import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {applyMigrations} from './lib/database.mjs';
import {prepareRmpImport} from './lib/rmp-recovery.mjs';
import {stageRmpImport,publicationStatements} from './import-rmp-reviews.mjs';
import {matchReviewCourse,matchRecoveredProfessor,sourceProfessorId,planNativeLinkRepairs,applyNativeLinkRepairs,recoveryDiff,assertRecoveryCoverage} from './lib/review-associations.mjs';
import {browseReviews} from '../src/data/review-browsing.ts';
import {indexQuickCatalog,filterQuickCatalog} from '../src/data/quick-search.ts';
const encode=s=>Buffer.from(s).toString('base64');
const id=n=>String(n).padStart(24,'0');
function loadTs(file,deps){const s=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};vm.runInNewContext(s,{module:m,exports:m.exports,require(n){if(!(n in deps))throw Error('Unexpected import '+n);return deps[n];}});return m.exports;}

test('course links accept BC section suffixes and verified instructor context, never arbitrary number or name guesses',()=>{
 const courses=[{id:'a',code:'MATH1004',title:'Finite Probability'},{id:'b',code:'BIOL2000',title:'Molecules and Cells'},
  {id:'c',code:'CHEM2000',title:'Chemistry'},{id:'d',code:'MATH1005',title:'Another class'}];
 assert.deepEqual(matchReviewCourse('MATH1004-08',courses),{courseId:'a',method:'course_section_code'});
 assert.equal(matchReviewCourse('MATH1004-9934',courses).courseId,null);
 assert.equal(matchReviewCourse('BIO2000',courses,['b']).courseId,'b');
 assert.equal(matchReviewCourse('BIO2000',courses,[]).courseId,null);
 assert.equal(matchReviewCourse('2000',courses,['b','c']).courseId,null);
 assert.equal(matchReviewCourse('2000',courses,['b']).courseId,'b');
 assert.equal(matchReviewCourse('Molecules and Cells',courses,['b']).courseId,'b');
 assert.equal(matchReviewCourse('Finite',courses,['a']).courseId,null);
 assert.equal(matchReviewCourse('MATH1006',courses,['a','d']).courseId,null);
 const teacher={legacyId:900,firstName:'Marie',lastName:'Clote',department:'Mathematics'};
 assert.equal(matchRecoveredProfessor(teacher,[{id:'p',name:'Peter Clote'}],[teacher]).professorId,null);
 const repairs=planNativeLinkRepairs([{id:'r',professor_id:null,course_id:'c',professor_name:'Nate Hartmann'}],[{id:'65c42b5449939741c67c9e72',name:'Nathaniel Hartmann'}],[]);
 assert.equal(repairs[0].method,'verified_archived_alias');
 assert.equal(planNativeLinkRepairs([{id:'r',professor_id:null,course_id:'c',professor_name:'Nate Hartmann'}],[{id:'65c42b5449939741c67c9e72',name:'Another Hartmann'}],[]).length,0);
});

