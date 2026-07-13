import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { resolveBottleSignature } from '../src/signature.js';
import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('原名署名优先使用群名片并回退到 QQ 昵称', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const client = createMockMilkyClient();
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  store.setSignature(10001, { type: 'original' });
  const withCard = client.inbox.group(
    { groupId: 20001, userId: 10001, groupMember: { card: '群名片', nickname: 'QQ 昵称' } },
    [inseg.text('测试')],
  );
  const withoutCard = client.inbox.group(
    { groupId: 20001, userId: 10001, groupMember: { card: '', nickname: 'QQ 昵称' } },
    [inseg.text('测试')],
  );

  assert.deepEqual(await resolveBottleSignature(client, store, withCard), {
    displayName: '群名片',
    needsModeration: true,
  });
  assert.deepEqual(await resolveBottleSignature(client, store, withoutCard), {
    displayName: 'QQ 昵称',
    needsModeration: true,
  });
});

test('匿名和别名署名不读取用户资料', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const client = createMockMilkyClient();
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });
  const message = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.text('测试')]);

  assert.deepEqual(await resolveBottleSignature(client, store, message), { needsModeration: false });
  store.setSignature(10001, { type: 'alias', name: '海风' });
  assert.deepEqual(await resolveBottleSignature(client, store, message), {
    displayName: '海风',
    needsModeration: false,
  });
});
