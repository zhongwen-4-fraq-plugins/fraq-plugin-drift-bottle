import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('漂流瓶会持久化并在捡取后移除', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const storagePath = join(directory, 'bottles.json');
  t.after(() => rm(directory, { recursive: true, force: true }));

  const store = new BottleStore(storagePath);
  await store.load();
  await store.add({
    senderId: 10001,
    source: { scene: 'friend', peerId: 10001 },
    segments: [{ type: 'text', data: { text: '第一条' } }],
  });
  await store.add({
    senderId: 10002,
    source: { scene: 'group', peerId: 20001 },
    segments: [{ type: 'text', data: { text: '第二条' } }],
  });

  assert.equal(store.count(), 2);
  assert.equal((await store.take(0.99))?.senderId, 10002);

  const reloadedStore = new BottleStore(storagePath);
  await reloadedStore.load();
  assert.equal(reloadedStore.count(), 1);
  assert.equal((await reloadedStore.take(0))?.senderId, 10001);
  assert.equal(reloadedStore.count(), 0);
});
