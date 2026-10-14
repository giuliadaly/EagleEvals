import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readReviewSubmissionResponse, uncertainSubmissionMessage } from '../src/data/review-submission-response.ts';
import { formatReviewCount } from '../src/data/format.ts';

const courses = [
  { id: 'first', code: 'ENGL1010', title: 'Writing', subject: 'English' },
  { id: 'second', code: 'ENGL2000', title: 'Literature', subject: 'English' },
];

// Exercise the actual component's events and rendered ARIA state without adding
// a browser test framework. Root integration checks cover the native focus flow.
function pickerHarness() {
  const slots = [];
  let cursor = 0;
  let selection = null;
  const react = {
    useId: () => 'picker',
    useEffect() {},
    useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './use-catalog-search': { useCatalogSearch: (_query, enabled) => ({ results: { courses: enabled ? courses : [], professors: [] }, loading: false, failed: false }) } };
  const source = ts.transpileModule(readFileSync('src/components/catalog-picker.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const flatten = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(flatten)];
  let tree;
  function render() { cursor = 0; tree = compiled.exports.CatalogPicker({ kind: 'course', label: 'Course', selected: selection, onSelect: value => { selection = value; } }); return tree; }
  const find = role => flatten(tree).filter(element => element.props?.role === role);
  function key(element, value) {
    let prevented = false;
    element.props.onKeyDown({ key: value, nativeEvent: { isComposing: false }, preventDefault() { prevented = true; } });
    render();
    return prevented;
  }
  render();
  return { render, find, key, setSelection(value) { selection = value; render(); }, get tree() { return tree; }, get selection() { return selection; } };
}

test('picker arrow keys wrap and Enter selects the active course without submitting', () => {
  const picker = pickerHarness();
  picker.find('combobox')[0].props.onChange({ target: { value: 'ENGL' } });
  picker.render();
  assert.equal(picker.find('listbox').length, 1);
  assert.ok(picker.key(picker.find('combobox')[0], 'ArrowUp'));
  assert.equal(picker.find('combobox')[0].props['aria-activedescendant'], 'picker-choice-1');
  assert.ok(picker.key(picker.find('combobox')[0], 'ArrowDown'));
  assert.equal(picker.find('option')[0].props['aria-selected'], true);
  assert.ok(picker.key(picker.find('combobox')[0], 'Enter'));
  assert.equal(picker.selection.id, 'first');
  assert.equal(picker.find('combobox')[0].props.value, 'ENGL1010');
  assert.equal(picker.find('listbox').length, 0);
});

test('Tab keeps suggestions open within the picker, Escape closes, and outside blur closes', () => {
  const picker = pickerHarness();
  picker.find('combobox')[0].props.onChange({ target: { value: 'ENGL' } });
  picker.render();
  assert.equal(picker.key(picker.find('combobox')[0], 'Tab'), false);
  picker.tree.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} });
  picker.render();
  assert.equal(picker.find('listbox').length, 1);
  picker.find('option')[1].props.onFocus();
  picker.render();
  assert.equal(picker.find('option')[1].props['aria-selected'], true);
  assert.ok(picker.key(picker.find('option')[1], 'Escape'));
  assert.equal(picker.find('listbox').length, 0);
  picker.find('combobox')[0].props.onFocus();
  picker.render();
  picker.tree.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: {} });
  picker.render();
  assert.equal(picker.find('listbox').length, 0);
});

test('known selections update the displayed value without remounting the picker', () => {
  const picker = pickerHarness();
  picker.find('combobox')[0].props.onChange({ target: { value: 'ENGL' } });
  picker.render();
  picker.setSelection({ id: 'second', primary: 'ENGL2000', secondary: 'Literature' });
  assert.equal(picker.find('combobox')[0].props.value, 'ENGL2000');
  assert.equal(picker.find('listbox').length, 0);
});

test('submission outages show useful text even if a proxy returns HTML or empty content', async () => {
  for (const response of [new Response('<html>502 Bad Gateway</html>', { status: 502 }), new Response(null, { status: 503 }), Response.json({ message: 'secret driver details' }, { status: 500 })]) {
    await assert.rejects(readReviewSubmissionResponse(response), /Publishing is temporarily unavailable\. Your review is still here/);
  }
  await assert.rejects(readReviewSubmissionResponse(new Response(null, { status: 200 })), { message: uncertainSubmissionMessage });
  await assert.rejects(readReviewSubmissionResponse(Response.json({ course: {}, professor: {} })), { message: uncertainSubmissionMessage });
});

test('submission responses preserve actionable validation, duplicate and rate-limit messages', async () => {
  for (const status of [400, 404, 409, 429]) {
    await assert.rejects(readReviewSubmissionResponse(Response.json({ message: 'Useful correction message.' }, { status })), { message: 'Useful correction message.' });
  }
  await assert.rejects(readReviewSubmissionResponse(new Response(null, { status: 429 })), /wait a few minutes/);
  const payload = { course: { id: 'c', code: 'ENGL1010', title: 'Writing' }, professor: { id: 'p', name: 'Example Professor' } };
  assert.deepEqual(await readReviewSubmissionResponse(Response.json(payload, { status: 201 })), { ...payload, message: 'Your anonymous review is live.' });
});

test('comparison review counts use the singular for one review', () => {
  assert.equal(formatReviewCount(0), '0 reviews');
  assert.equal(formatReviewCount(1), '1 review');
  assert.equal(formatReviewCount(1200), '1,200 reviews');
});
