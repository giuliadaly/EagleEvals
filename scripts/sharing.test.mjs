import assert from 'node:assert/strict';
import test from 'node:test';
import { detailSharingMetadata, sharePage } from '../src/data/sharing.ts';

test('individual page previews and canonical links point to the actual entity', () => {
  for (const kind of ['courses', 'professors']) {
    const path = `/${kind}/65c4299149939741c6777cc2`;
    const metadata = detailSharingMetadata(path, 'A specific page', 'A specific description');
    assert.equal(metadata.alternates.canonical, path);
    assert.equal(metadata.openGraph.url, path);
    assert.equal(metadata.openGraph.title, 'A specific page · EagleEvals');
    assert.equal(metadata.twitter.description, 'A specific description');
    assert.equal(metadata.openGraph.images[0].url, `https://eagleevals.com${path}/opengraph-image`);
    assert.equal(metadata.twitter.images[0].url, metadata.openGraph.images[0].url);
  }
});

test('sharing uses the platform share sheet and does not copy after cancellation', async () => {
  const data = [];
  assert.equal(await sharePage('Course', 'https://eagleevals.com/courses/example', { share: async value => data.push(value) }), 'shared');
  assert.deepEqual(data, [{ title: 'Course', url: 'https://eagleevals.com/courses/example' }]);
  assert.equal(await sharePage('Course', 'url', {
    share: async () => { throw new DOMException('Cancelled', 'AbortError'); },
    clipboard: { writeText: async () => assert.fail('Cancellation must not write the clipboard') },
  }), 'cancelled');
});

test('clipboard and selectable-link fallbacks cover unavailable or denied browser APIs', async () => {
  let copied;
  assert.equal(await sharePage('Course', 'url', { clipboard: { writeText: async value => { copied = value; } } }), 'copied');
  assert.equal(copied, 'url');
  assert.equal(await sharePage('Course', 'url', { share: async () => { throw new Error('Unavailable'); }, clipboard: { writeText: async () => {} } }), 'copied');
  assert.equal(await sharePage('Course', 'url', {}), 'manual');
  assert.equal(await sharePage('Course', 'url', { clipboard: { writeText: async () => { throw new Error('Denied'); } } }), 'manual');
});
