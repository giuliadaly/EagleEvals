-- Owner operations keep source records intact. These tables are never public API data.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'legacy_eagleeval'
  CHECK (catalog_source IN ('legacy_eagleeval','historical_archive'));
-- migrate:split
ALTER TABLE courses ADD COLUMN IF NOT EXISTS catalog_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
-- migrate:split
ALTER TABLE anonymous_reports ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version > 0);
-- migrate:split
ALTER TABLE anonymous_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- migrate:split
CREATE TABLE IF NOT EXISTS review_association_overrides (
  review_id text PRIMARY KEY,
  native_comment_id text UNIQUE REFERENCES student_comments(id),
  external_review_id text UNIQUE REFERENCES external_reviews(source_review_id),
  professor_id text NOT NULL REFERENCES professors(id),
  course_id text REFERENCES courses(id),
  context_note text CHECK (char_length(context_note) <= 2000),
  context_note_replaced boolean NOT NULL DEFAULT false,
  version integer NOT NULL CHECK (version > 0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  evidence_url text NOT NULL CHECK (char_length(evidence_url) <= 2048 AND evidence_url ~ '^https?://[^[:space:]]+$'),
  actor_github_id text NOT NULL CHECK (actor_github_id ~ '^[0-9]+$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((native_comment_id IS NOT NULL AND external_review_id IS NULL AND review_id=native_comment_id)
    OR (native_comment_id IS NULL AND external_review_id IS NOT NULL AND review_id='rmp:' || external_review_id))
);
-- migrate:split
CREATE TABLE IF NOT EXISTS owner_actions (
  action_id text PRIMARY KEY CHECK (action_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{32}$'),
  actor_github_id text NOT NULL CHECK (actor_github_id ~ '^[0-9]+$'),
  action_kind text NOT NULL CHECK (action_kind IN ('report-status','review-association')),
  target_id text NOT NULL,
  reason text NOT NULL,
  evidence_url text,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- migrate:split
CREATE INDEX IF NOT EXISTS owner_actions_recent_idx ON owner_actions(created_at DESC);
-- migrate:split
CREATE OR REPLACE FUNCTION reject_owner_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Owner audit records are append-only' USING ERRCODE='P0403';
END $$;
-- migrate:split
DROP TRIGGER IF EXISTS owner_actions_append_only ON owner_actions;
-- migrate:split
CREATE TRIGGER owner_actions_append_only BEFORE UPDATE OR DELETE ON owner_actions
  FOR EACH ROW EXECUTE FUNCTION reject_owner_audit_mutation();
-- migrate:split
CREATE TABLE IF NOT EXISTS owner_growth_baselines (
  id text PRIMARY KEY,
  measured_at timestamptz NOT NULL,
  dataset jsonb NOT NULL CHECK (jsonb_typeof(dataset)='object'
    AND dataset ?& ARRAY['id','measuredAt','traffic','speedInsights','searchConsole','sources']
    AND jsonb_typeof(dataset->'id')='string' AND dataset->>'id'=id
    AND jsonb_typeof(dataset->'measuredAt')='string' AND (dataset->>'measuredAt')::timestamptz=measured_at
    AND jsonb_typeof(dataset->'traffic')='object' AND jsonb_typeof(dataset->'speedInsights')='object'
    AND jsonb_typeof(dataset->'searchConsole')='object' AND jsonb_typeof(dataset->'sources')='array'),
  installed_by_github_id text NOT NULL CHECK (installed_by_github_id ~ '^[0-9]+$'),
  installed_at timestamptz NOT NULL DEFAULT now()
);
-- migrate:split
CREATE OR REPLACE VIEW public_rating_records AS
SELECT r.id,
  CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE r.course_id END AS course_id,
  COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE r.professor_id END) AS professor_id,
  r.section_code,
  CASE WHEN o.review_id IS NOT NULL THEN COALESCE(c.code,r.course_code) ELSE r.course_code END AS course_code,
  CASE WHEN o.review_id IS NOT NULL THEN p.name ELSE r.professor_name END AS professor_name,
  r.semester,r.section,r.course_overall,r.instructor_overall,r.legacy_document,r.source_snapshot,
  r.imported_at,r.source,r.published,r.submitted_at,r.submission_fingerprint
FROM reviews r
LEFT JOIN student_comments sc ON sc.review_id=r.id
LEFT JOIN review_association_overrides o ON o.native_comment_id=sc.id
LEFT JOIN professor_aliases a ON a.alias_id=CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE r.professor_id END
LEFT JOIN professors p ON p.id=COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE r.professor_id END)
LEFT JOIN courses c ON c.id=CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE r.course_id END;
-- migrate:split
CREATE OR REPLACE VIEW public_written_reviews AS
SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
  r.semester AS review_semester,
  COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE sc.professor_id END) AS professor_id,
  p.name AS professor_name,
  CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE sc.course_id END AS course_id,
  c.code AS course_code, c.title AS course_title,
  NULL::text AS source_url, NULL::text AS source_professor_id, true AS published,
  CASE WHEN o.context_note_replaced THEN o.context_note ELSE NULL::text END AS context_note
