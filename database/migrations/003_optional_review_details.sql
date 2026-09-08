-- Unanswered details stay unknown; existing review values are preserved.
ALTER TABLE reviews
  ALTER COLUMN section DROP NOT NULL,
  ALTER COLUMN section_code DROP NOT NULL;

-- migrate:split

ALTER TABLE student_comments
  ALTER COLUMN would_take_again DROP NOT NULL;
