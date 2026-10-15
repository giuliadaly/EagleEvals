import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {applyMigrations} from './lib/database.mjs';

const id=n=>String(n).padStart(24,'0');
const owner={githubId:'12345',name:'Fixture owner'};
const json=value=>JSON.parse(JSON.stringify(value));
function loadManagement(sql,session=()=>owner) {
  const source=ts.transpileModule(readFileSync('src/data/owner-management.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const deps={'server-only':{},'next/headers':{headers:async()=>new Headers()},'@/data/database':{database:()=>sql},'@/data/owner-auth':{ownerSession:async()=>session()}};
  vm.runInNewContext(source,{module:mod,exports:mod.exports,URL,Headers,require(name){if(!(name in deps))throw Error('Unexpected import '+name);return deps[name];}});
  return mod.exports;
}
async function fixture(t) {
  const pg=await PGlite.create({extensions:{pg_trgm}});t.after(()=>pg.close());
  const sql=(strings,...args)=>pg.query(strings.reduce((q,s,i)=>q+(i?`$${i}`:'')+s,''),args).then(result=>result.rows);
  sql.query=(q,args=[])=>pg.query(q,args).then(result=>result.rows);
  await applyMigrations(sql,'database/migrations');
  await sql.query("INSERT INTO migration_runs(snapshot_id,source_url,status,expected_counts,verification_manifest) VALUES('fixture','fixture','verified','{}','{}')");
  await sql.query("INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot) VALUES($1,'MATH1004','Finite Probability','Mathematics','Old catalog','{\"original\":true}','fixture'),($2,'ACCT1021','Accounting','Accounting','Verified catalog','{}','fixture')",[id(1),id(2)]);
  await sql.query("INSERT INTO professors(id,name,titles,legacy_document,source_snapshot) VALUES($1,'Original Professor',ARRAY['Mathematics'],'{\"original\":true}','fixture'),($2,'Correct Professor',ARRAY['Accounting'],'{}','fixture'),($3,'Alias Professor','{}','{}','fixture')",[id(3),id(4),id(5)]);
  await sql.query("INSERT INTO professor_aliases(alias_id,canonical_id,evidence) VALUES($1,$2,'{\"verified\":true}')",[id(5),id(4)]);
  await sql.query("INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,course_overall,instructor_overall,legacy_document,source_snapshot) VALUES($1,$2,$3,'MATH1004','Original Professor','Spring 2024',4,5,'{\"ratings\":\"keep\"}','fixture')",[id(6),id(1),id(3)]);
  await sql.query("INSERT INTO review_metrics(id,review_id,instructor_prepared,legacy_document,source_snapshot) VALUES($1,$2,4,'{\"metrics\":\"preserve\"}','fixture')",[id(10),id(6)]);
  await sql.query("INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,course_overall,instructor_overall,legacy_document,source_snapshot) VALUES($1,$2,$3,'MATH1004','Original Professor','Spring 2023',3,4,'{\"unpaired\":true}','fixture')",[id(11),id(1),id(3)]);
  await sql.query("INSERT INTO student_comments(id,course_id,professor_id,message,would_take_again,review_id,source,legacy_document,source_snapshot) VALUES('native-comment',$1,$2,'Original native comment that must never be rewritten.',true,$3,'legacy_eagleeval','{\"message\":\"original\"}','fixture')",[id(1),id(3),id(6)]);
  await sql.query("INSERT INTO external_review_profiles(source_teacher_id,legacy_teacher_id,school_id,display_name,professor_id,match_method,reported_rating_count,source_document,source_snapshot,fetched_at) VALUES('teacher',900,'U2Nob29sLTEyMg==','Archived Professor',$1,'verified',2,'{\"teacher\":\"original\"}','fixture','2026-10-01Z')",[id(3)]);
  await sql.query("INSERT INTO external_reviews(source_review_id,source_teacher_id,course_id,course_code,message,would_take_again,created_at,source_document,source_snapshot,fetched_at,context_note) VALUES('Rating-A','teacher',NULL,'2000','Original external comment that must remain unchanged.',true,'2025-01-01Z','{\"class\":\"2000\"}','fixture','2026-10-01Z','The exact original course was not verified.'),('Rating-B','teacher',$1,'MATH1004','A matched external experience.',false,'2025-01-02Z','{\"kept\":true}','fixture','2026-10-01Z',NULL)",[id(1)]);
  await sql.query("INSERT INTO anonymous_reports(id,target_kind,target_id,reason,message) VALUES($1,'review','rmp:Rating-A','wrong-association','The class linked to this comment needs a correction.')",[id(7)]);
  return {pg,sql,dal:loadManagement(sql)};
}
const correction=(review,extra={})=>({actionId:randomUUID(),reviewId:review.id,expectedFingerprint:review.fingerprint,professorId:id(4),courseId:id(2),reason:'Confirmed against the original course archive.',evidenceUrl:'https://example.org/archive/catalog',...extra});
async function sources(sql) {
  const result={};
  for(const table of ['courses','professors','reviews','review_metrics','student_comments','external_reviews','external_review_profiles']) result[table]=await sql.query(`SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY to_jsonb(t)::text`);
  return result;
}

test('every owner DAL call rejects an absent or mismatched owner before database access',async()=>{
  let queries=0;const sql=async()=>{queries++;throw Error('Database must not run');};
  const blocked=loadManagement(sql,()=>null);
  for(const [fn,args] of [
    ['getOwnerOverview',[]],['getOwnerReports',[]],['getOwnerReviewLookup',[{}]],
    ['getOwnerCatalogCandidates',[{kind:'course',query:'MATH'}]],
    ['changeOwnerReportStatus',[{},owner]],['correctOwnerReviewAssociation',[{},owner]],
    ['installOwnerGrowthBaseline',[{},owner]],
  ]) await assert.rejects(()=>blocked[fn](...args),error=>error.status===401);
  const mismatched=loadManagement(sql);
  await assert.rejects(()=>mismatched.changeOwnerReportStatus({}, {githubId:'67890'}),error=>error.status===401);
  assert.equal(queries,0);
});

test('owner corrections validate IDs, fingerprint, evidence, bounded text and deliberate context replacement',()=>{
  const dal=loadManagement(()=>{});
  const input=correction({id:'rmp:Rating-A',fingerprint:'a'.repeat(32)});
  assert.equal(dal.validateOwnerAssociation(input).contextNoteMode,'preserve');
  assert.equal(dal.validateOwnerAssociation({...input,contextNote:'Do not accidentally replace source context.'}).contextNote,null);
  assert.equal(dal.validateOwnerAssociation({...input,contextNoteMode:'replace',contextNote:null}).contextNote,null);
  for(const change of [
    {professorId:'bad'}, {courseId:''}, {reviewId:"x' OR 1=1"}, {actionId:'random'},
    {expectedFingerprint:'bad'}, {reason:'short'}, {contextNoteMode:'erase'},
    {contextNote:'x'.repeat(2001)}, {evidenceUrl:'javascript:alert(1)'},
    {evidenceUrl:'https://user:secret@example.org/proof'}, {evidenceUrl:'https://example.org/ bad'},
  ]) assert.throws(()=>dal.validateOwnerAssociation({...input,...change}),error=>error.status===400);
  const status={actionId:randomUUID(),reportId:id(7),status:'resolved',expectedVersion:1,reason:'Reviewed and corrected the course link.'};
  assert.equal(dal.validateOwnerReportStatus(status).status,'resolved');
  for(const change of [{status:'hidden'},{expectedVersion:0},{reportId:'native-comment'},{reason:'no'}])
    assert.throws(()=>dal.validateOwnerReportStatus({...status,...change}),error=>error.status===400);
});

test('association overrides apply before aliases, preserve every source field, update counts, and retry safely',async t=>{
  const {sql,dal}=await fixture(t);
  const before=await sources(sql);
  const external=(await dal.getOwnerReviewLookup({reviewId:'rmp:Rating-A'})).reviews[0];
  const originalColumns=(await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name='public_written_reviews' ORDER BY ordinal_position")).map(row=>row.column_name);
  assert.deepEqual(originalColumns,['id','message','would_take_again','created_at','source','review_semester','professor_id','professor_name','course_id','course_code','course_title','source_url','source_professor_id','published','context_note']);
  assert.equal((await dal.getOwnerOverview()).unmatchedReviews,1);
  const input=correction(external,{professorId:id(5)});
  const response=await dal.correctOwnerReviewAssociation(input,owner);
  assert.equal(response.replayed,false);
  assert.equal(response.review.professorId,id(4),'override is canonicalized after selecting the new professor');
  assert.equal(response.review.professorName,'Correct Professor');
  assert.equal(response.review.courseId,id(2));
  assert.equal(response.review.courseCode,'ACCT1021');
  assert.equal(response.review.contextNote,external.contextNote,'uncertainty note remains without explicit replacement');
  assert.equal(response.review.overrideVersion,1);
  assert.notEqual(response.review.fingerprint,external.fingerprint);
  assert.deepEqual(await sources(sql),before,'raw tables and imported JSON/IDs remain exactly unchanged');
  assert.equal((await dal.getOwnerOverview()).unmatchedReviews,0);
  assert.equal((await sql.query('SELECT comment_count FROM course_summaries WHERE id=$1',[id(2)]))[0].comment_count,1);
  const replay=await dal.correctOwnerReviewAssociation(input,owner);
  assert.equal(replay.replayed,true);
  assert.equal(replay.review.fingerprint,response.review.fingerprint);
  assert.equal((await sql.query('SELECT count(*)::int AS total FROM owner_actions'))[0].total,1);
  await assert.rejects(()=>dal.correctOwnerReviewAssociation({...input,reason:'A changed request must not reuse its action ID.'},owner),error=>error.status===409);
  await assert.rejects(()=>dal.correctOwnerReviewAssociation({...input,actionId:randomUUID()},owner),error=>error.status===409);
  assert.equal((await sql.query('SELECT version FROM review_association_overrides'))[0].version,1);
  const native=(await dal.getOwnerReviewLookup({reviewId:'native-comment'})).reviews[0];
  const nativeResult=await dal.correctOwnerReviewAssociation(correction(native),owner);
  assert.equal(nativeResult.review.reviewSemester,'Spring 2024');
  assert.equal(nativeResult.review.pairedRatingId,id(6));
  const paired=(await sql.query('SELECT * FROM public_rating_records WHERE id=$1',[id(6)]))[0];
  assert.equal(paired.course_id,id(2));assert.equal(paired.professor_id,id(4));
  assert.equal(paired.course_code,'ACCT1021');assert.equal(paired.professor_name,'Correct Professor');
  assert.equal(Number(paired.course_overall),4);assert.equal(Number(paired.instructor_overall),5);
  assert.equal((await sql.query('SELECT review_count FROM course_summaries WHERE id=$1',[id(2)]))[0].review_count,1);
  assert.equal((await sql.query('SELECT review_count FROM course_summaries WHERE id=$1',[id(1)]))[0].review_count,1);
  const unpaired=(await sql.query('SELECT * FROM public_rating_records WHERE id=$1',[id(11)]))[0];
  assert.equal(unpaired.course_id,id(1));assert.equal(unpaired.professor_id,id(3));
  const ratingColumns=(await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name='public_rating_records' ORDER BY ordinal_position")).map(row=>row.column_name);
  assert.deepEqual(ratingColumns,['id','course_id','professor_id','section_code','course_code','professor_name','semester','section','course_overall','instructor_overall','legacy_document','source_snapshot','imported_at','source','published','submitted_at','submission_fingerprint']);
  assert.equal(nativeResult.review.professorId,id(4));
  assert.equal((await sql.query('SELECT comment_count FROM professor_summaries WHERE id=$1',[id(4)]))[0].comment_count,2);
  assert.deepEqual(await sources(sql),before);
  await assert.rejects(()=>sql.query("UPDATE owner_actions SET reason='tampered'"),error=>error.code==='P0403');
  await assert.rejects(()=>sql.query('DELETE FROM owner_actions'),error=>error.code==='P0403');
  await applyMigrations(sql,'database/migrations');
  assert.equal((await dal.getOwnerReviewLookup({reviewId:'native-comment'})).reviews[0].overrideVersion,1,'migration replay retains owner overrides');
});

test('invalid targets roll back atomically; explicit reviewed context and deliberate course unlink persist',async t=>{
  const {sql,dal}=await fixture(t);
  const review=(await dal.getOwnerReviewLookup({reviewId:'rmp:Rating-A'})).reviews[0];
  for(const change of [{professorId:id(99)},{courseId:id(99)}]) {
    await assert.rejects(()=>dal.correctOwnerReviewAssociation(correction(review,change),owner),error=>error.status===404);
    assert.equal((await sql.query('SELECT count(*)::int AS total FROM review_association_overrides'))[0].total,0);
    assert.equal((await sql.query('SELECT count(*)::int AS total FROM owner_actions'))[0].total,0);
  }
  const replacement=await dal.correctOwnerReviewAssociation(correction(review,{contextNoteMode:'replace',contextNote:'Course verified against the archived syllabus.'}),owner);
  assert.equal(replacement.review.contextNote,'Course verified against the archived syllabus.');
  const preserved=await dal.correctOwnerReviewAssociation(correction(replacement.review,{courseId:null}),owner);
  assert.equal(preserved.review.courseId,null);
  assert.equal(preserved.review.courseCode,null,'a deliberately removed match does not keep a misleading imported code');
  assert.equal(preserved.review.contextNote,replacement.review.contextNote,'preserve retains an existing reviewed note');
  const cleared=await dal.correctOwnerReviewAssociation(correction(preserved.review,{contextNoteMode:'replace',contextNote:null}),owner);
  assert.equal(cleared.review.contextNote,null);
  assert.equal((await sql.query("SELECT context_note FROM external_reviews WHERE source_review_id='Rating-A'"))[0].context_note,review.contextNote);
  await sql.query("UPDATE professors SET name='Correct Professor with refreshed catalog name' WHERE id=$1",[id(4)]);
  await assert.rejects(()=>dal.correctOwnerReviewAssociation(correction(cleared.review),owner),error=>error.status===409,'catalog changes also invalidate an optimistic fingerprint');
});

test('report status queue is versioned, idempotent, reopenable and private; bounded catalog lookup stays read-only',async t=>{
  const {sql,dal}=await fixture(t);
  const input={actionId:randomUUID(),reportId:id(7),status:'resolved',expectedVersion:1,reason:'Reviewed proof and corrected the course association.'};
  const result=await dal.changeOwnerReportStatus(input,owner);
  assert.equal(result.report.status,'resolved');assert.equal(result.report.version,2);assert.ok(result.report.resolvedAt);
  assert.equal((await dal.getOwnerReports()).total,0);
  assert.equal((await dal.getOwnerReports({status:'resolved'})).total,1);
  assert.equal((await dal.changeOwnerReportStatus(input,owner)).replayed,true);
  await assert.rejects(()=>dal.changeOwnerReportStatus({...input,actionId:randomUUID()},owner),error=>error.status===409);
  const reopened=await dal.changeOwnerReportStatus({...input,actionId:randomUUID(),status:'open',expectedVersion:2},owner);
  assert.equal(reopened.report.version,3);assert.equal(reopened.report.resolvedAt,null);
  const dismissed=await dal.changeOwnerReportStatus({...input,actionId:randomUUID(),status:'dismissed',expectedVersion:3},owner);
  assert.equal(dismissed.report.version,4);assert.ok(dismissed.report.resolvedAt);
  await assert.rejects(()=>dal.changeOwnerReportStatus({...input,actionId:randomUUID(),reportId:id(99)},owner),error=>error.status===404);
  const before=await sources(sql);
  assert.equal((await dal.getOwnerCatalogCandidates({kind:'course',query:'MATH 1004'}))[0].id,id(1));
  assert.equal((await dal.getOwnerCatalogCandidates({kind:'professor',query:'Correct'}))[0].id,id(4));
  assert.equal((await dal.getOwnerCatalogCandidates({kind:'professor',query:'Alias'})).length,0);
  assert.equal((await dal.getOwnerReviewLookup({query:'original external',unmatchedOnly:true})).total,1);
  await assert.rejects(()=>dal.getOwnerReports({limit:1000}),error=>error.status===400);
  assert.deepEqual(await sources(sql),before);
  assert.equal((await dal.getOwnerOverview()).recentActions.length,3);
  assert.equal((await sql.query('SELECT count(*)::int AS total FROM public_written_reviews'))[0].total,3,'private reports never enter the review feed');
});

test('growth baselines are private immutable snapshots and historical course provenance appends view columns',async t=>{
  const {sql,dal}=await fixture(t);
  const dataset={id:'fixture-baseline',measuredAt:'2026-10-15T00:29:00Z',traffic:{period:{start:'2026-10-08T00:00:00Z',end:'2026-10-15T00:00:00Z'},current:{visitors:12,pageViews:50},previous:{start:'2026-10-01T00:00:00Z',end:'2026-10-08T00:00:00Z',visitors:10,pageViews:30},last28Days:{start:'2026-09-17T00:00:00Z',end:'2026-10-15T00:00:00Z',visitors:40,pageViews:150},notes:['Fixture only.']},speedInsights:{available:true,period:{start:'2026-10-08T00:00:00Z',end:'2026-10-15T00:00:00Z'},aggregation:'p75',sampleRate:0.5,metrics:{cls:{p75:null,dataPoints:0,unit:'score'}},notes:[]},searchConsole:{available:false,reason:'No verified owner session.'},sources:['https://example.org/fixture']};
  await dal.installOwnerGrowthBaseline(dataset,owner);
  await dal.installOwnerGrowthBaseline(dataset,owner);
  assert.equal((await dal.getOwnerOverview()).growthBaselines.length,1);
  assert.deepEqual(json((await dal.getOwnerOverview()).growthBaselines[0]),dataset);
  await assert.rejects(()=>dal.installOwnerGrowthBaseline({...dataset,traffic:{...dataset.traffic,current:{visitors:13,pageViews:51}}},owner),error=>error.status===409);
  await sql.query("INSERT INTO courses(id,code,title,subject,description,legacy_document,source_snapshot,catalog_source,catalog_evidence) VALUES($1,'ACCT0099','Historical class','Accounting','Imported historical course','{}','fixture','historical_archive','{\"proof\":\"https://example.org/archive\"}')",[id(20)]);
  const historical=(await sql.query('SELECT * FROM course_summaries WHERE id=$1',[id(20)]))[0];
  assert.equal(historical.catalog_source,'historical_archive');
  assert.equal(historical.catalog_evidence.proof,'https://example.org/archive');
  const columns=(await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name='course_summaries' ORDER BY ordinal_position")).map(row=>row.column_name);
  assert.deepEqual(columns,['id','code','title','subject','college','description','review_count','course_overall','instructor_overall','comment_count','catalog_source','catalog_evidence']);
});


test('freshness distinguishes native submissions from imports and stale paired rating links invalidate correction fingerprints',async t=>{
  const {sql,dal}=await fixture(t);
  for(const [n,days,published] of [[30,2,true],[31,5,true],[32,10,true],[33,30,true],[34,1,false]]) {
    await sql.query("INSERT INTO reviews(id,course_id,professor_id,course_code,professor_name,semester,legacy_document,source_snapshot,source,submitted_at,published) VALUES($1,$2,$3,'MATH1004','Original Professor','Fall 2026','{}','fixture','eagleevals_anonymous',now()-($4 || ' days')::interval,$5)",[id(n),id(1),id(3),String(days),published]);
  }
  const health=(await dal.getOwnerOverview()).reviewHealth;
  assert.equal(health.nativeLast7Days,2);assert.equal(health.nativeLast28Days,3);
  assert.ok(health.lastNativeSubmissionAt);assert.equal(health.writtenReviews,3);
  assert.equal(health.courseLinkedWrittenReviews,2);assert.equal(health.professorLinkedWrittenReviews,3);
  assert.ok(health.oldestOpenReportAt);
  const native=(await dal.getOwnerReviewLookup({reviewId:'native-comment'})).reviews[0];
  await sql.query('UPDATE reviews SET course_id=$1 WHERE id=$2',[id(2),id(6)]);
  await assert.rejects(()=>dal.correctOwnerReviewAssociation(correction(native),owner),error=>error.status===409);
  assert.equal((await sql.query('SELECT count(*)::int AS total FROM owner_actions'))[0].total,0);
});
