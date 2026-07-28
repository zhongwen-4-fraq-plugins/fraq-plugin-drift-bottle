import type { HonoService } from '@fraqjs/plugin-hono';

import { isValidWebuiPassword, parseQqAccount, type WebuiAuth } from './auth.js';
import type { DashboardSnapshot } from './dashboard.js';
import type {
  WebuiBottleListItem,
  WebuiListPage,
  WebuiPendingReviewItem,
  WebuiRegistrationRequestItem,
} from './lists.js';
import type { WebuiRegistration } from './registration.js';

import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WebuiRouteOptions {
  basePath?: string;
  directory?: string;
  auth: WebuiAuth;
  dashboard: () => DashboardSnapshot;
  bottles: (page: number) => WebuiListPage<WebuiBottleListItem>;
  pendingReviews: (page: number) => WebuiListPage<WebuiPendingReviewItem>;
  registration: Pick<WebuiRegistration, 'submit'>;
  registrationRequests: (page: number) => WebuiListPage<WebuiRegistrationRequestItem>;
  ownerIds: number[];
}

const SESSION_COOKIE = 'drift_bottle_session';

export function registerWebuiRoutes(service: Pick<HonoService, 'app'>, options: WebuiRouteOptions): string {
  const basePath = normalizeBasePath(options.basePath ?? '/drift-bottle');
  const directory = options.directory ?? fileURLToPath(new URL('./webui/', import.meta.url));

  service.app.get(basePath, (context) => context.redirect(`${basePath}/`, 308));
  service.app.get(`${basePath}/api/session`, (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    return context.json(
      {
        account: userId ? String(userId) : null,
        authenticated: userId !== undefined,
        isOwner: userId !== undefined && options.ownerIds.includes(userId),
        avatarUrl: qqAvatarUrl(userId),
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  });
  service.app.post(`${basePath}/api/session`, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }

    const credentials = readCredentials(body);
    if (!credentials) {
      return context.json({ error: '请输入 QQ 号和密码' }, 400, { 'Cache-Control': 'no-store' });
    }

    const userId = parseQqAccount(credentials.account);
    if (!userId) {
      return context.json({ error: '账号或密码不正确' }, 401, { 'Cache-Control': 'no-store' });
    }
    const token = await options.auth.createSession(userId, credentials.password);
    if (!token) {
      return context.json({ error: '账号或密码不正确' }, 401, { 'Cache-Control': 'no-store' });
    }

    const secure = new URL(context.req.url).protocol === 'https:';
    return context.json(
      {
        account: String(userId),
        authenticated: true,
        avatarUrl: qqAvatarUrl(userId),
        isOwner: options.ownerIds.includes(userId),
      },
      200,
      {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(token, basePath, secure),
      },
    );
  });
  service.app.post(`${basePath}/api/registrations`, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }

    const credentials = readCredentials(body);
    if (!credentials) {
      return context.json({ error: '请输入 QQ 号和密码' }, 400, { 'Cache-Control': 'no-store' });
    }
    const userId = parseQqAccount(credentials.account);
    if (!userId) {
      return context.json({ error: '账号必须是 5–12 位 QQ 号' }, 400, { 'Cache-Control': 'no-store' });
    }
    if (!isValidWebuiPassword(credentials.password)) {
      return context.json({ error: '密码必须为 6–10 位，并同时包含大写字母、小写字母和数字' }, 400, {
        'Cache-Control': 'no-store',
      });
    }

    const result = await options.registration.submit(userId, credentials.password);
    if (result === 'account-exists') {
      return context.json({ error: '该 QQ 已有账号，请直接登录' }, 409, { 'Cache-Control': 'no-store' });
    }
    if (result === 'notification-unavailable') {
      return context.json({ error: '暂时无法联系插件主人，请稍后重试' }, 503, { 'Cache-Control': 'no-store' });
    }
    return context.json(
      {
        status: 'pending',
        message: result === 'created' ? '申请已发送，请等待插件主人同意' : '该 QQ 的申请正在等待主人同意',
      },
      202,
      { 'Cache-Control': 'no-store' },
    );
  });
  service.app.delete(`${basePath}/api/session`, (context) => {
    options.auth.revokeSession(readSessionCookie(context.req.header('cookie')));
    const secure = new URL(context.req.url).protocol === 'https:';
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie('', basePath, secure, 0),
      },
    });
  });
  service.app.get(`${basePath}/api/dashboard`, (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(options.dashboard(), 200, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/reviews/pending`, (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(options.pendingReviews(readPage(context.req.query('page'))), 200, {
      'Cache-Control': 'no-store',
    });
  });
  service.app.get(`${basePath}/api/bottles`, (context) => {
    if (!options.auth.isSessionValid(readSessionCookie(context.req.header('cookie')))) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    return context.json(options.bottles(readPage(context.req.query('page'))), 200, { 'Cache-Control': 'no-store' });
  });
  service.app.get(`${basePath}/api/registrations/pending`, (context) => {
    const userId = options.auth.sessionUserId(readSessionCookie(context.req.header('cookie')));
    if (userId === undefined) {
      return context.json({ error: '登录已过期，请重新登录' }, 401, { 'Cache-Control': 'no-store' });
    }
    if (!options.ownerIds.includes(userId)) {
      return context.json({ error: '仅插件主人可以查看账号请求' }, 403, { 'Cache-Control': 'no-store' });
    }
    return context.json(options.registrationRequests(readPage(context.req.query('page'))), 200, {
      'Cache-Control': 'no-store',
    });
  });
  service.app.get(`${basePath}/`, async () => serveWebuiFile(directory, 'index.html'));
  service.app.get(`${basePath}/*`, async (context) => {
    let requestPath: string;
    try {
      requestPath = decodeURIComponent(context.req.path.slice(basePath.length + 1));
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const response = await serveWebuiFile(directory, requestPath);
    if (response.status !== 404 || extname(requestPath)) {
      return response;
    }
    return serveWebuiFile(directory, 'index.html');
  });
  return basePath;
}

function readCredentials(body: unknown): { account: string; password: string } | undefined {
  if (
    !body ||
    typeof body !== 'object' ||
    !('account' in body) ||
    typeof body.account !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string'
  ) {
    return undefined;
  }
  return { account: body.account, password: body.password };
}

function readPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function qqAvatarUrl(userId: number | undefined): string | undefined {
  if (!Number.isSafeInteger(userId) || !userId || userId < 1) {
    return undefined;
  }
  return `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`;
}

function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const cookie of header.split(';')) {
    const [name, ...value] = cookie.trim().split('=');
    if (name === SESSION_COOKIE) {
      return value.join('=');
    }
  }
  return undefined;
}

function sessionCookie(token: string, basePath: string, secure: boolean, maxAge = 12 * 60 * 60): string {
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    `Path=${basePath}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

function normalizeBasePath(path: string): string {
  const normalized = `/${path.trim().split('/').filter(Boolean).join('/')}`;
  if (normalized === '/' || path.includes('?') || path.includes('#')) {
    throw new Error('WebUI 挂载路径必须是非根路径，且不能包含查询参数或片段');
  }
  return normalized;
}

async function serveWebuiFile(directory: string, requestPath: string): Promise<Response> {
  const filePath = resolve(directory, requestPath);
  const relativePath = relative(directory, filePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return new Response('Not Found', { status: 404 });
  }

  let content: Uint8Array;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (isMissingFile(error)) {
      return new Response('Not Found', { status: 404 });
    }
    throw error;
  }

  return new Response(content, {
    headers: {
      'Cache-Control': requestPath === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Type': contentTypeFor(requestPath),
    },
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'EISDIR');
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}
