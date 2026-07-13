import { inseg } from '@fraqjs/mock';

import { createModerationContent, createModerationInstructions } from '../src/moderation.js';

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
