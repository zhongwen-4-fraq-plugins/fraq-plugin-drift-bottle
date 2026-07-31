import { HonoService } from '@fraqjs/plugin-hono';

import { WebuiAuth } from '../src/webui/auth.js';
import { createRegistrationRequestListPage } from '../src/webui/lists.js';
import { registerWebuiRoutes } from '../src/webui/routes.js';
import type { WebuiSettingsSnapshot } from '../src/webui/settings.js';
import { buildWebuiUrl } from '../src/webui/url.js';
import { createTestStore } from './store.js';

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
  const store = await createTestStore(t, join(directory, 'bottles.db'));
  t.after(async () => {
    await store.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  const hono = new HonoService();
  const auth = new WebuiAuth(store);
  const [initialCredential] = await auth.initializeOwners([123456789]);
  assert.ok(initialCredential);
  const registrations: number[] = [];
  const rejectedReviews: { actorId: number; id: string; reason: string }[] = [];
  const dashboard = {
    generatedAt: 1_700_000_001_000,
    instanceStartedAt: 1_700_000_000_000,
    counts: { totalBottles: 12, pendingReview: 3 },
    changelog: [{ version: '0.3.6', items: ['加入主页概览'] }],
    operations: [],
    runtime: {
      fraqVersion: '0.14.0',
      protocolEndpoint: { name: 'Lagrange.Core', version: '1.2.3' },
    },
  };
  const bottles = {
    generatedAt: 1_700_000_001_000,
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    items: [],
  };
  const pendingReviews = { ...bottles, total: 2 };
  let pluginSettings: WebuiSettingsSnapshot = {
    activeWebuiPath: '/manage/drift-bottle',
    moderationMode: 'ai',
    moderationModel: 'openai/gpt-4o-mini',
    ownerIds: [123456789],
    restartRequired: false,
    webuiPath: '/manage/drift-bottle',
  };
  const basePath = registerWebuiRoutes(hono, {
    auth,
    approveReview: async (id) =>
      id === 'admin-review'
        ? {
            status: 'approved',
            bottle: {
              id: 'published-bottle',
              senderId: 10001,
              createdAt: 1_700_000_002_000,
              source: { scene: 'friend', peerId: 10001 },
              segments: [],
            },
          }
        : { status: 'not-found' },
    basePath: '/manage/drift-bottle/',
    bottleComments: async (id) =>
      id === 'bottle-with-comments'
        ? {
            comments: [
              {
                id: 'comment-1',
                bottleId: id,
                senderId: 456789123,
                createdAt: 1_700_000_003_000,
                displayName: '海风',
                content: '写得真好',
              },
            ],
            total: 1,
          }
        : undefined,
    bottleImage: async (id, segmentIndex) => {
      if (id === 'bottle-with-image' && segmentIndex === 2) {
        return { status: 'found', url: 'https://cdn.example.com/bottle-image.jpg' };
      }
      return id === 'missing' ? { status: 'not-found' } : { status: 'not-image' };
    },
    bottles: async () => bottles,
    canModerate: async (userId) => userId === 333333333,
    dashboard: async () => dashboard,
    directory,
    ownerIds: [123456789],
    pendingReviews: async () => pendingReviews,
    rejectReview: async (id, actorId, reason) => {
      rejectedReviews.push({ actorId, id, reason });
      return { status: 'rejected' };
    },
    registration: {
      submit: async (userId, password) => {
        registrations.push(userId);
        return auth.requestRegistration(userId, password);
      },
    },
    registrationRequests: (requestPage) => createRegistrationRequestListPage(store, requestPage),
    settings: () => pluginSettings,
    updateSettings: async (settings) => {
      pluginSettings = {
        ...settings,
        activeWebuiPath: pluginSettings.activeWebuiPath,
        restartRequired: settings.webuiPath !== pluginSettings.activeWebuiPath,
      };
      return pluginSettings;
    },
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
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/accounts/requests')).status, 200);
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/settings')).status, 200);

  const missingAsset = await hono.app.request('http://localhost/manage/drift-bottle/assets/missing.js');
  assert.equal(missingAsset.status, 404);

  const anonymousSession = await hono.app.request('http://localhost/manage/drift-bottle/api/session');
  assert.equal(anonymousSession.status, 200);
  assert.deepEqual(await anonymousSession.json(), {
    account: null,
    authenticated: false,
    canModerate: false,
    isOwner: false,
  });
  assert.equal(anonymousSession.headers.get('cache-control'), 'no-store');

  const anonymousDashboard = await hono.app.request('http://localhost/manage/drift-bottle/api/dashboard');
  assert.equal(anonymousDashboard.status, 401);
  assert.equal(anonymousDashboard.headers.get('cache-control'), 'no-store');
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/pending')).status, 401);
  assert.equal(
    (await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/review-1/approve', { method: 'POST' }))
      .status,
    401,
  );
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/api/bottles')).status, 401);
  assert.equal(
    (await hono.app.request('http://localhost/manage/drift-bottle/api/bottles/bottle-with-comments/comments')).status,
    401,
  );
  assert.equal(
    (await hono.app.request('http://localhost/manage/drift-bottle/api/bottles/bottle-with-image/images/2')).status,
    401,
  );
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/api/registrations/pending')).status, 401);
  assert.equal((await hono.app.request('http://localhost/manage/drift-bottle/api/settings')).status, 401);
  assert.equal(
    (await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', { method: 'PUT' })).status,
    401,
  );

  assert.equal(await auth.requestRegistration(222222222, 'MemberA123'), 'created');
  assert.equal(await auth.approveRegistration(222222222, 123456789), true);
  const memberLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '222222222', password: 'MemberA123' }),
  });
  const memberCookie = memberLogin.headers.get('set-cookie');
  assert.ok(memberCookie);
  assert.deepEqual(await memberLogin.json(), {
    account: '222222222',
    authenticated: true,
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=222222222&s=640',
    canModerate: false,
    isOwner: false,
  });
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/registrations/pending', {
        headers: { Cookie: memberCookie },
      })
    ).status,
    403,
  );
  const memberPasswordChange = await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', {
    method: 'PUT',
    headers: { Cookie: memberCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'MemberA123', newPassword: 'MemberB123' }),
  });
  assert.equal(memberPasswordChange.status, 200);
  assert.ok(await auth.createSession(222222222, 'MemberB123'));
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
        headers: { Cookie: memberCookie },
      })
    ).status,
    403,
  );

  assert.equal(await auth.requestRegistration(333333333, 'AdminA123'), 'created');
  assert.equal(await auth.approveRegistration(333333333, 123456789), true);
  const moderatorLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '333333333', password: 'AdminA123' }),
  });
  const moderatorCookie = moderatorLogin.headers.get('set-cookie');
  assert.ok(moderatorCookie);
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/admin-review/approve', {
        method: 'POST',
        headers: { Cookie: moderatorCookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      (await (
        await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
          headers: { Cookie: moderatorCookie },
        })
      ).json()) as { canModerate: boolean }
    ).canModerate,
    true,
  );
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/review-1/reject', {
        method: 'POST',
        headers: { Cookie: memberCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '成员不能审核' }),
      })
    ).status,
    403,
  );

  const rejectedLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '123456789', password: 'wrong-password' }),
  });
  assert.equal(rejectedLogin.status, 401);

  const acceptedLogin = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '123456789', password: initialCredential.password }),
  });
  assert.equal(acceptedLogin.status, 200);
  const cookie = acceptedLogin.headers.get('set-cookie');
  assert.ok(cookie);
  assert.match(cookie, /drift_bottle_session=[^;]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const missingReason = await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/review-1/reject', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: '   ' }),
  });
  assert.equal(missingReason.status, 400);
  const rejectedReview = await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/review-1/reject', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: '不适合公开展示' }),
  });
  assert.equal(rejectedReview.status, 200);
  assert.deepEqual(rejectedReviews, [{ actorId: 123456789, id: 'review-1', reason: '不适合公开展示' }]);
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/reviews/missing/approve', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );

  const authenticatedSession = await hono.app.request('http://localhost/manage/drift-bottle/api/session', {
    headers: { Cookie: cookie },
  });
  assert.deepEqual(await authenticatedSession.json(), {
    account: '123456789',
    authenticated: true,
    canModerate: true,
    isOwner: true,
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=123456789&s=640',
  });

  const settings = await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
    headers: { Cookie: cookie },
  });
  assert.equal(settings.status, 200);
  assert.deepEqual(await settings.json(), pluginSettings);

  const selfRemoval = await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moderationMode: 'ai',
      moderationModel: '',
      ownerIds: [987654321],
      webuiPath: '/drift-bottle',
    }),
  });
  assert.equal(selfRemoval.status, 400);

  const invalidSettings = await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ moderationMode: 'ai', moderationModel: '', ownerIds: ['123456789'], webuiPath: '/' }),
  });
  assert.equal(invalidSettings.status, 400);

  const invalidModerationMode = await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moderationMode: 'automatic',
      moderationModel: '',
      ownerIds: [123456789],
      webuiPath: '/drift-bottle',
    }),
  });
  assert.equal(invalidModerationMode.status, 400);

  const updatedSettings = await hono.app.request('http://localhost/manage/drift-bottle/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moderationMode: 'manual',
      moderationModel: ' openai/gpt-5-mini ',
      ownerIds: [123456789, 987654321],
      webuiPath: '/new/drift-bottle/',
    }),
  });
  assert.equal(updatedSettings.status, 200);
  assert.deepEqual(await updatedSettings.json(), {
    activeWebuiPath: '/manage/drift-bottle',
    moderationMode: 'manual',
    moderationModel: 'openai/gpt-5-mini',
    ownerIds: [123456789, 987654321],
    restartRequired: true,
    webuiPath: '/new/drift-bottle',
  });

  const incorrectPassword = await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'WrongA1', newPassword: 'ChangedA1' }),
  });
  assert.equal(incorrectPassword.status, 400);
  const weakPassword = await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: initialCredential.password, newPassword: 'weak' }),
  });
  assert.equal(weakPassword.status, 400);
  const unchangedPassword = await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: initialCredential.password, newPassword: initialCredential.password }),
  });
  assert.equal(unchangedPassword.status, 400);
  const changedPassword = await hono.app.request('http://localhost/manage/drift-bottle/api/account/password', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: initialCredential.password, newPassword: 'ChangedA1' }),
  });
  assert.equal(changedPassword.status, 200);
  assert.ok(await auth.createSession(123456789, 'ChangedA1'));
  assert.equal(await auth.createSession(123456789, initialCredential.password), undefined);

  const invalidRegistration = await hono.app.request('http://localhost/manage/drift-bottle/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'not-qq', password: 'ValidA123' }),
  });
  assert.equal(invalidRegistration.status, 400);

  const registration = await hono.app.request('http://localhost/manage/drift-bottle/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '987654321', password: 'ValidA123' }),
  });
  assert.equal(registration.status, 202);
  assert.deepEqual(registrations, [987654321]);

  const registrationRequests = await hono.app.request(
    'http://localhost/manage/drift-bottle/api/registrations/pending?page=1',
    { headers: { Cookie: cookie } },
  );
  assert.equal(registrationRequests.status, 200);
  const requestPage = (await registrationRequests.json()) as { items: { userId: number }[]; total: number };
  assert.equal(requestPage.total, 1);
  assert.deepEqual(
    requestPage.items.map((item) => item.userId),
    [987654321],
  );
  assert.doesNotMatch(JSON.stringify(requestPage), /password|hash/i);

  const authenticatedDashboard = await hono.app.request('http://localhost/manage/drift-bottle/api/dashboard', {
    headers: { Cookie: cookie },
  });
  assert.equal(authenticatedDashboard.status, 200);
  assert.deepEqual(await authenticatedDashboard.json(), dashboard);
  assert.equal(authenticatedDashboard.headers.get('cache-control'), 'no-store');

  const authenticatedReviews = await hono.app.request(
    'http://localhost/manage/drift-bottle/api/reviews/pending?page=1',
    { headers: { Cookie: cookie } },
  );
  assert.equal(authenticatedReviews.status, 200);
  assert.deepEqual(await authenticatedReviews.json(), pendingReviews);
  assert.equal(authenticatedReviews.headers.get('cache-control'), 'no-store');

  const authenticatedBottles = await hono.app.request('http://localhost/manage/drift-bottle/api/bottles?page=1', {
    headers: { Cookie: cookie },
  });
  assert.equal(authenticatedBottles.status, 200);
  assert.deepEqual(await authenticatedBottles.json(), bottles);

  const authenticatedComments = await hono.app.request(
    'http://localhost/manage/drift-bottle/api/bottles/bottle-with-comments/comments',
    { headers: { Cookie: cookie } },
  );
  assert.equal(authenticatedComments.status, 200);
  assert.deepEqual(await authenticatedComments.json(), {
    comments: [
      {
        id: 'comment-1',
        bottleId: 'bottle-with-comments',
        senderId: 456789123,
        createdAt: 1_700_000_003_000,
        displayName: '海风',
        content: '写得真好',
      },
    ],
    total: 1,
  });
  assert.equal(authenticatedComments.headers.get('cache-control'), 'no-store');
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/bottles/missing/comments', {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );

  const authenticatedImage = await hono.app.request(
    'http://localhost/manage/drift-bottle/api/bottles/bottle-with-image/images/2',
    { headers: { Cookie: cookie } },
  );
  assert.equal(authenticatedImage.status, 200);
  assert.deepEqual(await authenticatedImage.json(), { url: 'https://cdn.example.com/bottle-image.jpg' });
  assert.equal(authenticatedImage.headers.get('cache-control'), 'no-store');
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/bottles/bottle-with-image/images/not-a-number', {
        headers: { Cookie: cookie },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await hono.app.request('http://localhost/manage/drift-bottle/api/bottles/missing/images/0', {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );

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
