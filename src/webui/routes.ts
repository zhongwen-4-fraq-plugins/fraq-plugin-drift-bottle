import type { HonoService } from '@fraqjs/plugin-hono';

import type { WebuiAuth } from './auth.js';

import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WebuiRouteOptions {
  basePath?: string;
  directory?: string;
  auth: WebuiAuth;
}

const SESSION_COOKIE = 'drift_bottle_session';

export function registerWebuiRoutes(service: Pick<HonoService, 'app'>, options: WebuiRouteOptions): string {
  const basePath = normalizeBasePath(options.basePath ?? '/drift-bottle');
  const directory = options.directory ?? fileURLToPath(new URL('./webui/', import.meta.url));

  service.app.get(basePath, (context) => context.redirect(`${basePath}/`, 308));
  service.app.get(`${basePath}/api/session`, (context) =>
    context.json({ authenticated: options.auth.isSessionValid(readSessionCookie(context.req.header('cookie'))) }, 200, {
      'Cache-Control': 'no-store',
    }),
  );
  service.app.post(`${basePath}/api/session`, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: '请求格式无效' }, 400, { 'Cache-Control': 'no-store' });
    }

    const password = readPassword(body);
    if (!password) {
      return context.json({ error: '请输入密码' }, 400, { 'Cache-Control': 'no-store' });
    }

    const token = await options.auth.createSession(password);
    if (!token) {
      return context.json({ error: '密码不正确' }, 401, { 'Cache-Control': 'no-store' });
    }

    const secure = new URL(context.req.url).protocol === 'https:';
    return context.json({ authenticated: true }, 200, {
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie(token, basePath, secure),
    });
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

function readPassword(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('password' in body) || typeof body.password !== 'string') {
    return undefined;
  }
  return body.password;
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
