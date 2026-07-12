import { createMockMilkyClient, inseg } from '@fraqjs/mock';

import { toOutgoingSegments } from '../src/message.js';

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