test('source archive profiles, verified aliases, canonical duplicate profiles and null-link repairs preserve content',async t=>{
 const pg=await PGlite.create({extensions:{pg_trgm}});t.after(()=>pg.close());
 const lazy=(q,a=[])=>({q,a,then(resolve,reject){return pg.query(q,a).then(r=>r.rows).then(resolve,reject);}});
 const sql=(strings,...a)=>lazy(strings.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),a);sql.query=lazy;
 sql.transaction=statements=>pg.transaction(async tx=>{const rows=[];for(const s of statements)rows.push((await tx.query(s.q,s.a)).rows);return rows;});
 await applyMigrations(sql,'database/migrations');
 await sql.query("INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest) VALUES('native','fixture','verified','{}','{}')");
 const nate='65c42b5449939741c67c9e72',natana='65c42b5a49939741c67cb564',duplicate='6709764fc60e35561f02b739';
 await sql.query("INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot) VALUES($1,'MATH1004','Finite Probability','Mathematics','Fixture','{}','native'),($2,'CHEM1109','General Chemistry','Chemistry','Fixture','{}','native')",[id(1),id(2)]);
 await sql.query("INSERT INTO professors(id,name,titles,phone,legacy_document,source_snapshot) VALUES($1,'Nathaniel Hartmann','{}',NULL,'{}','native'),($2,'Natana Delong-Bas',ARRAY['Theology Department'],'617-552-3322','{}','native'),($3,'Natana DeLong-Bas',ARRAY['Theology Department'],'617-552-3322','{}','native')",[nate,natana,duplicate]);
 await sql.query("INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,course_overall,instructor_overall,legacy_document,source_snapshot) VALUES($1,NULL,NULL,'MATH1004','Former Instructor','Fall 2024',4,5,'{\"kept\":true}','native'),($2,$3,$4,'MATH1004','Natana DeLong-Bas','Fall 2024',3,4,'{}','native')",[id(10),id(11),id(1),duplicate]);
 await sql.query("INSERT INTO student_comments(id,course_id,professor_id,message,source,created_at) VALUES('native-comment',$1,$2,'A native experience.','legacy_eagleeval','2024-01-01Z')",[id(1),duplicate]);
 const before=(await sql.query('SELECT to_jsonb(r) AS record FROM reviews r ORDER BY id')).map(r=>r.record);
 const teachers=[{legacyId:900,firstName:'Former',lastName:'Instructor',department:'Mathematics'},
  {legacyId:2641456,firstName:'Nate',lastName:'Hartmann',department:'Chemistry'},
  {legacyId:2744854,firstName:'Natana',lastName:'Delong-Bas',department:'Theology'}];
 const saved=teachers.map((teacher,i)=>({teacher:{...teacher,id:encode(`Teacher-${teacher.legacyId}`),school:{id:'U2Nob29sLTEyMg=='}},
  reportedRatingCount:0,fetchedAt:'2026-10-14T00:00:00Z',reviews:[{id:encode(`Rating-${900+i}`),class:i===1?'CHEM1109':'MATH1004-08',comment:'The exams required careful preparation.',date:'2025-01-02 03:04:05 +0000 UTC',wouldTakeAgain:'Yes'}]}));
 const snapshot={snapshotId:'source',sha256:'fixture',snapshots:saved,manifest:{ratings:3,writtenReviews:3}};
 const professors=await sql.query('SELECT * FROM professors'),courses=await sql.query('SELECT id,code,title FROM courses');
 const plan=prepareRmpImport(snapshot,professors,courses,{catalogProfiles:true});
 assert.equal(plan.catalogProfiles.length,1);assert.equal(plan.coverage.professorLinkedWrittenReviews,3);
 await stageRmpImport(sql,snapshot,plan);
 for(const [q,a] of publicationStatements(snapshot.snapshotId))await sql.query(q,a);
 const archive=(await sql.query('SELECT * FROM professors WHERE id=$1',[sourceProfessorId(900)]))[0];
 assert.equal(archive.catalog_source,'external_rmp');assert.equal(archive.name,'Former Instructor');assert.deepEqual(archive.legacy_document,{});
 const repairs=planNativeLinkRepairs(await sql.query('SELECT * FROM reviews'),await sql.query('SELECT * FROM professors'),courses);
 assert.equal(repairs.length,2);assert.deepEqual(await applyNativeLinkRepairs(sql,repairs),{professorLinks:1,courseLinks:1});
 const after=(await sql.query('SELECT to_jsonb(r) AS record FROM reviews r ORDER BY id')).map(r=>r.record);
 for(let i=0;i<before.length;i++)for(const key of Object.keys(before[i]))if(!['course_id','professor_id'].includes(key))assert.deepEqual(after[i][key],before[i][key]);
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM review_link_repairs'))[0].n,2);
 assert.equal(planNativeLinkRepairs(await sql.query('SELECT * FROM reviews'),await sql.query('SELECT * FROM professors'),courses).length,0);
 await sql.query("INSERT INTO reviews(id,course_code,professor_name,semester,legacy_document,source_snapshot) VALUES($1,'MATH1004','Former Instructor','Spring 2025','{}','native')",[id(12)]);
 await assert.rejects(()=>applyNativeLinkRepairs(sql,[{reviewId:id(12),field:'course_id',next:id(1),method:'fixture'},{reviewId:id(10),field:'course_id',next:id(1),method:'fixture'}]),/precondition/);
 assert.equal((await sql.query('SELECT course_id FROM reviews WHERE id=$1',[id(12)]))[0].course_id,null,'a changed precondition rolls back the complete repair operation');
 const queries=loadTs('src/data/queries.ts',{'server-only':{},react:{cache:f=>f},'@/data/public-cache':{publicQuery:(_k,f)=>f},'@/data/database':{readDatabase:()=>sql},'@/data/catalog-search':loadTs('src/data/catalog-search.ts',{}),'@/data/format':loadTs('src/data/format.ts',{})});
 const detail=await queries.getProfessorDetail(duplicate);assert.equal(detail.professor.id,natana);assert.equal(detail.professor.reviewCount,1);assert.equal(detail.comments.length,2);
 assert.equal((await queries.getProfessorDetail(sourceProfessorId(900))).professor.catalogSource,'external_rmp');
 assert.equal((await queries.getProfessorsPage('',1)).items.some(p=>p.id===duplicate),false);
 assert.equal((await queries.searchCatalog('Nate Hartmann')).professors[0].id,nate);
 const quick=await queries.getQuickSearchCatalog();assert.equal(filterQuickCatalog(indexQuickCatalog(quick),'Nate Hartmann').professors[0].id,nate);
 assert.equal((await queries.getCommentsPage('',1)).total,4,'canonicalization does not duplicate archive entries');
 await stageRmpImport(sql,snapshot,prepareRmpImport(snapshot,await sql.query('SELECT * FROM professors'),courses,{catalogProfiles:true}));
 assert.equal((await queries.getCommentsPage('',1)).total,4);await applyMigrations(sql,'database/migrations');
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM professor_aliases'))[0].n,1,'migration replay preserves data and appended view fields');
});

