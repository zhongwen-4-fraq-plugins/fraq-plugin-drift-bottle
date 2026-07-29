import { inseg } from '@fraqjs/mock';

import { BottleStore } from '../src/persistence/bottle-store.js';
import { ModerationFailureError } from '../src/processing/moderation.js';
import { withModerationRecords } from '../src/processing/moderation-records.js';

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
  await successfulModerator([inseg.text('待审核内容')], {
    target: 'bottle-content',
    bottleDraft: {
      senderId: 10001,
      source: { scene: 'friend', peerId: 10001 },
      segments: [inseg.text('待审核内容')],
    },
  });

  const failedModerator = withModerationRecords(store, { info: (message) => logs.push(message) }, async () => {
    throw new Error('AI unavailable');
  });
  await assert.rejects(failedModerator([inseg.text('审核失败内容')]), /AI unavailable/);
  store.addModerationRecord({
    content: [inseg.text('审核通过内容')],
    process: { result: { approved: true, categories: [], reason: '' } },
    success: true,
    approved: true,
  });

  const records = store.moderationRecords();
  const success = records.find((record) => record.success && record.approved === false);
  const failure = records.find((record) => !record.success);

  assert.equal(records.length, 3);
  assert.ok(success);
  assert.equal(success.approved, false);
  assert.deepEqual(success.content, [inseg.text('待审核内容')]);
  assert.deepEqual(success.process, {
    result: { approved: false, categories: ['r18'], reason: '包含不适宜内容' },
  });
  assert.deepEqual([success.inputTokens, success.outputTokens, success.totalTokens], [120, 30, 150]);
  assert.equal(success.target, 'bottle-content');
  assert.equal(success.bottleDraft?.senderId, 10001);
  assert.ok(failure);
  assert.equal(failure.approved, undefined);
  assert.deepEqual(failure.content, [inseg.text('审核失败内容')]);
  assert.deepEqual(failure.process, { error: { name: 'Error', message: 'AI unavailable' } });
  assert.ok(records.every((record) => record.createdAt > 0));
  assert.equal(store.pendingModerationCount(), 2);
  assert.deepEqual(
    store.pendingModerationRecords().map(({ success, approved }) => ({ success, approved })),
    [
      { success: false, approved: undefined },
      { success: true, approved: false },
    ],
  );
  assert.deepEqual(logs, ['漂流瓶 AI 审核 Token：输入 120，输出 30，总计 150']);
});

test('AI 结构校验失败会保存响应摘要、原因、Token 和 provider warning', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-diagnostic-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const schemaCause = new Error('approved: expected boolean, received string');
  const schemaError = new Error('No object generated: response did not match schema.', { cause: schemaCause });
  schemaError.name = 'AI_NoObjectGeneratedError';
  const moderator = withModerationRecords(store, { info: () => undefined }, async () => {
    throw new ModerationFailureError(schemaError, [
      {
        responseTextSummary: '{"approved":"false"}',
        finishReason: 'stop',
        warnings: ['unsupported：responseFormat'],
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      },
      {
        responseTextSummary: '{"approved":0}',
        finishReason: 'stop',
        warnings: ['unsupported：responseFormat'],
        usage: { inputTokens: 11, outputTokens: 2, totalTokens: 13 },
      },
    ]);
  });

  await assert.rejects(moderator([inseg.text('结构失败')]), /response did not match schema/);
  const [record] = store.pendingModerationRecords();
  assert.ok(record);
  assert.deepEqual(record.process, {
    error: {
      name: 'AI_NoObjectGeneratedError',
      message: 'No object generated: response did not match schema.',
      cause: { name: 'Error', message: 'approved: expected boolean, received string' },
      responseTextSummary: '{"approved":0}',
      finishReason: 'stop',
      providerWarnings: ['unsupported：responseFormat'],
      attempts: 2,
    },
  });
  assert.deepEqual([record.inputTokens, record.outputTokens, record.totalTokens], [21, 4, 25]);
});

test('人工审核可投放完整草稿，并要求拒绝理由后归档', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-review-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  t.after(async () => {
    store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const publishable = store.addModerationRecord({
    content: [inseg.text('需要主人确认')],
    process: { result: { approved: false, categories: ['profanity'], reason: '需要人工确认' } },
    success: true,
    approved: false,
    target: 'bottle-content',
    bottleDraft: {
      senderId: 10001,
      displayName: '海风',
      source: { scene: 'group', peerId: 20001 },
      segments: [inseg.text('需要主人确认')],
    },
  });
  const approved = store.approveModerationRecord(publishable.id, 90001);
  assert.equal(approved.status, 'approved');
  if (approved.status === 'approved') {
    assert.equal(approved.bottle.senderId, 10001);
    assert.equal(store.hasBottle(approved.bottle.id), true);
  }
  assert.equal(store.approveModerationRecord(publishable.id, 90001).status, 'already-resolved');

  const legacy = store.addModerationRecord({
    content: [inseg.text('旧审核记录')],
    process: { error: { name: 'Error', message: '模型不可用' } },
    success: false,
  });
  assert.equal(store.approveModerationRecord(legacy.id, 90001).status, 'publish-unavailable');
  assert.equal(store.rejectModerationRecord(legacy.id, 90001, '   ').status, 'invalid-reason');
  assert.equal(store.rejectModerationRecord(legacy.id, 90001, '缺少可信投瓶上下文').status, 'rejected');
  assert.equal(store.pendingModerationCount(), 0);

  const records = store.moderationRecords();
  const approvedRecord = records.find((record) => record.id === publishable.id);
  const rejectedRecord = records.find((record) => record.id === legacy.id);
  assert.equal(approvedRecord?.resolution, 'approved');
  assert.equal(approvedRecord?.resolvedBy, 90001);
  assert.ok(approvedRecord?.publishedBottleId);
  assert.equal(rejectedRecord?.resolution, 'rejected');
  assert.equal(rejectedRecord?.rejectionReason, '缺少可信投瓶上下文');
  assert.deepEqual(
    store.operationRecords().map(({ action }) => action),
    ['moderation-rejected', 'moderation-approved'],
  );
});
