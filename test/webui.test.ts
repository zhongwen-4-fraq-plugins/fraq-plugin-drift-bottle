import { HonoService } from '@fraqjs/plugin-hono';

import { WebuiAuth } from '../src/webui/auth.js';
import { registerWebuiRoutes } from '../src/webui/routes.js';

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
  registerWebuiRoutes(hono, { auth, basePath: '/manage/drift-bottle/', directory });

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
  assert.deepEqual(await anonymousSession.json(), { authenticated: false });
  assert.equal(anonymousSession.headers.get('cache-control'), 'no-store');

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
  assert.deepEqual(await authenticatedSession.json(), { authenticated: true });

  const logout = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
});
