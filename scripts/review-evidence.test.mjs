import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function loadTs(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
      return dependencies[name];
    },
  }, { filename: file });
  return compiled.exports;
}

const Link = ({ children, ...props }) => createElement('a', props, children);
const format = loadTs('src/data/format.ts');
const dependencies = {
  'react/jsx-runtime': jsxRuntime,
  'next/link': { default: Link },
  '@/components/icons': { ArrowIcon: () => null, BookIcon: () => null, PersonIcon: () => null, ChevronIcon: () => null },
  '@/data/format': format,
};
const { CourseCard, ProfessorCard } = loadTs('src/components/cards.tsx', {
  ...dependencies, '@/data/review-browsing': {}, '@/data/report-validation': {},
});

test('catalog cards distinguish numerical records, written feedback and true unrated states', () => {
  const baseCourse = { id: 'course', code: 'MATH4426', title: 'Fixture course', subject: 'Mathematics', reviewCount: 22,
    commentCount: 14, courseOverall: 4.1, instructorOverall: 3.9 };
  const baseProfessor = { id: 'professor', name: 'Fixture Professor', titles: [], reviewCount: 22,
    commentCount: 14, instructorOverall: 4.1, courseOverall: 3.9 };
  for (const [Card, prop, base] of [[CourseCard, 'course', baseCourse], [ProfessorCard, 'professor', baseProfessor]]) {
    const render = updates => renderToStaticMarkup(createElement(Card, { [prop]: { ...base, ...updates } }));
    const withComments = render({});
    assert.match(withComments, /22 numerical evaluations/);
    assert.match(withComments, /14 written reviews/);
    assert.doesNotMatch(withComments, /22 (?:written )?reviews|Ratings only/);
    const ratingsOnly = render({ commentCount: 0 });
    assert.match(ratingsOnly, /Ratings only · no comments/);
    assert.doesNotMatch(ratingsOnly, /No written reviews yet/);
    const unanswered = render({ commentCount: 0, courseOverall: null, instructorOverall: null });
    assert.match(unanswered, /22 numerical evaluations/);
    assert.match(unanswered, /No written comments/);
    assert.match(unanswered, /No rating/);
    assert.doesNotMatch(unanswered, /Ratings only/);
    const unrated = render({ commentCount: 0, reviewCount: 0, courseOverall: null, instructorOverall: null });
    assert.match(unrated, /No written reviews yet/);
    assert.match(unrated, /No rating/);
    assert.doesNotMatch(unrated, /Ratings only/);
  }
});

test('detail evidence explains score basis without treating every record as an answered rating', () => {
  const { DetailRatingEvidence } = loadTs('src/components/detail-page.tsx', {
    ...dependencies, './detail-page.module.css': { default: {} }, './detail-reviews': {},
  });
  const render = hasOverallRating => renderToStaticMarkup(createElement(DetailRatingEvidence, {
    evaluationCount: 20, writtenCount: 0, hasOverallRating,
  }));
  assert.match(render(true), /20 numerical evaluations/);
  assert.match(render(true), /Ratings only · no comments/);
  assert.match(render(true), /Scores average answered numerical ratings/);
  assert.match(render(true), /Written reviews are counted separately/);
  assert.doesNotMatch(render(true), /From 20/);
  assert.match(render(false), /No written comments/);
  assert.doesNotMatch(render(false), /Ratings only/);
  assert.equal(format.formatEvaluationCount(1), '1 numerical evaluation');
  assert.equal(format.formatWrittenReviewCount(1), '1 written review');
});

test('comparison uses the same numerical and written distinctions for each selected pairing', async () => {
  const fixture = {
    course: { id: 'course', code: 'MATH4426', title: 'Fixture course' },
    instructors: [
      { id: 'a', name: 'Ratings Only', reviewCount: 20, courseOverall: 4.1, instructorOverall: 4.2, latestSemester: 'Fall 2025' },
      { id: 'b', name: 'Missing Answers', reviewCount: 1, courseOverall: null, instructorOverall: null, latestSemester: 'Spring 2025' },
    ],
    comments: [],
  };
  const { default: ComparePage } = loadTs('src/app/courses/[id]/compare/page.tsx', {
    ...dependencies, 'next/navigation': { notFound() { throw new Error('Unexpected missing course'); } },
    '@/components/detail-review': { DetailReview: () => null }, '@/components/page-parts': { Breadcrumbs: () => null },
    '@/components/site-header': { SiteHeader: () => null }, '@/components/site-footer': { SiteFooter: () => null },
    '@/data/queries': { getCourseDetail: async () => fixture },
    '@/data/comparison': loadTs('src/data/comparison.ts'), './page.module.css': { default: {} },
  });
  const page = await ComparePage({ params: Promise.resolve({ id: 'course' }), searchParams: Promise.resolve({ professor: ['a', 'b'] }) });
  const markup = renderToStaticMarkup(page);
  assert.match(markup, /<th scope="row">Numerical evaluations<\/th><td>20<\/td><td>1<\/td>/);
  assert.match(markup, /average answered numerical ratings/);
  assert.match(markup, /Written reviews are counted separately/);
  assert.match(markup, /Ratings only · no comments for this pairing/);
  assert.match(markup, /No written comments for this pairing/);
  assert.doesNotMatch(markup, /0 reviews|From 20/);
});
