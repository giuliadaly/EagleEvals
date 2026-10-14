-- Keep external source IDs and documents separate from the native archive.
CREATE TABLE IF NOT EXISTS external_review_profiles (
  source_teacher_id text PRIMARY KEY,
  legacy_teacher_id integer NOT NULL UNIQUE CHECK (legacy_teacher_id > 0),
  school_id text NOT NULL CHECK (school_id = 'U2Nob29sLTEyMg=='),
  display_name text NOT NULL,
  department text,
  professor_id text REFERENCES professors(id),
  match_method text NOT NULL,
  reported_rating_count integer NOT NULL CHECK (reported_rating_count >= 0),
  source_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  fetched_at timestamptz NOT NULL
);

-- migrate:split

CREATE INDEX IF NOT EXISTS external_profile_professor_idx ON external_review_profiles(professor_id);

-- migrate:split

CREATE TABLE IF NOT EXISTS external_reviews (
  source_review_id text PRIMARY KEY,
  source_teacher_id text NOT NULL REFERENCES external_review_profiles(source_teacher_id),
  course_id text REFERENCES courses(id),
  course_code text,
  message text NOT NULL,
  would_take_again boolean,
  created_at timestamptz NOT NULL,
  published boolean NOT NULL DEFAULT true,
  source_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  fetched_at timestamptz NOT NULL
);

-- migrate:split

CREATE INDEX IF NOT EXISTS external_review_teacher_idx ON external_reviews(source_teacher_id, created_at DESC) WHERE published;

-- migrate:split

CREATE INDEX IF NOT EXISTS external_review_course_idx ON external_reviews(course_id, created_at DESC) WHERE published;

-- migrate:split

CREATE OR REPLACE VIEW public_written_reviews AS
SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
  r.semester AS review_semester, sc.professor_id, p.name AS professor_name,
  sc.course_id, c.code AS course_code, c.title AS course_title,
  NULL::text AS source_url, NULL::text AS source_professor_id, true AS published
FROM student_comments sc
JOIN professors p ON p.id = sc.professor_id
LEFT JOIN courses c ON c.id = sc.course_id
LEFT JOIN reviews r ON r.id = sc.review_id AND r.published
  AND r.course_id = sc.course_id AND r.professor_id = sc.professor_id
WHERE sc.published
UNION ALL
SELECT 'rmp:' || er.source_review_id, er.message, er.would_take_again, er.created_at,
  'ratemyprofessors'::text, NULL::text, ep.professor_id,
  COALESCE(p.name, ep.display_name), er.course_id,
  COALESCE(c.code, er.course_code), c.title,
  'https://www.ratemyprofessors.com/professor/' || ep.legacy_teacher_id,
  ep.legacy_teacher_id::text, true
FROM external_reviews er
JOIN external_review_profiles ep ON ep.source_teacher_id = er.source_teacher_id
LEFT JOIN professors p ON p.id = ep.professor_id
LEFT JOIN courses c ON c.id = er.course_id
WHERE er.published AND char_length(btrim(er.message)) > 0;

-- migrate:split

CREATE OR REPLACE VIEW course_summaries AS
SELECT c.id, c.code, c.title, c.subject, c.college, c.description,
  COALESCE(rt.review_count, 0)::integer AS review_count, rt.course_overall,
  rt.instructor_overall, COALESCE(ct.comment_count, 0)::integer AS comment_count
FROM courses c
LEFT JOIN (
  SELECT course_id, count(*) AS review_count,
    avg(course_overall)::numeric(4,2) AS course_overall,
    avg(instructor_overall)::numeric(4,2) AS instructor_overall
  FROM reviews WHERE published AND course_id IS NOT NULL GROUP BY course_id
) rt ON rt.course_id = c.id
LEFT JOIN (
  SELECT course_id, count(*) AS comment_count
  FROM public_written_reviews WHERE course_id IS NOT NULL GROUP BY course_id
) ct ON ct.course_id = c.id;

-- migrate:split

CREATE OR REPLACE VIEW professor_summaries AS
SELECT p.id, p.name, p.titles, p.education, p.phone, p.email, p.office, p.photo_url,
  COALESCE(rt.review_count, 0)::integer AS review_count, rt.course_overall,
  rt.instructor_overall, COALESCE(ct.comment_count, 0)::integer AS comment_count
FROM professors p
LEFT JOIN (
  SELECT professor_id, count(*) AS review_count,
    avg(course_overall)::numeric(4,2) AS course_overall,
    avg(instructor_overall)::numeric(4,2) AS instructor_overall
  FROM reviews WHERE published AND professor_id IS NOT NULL GROUP BY professor_id
) rt ON rt.professor_id = p.id
LEFT JOIN (
  SELECT professor_id, count(*) AS comment_count
  FROM public_written_reviews WHERE professor_id IS NOT NULL GROUP BY professor_id
) ct ON ct.professor_id = p.id;
