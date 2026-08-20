ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy_eagleeval';

-- migrate:split

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

-- migrate:split

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- migrate:split

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS submission_fingerprint text;

-- migrate:split

ALTER TABLE reviews
  ALTER COLUMN source_snapshot DROP NOT NULL;

-- migrate:split

ALTER TABLE review_metrics
  ALTER COLUMN source_snapshot DROP NOT NULL;

-- migrate:split

CREATE UNIQUE INDEX IF NOT EXISTS reviews_submission_fingerprint_idx
  ON reviews (submission_fingerprint)
  WHERE submission_fingerprint IS NOT NULL;

-- migrate:split

CREATE INDEX IF NOT EXISTS reviews_public_archive_idx
  ON reviews (published, submitted_at DESC, semester DESC);

-- migrate:split

CREATE OR REPLACE VIEW course_summaries AS
SELECT
  c.id,
  c.code,
  c.title,
  c.subject,
  c.college,
  c.description,
  COALESCE(review_totals.review_count, 0)::integer AS review_count,
  review_totals.course_overall,
  review_totals.instructor_overall,
  COALESCE(comment_totals.comment_count, 0)::integer AS comment_count
FROM courses c
LEFT JOIN (
  SELECT
    course_id,
    count(*) AS review_count,
    avg(course_overall)::numeric(4, 2) AS course_overall,
    avg(instructor_overall)::numeric(4, 2) AS instructor_overall
  FROM reviews
  WHERE published AND course_id IS NOT NULL
  GROUP BY course_id
) review_totals ON review_totals.course_id = c.id
LEFT JOIN (
  SELECT course_id, count(*) AS comment_count
  FROM student_comments
  WHERE published AND course_id IS NOT NULL
  GROUP BY course_id
) comment_totals ON comment_totals.course_id = c.id;

-- migrate:split

CREATE OR REPLACE VIEW professor_summaries AS
SELECT
  p.id,
  p.name,
  p.titles,
  p.education,
  p.phone,
  p.email,
  p.office,
  p.photo_url,
  COALESCE(review_totals.review_count, 0)::integer AS review_count,
  review_totals.course_overall,
  review_totals.instructor_overall,
  COALESCE(comment_totals.comment_count, 0)::integer AS comment_count
FROM professors p
LEFT JOIN (
  SELECT
    professor_id,
    count(*) AS review_count,
    avg(course_overall)::numeric(4, 2) AS course_overall,
    avg(instructor_overall)::numeric(4, 2) AS instructor_overall
  FROM reviews
  WHERE published AND professor_id IS NOT NULL
  GROUP BY professor_id
) review_totals ON review_totals.professor_id = p.id
LEFT JOIN (
  SELECT professor_id, count(*) AS comment_count
  FROM student_comments
  WHERE published
  GROUP BY professor_id
) comment_totals ON comment_totals.professor_id = p.id;
