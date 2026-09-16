import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as quick from '../src/data/quick-search.ts';

test('search reuses names and cannot overwrite new review counts with an older request', async () => {
  const catalog = { courses: [{id:'course',code:'ENGL1010',title:'Writing',subject:'English'}], professors:[] };
  const pending = [];
  let catalogFetches = 0;
  const compiled = {exports:{}};
  const source = ts.transpileModule(readFileSync('src/components/search-catalog-store.ts', 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(source, {module:compiled,exports:compiled.exports,require:()=>quick,
    fetch: async url => {
      if (url.endsWith('/v2')) { catalogFetches++; return {ok:true,json:async()=>catalog}; }
      return new Promise(resolve => pending.push(count => resolve({ok:count !== null,json:async()=>({courses:[['course',count,count]],professors:[]})})));
    },
  });
  const store = compiled.exports;
  const updates = [];
  const unsubscribe = store.subscribeToCatalog(index => updates.push(quick.filterQuickCatalog(index, 'E').courses[0].commentCount));
  const initial = await store.prepareSearchCatalog();
  assert.equal(quick.filterQuickCatalog(initial,'E').courses[0].commentCount, undefined, 'Unknown does not become zero');
  store.refreshSearchEvidence(false);
  store.refreshSearchEvidence(false);
  assert.equal(pending.length, 1, 'Concurrent components share the counts request');
  store.refreshSearchEvidence();
  assert.equal(pending.length, 2, 'A saved review starts a fresh request');
  pending[1](2);
  await new Promise(setImmediate);
  pending[0](1);
  await new Promise(setImmediate);
  assert.deepEqual(updates, [2], 'An older in-flight response cannot roll back counts');
  store.refreshSearchEvidence(false);
  pending[2](null);
  await new Promise(setImmediate);
  assert.equal(quick.filterQuickCatalog(await store.prepareSearchCatalog(),'E').courses[0].id,'course');
  assert.equal(catalogFetches,1);
  unsubscribe();
});
