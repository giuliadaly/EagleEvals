import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const RMP_BC_SCHOOL = 'U2Nob29sLTEyMg==';
const verified = new Map([[2712447, { id: '65c42b4a49939741c67c7693', name: 'Jeffrey Lucas' }]]);
const recordId = (kind, id) => typeof id === 'string' && new RegExp(`^${kind}-\\d+$`).test(Buffer.from(id, 'base64').toString('utf8'));

export function normalizedName(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/^(?:dr\.?|prof\.?|professor)\s+/, '')
    .replace(/(?:,?\s+)(?:jr\.?|sr\.?|ii|iii|iv)$/, '')
    .replace(/[’'\.\-]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function normalizedCourse(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function shortName(value) {
  const words = normalizedName(value).split(' ');
  return words.length >= 2 ? `${words[0]} ${words.at(-1)}` : '';
}

function middleCompatible(a, b) {
  const middle = name => normalizedName(name).split(' ').slice(1, -1).map(word => word[0]).join('');
  return !middle(a) || !middle(b) || middle(a) === middle(b);
}

export function matchRecoveredProfessor(teacher, professors, teachers) {
  const name = `${teacher.firstName.trim()} ${teacher.lastName.trim()}`;
  const override = verified.get(teacher.legacyId);
  if (override && professors.some(p => p.id === override.id && normalizedName(p.name) === normalizedName(override.name))) {
    return { professorId: override.id, method: 'verified_alias' };
  }
  const exact = professors.filter(p => normalizedName(p.name) === normalizedName(name));
  const sourceExact = teachers.filter(p => normalizedName(`${p.firstName} ${p.lastName}`) === normalizedName(name));
  if (exact.length === 1 && sourceExact.length === 1) return { professorId: exact[0].id, method: 'exact_name' };
  const short = shortName(name);
  const local = professors.filter(p => shortName(p.name) === short && middleCompatible(p.name, name));
  const remote = teachers.filter(p => shortName(`${p.firstName} ${p.lastName}`) === short && middleCompatible(`${p.firstName} ${p.lastName}`, name));
  if (local.length === 1 && remote.length === 1) return { professorId: local[0].id, method: 'unique_name_middle_compatible' };
  return { professorId: null, method: local.length || exact.length ? 'ambiguous_name' : 'no_local_match' };
}

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
  if (!manifest.complete || manifest.failed.length || manifest.schoolId !== RMP_BC_SCHOOL
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
    if (!saved.complete || saved.pages < 1 || saved.teacher.id !== teacher.id || saved.teacher.school.id !== RMP_BC_SCHOOL
      || saved.reviews.length !== saved.returnedRatingCount) throw new Error('Incomplete profile recovery');
    snapshots.push(saved);
  }
  return { manifest, snapshots, sha256: digest.digest('hex'), snapshotId: `rmp-bc-${manifest.completedAt}` };
}

export function prepareRmpImport(snapshot, professors, courses) {
  const teachers = snapshot.snapshots.map(p => p.teacher);
  const courseKeys = new Map();
  for (const course of courses) {
    const key = normalizedCourse(course.code);
    courseKeys.set(key, [...(courseKeys.get(key) ?? []), course]);
  }
  const profiles = [];
  const reviews = [];
  const seen = new Set();
  const coverage = { profiles: teachers.length, linkedProfiles: 0, unlinkedProfiles: 0, ratingRecords: 0,
    writtenReviews: 0, courseLinkedWrittenReviews: 0, professorLinkedWrittenReviews: 0, ambiguousProfiles: 0 };
  for (const saved of snapshot.snapshots) {
    const p = saved.teacher;
    const match = matchRecoveredProfessor(p, professors, teachers);
    if (match.professorId) coverage.linkedProfiles++; else coverage.unlinkedProfiles++;
    if (match.method === 'ambiguous_name') coverage.ambiguousProfiles++;
    profiles.push({ source_teacher_id: p.id, legacy_teacher_id: p.legacyId, school_id: RMP_BC_SCHOOL,
      display_name: `${p.firstName.trim()} ${p.lastName.trim()}`, department: p.department || null,
      professor_id: match.professorId, match_method: match.method, reported_rating_count: saved.reportedRatingCount,
      source_document: p, fetched_at: saved.fetchedAt });
    for (const r of saved.reviews) {
      if (!recordId('Rating', r.id) || seen.has(r.id) || typeof r.comment !== 'string') throw new Error('Invalid or conflicting source review');
      seen.add(r.id);
      const rawCourse = typeof r.class === 'string' ? r.class : null;
      const candidates = courseKeys.get(normalizedCourse(rawCourse)) ?? [];
      const courseId = candidates.length === 1 ? candidates[0].id : null;
      const written = Boolean(r.comment.trim());
      coverage.ratingRecords++;
      if (written) {
        coverage.writtenReviews++;
        if (courseId) coverage.courseLinkedWrittenReviews++;
        if (match.professorId) coverage.professorLinkedWrittenReviews++;
      }
      reviews.push({ source_review_id: r.id, source_teacher_id: p.id, course_id: courseId, course_code: rawCourse,
        message: r.comment, would_take_again: r.wouldTakeAgain === 'Yes' ? true : r.wouldTakeAgain === 'No' ? false : null,
        created_at: postedAt(r.date), source_document: r, fetched_at: saved.fetchedAt });
    }
  }
  if (coverage.ratingRecords !== snapshot.manifest.ratings || coverage.writtenReviews !== snapshot.manifest.writtenReviews) throw new Error('Snapshot count verification failed');
  return { profiles, reviews, coverage };
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
  (source_review_id,source_teacher_id,course_id,course_code,message,would_take_again,created_at,source_document,source_snapshot,fetched_at,published)
  SELECT source_review_id,source_teacher_id,course_id,course_code,message,would_take_again,created_at,source_document,$2,fetched_at,false
  FROM jsonb_to_recordset($1::jsonb) AS x(source_review_id text,source_teacher_id text,course_id text,course_code text,message text,
    would_take_again boolean,created_at timestamptz,source_document jsonb,fetched_at timestamptz)
  ON CONFLICT(source_review_id) DO UPDATE SET source_teacher_id=EXCLUDED.source_teacher_id,course_id=EXCLUDED.course_id,
    course_code=EXCLUDED.course_code,message=EXCLUDED.message,would_take_again=EXCLUDED.would_take_again,created_at=EXCLUDED.created_at,
    source_document=EXCLUDED.source_document,source_snapshot=EXCLUDED.source_snapshot,fetched_at=EXCLUDED.fetched_at`;
