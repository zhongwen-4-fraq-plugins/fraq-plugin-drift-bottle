import type { HonoService } from '@fraqjs/plugin-hono';

export function buildWebuiUrl(service: Pick<HonoService, 'host' | 'port'>, basePath: string): string {
  let hostname = service.host;
  if (hostname === '0.0.0.0') {
    hostname = '127.0.0.1';
  } else if (hostname === '::') {
    hostname = '::1';
  }

  const formattedHostname = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `http://${formattedHostname}:${service.port}${basePath}/`;
}