FROM student_comments sc
LEFT JOIN review_association_overrides o ON o.native_comment_id=sc.id
LEFT JOIN professor_aliases a ON a.alias_id=CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE sc.professor_id END
JOIN professors p ON p.id=COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE sc.professor_id END)
LEFT JOIN courses c ON c.id=CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE sc.course_id END
LEFT JOIN reviews r ON r.id=sc.review_id AND r.published
  AND r.course_id=sc.course_id AND r.professor_id=sc.professor_id
WHERE sc.published
UNION ALL
SELECT 'rmp:' || er.source_review_id, er.message, er.would_take_again, er.created_at,
  'ratemyprofessors'::text, NULL::text,
  COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE ep.professor_id END),
  COALESCE(p.name,ep.display_name), CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE er.course_id END,
  CASE WHEN o.review_id IS NOT NULL THEN c.code ELSE COALESCE(c.code,er.course_code) END, c.title,
  'https://www.ratemyprofessors.com/professor/' || ep.legacy_teacher_id,
  ep.legacy_teacher_id::text, true,
  CASE WHEN o.context_note_replaced THEN o.context_note ELSE er.context_note END
FROM external_reviews er
JOIN external_review_profiles ep ON ep.source_teacher_id=er.source_teacher_id
LEFT JOIN review_association_overrides o ON o.external_review_id=er.source_review_id
LEFT JOIN professor_aliases a ON a.alias_id=CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE ep.professor_id END
LEFT JOIN professors p ON p.id=COALESCE(a.canonical_id,CASE WHEN o.review_id IS NOT NULL THEN o.professor_id ELSE ep.professor_id END)
LEFT JOIN courses c ON c.id=CASE WHEN o.review_id IS NOT NULL THEN o.course_id ELSE er.course_id END
WHERE er.published AND char_length(btrim(er.message))>0;
-- migrate:split
CREATE OR REPLACE VIEW course_summaries AS
SELECT c.id,c.code,c.title,c.subject,c.college,c.description,
  COALESCE(rt.review_count,0)::integer AS review_count,rt.course_overall,rt.instructor_overall,
  COALESCE(ct.comment_count,0)::integer AS comment_count,c.catalog_source,c.catalog_evidence
FROM courses c
LEFT JOIN (SELECT course_id,count(*) AS review_count,avg(course_overall)::numeric(4,2) AS course_overall,
  avg(instructor_overall)::numeric(4,2) AS instructor_overall FROM public_rating_records
  WHERE published AND course_id IS NOT NULL GROUP BY course_id) rt ON rt.course_id=c.id
LEFT JOIN (SELECT course_id,count(*) AS comment_count FROM public_written_reviews
  WHERE course_id IS NOT NULL GROUP BY course_id) ct ON ct.course_id=c.id;
