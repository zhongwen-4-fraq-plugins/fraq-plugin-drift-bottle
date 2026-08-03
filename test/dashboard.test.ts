import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import { createDashboardSnapshot } from '../src/webui/dashboard.js';
import { createTestStore } from './store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('主页概览汇总瓶子、待审核、更新日志和完整操作记录', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-dashboard-'));
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

  await api.add({
    senderId: 10001,
    source: { scene: 'friend', peerId: 10001 },
    segments: [inseg.text('用于主页统计的漂流瓶')],
  });
  await store.addModerationRecord({
    content: [inseg.text('需要人工复核')],
    process: { result: { approved: false, categories: ['profanity'], reason: '需要人工复核' } },
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    success: true,
    approved: false,
    target: 'bottle-content',
  });
  await store.addModerationRecord({
    content: [inseg.text('等待人工审核')],
    process: { manual: { reason: '等待人工审核' } },
    success: true,
    approved: false,
    target: 'bottle-content',
    bottleDraft: {
      senderId: 10002,
      source: { scene: 'group', peerId: 20001 },
      segments: [inseg.text('等待人工审核')],
    },
  });
  await store.addModerationRecord({
    content: [inseg.text('审核服务异常')],
    process: { error: { name: 'Error', message: '模型暂时不可用' } },
    inputTokens: 40,
    outputTokens: 5,
    totalTokens: 45,
    success: false,
    target: 'comment-content',
  });

  const instanceStartedAt = Date.now() - 5000;
  const snapshot = await createDashboardSnapshot(api, instanceStartedAt, {
    fraqVersion: '0.14.0',
    protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
  });

  assert.equal(snapshot.instanceStartedAt, instanceStartedAt);
  assert.deepEqual(snapshot.counts, { totalBottles: 1, pendingReview: 2 });
  assert.deepEqual(snapshot.runtime, {
    fraqVersion: '0.14.0',
    protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
  });
  assert.equal(snapshot.changelog[0]?.version, '0.3.21');
  assert.ok(snapshot.operations.some((operation) => operation.title === '投递漂流瓶'));
  assert.ok(
    snapshot.operations.some(
      (operation) =>
        operation.title === 'AI 审核未通过' &&
        operation.detail === '名称：瓶子内容，输入 Token：120，输出 Token：30，总 Token：150 · 需要人工复核',
    ),
  );
  assert.ok(
    snapshot.operations.some(
      (operation) =>
        operation.title === 'AI 审核执行失败' &&
        operation.detail === '名称：评论内容，输入 Token：40，输出 Token：5，总 Token：45 · 模型暂时不可用',
    ),
  );
  assert.ok(
    snapshot.operations.some(
      (operation) => operation.title === '提交漂流瓶审核' && operation.detail === 'QQ 10002 · 等待人工审核',
    ),
  );
  assert.ok(snapshot.operations.every((operation) => operation.createdAt > 0));
});
