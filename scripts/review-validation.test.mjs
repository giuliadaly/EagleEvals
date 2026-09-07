import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReviewMessage, reviewRatingFields, validateReviewSubmission } from '../src/data/review-validation.ts';

const valid = {
  courseId: '65c4299149939741c6777c1d',
  professorId: '65c42b4949939741c67c70da',
  semester: 'Fall 2026',
  section: 1,
  courseOverall: 5,
  instructorOverall: 5,
  attendanceNecessary: 4,
  availableForHelp: 5,
  courseChallenge: 3,
  courseOrganization: 5,
  clearExplanations: 5,
  instructorPrepared: 5,
  stimulatedInterest: 5,
  assignmentsHelpful: 4,
  weeklyEffort: 3,
  message: 'Clear lectures and useful assignments throughout the semester.',
  wouldTakeAgain: true,
  firsthandConfirmed: true,
  guidelinesAccepted: true,
  website: '',
};

test('accepts a complete anonymous review without identity fields', () => {
  const result = validateReviewSubmission(valid, 2026);
  assert.equal(result.ok, true);
  assert.equal('email' in valid, false);
  assert.equal('name' in valid, false);
});

test('normalizes whitespace without changing the review wording', () => {
  assert.equal(normalizeReviewMessage('  Very   useful.\n\n\nWould take again.  '), 'Very useful.\n\nWould take again.');
});

test('rejects bot honeypots and contact information', () => {
  assert.equal(validateReviewSubmission({ ...valid, website: 'spam' }, 2026).ok, false);
  assert.equal(validateReviewSubmission({ ...valid, message: 'Contact me at person@example.com for more private details.' }, 2026).ok, false);
});

test('rejects invalid ratings and unsupported semesters', () => {
  assert.equal(validateReviewSubmission({ ...valid, instructorPrepared: 0 }, 2026).ok, false);
  assert.equal(validateReviewSubmission({ ...valid, semester: 'Winter 2026' }, 2026).ok, false);
});

const minimal = {
  courseId: valid.courseId,
  professorId: valid.professorId,
  semester: valid.semester,
  courseOverall: 4,
  instructorOverall: 5,
  message: valid.message,
  firsthandConfirmed: true,
  guidelinesAccepted: true,
};

const optionalRatings = reviewRatingFields.filter(field => !['courseOverall', 'instructorOverall'].includes(field));

test('accepts a short review and preserves unanswered details as null', () => {
  for (const blank of [undefined, null, '', '  ']) {
    const input = { ...minimal, section: blank, wouldTakeAgain: blank };
    for (const field of optionalRatings) input[field] = blank;
    const result = validateReviewSubmission(input, 2026);
    assert.equal(result.ok, true);
    assert.equal(result.data.section, null);
    assert.equal(result.data.wouldTakeAgain, null);
    for (const field of optionalRatings) assert.equal(result.data[field], null);
  }
});

test('accepts selected optional answers without requiring the other details', () => {
  const result = validateReviewSubmission({ ...minimal, section: '12', courseOrganization: '4', wouldTakeAgain: false }, 2026);
  assert.equal(result.ok, true);
  assert.equal(result.data.section, 12);
  assert.equal(result.data.courseOrganization, 4);
  assert.equal(result.data.wouldTakeAgain, false);
  assert.equal(result.data.instructorPrepared, null);
});

test('still requires both overall ratings, useful text, and first-hand confirmation', () => {
  for (const field of ['courseOverall', 'instructorOverall', 'message', 'firsthandConfirmed', 'guidelinesAccepted']) {
    assert.equal(validateReviewSubmission({ ...minimal, [field]: undefined }, 2026).ok, false, field);
  }
  assert.equal(validateReviewSubmission({ ...minimal, message: 'Too short' }, 2026).ok, false);
});

test('rejects invalid optional answers instead of silently ignoring them', () => {
  for (const field of optionalRatings) {
    for (const bad of [0, 6, -1, 2.5, 'bad', true, [], {}]) {
      assert.equal(validateReviewSubmission({ ...minimal, [field]: bad }, 2026).ok, false, `${field}: ${String(bad)}`);
    }
  }
  for (const bad of [0, 100, -1, 1.5, 'bad', true, []]) {
    assert.equal(validateReviewSubmission({ ...minimal, section: bad }, 2026).ok, false);
  }
  for (const bad of ['false', 0, 1, [], {}]) {
    assert.equal(validateReviewSubmission({ ...minimal, wouldTakeAgain: bad }, 2026).ok, false);
  }
});
