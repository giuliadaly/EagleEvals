import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReviewMessage, validateReviewSubmission } from '../src/data/review-validation.ts';

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

test('rejects missing ratings and unsupported semesters', () => {
  assert.equal(validateReviewSubmission({ ...valid, instructorPrepared: 0 }, 2026).ok, false);
  assert.equal(validateReviewSubmission({ ...valid, semester: 'Winter 2026' }, 2026).ok, false);
});
