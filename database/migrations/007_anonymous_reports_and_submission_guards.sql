-- Reports are a private moderation queue, not public comments or identity records.
CREATE TABLE IF NOT EXISTS anonymous_reports (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  target_kind text NOT NULL CHECK (target_kind IN ('review', 'course', 'professor', 'site')),
  target_id text,
  reason text NOT NULL CHECK (reason IN ('incorrect-information', 'wrong-association', 'private-information', 'harassment', 'spam', 'other')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((target_kind = 'site' AND target_id IS NULL) OR (target_kind <> 'site' AND target_id IS NOT NULL))
);

-- migrate:split

CREATE INDEX IF NOT EXISTS anonymous_reports_queue_idx ON anonymous_reports(status, created_at);

-- migrate:split

CREATE INDEX IF NOT EXISTS anonymous_reports_recent_idx ON anonymous_reports(created_at DESC);

-- migrate:split

CREATE INDEX IF NOT EXISTS anonymous_reports_open_target_idx
  ON anonymous_reports(target_kind, target_id, reason) WHERE status = 'open';

-- migrate:split

CREATE INDEX IF NOT EXISTS anonymous_reviews_recent_pair_idx
  ON reviews(course_id, professor_id, submitted_at DESC)
  WHERE source = 'eagleevals_anonymous' AND published;

-- migrate:split

-- Transaction lock counts submissions by public course/professor, never by a person.
-- Call inside the same transaction as all three review INSERTs.
CREATE OR REPLACE FUNCTION guard_anonymous_review_submission(
  selected_course text, selected_professor text, selected_semester text, submitted_message text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE normalized text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('anonymous-review:' || selected_course || ':' || selected_professor, 0));
  IF (SELECT count(*) FROM (
    SELECT 1 FROM reviews WHERE source = 'eagleevals_anonymous' AND published
      AND course_id = selected_course AND professor_id = selected_professor
      AND submitted_at > now() - interval '1 minute' LIMIT 50
  ) recent) >= 50 THEN
    RAISE EXCEPTION 'Submission burst' USING ERRCODE = 'P0429';
  END IF;
  normalized := lower(regexp_replace(submitted_message, '[^[:alnum:]]', '', 'g'));
  IF EXISTS (
    SELECT 1 FROM (
      SELECT lower(regexp_replace(sc.message, '[^[:alnum:]]', '', 'g')) AS message
      FROM reviews r JOIN student_comments sc ON sc.review_id = r.id
      WHERE r.source = 'eagleevals_anonymous' AND r.published AND sc.published
        AND r.course_id = selected_course AND r.professor_id = selected_professor
        AND r.semester = selected_semester AND r.submitted_at > now() - interval '24 hours'
      ORDER BY r.submitted_at DESC LIMIT 100
    ) recent
    WHERE message = normalized OR (
      char_length(normalized) >= 80 AND char_length(message) >= 80
      AND abs(char_length(message) - char_length(normalized)) <= char_length(normalized) * 0.1
      AND similarity(message, normalized) >= 0.96
    )
  ) THEN
    RAISE EXCEPTION 'Duplicate review content' USING ERRCODE = '23505';
  END IF;
END $$;

-- migrate:split

-- One atomic operation validates the reference and bounds the private queue.
CREATE OR REPLACE FUNCTION submit_anonymous_report(
  report_id text, kind text, reference_id text, report_reason text, report_message text
) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('anonymous-report-queue', 0));
  IF (kind = 'review' AND NOT EXISTS (SELECT 1 FROM public_written_reviews WHERE id = reference_id))
    OR (kind = 'course' AND NOT EXISTS (SELECT 1 FROM courses WHERE id = reference_id))
    OR (kind = 'professor' AND NOT EXISTS (SELECT 1 FROM professors WHERE id = reference_id)) THEN
    RAISE EXCEPTION 'Unknown report target' USING ERRCODE = 'P0404';
  END IF;
  IF EXISTS (SELECT 1 FROM anonymous_reports WHERE status = 'open' AND target_kind = kind
    AND target_id IS NOT DISTINCT FROM reference_id AND reason = report_reason
    AND lower(regexp_replace(message, '[^[:alnum:]]', '', 'g')) = lower(regexp_replace(report_message, '[^[:alnum:]]', '', 'g'))) THEN
    RETURN 'duplicate';
  END IF;
  IF (SELECT count(*) FROM (
    SELECT 1 FROM anonymous_reports WHERE created_at > now() - interval '1 minute' LIMIT 120
  ) recent) >= 120 THEN
    RAISE EXCEPTION 'Report queue burst' USING ERRCODE = 'P0429';
  END IF;
  INSERT INTO anonymous_reports(id, target_kind, target_id, reason, message)
    VALUES (report_id, kind, reference_id, report_reason, report_message);
  RETURN 'created';
END $$;
