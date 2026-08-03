import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { DriftBottleApi } from '../src/api/drift-bottle-api.js';
import type { BottleSegment } from '../src/models/index.js';
import { createBottleListPage, createPendingReviewListPage, summarizeSegments } from '../src/webui/lists.js';
import { createTestStore } from './store.js';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('WebUI 列表按页返回漂流瓶和待审核摘要', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-lists-'));
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

  for (let index = 0; index < 21; index += 1) {
    const bottle = await store.add({
      senderId: 10_000 + index,
      displayName: index === 20 ? '海风' : undefined,
      source: { scene: index === 20 ? 'friend' : 'group', peerId: 20_000 + index },
      segments:
        index === 19
          ? [inseg.text(`漂流瓶 ${index}`), inseg.image({ summary: '海边照片' }), inseg.text('照片说明')]
          : [inseg.text(`漂流瓶 ${index}`)],
    });
    if (index === 20) {
      await store.addComment({ bottleId: bottle.id, senderId: 30001, displayName: '浪花', content: '第一条评论' });
    }
  }
  const explicitlyRejected = await store.addModerationRecord({
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
  await store.addModerationRecord({
    content: [inseg.video({ tempUrl: 'https://example.com/video' })],
    process: { error: { name: 'Error', message: '模型暂时不可用' } },
    success: false,
  });
  await store.addModerationRecord({
    content: [inseg.text('直接进入人工审核')],
    process: { manual: { reason: '等待人工审核' } },
    success: true,
    approved: false,
    target: 'bottle-content',
    bottleDraft: {
      senderId: 67890,
      source: { scene: 'friend', peerId: 67890 },
      segments: [inseg.text('直接进入人工审核')],
    },
  });

  const firstBottlePage = await createBottleListPage(api, 1);
  assert.equal(firstBottlePage.total, 21);
  assert.equal(firstBottlePage.totalPages, 2);
  assert.equal(firstBottlePage.items.length, 20);
  assert.equal(firstBottlePage.items[0]?.displayName, '海风');
  assert.equal(firstBottlePage.items[0]?.content.preview, '漂流瓶 20');
  assert.equal(firstBottlePage.items[0]?.editableText, '漂流瓶 20');
  assert.deepEqual(firstBottlePage.items[0]?.editableTextSegments, [{ segmentIndex: 0, text: '漂流瓶 20' }]);
  assert.equal(firstBottlePage.items[0]?.commentCount, 1);
  assert.equal(firstBottlePage.items[1]?.commentCount, 0);
  assert.equal(firstBottlePage.items[1]?.editableText, undefined);
  assert.deepEqual(firstBottlePage.items[1]?.editableTextSegments, [
    { segmentIndex: 0, text: '漂流瓶 19' },
    { segmentIndex: 2, text: '照片说明' },
  ]);
  const lastBottlePage = await createBottleListPage(api, 99);
  assert.equal(lastBottlePage.page, 2);
  assert.equal(lastBottlePage.items.length, 1);
  assert.equal(lastBottlePage.items[0]?.commentCount, 0);

  const pendingPage = await createPendingReviewListPage(api, 1);
  assert.equal(pendingPage.total, 2);
  assert.deepEqual(
    pendingPage.items.map(({ status }) => status),
    ['pending', 'error'],
  );
  assert.equal(pendingPage.items[0]?.reason, '等待人工审核');
  assert.equal(pendingPage.items[1]?.target, '历史记录');
  assert.equal(pendingPage.items[1]?.canApprove, false);
  assert.ok(pendingPage.items.every((item) => item.id !== explicitlyRejected.id));
  assert.deepEqual(summarizeSegments([inseg.text('你好'), inseg.image({ summary: '照片' })]), {
    preview: '你好 [图片：照片]',
    kinds: ['文字', '图片'],
    parts: [
      { segmentIndex: 0, text: '你好', faceId: undefined, imageSegmentIndex: undefined },
      { segmentIndex: 1, text: '[图片：照片]', faceId: undefined, imageSegmentIndex: 1 },
    ],
  });
  assert.deepEqual(summarizeSegments([inseg.face(14)]), {
    preview: '[表情：14]',
    kinds: ['表情'],
    parts: [{ segmentIndex: 0, text: '[表情：14]', faceId: '14', imageSegmentIndex: undefined }],
  });
});

test('WebUI 将合并转发正文转换为 Markdown，并保留无明细时的摘要', () => {
  const nestedForward = {
    type: 'forward',
    data: {
      forward_id: 'nested-forward',
      title: '子转发',
      preview: [],
      summary: '共 1 条消息',
      messages: [
        {
          message_seq: 2,
          sender_name: 'Bob',
          avatar_url: '',
          time: 1_700_000_001,
          segments: [
            { type: 'markdown', data: { content: '| 项目 | 状态 |\n| --- | --- |\n| 测试 | ~~旧~~ **新** |' } },
          ],
        },
      ],
    },
  } as BottleSegment;
  const forward = {
    type: 'forward',
    data: {
      forward_id: 'forward-id',
      title: '聊天 *记录*',
      preview: ['预览内容'],
      summary: '共 1 条消息',
      messages: [
        {
          message_seq: 1,
          sender_name: 'Alice [管理员]',
          avatar_url: '',
          time: 1_700_000_000,
          segments: [
            {
              type: 'text',
              data: { text: '**加粗正文**\n\n![远程图](https://example.com/image.png)\n\n<script>alert(1)</script>' },
            },
            nestedForward,
          ],
        },
      ],
    },
  } as BottleSegment;

  const summary = summarizeSegments([forward]);
  assert.equal(summary.preview, '[合并转发：聊天 *记录*]');
  assert.deepEqual(summary.parts[0]?.forwardMessages, [
    {
      sequence: 1,
      sender: 'Alice [管理员]',
      markdown: [
        '**加粗正文**\n\n![远程图](https://example.com/image.png)\n\n<script>alert(1)</script>',
        '**子转发**',
        '**Bob**：\n\n| 项目 | 状态 |\n| --- | --- |\n| 测试 | ~~旧~~ **新** |',
      ].join('\n\n'),
    },
  ]);
  assert.equal(summary.parts[0]?.forwardMessageCount, 1);

  const fallback = summarizeSegments([inseg.forward({ title: '只有摘要' })]);
  assert.equal(fallback.parts[0]?.text, '[合并转发：只有摘要]');
  assert.equal(fallback.parts[0]?.forwardMessages, undefined);
});

test('WebUI 合并转发按消息返回内容且不生成分割线', () => {
  const forward = {
    type: 'forward',
    data: {
      forward_id: 'long-forward',
      title: '群聊记录',
      preview: [],
      summary: '共 5 条消息',
      messages: Array.from({ length: 5 }, (_, index) => ({
        message_seq: index + 1,
        sender_name: `用户 ${index + 1}`,
        avatar_url: '',
        time: 1_700_000_000 + index,
        segments: [{ type: 'text', data: { text: `消息 ${index + 1}` } }],
      })),
    },
  } as BottleSegment;

  const part = summarizeSegments([forward]).parts[0];
  assert.equal(part?.forwardMessageCount, 5);
  assert.equal(part?.forwardMessages?.[3]?.markdown, '消息 4');
  assert.equal(part?.forwardMessages?.[4]?.markdown, '消息 5');
  assert.ok(part?.forwardMessages?.every((message) => !message.markdown.includes('\n---\n')));
});
