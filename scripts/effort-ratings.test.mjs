import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { applyMigrations } from './lib/database.mjs';

function loadTs(file, dependencies) {
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

test('course, professor and evaluation effort retain the original five-point values and missing responses', async t => {
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  t.after(() => pg.close());
  const lazy = (text, values = []) => ({
    text, values, then(resolve, reject) { return pg.query(text, values).then(result => result.rows).then(resolve, reject); },
  });
  const sql = (strings, ...values) => lazy(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values);
  sql.query = lazy;
  await applyMigrations(sql, 'database/migrations');
  await pg.query(`INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest)
    VALUES('effort','fixture','verified','{}','{}')`);
  const course = '000000000000000000000001';
  const professor = '000000000000000000000002';
  const missingCourse = '000000000000000000000003';
  const missingProfessor = '000000000000000000000004';
  await pg.query(`INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot)
    VALUES($1,'ENGL1010','Writing','English','Fixture','{}','effort'),
      ($2,'ENGL2000','Literature','English','Fixture','{}','effort')`, [course, missingCourse]);
  await pg.query(`INSERT INTO professors(id,name,legacy_document,source_snapshot)
    VALUES($1,'Jane Teacher','{}','effort'),($2,'No Effort Responses','{}','effort')`, [professor, missingProfessor]);
  const effortValues = [4, null, 1, 5];
  for (const [index, effort] of effortValues.entries()) {
    const id = String(index + 10).padStart(24, '0');
    await pg.query(`INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,
      course_overall,instructor_overall,published,legacy_document,source_snapshot)
      VALUES($1,$2,$3,'ENGL1010','Jane Teacher','Fall 2025',4,4,$4,'{}','effort')`, [id, course, professor, index < 3]);
    await pg.query(`INSERT INTO review_metrics(id,review_id,effort_average_hours_weekly,legacy_document,source_snapshot)
      VALUES($1,$1,$2,'{}','effort')`, [id, effort]);
  }
  const missingId = '000000000000000000000099';
  await pg.query(`INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,
    legacy_document,source_snapshot) VALUES($1,$2,$3,'ENGL2000','No Effort Responses','Spring 2025','{}','effort')`,
    [missingId, missingCourse, missingProfessor]);
  await pg.query(`INSERT INTO review_metrics(id,review_id,legacy_document,source_snapshot)
    VALUES($1,$1,'{}','effort')`, [missingId]);
  const before = (await pg.query('SELECT to_jsonb(m) AS row FROM review_metrics m ORDER BY id')).rows;
  const queries = loadTs('src/data/queries.ts', {
    'server-only': {}, react: { cache: fn => fn }, '@/data/public-cache': { publicQuery: (_key, fn) => fn },
    '@/data/database': { readDatabase: () => sql }, '@/data/catalog-search': loadTs('src/data/catalog-search.ts', {}),
    '@/data/format': loadTs('src/data/format.ts', {}),
  });
  for (const detail of [await queries.getCourseDetail(course), await queries.getProfessorDetail(professor)]) {
    const effort = detail.metrics.find(metric => metric.label === 'Weekly effort');
    assert.equal(effort.value, 2.5, 'average excludes NULL and unpublished responses without converting to hours');
    assert.equal(effort.sampleCount, 2, 'only answered, published evaluations count');
    assert.equal(effort.description, '1 is very light; 5 is very heavy');
    assert.equal('estimatedWeeklyHours' in detail, false);
  }
  for (const detail of [await queries.getCourseDetail(missingCourse), await queries.getProfessorDetail(missingProfessor)]) {
    const effort = detail.metrics.find(metric => metric.label === 'Weekly effort');
    assert.equal(effort.value, null, 'missing effort stays missing');
    assert.equal(effort.sampleCount, 0);
  }
  const evaluations = await queries.getEvaluationsPage('', 1);
  assert.equal(evaluations.items.find(row => row.id === '000000000000000000000010').metrics.find(metric => metric.label === 'Weekly effort').value, 4);
  assert.equal(evaluations.items.find(row => row.id === '000000000000000000000011').metrics.find(metric => metric.label === 'Weekly effort').value, null);
  assert.deepEqual((await pg.query('SELECT to_jsonb(m) AS row FROM review_metrics m ORDER BY id')).rows, before,
    'reading effort never changes stored historical values');
});

test('metric display uses the five-point scale and distinguishes a missing response from a score', () => {
  const { DetailMetrics } = loadTs('src/components/detail-page.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/link': () => null, '@/components/icons': {},
    '@/data/format': loadTs('src/data/format.ts', {}), './detail-page.module.css': { default: {} }, './detail-reviews': {},
  });
  const metrics = [{ label: 'Weekly effort', value: 2.5, description: '1 is very light; 5 is very heavy', sampleCount: 1 },
    { label: 'Weekly effort without responses', value: null, sampleCount: 0 }];
  const markup = renderToStaticMarkup(createElement(DetailMetrics, { metrics }));
  assert.match(markup, /2\.50 \/ 5/);
  assert.match(markup, /1 evaluation<\/small>/);
  assert.match(markup, /data-empty="true">Not collected<\/dd>/);
  assert.doesNotMatch(markup, /\b(?:hrs|hours)\b|1 evaluations|data-empty="false"/);
});
