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
  legacyDatabase.exec(`
    CREATE TABLE bottle_profiles (
      sender_id INTEGER PRIMARY KEY,
      alias TEXT NOT NULL
    );
    INSERT INTO bottle_profiles (sender_id, alias) VALUES (10003, '旧别名');
  `);
  legacyDatabase.close();

  const store = new BottleStore(storagePath);
  await store.load();
  store.setSignature(10001, { type: 'alias', name: '海风' });
  store.setSignature(10002, { type: 'original' });
  store.addModerator(20001);
  store.setRepeatPick(30001, true);
  store.setRepeatPick(30002, false);
  assert.deepEqual(store.signatureFor(10001), { type: 'alias', name: '海风' });
  assert.deepEqual(store.signatureFor(10002), { type: 'original' });
  assert.deepEqual(store.signatureFor(10003), { type: 'alias', name: '旧别名' });
  assert.equal(store.isModerator(20001), true);
  assert.deepEqual(store.moderators(), [20001]);
  assert.equal(store.repeatPickFor(30001), true);
  assert.equal(store.repeatPickFor(30002), false);
  assert.equal(store.repeatPickFor(30003), undefined);
  await store.add({
    senderId: 10001,
    displayName: '海风',
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
  assert.deepEqual(reloadedStore.signatureFor(10001), { type: 'alias', name: '海风' });
  assert.deepEqual(reloadedStore.signatureFor(10002), { type: 'original' });
  assert.deepEqual(reloadedStore.moderators(), [20001]);
  assert.equal(reloadedStore.repeatPickFor(30001), true);
  assert.equal(reloadedStore.repeatPickFor(30002), false);
  assert.equal(reloadedStore.count(), 1);
  const bottle = await reloadedStore.pick(false, 0);
  assert.equal(bottle?.senderId, 10001);
  assert.equal(bottle?.displayName, '海风');
  assert.equal(reloadedStore.count(), 1);
  assert.equal((await reloadedStore.pick(true, 0))?.senderId, 10001);
  assert.equal(reloadedStore.count(), 0);
  reloadedStore.setSignature(10001, { type: 'anonymous' });
  assert.deepEqual(reloadedStore.signatureFor(10001), { type: 'anonymous' });
  assert.equal(reloadedStore.removeModerator(20001), true);
  assert.equal(reloadedStore.isModerator(20001), false);
  reloadedStore.setRepeatPick(30001);
  assert.equal(reloadedStore.repeatPickFor(30001), undefined);
  reloadedStore.dispose();
});
