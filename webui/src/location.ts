export type AppPage = 'bottles' | 'home' | 'pending' | 'registrations' | 'settings';

const pagePaths: Record<AppPage, string> = {
  bottles: 'bottles',
  home: 'app',
  pending: 'reviews/pending',
  registrations: 'accounts/requests',
  settings: 'settings',
};

export function pageFromLocation(): AppPage {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/reviews/pending')) return 'pending';
  if (path.endsWith('/bottles')) return 'bottles';
  if (path.endsWith('/accounts/requests')) return 'registrations';
  if (path.endsWith('/settings')) return 'settings';
  return 'home';
}

export function webuiUrl(path = ''): URL {
  const url = new URL(window.location.href);
  const pathname = url.pathname.replace(/\/+$/, '');
  const suffix = Object.values(pagePaths).find((candidate) => pathname.endsWith(`/${candidate}`));
  const basePath = suffix ? pathname.slice(0, -suffix.length) : `${pathname}/`;
  url.pathname = `${basePath}${path}`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.hash = '';
  return url;
}

export function pageUrl(page: AppPage): URL {
  return webuiUrl(pagePaths[page]);
}
