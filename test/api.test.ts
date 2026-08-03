import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/index.js';
import type { ModerationContext } from '../src/processing/moderation.js';
import { createTestStore } from './store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('公开 API 可以脱离命令路由完成漂流瓶操作', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-api-'));
  const client = createMockMilkyClient();
  client.stubApi('get_resource_temp_url', ({ resource_id }) => ({
    url: `https://cdn.example.com/${resource_id}.jpg`,
  }));
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  const api = new DriftBottleApi(client, store, async () => ({ approved: true, categories: [], reason: '' }));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const sender = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.text('调用 API')]);
  assert.deepEqual(await api.updateSignature(sender, { type: 'alias', name: '海风' }), { status: 'updated' });

  const created = await api.createBottle(sender, [
    inseg.text('来自 API 的漂流瓶'),
    inseg.image({ resourceId: 'image-resource', tempUrl: 'https://old.example.com/image.jpg' }),
  ]);
  assert.equal(created.status, 'created');
  if (created.status !== 'created') {
    return;
  }
  assert.equal(created.bottle.displayName, '海风');
  assert.deepEqual(await api.bottleImage(created.bottle.id, 1), {
    status: 'found',
    url: 'https://cdn.example.com/image-resource.jpg',
  });
  assert.deepEqual(await api.bottleImage(created.bottle.id, 0), { status: 'not-image' });
  assert.deepEqual(await api.bottleImage('missing-bottle', 0), { status: 'not-found' });

  const commenter = client.inbox.group({ groupId: 20001, userId: 10002 }, [inseg.text('评论')]);
  const comment = await api.publishComment(commenter, created.bottle.id, '写得真好');
  assert.equal(comment.status, 'created');
  const comments = await api.commentsFor(created.bottle.id);
  assert.deepEqual(
    comments?.comments.map(({ senderId, content }) => ({ senderId, content })),
    [{ senderId: 10002, content: '写得真好' }],
  );
  assert.equal(await api.commentCountFor(created.bottle.id), 1);
  assert.equal(await api.commentCountFor('missing-bottle'), 0);

  await api.setRepeatPick(10002, true);
  assert.equal((await api.pickBottle(10002, 0))?.id, created.bottle.id);
  assert.equal(await api.count(), 1);

  await api.setRepeatPick(10002, false);
  assert.equal((await api.pickBottle(10002, 0))?.id, created.bottle.id);
  assert.equal(await api.count(), 0);
  assert.deepEqual(
    (await api.operationRecords()).map(({ action, actorId }) => ({ action, actorId })),
    [
      { action: 'bottle-picked', actorId: 10002 },
      { action: 'repeat-pick-updated', actorId: 10002 },
      { action: 'bottle-picked', actorId: 10002 },
      { action: 'repeat-pick-updated', actorId: 10002 },
      { action: 'comment-created', actorId: 10002 },
      { action: 'bottle-created', actorId: 10001 },
      { action: 'signature-updated', actorId: 10001 },
    ],
  );
});

test('公开 API 可以修改漂流瓶并记录管理操作', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-api-update-'));
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  const api = new DriftBottleApi(createMockMilkyClient(), store, async () => ({
    approved: true,
    categories: [],
    reason: '',
  }));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const bottle = await api.add({
    senderId: 10001,
    source: { scene: 'group', peerId: 20001 },
    segments: [inseg.text('原内容')],
  });
  const updated = await api.updateBottle(
    bottle.id,
    {
      senderId: 10002,
      displayName: '海风',
      source: { scene: 'friend', peerId: 10002 },
      content: '新内容',
    },
    90001,
  );
  assert.equal(updated.status, 'updated');
  if (updated.status === 'updated') {
    assert.equal(updated.bottle.senderId, 10002);
    assert.deepEqual(updated.bottle.segments, [inseg.text('新内容')]);
  }

  const mediaBottle = await api.add({
    senderId: 10003,
    source: { scene: 'group', peerId: 20001 },
    segments: [inseg.text('图文'), inseg.image({ summary: '图片' })],
  });
  assert.deepEqual(
    await api.updateBottle(mediaBottle.id, {
      senderId: 10003,
      source: { scene: 'group', peerId: 20001 },
      content: '不能覆盖图文消息',
    }),
    { status: 'content-read-only' },
  );
  assert.deepEqual(
    await api.updateBottle('missing', {
      senderId: 10003,
      source: { scene: 'group', peerId: 20001 },
    }),
    { status: 'not-found' },
  );
  assert.equal((await api.operationRecords()).filter(({ action }) => action === 'bottle-updated').length, 1);
});

test('投瓶审核会携带人工投放所需的完整草稿上下文', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-api-review-'));
  const client = createMockMilkyClient();
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  const contexts: (ModerationContext | undefined)[] = [];
  const api = new DriftBottleApi(client, store, async (_segments, context) => {
    contexts.push(context);
    return { approved: false, categories: ['profanity'], reason: '需要人工确认' };
  });
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const sender = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.text('待人工审核')]);
  const result = await api.createBottle(sender, [inseg.text('待人工审核')]);
  assert.equal(result.status, 'rejected');
  assert.deepEqual(contexts, [
    {
      target: 'bottle-content',
      bottleDraft: {
        senderId: 10001,
        displayName: undefined,
        source: { scene: 'group', peerId: 20001 },
        segments: [inseg.text('待人工审核')],
      },
    },
  ]);
});

test('人工审核模式会跳过投瓶 AI 并保存可投放草稿', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-api-manual-review-'));
  const client = createMockMilkyClient();
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  await store.setSignature(10001, { type: 'alias', name: '海风' });
  let moderationCalls = 0;
  const api = new DriftBottleApi(
    client,
    store,
    async () => {
      moderationCalls += 1;
      return { approved: true, categories: [], reason: '' };
    },
    () => 'manual',
  );
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const sender = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.text('等待主人确认')]);
  const result = await api.createBottle(sender, [inseg.text('等待主人确认')]);
  assert.equal(result.status, 'pending');
  assert.equal(moderationCalls, 0);
  assert.equal(await api.count(), 0);
  assert.equal(await api.pendingModerationCount(), 1);

  const [record] = await api.pendingModerationRecords();
  assert.ok(record);
  assert.deepEqual(record.process, { manual: { reason: '等待人工审核' } });
  assert.equal(record.id, result.status === 'pending' ? result.reviewId : undefined);
  assert.deepEqual(record.bottleDraft, {
    senderId: 10001,
    displayName: '海风',
    source: { scene: 'group', peerId: 20001 },
    segments: [inseg.text('等待主人确认')],
  });

  const approved = await api.approveModerationRecord(record.id, 90001);
  assert.equal(approved.status, 'approved');
  assert.equal(await api.count(), 1);
  assert.equal(await api.pendingModerationCount(), 0);
});
