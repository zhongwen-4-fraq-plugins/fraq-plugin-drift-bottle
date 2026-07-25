import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/index.js';
import { BottleStore } from '../src/persistence/bottle-store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('公开 API 可以脱离命令路由完成漂流瓶操作', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-api-'));
  const client = createMockMilkyClient();
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  const api = new DriftBottleApi(client, store, async () => ({ approved: true, categories: [], reason: '' }));
  t.after(async () => {
    api.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const sender = client.inbox.group({ groupId: 20001, userId: 10001 }, [inseg.text('调用 API')]);
  assert.deepEqual(await api.updateSignature(sender, { type: 'alias', name: '海风' }), { status: 'updated' });

  const created = await api.createBottle(sender, [inseg.text('来自 API 的漂流瓶')]);
  assert.equal(created.status, 'created');
  if (created.status !== 'created') {
    return;
  }
  assert.equal(created.bottle.displayName, '海风');

  const commenter = client.inbox.group({ groupId: 20001, userId: 10002 }, [inseg.text('评论')]);
  const comment = await api.publishComment(commenter, created.bottle.id, '写得真好');
  assert.equal(comment.status, 'created');
  assert.deepEqual(
    api.commentsFor(created.bottle.id)?.comments.map(({ senderId, content }) => ({ senderId, content })),
    [{ senderId: 10002, content: '写得真好' }],
  );

  api.setRepeatPick(10002, true);
  assert.equal((await api.pickBottle(10002, 0))?.id, created.bottle.id);
  assert.equal(api.count(), 1);

  api.setRepeatPick(10002, false);
  assert.equal((await api.pickBottle(10002, 0))?.id, created.bottle.id);
  assert.equal(api.count(), 0);
});
