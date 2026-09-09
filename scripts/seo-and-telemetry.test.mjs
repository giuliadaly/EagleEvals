import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { directoryMetadata, breadcrumbData, serializeJsonLd } from '../src/data/seo.ts';
import { telemetryUrl, redactTelemetry, reviewDuration, productEventData } from '../src/data/telemetry.ts';

const id = '65c4299149939741c6777cc2';
test('telemetry strips search, prefill, campaign, credential and fragment data', () => {
  for (const path of ['/review', '/search', '/courses', `/courses/${id}`, `/professors/${id}`]) {
    assert.equal(telemetryUrl(`https://user:password@eagleevals.com${path}?q=private+text&professor=${id}&utm_source=private#review-id`), `https://eagleevals.com${path}`);
  }
  for (const path of ['/api/reviews', '/not-a-page/private-name', '/showcase', '/courses/private-name', '/review/private-id']) {
    assert.equal(telemetryUrl(`https://eagleevals.com${path}`), null);
  }
  assert.equal(telemetryUrl('javascript:alert(1)'), null);
  assert.equal(telemetryUrl('broken'), null);
  const event = { type: 'vital', url: `https://eagleevals.com/review?course=${id}`, route: '/review' };
  assert.deepEqual(redactTelemetry(event), { ...event, url: 'https://eagleevals.com/review' });
  assert.match(event.url, /course=/, 'do not mutate shared SDK objects');
});

test('event payloads exclude form details and timing uses broad ranges', () => {
  const privateFields = { message: 'private text', courseId: id, professorId: id, rating: 5, query: 'private search' };
  assert.deepEqual(productEventData({ name: 'review_submitted', duration: 'under_1_min', ...privateFields }), { duration: 'under_1_min' });
  assert.deepEqual(productEventData({ name: 'review_error', reason: 'server', ...privateFields }), { reason: 'server' });
  assert.equal(productEventData({ name: 'review_started', ...privateFields }), undefined);
  assert.deepEqual([0, 59_999, 60_000, 119_999, 120_000, 299_999, 300_000].map(reviewDuration), ['under_1_min','under_1_min','1_to_2_min','1_to_2_min','2_to_5_min','2_to_5_min','5_plus_min']);
});

test('pagination preserves crawlable page identity and default filters deduplicate', () => {
  for (const path of ['/courses', '/professors', '/comments', '/evaluations']) {
    const meta = directoryMetadata(path, 'Directory', 'Description', { page: '2', sort: 'evidence', q: '', min: '0' });
    assert.equal(meta.alternates.canonical, `${path}?page=2`);
    assert.match(meta.title, /Page 2/);
    assert.equal(meta.robots, undefined);
    assert.equal(directoryMetadata(path, 'Directory', '', { page: '1' }).alternates.canonical, path);
  }
  const subject = directoryMetadata('/courses', 'Courses', '', { subject: 'English', page: '2' });
  assert.equal(subject.alternates.canonical, '/courses?subject=English&page=2');
  assert.match(subject.title, /English courses at Boston College/);
});

test('search and arbitrary filters do not create indexable duplicate collections', () => {
  for (const params of [{q:'ENGL1010'}, {sort:'rating'}, {min:'4'}, {subject:'unrecognized subject'}]) {
    const meta = directoryMetadata('/courses', 'Courses', '', params);
    assert.deepEqual(meta.robots, {index:false,follow:true});
    assert.equal(meta.alternates, undefined, 'do not canonicalize different filtered content to page one');
  }
});

test('breadcrumb markup follows visible navigation and escapes script termination', () => {
  const data = breadcrumbData([{label:'Courses',href:'/courses'}, {label:'</script><script>alert(1)</script>'}]);
  assert.equal(data.itemListElement[0].item, 'https://eagleevals.com/courses');
  assert.equal(data.itemListElement[1].position, 2);
  const serialized = serializeJsonLd(data);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), data);
});

function loadComponent(file, dependencies, globals = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(code, {module, exports:module.exports, console, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }}, {filename:file});
  return module.exports;
}
const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};

test('an analytics failure cannot prevent a product action', () => {
  const module = loadComponent('src/components/site-telemetry.tsx', {
    'react/jsx-runtime':jsx, '@vercel/analytics/next':{}, '@vercel/speed-insights/next':{},
    '@vercel/analytics':{track(){throw new Error('blocked');}}, '@/data/telemetry':{productEventData,redactTelemetry}
  });
  assert.doesNotThrow(()=>module.trackProductEvent({name:'review_started'}));
});

test('real form handlers count starts once, report failures, and only count confirmed success', async () => {
  let cells=[], cursor=0, clock=0, status=500, posts=0, offline=false;
  const events=[];
  const state=initial=>{const n=cursor++;if(!(n in cells))cells[n]=initial;return [cells[n],value=>{cells[n]=value;}];};
  const react={useState:state,useRef:initial=>state({current:initial})[0],useId:()=>':id:',useEffect(){}};
  const fields={semester:'Fall 2026',courseOverall:'5',instructorOverall:'4',message:'Private draft written only for a mocked request.',reviewConfirmed:'on'};
  const {AnonymousReviewForm}=loadComponent('src/components/anonymous-review-form.tsx', {
    react,'react/jsx-runtime':jsx,'next/link':{},'./semester-picker':{},'./use-catalog-search':{},
    './site-telemetry':{trackProductEvent:event=>events.push(JSON.parse(JSON.stringify(event)))},
    '@/data/telemetry':{reviewDuration}
  }, {
    performance:{now:()=>clock}, FormData:class {get(key){return fields[key]??null;}},
    fetch:async()=>{posts++; if(offline)throw new Error('offline');return {ok:status===201,status,json:async()=>({message:'server message',course:{id,code:'ENGL1010'},professor:{id,name:'Fixture'}})};}
  });
  const selection={id,primary:'Fixture',secondary:'Fixture'};
  const render=()=>{cursor=0;return AnonymousReviewForm({initialCourse:selection,initialProfessor:selection,currentYear:2026});};
  let tree=render();
  tree.props.onChangeCapture();clock=20_000;tree.props.onChangeCapture();
  tree.props.onInvalidCapture();tree.props.onInvalidCapture();
  assert.deepEqual(events,[{name:'review_started'},{name:'review_error',reason:'validation'}]);
  tree=render(); await tree.props.onSubmit({preventDefault(){},currentTarget:{}});
  assert.equal(posts,1);assert.deepEqual(events.at(-1),{name:'review_error',reason:'server'});
  assert.ok(!events.some(e=>e.name==='review_submitted'));
  offline=true;tree=render();await tree.props.onSubmit({preventDefault(){},currentTarget:{}});
  assert.deepEqual(events.at(-1),{name:'review_error',reason:'network'});
  offline=false;status=201;clock=70_000;tree=render();await tree.props.onSubmit({preventDefault(){},currentTarget:{}});
  assert.deepEqual(events.at(-1),{name:'review_submitted',duration:'1_to_2_min'});
  assert.equal(events.filter(e=>e.name==='review_started').length,1);
  assert.ok(!JSON.stringify(events).includes(id));assert.ok(!JSON.stringify(events).includes('Private draft'));
  assert.equal(render().type,'section');
});
