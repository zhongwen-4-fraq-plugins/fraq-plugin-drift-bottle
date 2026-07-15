import { inseg } from '@fraqjs/mock';

import { withModerationRecords } from '../src/moderation-records.js';
import { BottleStore } from '../src/storage.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('AI 审核成功和失败都会写入数据库', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const logs: string[] = [];
  const successfulModerator = withModerationRecords(store, { info: (message) => logs.push(message) }, async () => ({
    approved: false,
    categories: ['r18'],
    reason: '包含不适宜内容',
    usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
  }));
  await successfulModerator([inseg.text('待审核内容')]);

  const failedModerator = withModerationRecords(store, { info: (message) => logs.push(message) }, async () => {
    throw new Error('AI unavailable');
  });
  await assert.rejects(failedModerator([inseg.text('审核失败内容')]), /AI unavailable/);

  const records = store.moderationRecords();
  const success = records.find((record) => record.success);
  const failure = records.find((record) => !record.success);

  assert.equal(records.length, 2);
  assert.ok(success);
  assert.equal(success.approved, false);
  assert.deepEqual(success.content, [inseg.text('待审核内容')]);
  assert.deepEqual(success.process, {
    result: { approved: false, categories: ['r18'], reason: '包含不适宜内容' },
  });
  assert.deepEqual([success.inputTokens, success.outputTokens, success.totalTokens], [120, 30, 150]);
  assert.ok(failure);
  assert.equal(failure.approved, undefined);
  assert.deepEqual(failure.content, [inseg.text('审核失败内容')]);
  assert.deepEqual(failure.process, { error: { name: 'Error', message: 'AI unavailable' } });
  assert.ok(records.every((record) => record.createdAt > 0));
  assert.deepEqual(logs, ['漂流瓶 AI 审核 Token：输入 120，输出 30，总计 150']);
});
