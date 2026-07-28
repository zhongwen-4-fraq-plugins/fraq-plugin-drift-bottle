import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import { BottleStore } from '../src/persistence/bottle-store.js';
import { createDashboardSnapshot } from '../src/webui/dashboard.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('主页概览汇总瓶子、待审核、更新日志和完整操作记录', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-dashboard-'));
  const store = new BottleStore(join(directory, 'bottles.db'));
  await store.load();
  const api = new DriftBottleApi(createMockMilkyClient(), store, async () => ({
    approved: true,
    categories: [],
    reason: '',
  }));
  t.after(async () => {
    api.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  await api.add({
    senderId: 10001,
    source: { scene: 'friend', peerId: 10001 },
    segments: [inseg.text('用于主页统计的漂流瓶')],
  });
  store.addModerationRecord({
    content: [inseg.text('需要人工复核')],
    process: { result: { approved: false, categories: ['profanity'], reason: '需要人工复核' } },
    success: true,
    approved: false,
  });

  const instanceStartedAt = Date.now() - 5000;
  const snapshot = createDashboardSnapshot(api, instanceStartedAt, {
    fraqVersion: '0.14.0',
    protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
  });

  assert.equal(snapshot.instanceStartedAt, instanceStartedAt);
  assert.deepEqual(snapshot.counts, { totalBottles: 1, pendingReview: 1 });
  assert.deepEqual(snapshot.runtime, {
    fraqVersion: '0.14.0',
    protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
  });
  assert.equal(snapshot.changelog[0]?.version, '0.3.13');
  assert.ok(snapshot.operations.some((operation) => operation.title === '投递漂流瓶'));
  assert.ok(snapshot.operations.some((operation) => operation.title === 'AI 审核未通过'));
  assert.ok(snapshot.operations.every((operation) => operation.createdAt > 0));
});
