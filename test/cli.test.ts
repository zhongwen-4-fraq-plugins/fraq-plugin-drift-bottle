import { Context, type LogMessage } from '@fraqjs/fraq';
import { createMockMilkyClient } from '@fraqjs/mock';
import { AiService } from '@fraqjs/plugin-ai';
import { HonoService } from '@fraqjs/plugin-hono';
import type { LanguageModel } from 'ai';

import DriftBottlePlugin, { DriftBottleApi, type DriftBottleOptions } from '../src/index.js';

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('包元信息符合 Fraq CLI 插件约定', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.name, `fraq-plugin-${DriftBottlePlugin.name}`);
  assert.equal(packageJson.fraq.category, 'social');
  assert.equal(packageJson.peerDependencies['@fraqjs/fraq'], '^0.14.0');
  assert.equal(packageJson.peerDependencies['@fraqjs/plugin-ai'], '^0.5.1');
  assert.equal(packageJson.peerDependencies['@fraqjs/plugin-hono'], '^0.2.1');
});

test('Fraq CLI 的 JSON 配置对象可以安装默认导出', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-cli-'));
  const messages: LogMessage[] = [];
  const ctx = Context.fromClient(createMockMilkyClient(), {
    logHandler: (message) => messages.push(message),
  });
  t.after(async () => {
    await ctx.stop();
    await rm(directory, { recursive: true, force: true });
  });

  ctx.provide(
    AiService,
    new AiService({
      models: { test: {} as LanguageModel },
      images: {},
      aliases: {},
    }),
  );
  const hono = new HonoService();
  ctx.provide(HonoService, hono);
  const options = JSON.parse(
    JSON.stringify({
      storagePath: join(directory, 'bottles.db'),
      moderationModel: 'test',
      ownerIds: [123456789, 987654321],
      webuiPath: '/manage/drift-bottle/',
    }),
  ) as DriftBottleOptions;

  ctx.install(DriftBottlePlugin, options);
  await ctx.start();

  assert.equal(ctx.isProvided(DriftBottleApi), true);
  assert.ok(messages.some((message) => message.message === '漂流瓶 WebUI：http://127.0.0.1:4649/manage/drift-bottle/'));
  const session = await hono.app.request('http://localhost/manage/drift-bottle/api/session');
  assert.deepEqual(await session.json(), {
    account: null,
    authenticated: false,
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640',
    isOwner: false,
  });
});
