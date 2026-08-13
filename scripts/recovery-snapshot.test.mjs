import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  archiveDefinitions,
  loadAndValidateSnapshot,
  sqlStatements,
} from './lib/recovery-snapshot.mjs';

const ids = {
  course: '65c4299149939741c6777c1d',
  professor: '65c42b4949939741c67c70da',
  review: '65c42c5949939741c67fa226',
  metric: '65c430be49939741c68d51f3',
  comment: '69fbec15e3a0f04a164d45f0',
};

function records({ includeUserId = false } = {}) {
  return {
    courses: [{
      _id: ids.course,
      code: 'TEST1001',
      title: 'Test Course',
      subject: 'Testing',
      college: 'MCAS',
      description: 'Fixture',
    }],
    professors: [{
      _id: ids.professor,
      name: 'Test Professor',
      title: [],
      education: [],
      photoLink: 'https://example.com/photo.jpg',
    }],
    reviews: [{
      _id: ids.review,
      code: 'TEST100101',
      prof: 'Test Professor',
      semester: 'Fall 2025',
      course_id: ids.course,
      professor_id: ids.professor,
      section: 1,
      course_overall: 4.5,
      instructor_overall: 4.75,
    }],
    reviewMetrics: [{ _id: ids.metric, review_id: ids.review }],
    comments: [{
      _id: ids.comment,
      message: 'Helpful fixture comment',
      wouldTakeAgain: true,
      professor_id: ids.professor,
      course_id: ids.course,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...(includeUserId ? { user_id: 'must-not-survive' } : {}),
    }],
    facultyDirectory: [{
      source: 'Boston College public faculty directory',
      sourceSchool: 'csom',
      name: 'Current Professor',
      profilePath: '/faculty/current-professor.html',
      profileUrl: 'https://www.bc.edu/faculty/current-professor.html',
    }],
  };
}

async function writeFixture(options) {
  const root = await mkdtemp(path.join(tmpdir(), 'eagleevals-migration-'));
  const exportPath = path.join(root, 'export');
  const manifestPath = path.join(root, 'manifests');
  await Promise.all([mkdir(exportPath), mkdir(manifestPath)]);
  const fixtureRecords = records(options);
  const archives = {};
  const recoveredCounts = {};

  for (const [name, definition] of Object.entries(archiveDefinitions)) {
    const compressed = gzipSync(`${fixtureRecords[name].map(JSON.stringify).join('\n')}\n`);
    const filePath = path.join(exportPath, definition.file);
    await writeFile(filePath, compressed);
    archives[definition.file] = {
      bytes: compressed.length,
      records: fixtureRecords[name].length,
      sha256: createHash('sha256').update(compressed).digest('hex'),
    };
    recoveredCounts[definition.expectedCountKey] = fixtureRecords[name].length;
  }

  await writeFile(path.join(manifestPath, 'verification.json'), JSON.stringify({
    source: 'https://eagleeval.com',
    recoveredCounts,
    archives,
    integrity: { privacy: { commentsContainingUserId: 0 } },
  }));
  await writeFile(path.join(manifestPath, 'migration-inventory.json'), JSON.stringify({
    snapshotDate: '2026-08-13-test',
    source: 'https://eagleeval.com',
    localDeletionStatus: 'blocked',
  }));
  return root;
}

test('validates a complete anonymized snapshot', async (t) => {
  const root = await writeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const snapshot = await loadAndValidateSnapshot(root);
  assert.equal(snapshot.snapshotId, '2026-08-13-test');
  assert.equal(snapshot.records.reviews.length, 1);
});

test('rejects a snapshot containing comment account IDs', async (t) => {
  const root = await writeFixture({ includeUserId: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(loadAndValidateSnapshot(root), /still contains user_id/);
});

test('rejects an archive whose checksum changed', async (t) => {
  const root = await writeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const coursePath = path.join(root, 'export', 'courses.jsonl.gz');
  const original = await readFile(coursePath);
  await writeFile(coursePath, Buffer.concat([original, Buffer.from('tampered')]));
  await assert.rejects(loadAndValidateSnapshot(root), /checksum does not match/);
});

test('splits schema only at explicit migration boundaries', async () => {
  const schema = await readFile(
    new URL('../database/migrations/001_initial.sql', import.meta.url),
    'utf8',
  );
  const statements = sqlStatements(schema);
  assert.equal(statements.length, 21);
  assert.match(statements[0], /CREATE EXTENSION/);
  assert.match(statements.at(-1), /professor_summaries/);
});
