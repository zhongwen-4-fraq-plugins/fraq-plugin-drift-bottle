import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { resolveBottleContent, toOutgoingSegments } from '../src/message.js';

import assert from 'node:assert/strict';
import test from 'node:test';

test('接收消息段会转换成可安全发送的消息段', async () => {
  const client = createMockMilkyClient();
  client.stubApi('get_resource_temp_url', ({ resource_id }) => ({ url: `https://example.com/${resource_id}` }));

  const segments = await toOutgoingSegments(client, [
    inseg.text('你好'),
    inseg.mention(10001, '测试用户'),
    inseg.image({ resourceId: 'image-id', tempUrl: 'https://old.example.com/image' }),
    inseg.file({ fileName: 'document.txt' }),
  ]);

  assert.deepEqual(segments, [
    { type: 'text', data: { text: '你好' } },
    { type: 'text', data: { text: '[提及：测试用户]' } },
    {
      type: 'image',
      data: {
        uri: 'https://example.com/image-id',
        sub_type: 'normal',
        summary: '[image]',
      },
    },
    { type: 'text', data: { text: '[文件：document.txt]' } },
  ]);
});

test('回复消息中的图片和视频可以作为漂流瓶内容', () => {
  const client = createMockMilkyClient();
  const quoted = client.inbox.group({ groupId: 20001, userId: 10001 }, [
    inseg.text('不会被带入的文字'),
    inseg.image({ resourceId: 'image-id', tempUrl: 'https://example.com/image' }),
    inseg.video({ resourceId: 'video-id', tempUrl: 'https://example.com/video' }),
  ]);
  const message = client.inbox.group({ groupId: 20001, userId: 10002 }, [inseg.text('当前文字'), inseg.reply(quoted)]);

  const content = resolveBottleContent(message.segments);

  assert.deepEqual(
    content.map((segment) => segment.type),
    ['text', 'image', 'video'],
  );
  assert.equal(content[0]?.type === 'text' && content[0].data.text, '当前文字');
});
