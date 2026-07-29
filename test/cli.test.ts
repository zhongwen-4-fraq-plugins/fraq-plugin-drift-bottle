import { Context, type LogMessage, type milky } from '@fraqjs/fraq';
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
  const client = createMockMilkyClient();
  let messageSeq = 1;
  client.stubApi('get_impl_info', () => ({
    impl_name: 'Lagrange.Core',
    impl_version: '1.2.3',
    milky_version: '1.3',
    qq_protocol_type: 'linux',
    qq_protocol_version: '9.9.15',
  }));
  client.stubApi('send_private_message', () => ({ message_seq: messageSeq++, time: 1_700_000_000 }));
  const ctx = Context.fromClient(client, {
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
  assert.ok(client.apiCalls.some((call) => call.endpoint === 'get_impl_info'));
  assert.ok(messages.some((message) => message.message === '漂流瓶 WebUI：http://127.0.0.1:4649/manage/drift-bottle/'));
  const passwordMessages = client.apiCalls
    .filter((call) => call.endpoint === 'send_private_message')
    .map((call) => call.params as milky.SendPrivateMessageInput_ZodInput);
  assert.deepEqual(
    passwordMessages.map((message) => message.user_id),
    [123456789, 987654321],
  );
  assert.ok(
    passwordMessages.every((message) =>
      message.message.some(
        (segment) =>
          segment.type === 'text' &&
          /^您的密码是：(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,10}，请妥善保管您的密码以防丢失，如若丢失请联系插件拥有者前往数据库删除您的密码$/.test(
            segment.data.text,
          ),
      ),
    ),
  );
  const initialPasswordText = passwordMessages[0]?.message.find((segment) => segment.type === 'text')?.data.text;
  const initialPassword = initialPasswordText?.match(/^您的密码是：([A-Za-z\d]{6,10})，/)?.[1];
  assert.ok(initialPassword);
  const login = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '123456789', password: initialPassword }),
  });
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);
  const dashboard = await hono.app.request('http://localhost/manage/drift-bottle/api/dashboard', {
    headers: { Cookie: cookie },
  });
  const dashboardBody = (await dashboard.json()) as { runtime: unknown };
  assert.deepEqual(dashboardBody.runtime, {
    fraqVersion: '0.14.0',
    protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
  });
  const session = await hono.app.request('http://localhost/manage/drift-bottle/api/session');
  assert.deepEqual(await session.json(), {
    account: null,
    authenticated: false,
    canModerate: false,
    isOwner: false,
  });
});
