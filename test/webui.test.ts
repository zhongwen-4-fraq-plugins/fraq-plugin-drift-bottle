import { HonoService } from '@fraqjs/plugin-hono';

import { WebuiAuth } from '../src/webui/auth.js';
import { registerWebuiRoutes } from '../src/webui/routes.js';
import { buildWebuiUrl } from '../src/webui/url.js';

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('WebUI 通过 Hono 服务挂载页面、静态资源和前端路由', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraq-drift-bottle-webui-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>漂流瓶管理后台</title>');
  await writeFile(join(directory, 'assets', 'app.js'), 'export const ready = true;');
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const hono = new HonoService();
  let passwordHash: string | undefined;
  const auth = new WebuiAuth({
    webuiPasswordHash: () => passwordHash,
    setWebuiPasswordHash: (hash) => {
      passwordHash = hash;
    },
  });
  const password = await auth.initialize();
  assert.ok(password);
  const dashboard = {
    generatedAt: 1_700_000_001_000,
    instanceStartedAt: 1_700_000_000_000,
    counts: { totalBottles: 12, pendingReview: 3 },
    changelog: [{ version: '0.3.6', items: ['加入主页概览'] }],
    operations: [],
  };
  const basePath = registerWebuiRoutes(hono, {
    auth,
    basePath: '/manage/drift-bottle/',
    dashboard: () => dashboard,
    directory,
    ownerId: 123456789,
  });
  assert.equal(basePath, '/manage/drift-bottle');
  assert.equal(buildWebuiUrl(hono, basePath), 'http://127.0.0.1:4649/manage/drift-bottle/');

  const redirect = await hono.app.request('http://localhost/manage/drift-bottle');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/manage/drift-bottle/');

  const page = await hono.app.request('http://localhost/manage/drift-bottle/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /漂流瓶管理后台/);
  assert.equal(page.headers.get('cache-control'), 'no-cache');

  const asset = await hono.app.request('http://localhost/manage/drift-bottle/assets/app.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const frontendRoute = await hono.app.request('http://localhost/manage/drift-bottle/reviews/pending');
  assert.equal(frontendRoute.status, 200);
  assert.match(await frontendRoute.text(), /漂流瓶管理后台/);

  const missingAsset = await hono.app.request('http://localhost/manage/drift-bottle/assets/missing.js');
  assert.equal(missingAsset.status, 404);

  const anonymousSession = await hono.app.request('http://localhost/manage/drift-bottle/api/session');
  assert.equal(anonymousSession.status, 200);
  assert.deepEqual(await anonymousSession.json(), {
    authenticated: false,
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640',
  });
  assert.equal(anonymousSession.headers.get('cache-control'), 'no-store');

  const anonymousDashboard = await hono.app.request('http://localhost/manage/drift-bottle/api/dashboard');
  assert.equal(anonymousDashboard.status, 401);
  assert.equal(anonymousDashboard.headers.get('cache-control'), 'no-store');

  const rejectedLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' }),
  });
  assert.equal(rejectedLogin.status, 401);

  const acceptedLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(acceptedLogin.status, 200);
  const cookie = acceptedLogin.headers.get('set-cookie');
  assert.ok(cookie);
  assert.match(cookie, /drift_bottle_session=[^;]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const authenticatedSession = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    headers: { Cookie: cookie },
  });
  assert.deepEqual(await authenticatedSession.json(), {
    authenticated: true,
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640',
  });

  const authenticatedDashboard = await hono.app.request('http://localhost/manage/drift-bottle/api/dashboard', {
    headers: { Cookie: cookie },
  });
  assert.equal(authenticatedDashboard.status, 200);
  assert.deepEqual(await authenticatedDashboard.json(), dashboard);
  assert.equal(authenticatedDashboard.headers.get('cache-control'), 'no-store');

  const logout = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

test('WebUI 日志网址将通配监听地址转换为可访问的回环地址', () => {
  assert.equal(buildWebuiUrl({ host: '0.0.0.0', port: 8080 }, '/drift-bottle'), 'http://127.0.0.1:8080/drift-bottle/');
  assert.equal(buildWebuiUrl({ host: '::', port: 8080 }, '/drift-bottle'), 'http://[::1]:8080/drift-bottle/');
  assert.equal(
    buildWebuiUrl({ host: '2001:db8::1', port: 8080 }, '/drift-bottle'),
    'http://[2001:db8::1]:8080/drift-bottle/',
  );
});
