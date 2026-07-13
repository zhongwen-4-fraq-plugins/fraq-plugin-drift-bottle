import { inseg } from '@fraqjs/mock';

import { createModerationContent } from '../src/moderation.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('AI 审核输入包含文本和媒体', () => {
  const content = createModerationContent([
    inseg.text('普通文本'),
    inseg.image({ tempUrl: 'https://example.com/image.jpg', summary: '图片摘要' }),
    inseg.record({ tempUrl: 'https://example.com/audio.mp3' }),
    inseg.video({ tempUrl: 'https://example.com/video.mp4' }),
    inseg.markdown('Markdown 文本'),
  ]);

  assert.ok(Array.isArray(content));
  assert.deepEqual(
    content.filter((part) => part.type === 'text').map((part) => part.text),
    ['以下是待审核的漂流瓶内容：', '普通文本', '图片摘要', '[语音消息]', '[视频消息]', 'Markdown 文本'],
  );

  assert.deepEqual(
    content.filter((part) => part.type === 'file').map((part) => ({ type: part.mediaType, url: part.data.toString() })),
    [
      { type: 'image', url: 'https://example.com/image.jpg' },
      { type: 'audio', url: 'https://example.com/audio.mp3' },
      { type: 'video', url: 'https://example.com/video.mp4' },
    ],
  );
});
