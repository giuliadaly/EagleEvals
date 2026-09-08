-- Link future written reviews to their evaluation so the semester is reliable.
-- Historical comments stay unlinked; do not infer a semester from their post date.
ALTER TABLE student_comments
  ADD COLUMN IF NOT EXISTS review_id text REFERENCES reviews(id);

-- migrate:split

CREATE UNIQUE INDEX IF NOT EXISTS student_comments_review_id_idx
  ON student_comments (review_id) WHERE review_id IS NOT NULL;
