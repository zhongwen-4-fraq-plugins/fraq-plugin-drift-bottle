import { createTestStore } from './store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('漂流瓶会持久化，并可选择捡取后是否删除', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const storagePath = join(directory, 'bottles.db');
  t.after(async () => {
    await Promise.all([store.dispose(), reloadedStore.dispose()]);
    await rm(directory, { recursive: true, force: true });
  });

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
  legacyDatabase.exec(`
    CREATE TABLE bottle_moderation_records (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      content TEXT NOT NULL,
      process TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      success INTEGER NOT NULL,
      approved INTEGER
    );
    INSERT INTO bottle_moderation_records (
      id, created_at, content, process, success, approved
    ) VALUES (
      'legacy-review', 1700000000000, '[]', '{"error":{"name":"Error","message":"旧审核失败"}}', 0, NULL
    );
  `);
  legacyDatabase
    .prepare(`
      INSERT INTO bottles (id, sender_id, created_at, source_scene, source_peer_id, segments)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      'legacy-bottle',
      10004,
      1_700_000_000_000,
      'group',
      20001,
      JSON.stringify([{ type: 'text', data: { text: '旧瓶子' } }]),
    );
  legacyDatabase.close();

  const store = await createTestStore(t, storagePath);
  assert.equal(await store.pendingModerationCount(), 1);
  assert.equal((await store.approveModerationRecord('legacy-review', 10001)).status, 'publish-unavailable');
  assert.equal((await store.rejectModerationRecord('legacy-review', 10001, '旧记录缺少上下文')).status, 'rejected');
  assert.equal(await store.pendingModerationCount(), 0);
  assert.equal(await store.hasBottle('legacy-bottle'), true);
  assert.equal(await store.deleteBottle('legacy-bottle'), true);
  await store.setSignature(10001, { type: 'alias', name: '海风' });
  await store.setSignature(10002, { type: 'original' });
  await store.addModerator(20001);
  await store.setRepeatPick(30001, true);
  await store.setRepeatPick(30002, false);
  const operation = await store.addOperationRecord({
    action: 'moderator-added',
    actorId: 10001,
    targetUserId: 20001,
  });
  assert.deepEqual(await store.signatureFor(10001), { type: 'alias', name: '海风' });
  assert.deepEqual(await store.signatureFor(10002), { type: 'original' });
  assert.deepEqual(await store.signatureFor(10003), { type: 'alias', name: '旧别名' });
  assert.equal(await store.isModerator(20001), true);
  assert.deepEqual(await store.moderators(), [20001]);
  assert.equal(await store.repeatPickFor(30001), true);
  assert.equal(await store.repeatPickFor(30002), false);
  assert.equal(await store.repeatPickFor(30003), undefined);
  const firstBottle = await store.add({
    senderId: 10001,
    displayName: '海风',
    source: { scene: 'friend', peerId: 10001 },
    segments: [{ type: 'text', data: { text: '第一条' } }],
  });
  const secondBottle = await store.add({
    senderId: 10002,
    source: { scene: 'group', peerId: 20001 },
    segments: [{ type: 'text', data: { text: '第二条' } }],
  });
  const updatedFirstBottle = await store.updateBottle(firstBottle.id, {
    senderId: 10005,
    displayName: '新署名',
    source: { scene: 'group', peerId: 20005 },
    segments: [{ type: 'text', data: { text: '修改后的第一条' } }],
  });
  assert.equal(updatedFirstBottle?.senderId, 10005);
  assert.equal(updatedFirstBottle?.displayName, '新署名');
  assert.equal(updatedFirstBottle?.segments[0]?.type, 'text');
  assert.equal(await store.isBottleOwner(firstBottle.id, 10001), false);
  assert.equal(await store.isBottleOwner(firstBottle.id, 10005), true);
  assert.ok(
    await store.updateBottle(firstBottle.id, {
      senderId: 10005,
      displayName: '新署名',
      source: { scene: 'group', peerId: 20005 },
      segments: [{ type: 'text', data: { text: '修改后的第一条' } }],
    }),
  );
  assert.equal(
    await store.updateBottle('missing', {
      senderId: 10005,
      source: { scene: 'group', peerId: 20005 },
      segments: [{ type: 'text', data: { text: '不存在' } }],
    }),
    undefined,
  );

  assert.equal(await store.count(), 2);
  assert.deepEqual(
    (await store.bottles()).map(({ id }) => id),
    [secondBottle.id, firstBottle.id],
  );
  await store.addComment({
    bottleId: secondBottle.id,
    senderId: 30001,
    displayName: '浪花',
    content: '写得真好',
  });
  assert.equal(await store.commentCount(secondBottle.id), 1);
  assert.equal((await store.pick(false, 0.99))?.senderId, 10002);
  assert.equal(await store.count(), 2);
  assert.equal((await store.pick(true, 0.99))?.senderId, 10002);
  assert.equal(await store.hasBottle(secondBottle.id), true);
  assert.equal(await store.isBottleOwner(secondBottle.id, 10002), true);
  assert.equal(await store.isBottleOwner(secondBottle.id, 10001), false);
  const reloadedStore = await createTestStore(t, storagePath);
  assert.deepEqual(await reloadedStore.signatureFor(10001), { type: 'alias', name: '海风' });
  assert.deepEqual(await reloadedStore.signatureFor(10002), { type: 'original' });
  assert.deepEqual(await reloadedStore.moderators(), [20001]);
  assert.equal(await reloadedStore.repeatPickFor(30001), true);
  assert.equal(await reloadedStore.repeatPickFor(30002), false);
  assert.deepEqual(
    (await reloadedStore.operationRecords()).filter(({ action }) => action === 'moderator-added'),
    [operation],
  );
  assert.ok((await reloadedStore.operationRecords()).some(({ action }) => action === 'moderation-rejected'));
  assert.deepEqual(
    (await reloadedStore.commentsFor(secondBottle.id)).map(({ displayName, content }) => ({ displayName, content })),
    [{ displayName: '浪花', content: '写得真好' }],
  );
  assert.equal(await reloadedStore.count(), 1);
  assert.deepEqual(
    (await reloadedStore.bottles()).map(({ id }) => id),
    [firstBottle.id],
  );
  const bottle = await reloadedStore.pick(false, 0);
  assert.equal(bottle?.senderId, 10005);
  assert.equal(bottle?.displayName, '新署名');
  assert.deepEqual(bottle?.segments, [{ type: 'text', data: { text: '修改后的第一条' } }]);
  assert.equal(await reloadedStore.count(), 1);
  assert.equal((await reloadedStore.pick(true, 0))?.senderId, 10005);
  assert.equal(await reloadedStore.count(), 0);
  assert.equal(await reloadedStore.hasBottle(firstBottle.id), true);
  assert.equal(await reloadedStore.deleteBottle(secondBottle.id), true);
  assert.equal(await reloadedStore.hasBottle(secondBottle.id), false);
  assert.equal(await reloadedStore.commentCount(secondBottle.id), 0);
  await reloadedStore.setSignature(10001, { type: 'anonymous' });
  assert.deepEqual(await reloadedStore.signatureFor(10001), { type: 'anonymous' });
  assert.equal(await reloadedStore.removeModerator(20001), true);
  assert.equal(await reloadedStore.isModerator(20001), false);
  await reloadedStore.setRepeatPick(30001);
  assert.equal(await reloadedStore.repeatPickFor(30001), undefined);
});
