import assert from 'node:assert/strict';
import test from 'node:test';
import { filterQuickCatalog, indexQuickCatalog } from '../src/data/quick-search.ts';

const catalog = {
  courses: [
    { id: 'writing', code: 'ENGL1010', title: 'First Year Writing Seminar', subject: 'English', reviewCount: 467, commentCount: 43 },
    { id: 'literature', code: 'ENGL2000', title: 'Literature', subject: 'English', reviewCount: 600, commentCount: 10 },
    { id: 'economics', code: 'ECON1101', title: 'Principles of Economics', subject: 'Economics', reviewCount: 177, commentCount: 26 },
  ],
  professors: [
    { id: 'brian', name: 'Brian Zimmerman', title: null, commentCount: 2 },
    { id: 'jane', name: 'Jane O’Neill', title: null, commentCount: 0 },
  ],
};
const index = indexQuickCatalog(catalog);

test('suggestions filter synchronously from the first letter through continued typing and backspacing', () => {
  for (const query of ['E', 'EN', 'ENG', 'ENGL', 'ENGL 1', 'ENGL 10', 'ENGL 1010', 'ENGL 101', 'ENGL', 'E']) {
    const results = filterQuickCatalog(index, query);
    assert.equal(results instanceof Promise, false);
    assert.ok(results.courses.some(course => course.id === 'writing'), query);
    if (query.length > 1) assert.ok(!results.courses.some(course => course.id === 'economics'), query);
  }
  assert.deepEqual(filterQuickCatalog(index, ''), { courses: [], professors: [] });
  assert.deepEqual(filterQuickCatalog(index, '   %_- '), { courses: [], professors: [] });
});

test('code punctuation, names, title and subject matching survive the instant search path', () => {
  for (const query of ['ENGL1010', 'ENGL 1010', 'engl-1010', 'engl.1010', 'ＥＮＧＬ１０１０', 'First Year Writing']) {
    assert.equal(filterQuickCatalog(index, query).courses[0]?.id, 'writing', query);
  }
  assert.equal(filterQuickCatalog(index, 'Economics').courses[0]?.id, 'economics');
  for (const query of ["O'Neill", 'O Neill', 'ONeill']) assert.equal(filterQuickCatalog(index, query).professors[0]?.id, 'jane');
  assert.equal(filterQuickCatalog(index, 'B').professors[0]?.id, 'brian');
  assert.deepEqual(filterQuickCatalog(index, 'zzzzqqqq'), { courses: [], professors: [] });
});

test('exact codes win over more reviewed prefixes and the result limit does not restrict later searches', () => {
  const many = indexQuickCatalog({ courses: Array.from({ length: 20 }, (_, i) => ({
    id: `${i}`, code: `TEST1${i}`, title: 'A course', subject: 'Testing', reviewCount: i, commentCount: 0,
  })), professors: [] });
  assert.equal(filterQuickCatalog(many, 'T').courses.length, 6);
  assert.equal(filterQuickCatalog(many, 'TEST10').courses[0]?.id, '0');
  assert.equal(filterQuickCatalog(many, 'TEST119').courses[0]?.id, '19');
  assert.equal(catalog.courses[0].id, 'writing');
});
