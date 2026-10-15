import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalCourseEvidence,prepareHistoricalCourses,historicalCourseId,matchReviewCourse,sourceCourseException} from './lib/review-associations.mjs';
import {prepareRmpImport,RMP_BC_SCHOOL} from './lib/rmp-recovery.mjs';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {applyMigrations} from './lib/database.mjs';
import {pgliteSql} from './lib/review-refresh.mjs';
import {prepareDatabaseImport,stageRmpImport,publicationStatements} from './import-rmp-reviews.mjs';
const encode=v=>Buffer.from(v).toString('base64');
const id=n=>String(n).padStart(24,'0');

test('historical course linking requires the exact documented pair and reviewed instructor',()=>{
 const courses=[{id:id(1),code:'MATH1100'},{id:id(2),code:'MATH1102'},{id:id(3),code:'COMM2125'},...prepareHistoricalCourses([])];
 assert.deepEqual(matchReviewCourse('MT100',courses,[],1015730),{courseId:id(1),method:'verified_historical_course_code'});
 assert.equal(matchReviewCourse('MT100',courses,[],900).courseId,null);
 assert.equal(matchReviewCourse('MT102',courses,[],1015730).courseId,id(2));
 assert.equal(matchReviewCourse('MT10001',courses,[],1015730).courseId,null,'Do not guess sections for undocumented old codes');
 assert.equal(matchReviewCourse('COMM2225-01',courses,[],2342162).courseId,id(3));
 assert.equal(matchReviewCourse('COMM2225-123',courses,[],2342162).courseId,null);
 assert.equal(matchReviewCourse('ISYS1021',courses,[],2727023).courseId,historicalCourseId('ISYS1021'));
 assert.equal(matchReviewCourse('ISYS1021',courses,[],900).courseId,null);
 assert.throws(()=>prepareHistoricalCourses([{id:id(9),code:'ISYS1021',catalog_source:'legacy_eagleeval'}]),/conflicts/);
 const e=historicalCourseEvidence.courseExclusions[0];
 const review={id:e.reviewId,class:e.class,comment:`Originally wrote: ${e.requiredText}`};
 assert.equal(sourceCourseException({legacyId:e.teacherId},review).method,'source_course_conflict');
 assert.equal(sourceCourseException({legacyId:e.teacherId+1},review),undefined);
});

test('archive import and replay preserve native catalog and source records; conflicting source course stays on professor page',async t=>{
 const pg=await PGlite.create({extensions:{pg_trgm}});t.after(()=>pg.close());const sql=pgliteSql(pg);
 await applyMigrations(sql,'database/migrations');
 await sql.query("INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest) VALUES('native','fixture','verified','{}','{}')");
 await sql.query("INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot) VALUES($1,'MATH1100','Calculus I','Mathematics','Native unchanged','{\"original\":true}','native')",[id(1)]);
 await sql.query("INSERT INTO professors(id,name,legacy_document,source_snapshot) VALUES($1,'Anna Karpovsky','{}','native'),($2,'Math Instructor','{}','native')",[id(2),id(3)]);
 const fixture=(n,firstName,lastName,reviews)=>({teacher:{legacyId:n,id:encode(`Teacher-${n}`),firstName,lastName,school:{id:RMP_BC_SCHOOL}},fetchedAt:'2026-10-14T00:00:00Z',reportedRatingCount:reviews.length,reviews:reviews.map(r=>({...r,date:'2010-01-02 03:04:05 +0000 UTC',wouldTakeAgain:'Yes'}))});
 const conflict=historicalCourseEvidence.courseExclusions[0];
 const snapshot={snapshotId:'rmp-history-fixture',sha256:'history',manifest:{ratings:3,writtenReviews:3},snapshots:[
  fixture(2727023,'Anna','Karpovsky',[{id:encode('Rating-123'),class:'ISYS1021',comment:'Spreadsheets and business strategy.'},{id:conflict.reviewId,class:conflict.class,comment:conflict.requiredText}]),
  fixture(1015730,'Math','Instructor',[{id:encode('Rating-124'),class:'MT100',comment:'Original historical calculus comment.'}])
 ]};
 const before=await sql.query('SELECT to_jsonb(c) AS row FROM courses c');
 const {plan,diff}=await prepareDatabaseImport(sql,snapshot);assert.equal(plan.coverage.courseLinkedWrittenReviews,2);assert.equal(plan.coverage.conflictingCourseLabels,1);
 assert.equal(Object.values(diff).flat().length,0);
 await stageRmpImport(sql,snapshot,plan);await sql.transaction(publicationStatements(snapshot.snapshotId).map(([q,p])=>sql.query(q,p)));
 assert.deepEqual(await sql.query('SELECT to_jsonb(c) AS row FROM courses c WHERE id=$1',[id(1)]),before);
 assert.equal((await sql.query("SELECT catalog_source FROM courses WHERE code='ISYS1021'"))[0].catalog_source,'historical_archive');
 const comments=await sql.query('SELECT id,message,course_id,context_note FROM public_written_reviews ORDER BY id');assert.equal(comments.length,3);
 const conflicted=comments.find(c=>c.id===`rmp:${conflict.reviewId}`);assert.equal(conflicted.course_id,null);assert.equal(conflicted.message,conflict.requiredText);assert.equal(conflicted.context_note,conflict.note);
 const raw=await sql.query('SELECT source_review_id,source_document,message,course_code FROM external_reviews ORDER BY source_review_id');
 const replay=await prepareDatabaseImport(sql,snapshot);await stageRmpImport(sql,snapshot,replay.plan);
 assert.deepEqual(await sql.query('SELECT source_review_id,source_document,message,course_code FROM external_reviews ORDER BY source_review_id'),raw);
 assert.equal((await sql.query("SELECT count(*)::int AS n FROM courses WHERE catalog_source='historical_archive'"))[0].n,3);
 const generic=prepareRmpImport(snapshot,await sql.query('SELECT * FROM professors'),[],{});assert.equal(generic.coverage.courseLinkedWrittenReviews,0);
});
