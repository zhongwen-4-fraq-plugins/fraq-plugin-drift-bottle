import { inseg } from '@fraqjs/mock';
import type { AiService } from '@fraqjs/plugin-ai';
import { MockLanguageModelV3 } from 'ai/test';

import type { BottleSegment } from '../src/models/index.js';
import {
  createModerationContent,
  createModerationInstructions,
  formatModerationUsage,
  ModerationFailureError,
  moderateBottle,
} from '../src/processing/moderation.js';

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
  const instructions = createModerationInstructions();

  assert.match(instructions, /JSON 必须且只能包含三个字段：approved、categories、reason/);
  assert.match(instructions, /approved 必须是 JSON 布尔值 true 或 false/);
  assert.match(instructions, /元素只能是字符串 "profanity" 或 "r18"/);
  assert.match(instructions, /reason 必须是 JSON 字符串/);
});

test('AI 审核结构不匹配时只重试一次并累计 Token', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      {
        content: [{ type: 'text', text: '{"approved":"false","categories":"r18","reason":1}' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
        warnings: [{ type: 'unsupported', feature: 'responseFormat', details: 'json_schema unavailable' }],
      },
      {
        content: [{ type: 'text', text: '{"approved":false,"categories":["r18"],"reason":"不适合公开"}' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 4, text: 4, reasoning: 0 },
        },
        warnings: [],
      },
    ],
  });
  const ai = { model: () => model } as unknown as AiService;

  const result = await moderateBottle(ai, [inseg.text('需要审核')]);

  assert.deepEqual(result, {
    approved: false,
    categories: ['r18'],
    reason: '不适合公开',
    usage: { inputTokens: 22, outputTokens: 7, totalTokens: 29 },
  });
  assert.equal(model.doGenerateCalls.length, 2);
});

test('AI 审核两次结构校验失败后保留诊断并保持关闭失败', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      {
        content: [{ type: 'text', text: '{"approved":"yes"}' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 2, text: 2, reasoning: 0 },
        },
        warnings: [{ type: 'unsupported', feature: 'responseFormat' }],
      },
      {
        content: [{ type: 'text', text: '{"approved":false,"categories":["unknown"],"reason":null}' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 9, noCache: 9, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
        warnings: [],
      },
    ],
  });
  const ai = { model: () => model } as unknown as AiService;

  await assert.rejects(
    () => moderateBottle(ai, [inseg.text('仍然不符合结构')]),
    (error: unknown) => {
      assert.ok(error instanceof ModerationFailureError);
      assert.equal(error.attempts.length, 2);
      assert.equal(error.attempts[0]?.finishReason, 'stop');
      assert.match(error.attempts[0]?.warnings[0] ?? '', /unsupported.*responseFormat/);
      assert.match(error.attempts[1]?.responseTextSummary ?? '', /unknown/);
      assert.deepEqual(error.usage, { inputTokens: 17, outputTokens: 5, totalTokens: 22 });
      return true;
    },
  );
  assert.equal(model.doGenerateCalls.length, 2);
});

test('AI 审核 Token 用量包含输入、输出和总计', () => {
  assert.equal(
    formatModerationUsage({ inputTokens: 120, outputTokens: 30, totalTokens: 150 }),
    '漂流瓶 AI 审核 Token：输入 120，输出 30，总计 150',
  );
  assert.equal(formatModerationUsage({}), '漂流瓶 AI 审核 Token：输入 未知，输出 未知，总计 未知');
});

test('AI 审核会将卡通或动物的性暗示倾向视为 R18', () => {
  const instructions = createModerationInstructions();

  assert.match(instructions, /性暗示/);
  assert.match(instructions, /臀部.*肛门.*裆部/);
  assert.match(instructions, /触摸.*圈形手势/);
  assert.match(instructions, /卡通.*动物.*表情包/);
  assert.match(instructions, /没有裸露.*r18/i);
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
