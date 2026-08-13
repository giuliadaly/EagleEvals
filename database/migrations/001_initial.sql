CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- migrate:split

CREATE TABLE IF NOT EXISTS migration_runs (
  snapshot_id text PRIMARY KEY,
  source_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('importing', 'verified', 'failed')),
  expected_counts jsonb NOT NULL,
  verification_manifest jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  subject text NOT NULL,
  college text,
  description text NOT NULL,
  legacy_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS professors (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  name text NOT NULL,
  titles text[] NOT NULL DEFAULT '{}',
  education text[] NOT NULL DEFAULT '{}',
  phone text,
  email text,
  office text,
  photo_url text,
  legacy_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  course_id text REFERENCES courses(id),
  professor_id text REFERENCES professors(id),
  section_code text NOT NULL,
  course_code text NOT NULL,
  professor_name text NOT NULL,
  semester text NOT NULL,
  section integer NOT NULL CHECK (section > 0),
  course_overall numeric(4, 2) CHECK (course_overall BETWEEN 1 AND 5),
  instructor_overall numeric(4, 2) CHECK (instructor_overall BETWEEN 1 AND 5),
  legacy_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS review_metrics (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  review_id text NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  attendance_necessary numeric(4, 2) CHECK (attendance_necessary BETWEEN 1 AND 5),
  available_for_help_outside_class numeric(4, 2) CHECK (available_for_help_outside_class BETWEEN 1 AND 5),
  course_intellectually_challenging numeric(4, 2) CHECK (course_intellectually_challenging BETWEEN 1 AND 5),
  course_well_organized numeric(4, 2) CHECK (course_well_organized BETWEEN 1 AND 5),
  instructor_clear_explanations numeric(4, 2) CHECK (instructor_clear_explanations BETWEEN 1 AND 5),
  instructor_prepared numeric(4, 2) CHECK (instructor_prepared BETWEEN 1 AND 5),
  stimulated_interest numeric(4, 2) CHECK (stimulated_interest BETWEEN 1 AND 5),
  assignments_helpful numeric(4, 2) CHECK (assignments_helpful BETWEEN 1 AND 5),
  effort_average_hours_weekly numeric(4, 2) CHECK (effort_average_hours_weekly BETWEEN 1 AND 5),
  legacy_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS student_comments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  professor_id text NOT NULL REFERENCES professors(id),
  course_id text REFERENCES courses(id),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
  would_take_again boolean NOT NULL,
  source text NOT NULL DEFAULT 'eagleevals',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  legacy_document jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot text REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE TABLE IF NOT EXISTS faculty_directory_entries (
  profile_path text PRIMARY KEY,
  source_school text NOT NULL,
  name text NOT NULL,
  first_name text,
  last_name text,
  title text,
  department text,
  phone text,
  email text,
  office text,
  profile_url text NOT NULL UNIQUE,
  source_name text NOT NULL,
  source_document jsonb NOT NULL,
  source_snapshot text NOT NULL REFERENCES migration_runs(snapshot_id),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:split

CREATE INDEX IF NOT EXISTS courses_search_trgm_idx
  ON courses USING gin ((lower(code || ' ' || title || ' ' || subject)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS courses_college_idx ON courses (college);
CREATE INDEX IF NOT EXISTS professors_search_trgm_idx
  ON professors USING gin ((lower(name || ' ' || array_to_string(titles, ' '))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS professors_email_idx ON professors (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_course_idx ON reviews (course_id, semester);
CREATE INDEX IF NOT EXISTS reviews_professor_idx ON reviews (professor_id, semester);
CREATE INDEX IF NOT EXISTS reviews_course_code_idx ON reviews (course_code);
CREATE INDEX IF NOT EXISTS comments_course_idx ON student_comments (course_id, created_at DESC) WHERE published;
CREATE INDEX IF NOT EXISTS comments_professor_idx ON student_comments (professor_id, created_at DESC) WHERE published;
CREATE INDEX IF NOT EXISTS faculty_name_trgm_idx
  ON faculty_directory_entries USING gin ((lower(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS faculty_email_idx
  ON faculty_directory_entries (lower(email)) WHERE email IS NOT NULL;

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
  WHERE course_id IS NOT NULL
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
  WHERE professor_id IS NOT NULL
  GROUP BY professor_id
) review_totals ON review_totals.professor_id = p.id
LEFT JOIN (
  SELECT professor_id, count(*) AS comment_count
  FROM student_comments
  WHERE published
  GROUP BY professor_id
) comment_totals ON comment_totals.professor_id = p.id;
