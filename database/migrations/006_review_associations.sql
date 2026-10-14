ALTER TABLE professors ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'legacy_eagleeval'
  CHECK (catalog_source IN ('legacy_eagleeval','external_rmp'));
-- migrate:split
ALTER TABLE professors ADD COLUMN IF NOT EXISTS search_names text[] NOT NULL DEFAULT '{}';
-- migrate:split
CREATE TABLE IF NOT EXISTS professor_aliases (
  alias_id text PRIMARY KEY REFERENCES professors(id),
  canonical_id text NOT NULL REFERENCES professors(id),
  evidence jsonb NOT NULL,
  CHECK (alias_id <> canonical_id)
);
-- migrate:split
CREATE INDEX IF NOT EXISTS professor_alias_canonical_idx ON professor_aliases(canonical_id);
-- migrate:split
CREATE TABLE IF NOT EXISTS review_link_repairs (
  repair_key text PRIMARY KEY,
  review_id text NOT NULL REFERENCES reviews(id),
  field_name text NOT NULL CHECK (field_name IN ('course_id','professor_id')),
  previous_value text,
  next_value text NOT NULL,
  evidence jsonb NOT NULL,
  repaired_at timestamptz NOT NULL DEFAULT now()
);
-- migrate:split
CREATE OR REPLACE FUNCTION repair_archived_review_links(planned jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE total integer; valid integer;
BEGIN
  total := jsonb_array_length(planned);
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(planned) AS x("reviewId" text,field text,next text)
    WHERE field NOT IN ('course_id','professor_id') OR field IS NULL OR next IS NULL) THEN
    RAISE EXCEPTION 'Invalid link repair' USING ERRCODE='P0409';
  END IF;
  IF total <> (SELECT count(DISTINCT (x."reviewId",x.field)) FROM jsonb_to_recordset(planned) AS x("reviewId" text,field text)) THEN
    RAISE EXCEPTION 'Conflicting link repair' USING ERRCODE='P0409';
  END IF;
  PERFORM r.id FROM reviews r JOIN jsonb_to_recordset(planned) AS x("reviewId" text) ON r.id=x."reviewId" FOR UPDATE OF r;
  SELECT count(*) INTO valid FROM reviews r JOIN jsonb_to_recordset(planned) AS x("reviewId" text,field text) ON r.id=x."reviewId"
    WHERE (x.field='course_id' AND r.course_id IS NULL) OR (x.field='professor_id' AND r.professor_id IS NULL);
  IF valid <> total OR EXISTS (SELECT 1 FROM review_link_repairs l JOIN jsonb_to_recordset(planned) AS x("reviewId" text,field text)
    ON l.repair_key=x."reviewId" || ':' || x.field) THEN
    RAISE EXCEPTION 'Link repair precondition changed' USING ERRCODE='P0409';
  END IF;
  UPDATE reviews r SET professor_id=x.next FROM jsonb_to_recordset(planned) AS x("reviewId" text,field text,next text)
    WHERE r.id=x."reviewId" AND x.field='professor_id';
  UPDATE reviews r SET course_id=x.next FROM jsonb_to_recordset(planned) AS x("reviewId" text,field text,next text)
    WHERE r.id=x."reviewId" AND x.field='course_id';
  INSERT INTO review_link_repairs(repair_key,review_id,field_name,previous_value,next_value,evidence)
    SELECT x."reviewId" || ':' || x.field,x."reviewId",x.field,NULL,x.next,jsonb_build_object('method',x.method)
    FROM jsonb_to_recordset(planned) AS x("reviewId" text,field text,next text,method text);
  RETURN jsonb_build_object('professorLinks',(SELECT count(*) FROM jsonb_to_recordset(planned) AS x(field text) WHERE field='professor_id'),
    'courseLinks',(SELECT count(*) FROM jsonb_to_recordset(planned) AS x(field text) WHERE field='course_id'));
END $$;
-- migrate:split
ALTER TABLE external_reviews ADD COLUMN IF NOT EXISTS course_match_method text NOT NULL DEFAULT 'unmatched';
-- migrate:split
ALTER TABLE external_reviews ADD COLUMN IF NOT EXISTS context_note text;
-- migrate:split
CREATE OR REPLACE VIEW public_rating_records AS
SELECT r.id, r.course_id, COALESCE(a.canonical_id,r.professor_id) AS professor_id,
  r.section_code, r.course_code, r.professor_name, r.semester, r.section,
  r.course_overall, r.instructor_overall, r.legacy_document, r.source_snapshot,
  r.imported_at, r.source, r.published, r.submitted_at, r.submission_fingerprint
FROM reviews r LEFT JOIN professor_aliases a ON a.alias_id=r.professor_id;
-- migrate:split
CREATE OR REPLACE VIEW public_written_reviews AS
SELECT sc.id, sc.message, sc.would_take_again, sc.created_at, sc.source,
  r.semester AS review_semester, COALESCE(a.canonical_id,sc.professor_id) AS professor_id, p.name AS professor_name,
  sc.course_id, c.code AS course_code, c.title AS course_title,
  NULL::text AS source_url, NULL::text AS source_professor_id, true AS published,
  NULL::text AS context_note
FROM student_comments sc
LEFT JOIN professor_aliases a ON a.alias_id=sc.professor_id
JOIN professors p ON p.id=COALESCE(a.canonical_id,sc.professor_id)
LEFT JOIN courses c ON c.id=sc.course_id
LEFT JOIN reviews r ON r.id=sc.review_id AND r.published
  AND r.course_id=sc.course_id AND r.professor_id=sc.professor_id
WHERE sc.published
UNION ALL
SELECT 'rmp:' || er.source_review_id, er.message, er.would_take_again, er.created_at,
  'ratemyprofessors'::text, NULL::text, COALESCE(a.canonical_id,ep.professor_id),
  COALESCE(p.name,ep.display_name), er.course_id, COALESCE(c.code,er.course_code), c.title,
  'https://www.ratemyprofessors.com/professor/' || ep.legacy_teacher_id,
  ep.legacy_teacher_id::text, true, er.context_note
FROM external_reviews er
JOIN external_review_profiles ep ON ep.source_teacher_id=er.source_teacher_id
LEFT JOIN professor_aliases a ON a.alias_id=ep.professor_id
LEFT JOIN professors p ON p.id=COALESCE(a.canonical_id,ep.professor_id)
LEFT JOIN courses c ON c.id=er.course_id
WHERE er.published AND char_length(btrim(er.message))>0;
-- migrate:split
CREATE OR REPLACE VIEW professor_summaries AS
SELECT p.id,p.name,p.titles,p.education,p.phone,p.email,p.office,p.photo_url,
  COALESCE(rt.review_count,0)::integer AS review_count,rt.course_overall,rt.instructor_overall,
  COALESCE(ct.comment_count,0)::integer AS comment_count,p.catalog_source,p.search_names
FROM professors p
LEFT JOIN (SELECT professor_id,count(*) AS review_count,avg(course_overall)::numeric(4,2) AS course_overall,
  avg(instructor_overall)::numeric(4,2) AS instructor_overall FROM public_rating_records
  WHERE published AND professor_id IS NOT NULL GROUP BY professor_id) rt ON rt.professor_id=p.id
LEFT JOIN (SELECT professor_id,count(*) AS comment_count FROM public_written_reviews
  WHERE professor_id IS NOT NULL GROUP BY professor_id) ct ON ct.professor_id=p.id
WHERE NOT EXISTS(SELECT 1 FROM professor_aliases a WHERE a.alias_id=p.id);