test('coverage loss requires exact reviewed snapshot approval and ignores source count counters',()=>{
 const plan={profiles:[{source_teacher_id:'p',professor_id:null}],reviews:[{source_review_id:'a',course_id:null}]};
 const diff=recoveryDiff(plan,[{source_teacher_id:'p',professor_id:'native'},{source_teacher_id:'gone'}],
  [{source_review_id:'a',course_id:'course',published:true},{source_review_id:'gone',published:true}]);
 assert.equal(diff.missingProfiles.length,1);assert.equal(diff.removedPublishedReviews.length,1);assert.equal(diff.lostProfessorLinks.length,1);assert.equal(diff.lostCourseLinks.length,1);
 assert.throws(()=>assertRecoveryCoverage(diff,'current','old'),/coverage/);
 assert.doesNotThrow(()=>assertRecoveryCoverage(diff,'current','current'));
 assert.doesNotThrow(()=>assertRecoveryCoverage(recoveryDiff({profiles:[],reviews:[]},[],[{source_review_id:'private',published:false}]),'current'));
 const reassigned=recoveryDiff({profiles:[{source_teacher_id:'p',professor_id:'different'}],reviews:[{source_review_id:'a',course_id:'different'}]},[{source_teacher_id:'p',professor_id:'native'}],[{source_review_id:'a',course_id:'native',published:true}]);
 assert.equal(reassigned.changedProfessorLinks.length,1);assert.equal(reassigned.changedCourseLinks.length,1);
 assert.throws(()=>assertRecoveryCoverage(reassigned,'current'),/coverage/,'non-null reassignment needs the same reviewed digest approval');
 const stale=recoveryDiff({profiles:[{source_teacher_id:'p',fetched_at:'2025-01-01Z'}],reviews:[]},[{source_teacher_id:'p',fetched_at:'2026-01-01Z'}],[]);
 assert.equal(stale.olderProfileSnapshots.length,1);assert.throws(()=>assertRecoveryCoverage(stale,'current'),/coverage/);
});

test('review text search combines words with existing professor/course filters and stable ordering',()=>{
 const comments=[{id:'a',professorId:'p',professorName:'Jane',courseId:'c',message:'Fair exams and clear grading.',createdAt:'2025-01-01Z',semester:null},
  {id:'b',professorId:'q',professorName:'John',courseId:'c',message:'Attendance matters.',createdAt:'2026-01-01Z',semester:null}];
 assert.deepEqual(browseReviews(comments,'course','','newest','EXAMS grading').map(r=>r.id),['a']);
 assert.equal(browseReviews(comments,'course','q','newest','exams').length,0);
 assert.equal(browseReviews(comments,'professor','c','newest','attendance').length,1);
 assert.equal(comments[0].id,'a','search does not reorder source arrays');
});
