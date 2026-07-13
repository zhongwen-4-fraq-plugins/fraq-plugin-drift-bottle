import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('漂流瓶会持久化，并可选择捡取后是否删除', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const storagePath = join(directory, 'bottles.db');
  t.after(() => rm(directory, { recursive: true, force: true }));

  const legacyDatabase = new DatabaseSync(storagePath);
  legacyDatabase.exec(`
    CREATE TABLE bottles (
      id TEXT PRIMARY KEY,
      sender_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      source_scene TEXT NOT NULL,
      source_peer_id INTEGER NOT NULL,
      segments TEXT NOT NULL
    )
  `);
  legacyDatabase.close();

  const store = new BottleStore(storagePath);
  await store.load();
  store.setAlias(10001, '海风');
  assert.equal(store.aliasFor(10001), '海风');
  await store.add({
    senderId: 10001,
    displayName: store.aliasFor(10001),
    source: { scene: 'friend', peerId: 10001 },
    segments: [{ type: 'text', data: { text: '第一条' } }],
  });
  await store.add({
    senderId: 10002,
    source: { scene: 'group', peerId: 20001 },
    segments: [{ type: 'text', data: { text: '第二条' } }],
  });

  assert.equal(store.count(), 2);
  assert.equal((await store.pick(false, 0.99))?.senderId, 10002);
  assert.equal(store.count(), 2);
  assert.equal((await store.pick(true, 0.99))?.senderId, 10002);
  store.dispose();

  const reloadedStore = new BottleStore(storagePath);
  await reloadedStore.load();
  assert.equal(reloadedStore.aliasFor(10001), '海风');
  assert.equal(reloadedStore.count(), 1);
  const bottle = await reloadedStore.pick(false, 0);
  assert.equal(bottle?.senderId, 10001);
  assert.equal(bottle?.displayName, '海风');
  assert.equal(reloadedStore.count(), 1);
  assert.equal((await reloadedStore.pick(true, 0))?.senderId, 10001);
  assert.equal(reloadedStore.count(), 0);
  reloadedStore.setAlias(10001);
  assert.equal(reloadedStore.aliasFor(10001), undefined);
  reloadedStore.dispose();
});
