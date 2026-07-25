import type { HonoService } from '@fraqjs/plugin-hono';

import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WebuiRouteOptions {
  basePath?: string;
  directory?: string;
}

export function registerWebuiRoutes(service: Pick<HonoService, 'app'>, options: WebuiRouteOptions = {}): void {
  const basePath = normalizeBasePath(options.basePath ?? '/drift-bottle');
  const directory = options.directory ?? fileURLToPath(new URL('./webui/', import.meta.url));

  service.app.get(basePath, (context) => context.redirect(`${basePath}/`, 308));
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
