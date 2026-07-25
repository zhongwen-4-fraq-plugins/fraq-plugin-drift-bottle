import { HonoService } from '@fraqjs/plugin-hono';

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
  registerWebuiRoutes(hono, { basePath: '/manage/drift-bottle/', directory });

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
});
