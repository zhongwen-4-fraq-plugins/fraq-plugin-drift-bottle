import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import { BottleStore } from '../src/persistence/bottle-store.js';
import { createBottleListPage, createPendingReviewListPage, summarizeSegments } from '../src/webui/lists.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('WebUI 列表按页返回漂流瓶和待审核摘要', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-lists-'));
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

  for (let index = 0; index < 21; index += 1) {
    await store.add({
      senderId: 10_000 + index,
      displayName: index === 20 ? '海风' : undefined,
      source: { scene: index === 20 ? 'friend' : 'group', peerId: 20_000 + index },
      segments: [inseg.text(`漂流瓶 ${index}`)],
    });
  }
  store.addModerationRecord({
    content: [inseg.text('需要人工确认'), inseg.image({ summary: '海边照片' })],
    process: { result: { approved: false, categories: ['r18'], reason: '内容需要确认' } },
    success: true,
    approved: false,
    totalTokens: 88,
    target: 'bottle-content',
    bottleDraft: {
      senderId: 12345,
      displayName: '海风',
      source: { scene: 'group', peerId: 54321 },
      segments: [inseg.text('需要人工确认'), inseg.image({ summary: '海边照片' })],
    },
  });
  store.addModerationRecord({
    content: [inseg.video({ tempUrl: 'https://example.com/video' })],
    process: { error: { name: 'Error', message: '模型暂时不可用' } },
    success: false,
  });

  const firstBottlePage = createBottleListPage(api, 1);
  assert.equal(firstBottlePage.total, 21);
  assert.equal(firstBottlePage.totalPages, 2);
  assert.equal(firstBottlePage.items.length, 20);
  assert.equal(firstBottlePage.items[0]?.displayName, '海风');
  assert.equal(firstBottlePage.items[0]?.content.preview, '漂流瓶 20');
  const lastBottlePage = createBottleListPage(api, 99);
  assert.equal(lastBottlePage.page, 2);
  assert.equal(lastBottlePage.items.length, 1);

  const pendingPage = createPendingReviewListPage(api, 1);
  assert.equal(pendingPage.total, 2);
  assert.deepEqual(
    pendingPage.items.map(({ status }) => status),
    ['error', 'rejected'],
  );
  assert.equal(pendingPage.items[1]?.reason, '内容需要确认');
  assert.deepEqual(pendingPage.items[1]?.categories, ['r18']);
  assert.equal(pendingPage.items[1]?.target, '瓶子内容');
  assert.equal(pendingPage.items[1]?.canApprove, true);
  assert.deepEqual(pendingPage.items[1]?.bottleDraft, {
    senderId: 12345,
    displayName: '海风',
    source: { scene: 'group', peerId: 54321 },
  });
  assert.equal(pendingPage.items[0]?.target, '历史记录');
  assert.equal(pendingPage.items[0]?.canApprove, false);
  assert.deepEqual(summarizeSegments([inseg.text('你好'), inseg.image({ summary: '照片' })]), {
    preview: '你好 [图片：照片]',
    kinds: ['文字', '图片'],
  });
});
