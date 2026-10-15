import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {matchRecoveredProfessor, verifiedNativeAliases, sourceProfessorId, matchReviewCourse, sourceCourseException} from './review-associations.mjs';
export {normalizedName, normalizedCourse, matchRecoveredProfessor} from './review-associations.mjs';

export const RMP_BC_SCHOOL = 'U2Nob29sLTEyMg==';
const recordId = (kind, id) => typeof id === 'string' && new RegExp(`^${kind}-\\d+$`).test(Buffer.from(id, 'base64').toString('utf8'));

function postedAt(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2}) UTC$/);
  const parsed = match ? Date.parse(`${match[1]}T${match[2]}${match[3]}:${match[4]}`) : NaN;
  if (!Number.isFinite(parsed)) throw new Error('Invalid source posting date; original snapshot must be inspected');
  return new Date(parsed).toISOString();
}

export async function loadRmpSnapshot(root) {
  const manifestBytes = await readFile(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const indexBytes = await readFile(path.join(root, 'teachers.json'));
  const index = JSON.parse(indexBytes);
  if (!manifest.complete || !Number.isFinite(Date.parse(manifest.completedAt)) || manifest.failed.length || manifest.schoolId !== RMP_BC_SCHOOL
    || !index.indexCountMatches || index.profiles.length !== manifest.indexedProfiles
    || manifest.completedProfiles !== manifest.indexedProfiles) throw new Error('Recovery snapshot is incomplete');
  const digest = createHash('sha256').update(manifestBytes).update(indexBytes);
  const snapshots = [];
  const ids = new Set();
  for (const teacher of index.profiles) {
    if (teacher.school.id !== RMP_BC_SCHOOL || !recordId('Teacher', teacher.id)
      || !Number.isSafeInteger(teacher.legacyId) || teacher.legacyId <= 0 || ids.has(teacher.id)
      || Buffer.from(teacher.id, 'base64').toString() !== `Teacher-${teacher.legacyId}`) throw new Error('Invalid or duplicated source profile');
    ids.add(teacher.id);
    const bytes = await readFile(path.join(root, 'profiles', `${teacher.legacyId}.json.gz`));
    digest.update(bytes);
    const saved = JSON.parse(gunzipSync(bytes));
    if (!saved.complete || !Number.isFinite(Date.parse(saved.fetchedAt)) || saved.pages < 1 || saved.teacher.id !== teacher.id || saved.teacher.school.id !== RMP_BC_SCHOOL
      || saved.reviews.length !== saved.returnedRatingCount) throw new Error('Incomplete profile recovery');
    snapshots.push(saved);
  }
  return { manifest, snapshots, sha256: digest.digest('hex'), snapshotId: `rmp-bc-${manifest.completedAt}` };
}

export function prepareRmpImport(snapshot, professors, courses, context = {}) {
  const teachers = snapshot.snapshots.map(p => p.teacher);
  const catalogProfiles = [];
  const nativeAliases = verifiedNativeAliases(professors);
  const canonicalIds = new Map(nativeAliases.map(a => [a.aliasId,a.canonicalId]));
  const relationships = context.relationships ?? [];
  const profiles = [];
  const reviews = [];
  const seen = new Set();
  const coverage = { profiles: teachers.length, linkedProfiles: 0, unlinkedProfiles: 0, ratingRecords: 0,
    writtenReviews: 0, courseLinkedWrittenReviews: 0, professorLinkedWrittenReviews: 0, ambiguousProfiles: 0, archiveProfiles: 0, sectionCodeLinks: 0, contextualCourseLinks: 0, otherCampusReviews: 0, historicalCourseLinks: 0, conflictingCourseLabels: 0 };
  for (const saved of snapshot.snapshots) {
    const p = saved.teacher;
    const match = matchRecoveredProfessor(p, professors, teachers);
    const ambiguous = match.method === 'ambiguous_name';
    if (!match.professorId && context.catalogProfiles && saved.reviews.some(r => r.comment.trim())) {
      const id = sourceProfessorId(p.legacyId);
      const existing = professors.find(q => q.id === id);
      if (existing && existing.catalog_source !== 'external_rmp') throw Error('Imported professor ID conflicts with an original catalog record');
      catalogProfiles.push({id,name:`${p.firstName.trim()} ${p.lastName.trim()}`,titles:[p.department ? `${p.department} · Review archive` : 'Boston College review archive']});
      match.professorId = id;
      match.method = 'source_archive_profile';
      coverage.archiveProfiles++;
    }
    if (match.professorId) coverage.linkedProfiles++; else coverage.unlinkedProfiles++;
    if (ambiguous) coverage.ambiguousProfiles++;
    profiles.push({ source_teacher_id: p.id, legacy_teacher_id: p.legacyId, school_id: RMP_BC_SCHOOL,
      display_name: `${p.firstName.trim()} ${p.lastName.trim()}`, department: p.department || null,
      professor_id: match.professorId, match_method: match.method, reported_rating_count: saved.reportedRatingCount,
      source_document: p, fetched_at: saved.fetchedAt });
    const knownCourses = relationships.filter(r => (canonicalIds.get(r.professor_id) ?? r.professor_id) === match.professorId).map(r => r.course_id);
    for (const r of saved.reviews) {
      if (!recordId('Rating', r.id) || seen.has(r.id) || typeof r.comment !== 'string') throw new Error('Invalid or conflicting source review');
      seen.add(r.id);
      const rawCourse = typeof r.class === 'string' ? r.class : null;
      const exception = sourceCourseException(p,r);
      const courseMatch = exception ? {courseId:null,method:exception.method??'other_campus_experience'} : matchReviewCourse(rawCourse,courses,knownCourses,p.legacyId);
      const courseId = courseMatch.courseId;
      const written = Boolean(r.comment.trim());
      coverage.ratingRecords++;
      if (written) {
        coverage.writtenReviews++;
        if (courseId) coverage.courseLinkedWrittenReviews++;
        if (match.professorId) coverage.professorLinkedWrittenReviews++;
        if (courseMatch.method === 'course_section_code') coverage.sectionCodeLinks++;
        if (['unique_professor_course_number','professor_course_prefix_variant','exact_professor_course_title'].includes(courseMatch.method)) coverage.contextualCourseLinks++;
        if (courseMatch.method === 'verified_historical_course_code') coverage.historicalCourseLinks++;
        if (courseMatch.method === 'other_campus_experience') coverage.otherCampusReviews++;
        if (courseMatch.method === 'source_course_conflict') coverage.conflictingCourseLabels++;
      }
      reviews.push({ source_review_id: r.id, source_teacher_id: p.id, course_id: courseId, course_code: rawCourse,
        message: r.comment, would_take_again: r.wouldTakeAgain === 'Yes' ? true : r.wouldTakeAgain === 'No' ? false : null,
        created_at: postedAt(r.date), source_document: r, fetched_at: saved.fetchedAt,
        course_match_method: courseMatch.method, context_note: exception?.note ?? null });
    }
  }
  if (coverage.ratingRecords !== snapshot.manifest.ratings || coverage.writtenReviews !== snapshot.manifest.writtenReviews) throw new Error('Snapshot count verification failed');
  return { profiles, reviews, coverage, catalogProfiles, nativeAliases };
}

export const UPSERT_PROFILES = `INSERT INTO external_review_profiles
  (source_teacher_id,legacy_teacher_id,school_id,display_name,department,professor_id,match_method,reported_rating_count,source_document,source_snapshot,fetched_at)
  SELECT source_teacher_id,legacy_teacher_id,school_id,display_name,department,professor_id,match_method,reported_rating_count,source_document,$2,fetched_at
  FROM jsonb_to_recordset($1::jsonb) AS x(source_teacher_id text,legacy_teacher_id integer,school_id text,display_name text,department text,
    professor_id text,match_method text,reported_rating_count integer,source_document jsonb,fetched_at timestamptz)
  ON CONFLICT(source_teacher_id) DO UPDATE SET display_name=EXCLUDED.display_name,department=EXCLUDED.department,
    professor_id=EXCLUDED.professor_id,match_method=EXCLUDED.match_method,reported_rating_count=EXCLUDED.reported_rating_count,
    source_document=EXCLUDED.source_document,source_snapshot=EXCLUDED.source_snapshot,fetched_at=EXCLUDED.fetched_at`;

export const UPSERT_REVIEWS = `INSERT INTO external_reviews
  (source_review_id,source_teacher_id,course_id,course_code,message,would_take_again,created_at,source_document,source_snapshot,fetched_at,published,course_match_method,context_note)
  SELECT source_review_id,source_teacher_id,course_id,course_code,message,would_take_again,created_at,source_document,$2,fetched_at,false,course_match_method,context_note
  FROM jsonb_to_recordset($1::jsonb) AS x(source_review_id text,source_teacher_id text,course_id text,course_code text,message text,
    would_take_again boolean,created_at timestamptz,source_document jsonb,fetched_at timestamptz,course_match_method text,context_note text)
  ON CONFLICT(source_review_id) DO UPDATE SET source_teacher_id=EXCLUDED.source_teacher_id,course_id=EXCLUDED.course_id,
    course_code=EXCLUDED.course_code,message=EXCLUDED.message,would_take_again=EXCLUDED.would_take_again,created_at=EXCLUDED.created_at,
    source_document=EXCLUDED.source_document,source_snapshot=EXCLUDED.source_snapshot,fetched_at=EXCLUDED.fetched_at,course_match_method=EXCLUDED.course_match_method,context_note=EXCLUDED.context_note`;
