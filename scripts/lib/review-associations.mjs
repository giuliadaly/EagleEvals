import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const associationEvidence=JSON.parse(readFileSync(new URL('../../database/reference/review-associations.json',import.meta.url),'utf8'));
export const normalizedName=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/^(?:dr\.?|prof\.?|professor)\s+/,'').replace(/(?:,?\s+)(?:jr\.?|sr\.?|ii|iii|iv)$/,'')
  .replace(/[’'\.\-]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const normalizedCourse=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const shortName=value=>{const w=normalizedName(value).split(' ');return w.length>=2?`${w[0]} ${w.at(-1)}`:'';};
const middle=value=>normalizedName(value).split(' ').slice(1,-1).map(w=>w[0]).join('');
export const sourceProfessorId=teacherId=>createHash('sha256').update(`eagleevals:external-rmp-teacher:${teacherId}`).digest('hex').slice(0,24);

export function verifiedNativeAliases(professors){
 return associationEvidence.nativeAliases.filter(a=>{
  const alias=professors.find(p=>p.id===a.aliasId),canonical=professors.find(p=>p.id===a.canonicalId);
  return alias&&canonical&&normalizedName(alias.name)===normalizedName(a.name)&&normalizedName(canonical.name)===normalizedName(a.name)
    &&alias.phone&&alias.phone===canonical.phone;
 });
}

export function matchRecoveredProfessor(teacher,professors,teachers){
 const name=`${teacher.firstName.trim()} ${teacher.lastName.trim()}`;
 const aliases=new Map(verifiedNativeAliases(professors).map(a=>[a.aliasId,a.canonicalId]));
 const canonical=professors.filter(p=>!aliases.has(p.id)&&p.catalog_source!=='external_rmp');
 const override=associationEvidence.profileLinks.find(a=>a.teacherId===teacher.legacyId);
 if(override&&normalizedName(override.sourceName)===normalizedName(name)&&canonical.some(p=>p.id===override.professorId&&normalizedName(p.name)===normalizedName(override.nativeName)))
  return {professorId:override.professorId,method:'verified_alias'};
 const exact=canonical.filter(p=>normalizedName(p.name)===normalizedName(name));
 const sourceExact=teachers.filter(p=>normalizedName(`${p.firstName} ${p.lastName}`)===normalizedName(name));
 const sameDepartment=teacher.department&&sourceExact.every(p=>normalizedName(p.department??'')===normalizedName(teacher.department));
 if(exact.length===1&&(sourceExact.length===1||sameDepartment))return {professorId:exact[0].id,method:sourceExact.length===1?'exact_name':'same_name_source_profiles'};
 const short=shortName(name);
 const local=canonical.filter(p=>shortName(p.name)===short&&(!middle(p.name)||!middle(name)||middle(p.name)===middle(name)));
 const remote=teachers.filter(p=>shortName(`${p.firstName} ${p.lastName}`)===short&&(!middle(`${p.firstName} ${p.lastName}`)||!middle(name)||middle(`${p.firstName} ${p.lastName}`)===middle(name)));
 if(local.length===1&&remote.length===1)return {professorId:local[0].id,method:'unique_name_middle_compatible'};
 return {professorId:null,method:local.length||exact.length?'ambiguous_name':'no_local_match'};
}

const onePrefixEdit=(a,b)=>{
 if(a===b)return true;
 if(a.length===b.length){const positions=[...a].map((c,i)=>c!==b[i]?i:-1).filter(i=>i>=0);return positions.length===1||(positions.length===2&&positions[1]===positions[0]+1&&a[positions[0]]===b[positions[1]]&&a[positions[1]]===b[positions[0]]);}
 if(Math.abs(a.length-b.length)!==1)return false;
 const longer=a.length>b.length?a:b,shorter=a.length>b.length?b:a;
 return [...longer].some((_,i)=>longer.slice(0,i)+longer.slice(i+1)===shorter);
};

export function matchReviewCourse(raw,courses,knownCourseIds=[]){
 const key=normalizedCourse(raw);
 const exact=courses.filter(c=>normalizedCourse(c.code)===key);
 if(exact.length===1)return {courseId:exact[0].id,method:'exact_source_code'};
 // BC section identifiers append exactly two digits to the eight-character code.
 if(/^[A-Z]{4}\d{6}$/.test(key)){
  const base=courses.filter(c=>normalizedCourse(c.code)===key.slice(0,8));
  if(base.length===1)return {courseId:base[0].id,method:'course_section_code'};
 }
 const known=courses.filter(c=>knownCourseIds.includes(c.id));
 if(/^\d{4}$/.test(key)){
  const candidates=known.filter(c=>normalizedCourse(c.code).endsWith(key));
  if(candidates.length===1)return {courseId:candidates[0].id,method:'unique_professor_course_number'};
 }
 const source=key.match(/^([A-Z]{2,6})(\d{4})$/);
 if(source){
  const candidates=known.filter(c=>{const target=normalizedCourse(c.code).match(/^([A-Z]{2,6})(\d{4})$/);return target&&source[2]===target[2]&&onePrefixEdit(source[1],target[1]);});
  if(candidates.length===1)return {courseId:candidates[0].id,method:'professor_course_prefix_variant'};
 }
 const title=normalizedName(String(raw??''));
 const titles=title?known.filter(c=>normalizedName(c.title??'')===title):[];
 if(titles.length===1)return {courseId:titles[0].id,method:'exact_professor_course_title'};
 return {courseId:null,method:'unmatched'};
}

export function sourceCourseException(teacher,review){
 return associationEvidence.courseExclusions.find(e=>e.teacherId===teacher.legacyId&&e.reviewId===review.id&&e.class===review.class&&review.comment.includes(e.requiredText));
}

export function planNativeLinkRepairs(reviews,professors,courses){
 const aliases=new Map(verifiedNativeAliases(professors).map(a=>[a.aliasId,a.canonicalId]));
 const canonical=professors.filter(p=>!aliases.has(p.id));const repairs=[];
 for(const r of reviews){
  if(!r.professor_id){
   const target=normalizedName(r.professor_name);
   const p=canonical.filter(p=>normalizedName(p.name)===target||associationEvidence.profileLinks.some(a=>a.professorId===p.id&&normalizedName(a.nativeName)===normalizedName(p.name)&&normalizedName(a.sourceName)===target));
   if(p.length===1)repairs.push({reviewId:r.id,field:'professor_id',previous:null,next:p[0].id,method:normalizedName(p[0].name)===target?'unique_exact_archived_name':'verified_archived_alias'});
  }
  if(!r.course_id){const c=courses.filter(c=>normalizedCourse(c.code)===normalizedCourse(r.course_code));if(c.length===1)repairs.push({reviewId:r.id,field:'course_id',previous:null,next:c[0].id,method:'unique_exact_archived_code'});}
 }
 return repairs;
}

export function recoveryDiff(plan,existingProfiles=[],existingReviews=[]){
 const ids=new Set(plan.reviews.map(r=>r.source_review_id));
 const profiles=new Map(plan.profiles.map(p=>[p.source_teacher_id,p]));
 const reviews=new Map(plan.reviews.map(r=>[r.source_review_id,r]));
 return {missingProfiles:existingProfiles.filter(p=>!profiles.has(p.source_teacher_id)).map(p=>p.source_teacher_id),
  removedPublishedReviews:existingReviews.filter(r=>r.published&&!ids.has(r.source_review_id)).map(r=>r.source_review_id),
  lostProfessorLinks:existingProfiles.filter(p=>p.professor_id&&profiles.has(p.source_teacher_id)&&!profiles.get(p.source_teacher_id).professor_id).map(p=>p.source_teacher_id),
  lostCourseLinks:existingReviews.filter(r=>r.course_id&&reviews.has(r.source_review_id)&&!reviews.get(r.source_review_id).course_id&&!reviews.get(r.source_review_id).context_note).map(r=>r.source_review_id),
  changedProfessorLinks:existingProfiles.filter(p=>p.professor_id&&profiles.has(p.source_teacher_id)&&profiles.get(p.source_teacher_id).professor_id!==p.professor_id)
    .map(p=>({sourceId:p.source_teacher_id,previous:p.professor_id,next:profiles.get(p.source_teacher_id).professor_id,method:profiles.get(p.source_teacher_id).match_method})),
  changedCourseLinks:existingReviews.filter(r=>r.course_id&&reviews.has(r.source_review_id)&&reviews.get(r.source_review_id).course_id!==r.course_id)
    .map(r=>({sourceId:r.source_review_id,previous:r.course_id,next:reviews.get(r.source_review_id).course_id,method:reviews.get(r.source_review_id).course_match_method,context:reviews.get(r.source_review_id).context_note})),
  olderProfileSnapshots:existingProfiles.filter(p=>profiles.has(p.source_teacher_id)&&Date.parse(p.fetched_at)>Date.parse(profiles.get(p.source_teacher_id).fetched_at))
    .map(p=>p.source_teacher_id)};
}

export function assertRecoveryCoverage(diff,sha256,approvalDigest){
 if(Object.values(diff).some(ids=>ids.length)&&approvalDigest!==sha256)throw Error('Recovery coverage regressed; inspect the diff and approve this exact snapshot digest before publication');
}

export async function applyNativeLinkRepairs(sql,repairs){
 const rows=await sql.query('SELECT repair_archived_review_links($1::jsonb) AS repairs',[JSON.stringify(repairs)]);
 return rows[0].repairs;
}
