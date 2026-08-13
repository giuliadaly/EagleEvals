import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

export const archiveDefinitions = {
  courses: { file: 'courses.jsonl.gz', expectedCountKey: 'courses' },
  professors: { file: 'professors.jsonl.gz', expectedCountKey: 'professors' },
  reviews: { file: 'reviews.jsonl.gz', expectedCountKey: 'reviews' },
  reviewMetrics: { file: 'drilldowns.jsonl.gz', expectedCountKey: 'drilldowns' },
  comments: { file: 'comments.jsonl.gz', expectedCountKey: 'comments' },
  facultyDirectory: {
    file: 'current-faculty-directory.jsonl.gz',
    expectedCountKey: 'currentFacultyDirectory',
  },
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function sha256(filePath) {
  const body = await readFile(filePath);
  return createHash('sha256').update(body).digest('hex');
}

export async function readJsonlGzip(filePath) {
  const text = gunzipSync(await readFile(filePath)).toString('utf8').trim();
  if (!text) return [];
  return text.split('\n').map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${filePath} contains invalid JSON on line ${index + 1}: ${error.message}`);
    }
  });
}

function assertUniqueIds(records, label, key = '_id') {
  const seen = new Set();
  for (const record of records) {
    invariant(record[key], `${label} contains a record without ${key}`);
    invariant(!seen.has(record[key]), `${label} contains duplicate ${key} ${record[key]}`);
    seen.add(record[key]);
  }
  return seen;
}

function assertReferences(records, field, targets, label) {
  for (const record of records) {
    if (record[field] !== null && record[field] !== undefined) {
      invariant(targets.has(record[field]), `${label} references missing ${field} ${record[field]}`);
    }
  }
}

function assertRating(value, label) {
  if (value === null || value === undefined) return;
  invariant(typeof value === 'number' && value >= 1 && value <= 5, `${label} must be between 1 and 5`);
}

function validateRecords(records) {
  const courseIds = assertUniqueIds(records.courses, 'courses');
  const professorIds = assertUniqueIds(records.professors, 'professors');
  const reviewIds = assertUniqueIds(records.reviews, 'reviews');
  assertUniqueIds(records.reviewMetrics, 'review metrics');
  assertUniqueIds(records.comments, 'comments');
  assertUniqueIds(records.facultyDirectory, 'faculty directory', 'profilePath');

  assertReferences(records.reviews, 'course_id', courseIds, 'review');
  assertReferences(records.reviews, 'professor_id', professorIds, 'review');
  assertReferences(records.reviewMetrics, 'review_id', reviewIds, 'review metric');
  assertReferences(records.comments, 'course_id', courseIds, 'comment');
  assertReferences(records.comments, 'professor_id', professorIds, 'comment');

  for (const review of records.reviews) {
    invariant(typeof review.code === 'string' && review.code.length > 0, `review ${review._id} is missing code`);
    invariant(Number.isInteger(review.section) && review.section > 0, `review ${review._id} has invalid section`);
    assertRating(review.course_overall, `review ${review._id} course_overall`);
    assertRating(review.instructor_overall, `review ${review._id} instructor_overall`);
  }

  for (const comment of records.comments) {
    invariant(!Object.hasOwn(comment, 'user_id'), `comment ${comment._id} still contains user_id`);
    invariant(typeof comment.message === 'string' && comment.message.trim(), `comment ${comment._id} has no message`);
    invariant(Number.isFinite(Date.parse(comment.createdAt)), `comment ${comment._id} has invalid createdAt`);
  }

  for (const entry of records.facultyDirectory) {
    invariant(typeof entry.name === 'string' && entry.name.trim(), `faculty entry ${entry.profilePath} has no name`);
    invariant(entry.profileUrl?.startsWith('https://www.bc.edu/'), `faculty entry ${entry.profilePath} has invalid URL`);
  }
}

export async function loadAndValidateSnapshot(snapshotPath) {
  const absoluteSnapshotPath = path.resolve(snapshotPath);
  const verificationPath = path.join(absoluteSnapshotPath, 'manifests', 'verification.json');
  const inventoryPath = path.join(absoluteSnapshotPath, 'manifests', 'migration-inventory.json');
  const [verification, inventory] = await Promise.all([
    readJson(verificationPath),
    readJson(inventoryPath),
  ]);

  invariant(inventory.localDeletionStatus === 'blocked', 'Recovery snapshot is not marked as protected from deletion');
  invariant(verification.integrity?.privacy?.commentsContainingUserId === 0, 'Verification manifest reports comment user IDs');

  const records = {};
  for (const [name, definition] of Object.entries(archiveDefinitions)) {
    const filePath = path.join(absoluteSnapshotPath, 'export', definition.file);
    const manifestArchive = verification.archives?.[definition.file];
    invariant(manifestArchive, `Verification manifest is missing ${definition.file}`);
    const actualSha256 = await sha256(filePath);
    invariant(actualSha256 === manifestArchive.sha256, `${definition.file} checksum does not match verification manifest`);
    const archiveRecords = await readJsonlGzip(filePath);
    invariant(archiveRecords.length === manifestArchive.records, `${definition.file} record count does not match verification manifest`);
    invariant(
      archiveRecords.length === verification.recoveredCounts?.[definition.expectedCountKey],
      `${definition.file} record count does not match recoveredCounts`,
    );
    records[name] = archiveRecords;
  }

  validateRecords(records);

  return {
    snapshotPath: absoluteSnapshotPath,
    snapshotId: inventory.snapshotDate || path.basename(absoluteSnapshotPath),
    sourceUrl: inventory.source || verification.source,
    verification,
    inventory,
    records,
  };
}

export function sqlStatements(sqlSource) {
  return sqlSource
    .split(/^\s*-- migrate:split\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function parseSnapshotArgument(argv) {
  const snapshotFlag = argv.indexOf('--snapshot');
  invariant(snapshotFlag >= 0 && argv[snapshotFlag + 1], 'Usage: --snapshot /absolute/path/to/recovery-snapshot');
  const snapshotPath = argv[snapshotFlag + 1];
  invariant(path.isAbsolute(snapshotPath), '--snapshot must be an absolute path');
  return snapshotPath;
}