-- migrate:split
CREATE OR REPLACE FUNCTION owner_review_state(selected_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('id',w.id,'message',w.message,'source',w.source,
    'professorId',w.professor_id,'professorName',w.professor_name,'courseId',w.course_id,
    'courseCode',w.course_code,'courseTitle',w.course_title,'contextNote',w.context_note,
    'createdAt',w.created_at,'reviewSemester',w.review_semester,'sourceUrl',w.source_url,
    'sourceProfessorId',w.source_professor_id,'overrideVersion',COALESCE(o.version,0),'pairedRatingId',pr.id,
    'fingerprint',md5(to_jsonb(w)::text || ':' || COALESCE(o.version,0)::text || ':' ||
      jsonb_build_object('id',pr.id,'courseId',pr.course_id,'professorId',pr.professor_id)::text))
  FROM public_written_reviews w LEFT JOIN review_association_overrides o ON o.review_id=w.id
  LEFT JOIN student_comments sc ON sc.id=w.id LEFT JOIN public_rating_records pr ON pr.id=sc.review_id
  WHERE w.id=selected_id
$$;
-- migrate:split
CREATE OR REPLACE FUNCTION owner_report_state(selected_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('id',id,'targetKind',target_kind,'targetId',target_id,'reason',reason,
    'message',message,'status',status,'createdAt',created_at,'resolvedAt',resolved_at,
    'version',version,'updatedAt',updated_at) FROM anonymous_reports WHERE id=selected_id
$$;
-- migrate:split
CREATE OR REPLACE FUNCTION owner_change_report_status(
  selected_action text,actor text,selected_report text,next_status text,expected_version integer,change_reason text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE request_digest text; saved owner_actions%ROWTYPE; before_value jsonb; after_value jsonb; response jsonb;
BEGIN
  IF actor IS NULL OR actor !~ '^[0-9]+$' OR selected_action IS NULL OR selected_action !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR next_status IS NULL OR next_status NOT IN ('open','resolved','dismissed')
    OR change_reason IS NULL OR char_length(btrim(change_reason)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Invalid owner action' USING ERRCODE='P0400';
  END IF;
  request_digest:=md5(jsonb_build_object('actor',actor,'kind','report-status','report',selected_report,
    'status',next_status,'version',expected_version,'reason',change_reason)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('owner-action:' || selected_action,0));
  SELECT * INTO saved FROM owner_actions WHERE action_id=selected_action;
  IF FOUND THEN
    IF saved.request_hash<>request_digest OR saved.actor_github_id<>actor THEN
      RAISE EXCEPTION 'Action ID already used for another request' USING ERRCODE='P0409';
    END IF;
    RETURN saved.result || jsonb_build_object('replayed',true);
  END IF;
  PERFORM id FROM anonymous_reports WHERE id=selected_report FOR UPDATE;
  before_value:=owner_report_state(selected_report);
  IF before_value IS NULL THEN RAISE EXCEPTION 'Report not found' USING ERRCODE='P0404'; END IF;
  IF expected_version IS NULL OR (before_value->>'version')::integer<>expected_version THEN
    RAISE EXCEPTION 'Report changed; reload before saving' USING ERRCODE='P0409';
  END IF;
  UPDATE anonymous_reports SET status=next_status,version=version+1,updated_at=now(),
    resolved_at=CASE WHEN next_status='open' THEN NULL ELSE now() END WHERE id=selected_report;
  after_value:=owner_report_state(selected_report);
  response:=jsonb_build_object('actionId',selected_action,'replayed',false,'report',after_value);
  INSERT INTO owner_actions(action_id,request_hash,actor_github_id,action_kind,target_id,reason,before_state,after_state,result)
    VALUES(selected_action,request_digest,actor,'report-status',selected_report,change_reason,before_value,after_value,response);
  RETURN response;
END $$;
-- migrate:split
CREATE OR REPLACE FUNCTION owner_correct_review_association(
  selected_action text,actor text,selected_review text,expected_fingerprint text,
  selected_professor text,selected_course text,change_reason text,evidence text,
  replace_note boolean DEFAULT false,replacement_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE request_digest text; saved owner_actions%ROWTYPE; prior_override review_association_overrides%ROWTYPE;
  before_value jsonb; after_value jsonb; response jsonb; native_id text; external_id text;
BEGIN
  IF actor IS NULL OR actor !~ '^[0-9]+$' OR selected_action IS NULL OR selected_action !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR change_reason IS NULL OR char_length(btrim(change_reason)) NOT BETWEEN 10 AND 2000
    OR evidence IS NULL OR char_length(evidence)>2048 OR evidence !~ '^https?://[^[:space:]]+$'
    OR replace_note IS NULL OR char_length(replacement_note)>2000 THEN
    RAISE EXCEPTION 'Invalid owner correction' USING ERRCODE='P0400';
  END IF;
  request_digest:=md5(jsonb_build_object('actor',actor,'kind','review-association','review',selected_review,
    'fingerprint',expected_fingerprint,'professor',selected_professor,'course',selected_course,'reason',change_reason,
    'evidence',evidence,'replaceNote',replace_note,'note',replacement_note)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('owner-action:' || selected_action,0));
  SELECT * INTO saved FROM owner_actions WHERE action_id=selected_action;
  IF FOUND THEN
    IF saved.request_hash<>request_digest OR saved.actor_github_id<>actor THEN
      RAISE EXCEPTION 'Action ID already used for another request' USING ERRCODE='P0409';
    END IF;
    RETURN saved.result || jsonb_build_object('replayed',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('owner-review:' || selected_review,0));
  IF left(selected_review,4)='rmp:' THEN
    SELECT source_review_id INTO external_id FROM external_reviews WHERE source_review_id=substr(selected_review,5) FOR UPDATE;
    -- Refreshes may update the source profile link independently of its review.
    PERFORM ep.source_teacher_id FROM external_review_profiles ep
      JOIN external_reviews er ON er.source_teacher_id=ep.source_teacher_id
      WHERE er.source_review_id=external_id FOR UPDATE OF ep;
  ELSE
    SELECT id INTO native_id FROM student_comments WHERE id=selected_review FOR UPDATE;
    -- A paired numerical evaluation moves with this written experience.
    PERFORM r.id FROM reviews r JOIN student_comments sc ON sc.review_id=r.id
      WHERE sc.id=native_id FOR UPDATE OF r;
  END IF;
  before_value:=owner_review_state(selected_review);
  IF before_value IS NULL OR (native_id IS NULL AND external_id IS NULL) THEN
    RAISE EXCEPTION 'Published review not found' USING ERRCODE='P0404';
  END IF;
  IF expected_fingerprint IS NULL OR before_value->>'fingerprint'<>expected_fingerprint THEN
    RAISE EXCEPTION 'Review changed; reload before saving' USING ERRCODE='P0409';
  END IF;
  PERFORM id FROM professors WHERE id=selected_professor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Professor not found' USING ERRCODE='P0404'; END IF;
  IF selected_course IS NOT NULL THEN
    PERFORM id FROM courses WHERE id=selected_course FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='P0404'; END IF;
  END IF;
  SELECT * INTO prior_override FROM review_association_overrides WHERE review_id=selected_review;
  INSERT INTO review_association_overrides(review_id,native_comment_id,external_review_id,professor_id,course_id,
    context_note,context_note_replaced,version,reason,evidence_url,actor_github_id)
  VALUES(selected_review,native_id,external_id,selected_professor,selected_course,
    CASE WHEN replace_note THEN replacement_note ELSE prior_override.context_note END,
    CASE WHEN replace_note THEN true ELSE COALESCE(prior_override.context_note_replaced,false) END,
    COALESCE(prior_override.version,0)+1,change_reason,evidence,actor)
  ON CONFLICT(review_id) DO UPDATE SET professor_id=EXCLUDED.professor_id,course_id=EXCLUDED.course_id,
    context_note=EXCLUDED.context_note,context_note_replaced=EXCLUDED.context_note_replaced,
    version=EXCLUDED.version,reason=EXCLUDED.reason,evidence_url=EXCLUDED.evidence_url,
    actor_github_id=EXCLUDED.actor_github_id,updated_at=now();
  after_value:=owner_review_state(selected_review);
  response:=jsonb_build_object('actionId',selected_action,'replayed',false,'review',after_value);
  INSERT INTO owner_actions(action_id,request_hash,actor_github_id,action_kind,target_id,reason,evidence_url,before_state,after_state,result)
    VALUES(selected_action,request_digest,actor,'review-association',selected_review,change_reason,evidence,before_value,after_value,response);
  RETURN response;
END $$;
