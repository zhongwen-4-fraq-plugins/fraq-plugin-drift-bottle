import { inseg } from '@fraqjs/mock';

import { createModerationContent, createModerationInstructions } from '../src/moderation.js';
import type { BottleSegment } from '../src/types.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('AI 审核输入包含文字、图片和视频', () => {
  const content = createModerationContent([
    inseg.text('普通文本'),
    inseg.image({ tempUrl: 'https://example.com/image.jpg', summary: '图片摘要' }),
    inseg.video({ tempUrl: 'https://example.com/video.mp4' }),
  ]);

  assert.ok(Array.isArray(content));
  assert.deepEqual(
    content.filter((part) => part.type === 'text').map((part) => part.text),
    ['以下是待审核的漂流瓶内容：', '普通文本', '图片摘要', '[视频消息]'],
  );

  assert.deepEqual(
    content.filter((part) => part.type === 'file').map((part) => ({ type: part.mediaType, url: part.data.toString() })),
    [
      { type: 'image', url: 'https://example.com/image.jpg' },
      { type: 'video', url: 'https://example.com/video.mp4' },
    ],
  );
});

test('AI 审核指令明确要求返回 json', () => {
  assert.match(createModerationInstructions(), /json/i);
});

test('AI 审核会读取表情、动态表情和合并转发正文', () => {
  const forward: Extract<BottleSegment, { type: 'forward' }> = {
    type: 'forward',
    data: {
      forward_id: 'forward-id',
      title: '聊天记录',
      preview: ['预览内容'],
      summary: '共 1 条消息',
      messages: [
        {
          message_seq: 1,
          sender_name: '测试用户',
          avatar_url: 'https://example.com/avatar',
          time: 1_700_000_000,
          segments: [inseg.text('转发正文')],
        },
      ],
    },
  };

  const content = createModerationContent([
    inseg.face(14),
    inseg.marketFace({ summary: '动态表情', url: 'https://example.com/face.gif' }),
    forward,
  ]);
  const texts = content.filter((part) => part.type === 'text').map((part) => part.text);

  assert.ok(texts.includes('[QQ 表情：14]'));
  assert.ok(texts.includes('动态表情'));
  assert.ok(texts.includes('[测试用户]'));
  assert.ok(texts.includes('转发正文'));
  assert.ok(
    content.some(
      (part) =>
        part.type === 'file' && part.mediaType === 'image' && part.data.toString() === 'https://example.com/face.gif',
    ),
  );
});
