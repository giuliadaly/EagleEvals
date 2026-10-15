import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const evidence=JSON.parse(readFileSync(new URL('../database/reference/historical-course-codes.json',import.meta.url),'utf8'));
const officialSource=source=>{
 const url=new URL(source.url);
 assert.equal(url.protocol,'https:');
 assert.match(url.hostname,/(^|\.)bc\.edu$/);
 assert.ok(source.code&&typeof source.code==='string');
 if(url.pathname.endsWith('.pdf')&&source.pdfPage!==undefined){
  assert.ok(Number.isSafeInteger(source.pdfPage)&&source.pdfPage>0,'PDF pages are one-based');
  assert.match(source.year,/^\d{4}-\d{4}$/);
 }
};

test('historical course evidence has explicit official code pairs and bounded instructor context',()=>{
 assert.equal(evidence.version,1);
 const seen=new Set();
 for(const mapping of evidence.mappings){
  assert.match(mapping.sourceCode,/^[A-Z]{2,4}\d{3,4}$/);
  assert.match(mapping.targetCode,/^[A-Z]{4}\d{4}$/);
  assert.ok(!seen.has(mapping.sourceCode),'A source code cannot point at two courses');
  seen.add(mapping.sourceCode);
  assert.ok(mapping.allowedTeacherIds.length>0,'No global prefix/number rewriting');
  assert.equal(new Set(mapping.allowedTeacherIds).size,mapping.allowedTeacherIds.length);
  assert.ok(mapping.allowedTeacherIds.every(id=>Number.isSafeInteger(id)&&id>0));
  assert.ok(mapping.targetTitle&&mapping.department&&mapping.evidence);
  assert.ok(mapping.catalogSources.length>0);
  mapping.catalogSources.forEach(officialSource);
  assert.ok(mapping.catalogSources.some(s=>s.code.includes(mapping.sourceCode)),'Old code has primary evidence');
  assert.ok(mapping.catalogSources.some(s=>s.code.includes(mapping.targetCode)),'Target code has primary evidence');
  if(mapping.allowSectionSuffix)assert.equal(mapping.sourceCode,'COMM2225');
 }
 const targets=Object.fromEntries(evidence.mappings.map(m=>[m.sourceCode,m.targetCode]));
 assert.equal(targets.MT100,'MATH1100');
 assert.equal(targets.MT102,'MATH1102','Keep distinct calculus sequences separate');
 assert.equal(targets.MF151,'MFIN1151');
 assert.equal(targets.MF801,'MFIN8801','Keep undergraduate and graduate investments separate');
 assert.equal(targets.HS111,'HIST2475','A documented code change is not a numerical prefix formula');
 assert.equal(targets.MK721,'MKTG7720');
 assert.equal(targets.COMM2225,'COMM2125');
 for(const unresolved of ['MT212','MT301','MT804','MKT101','MKTG101','MK02','MATH102','FINITE','FWS']){
  assert.equal(targets[unresolved],undefined,`${unresolved} lacks the required verified exact code pair`);
 }
 assert.match(evidence.policy,/Posting dates are not class-taken dates/);
 assert.ok(evidence.mappings.every(m=>!('postedAfter' in m)&&!('postedBefore' in m)));
});

test('missing historical courses retain their own codes and sourced descriptions',()=>{
 assert.equal(new Set(evidence.archiveCourses.map(c=>c.code)).size,evidence.archiveCourses.length);
 const courses=new Map(evidence.archiveCourses.map(c=>[c.code,c]));
 assert.equal(courses.get('ISYS1021').title,'Digital Technologies: Strategy and Use');
 assert.equal(courses.get('HIST1728').title,'Holocaust History, Representation & Memory');
 assert.equal(courses.get('SOCY5563').title,'Trauma, Culture, and Coping');
 for(const course of courses.values()){
  assert.match(course.code,/^[A-Z]{4}\d{4}$/);
  assert.ok(course.title&&course.department&&course.college&&course.description);
  assert.equal(course.descriptionIsParaphrase,true);
  assert.match(course.description,/does not establish a current offering/);
  assert.ok(course.allowedTeacherIds.length>0);
  course.catalogSources.forEach(officialSource);
 }
});

test('explicit course conflicts are scoped to one source review and retain a course-title evidence phrase',()=>{
 assert.equal(new Set(evidence.courseExclusions.map(e=>e.reviewId)).size,evidence.courseExclusions.length);
 for(const exception of evidence.courseExclusions){
  assert.ok(Number.isSafeInteger(exception.teacherId)&&exception.teacherId>0);
  assert.match(Buffer.from(exception.reviewId,'base64').toString(),/^Rating-\d+$/);
  assert.ok(exception.class&&exception.requiredText&&exception.note);
  assert.equal(exception.method,'source_course_conflict');
  assert.match(exception.note,/course label is not verified/);
 }
 assert.ok(evidence.courseExclusions.some(e=>e.class==='ISYS1021'&&e.requiredText==='Data Visualization'));
 assert.ok(evidence.courseExclusions.some(e=>e.class==='HIST1728'&&e.requiredText.includes('HIST1002')));
 assert.equal(evidence.courseExclusions.filter(e=>e.class==='COMM2225').length,2);
});
