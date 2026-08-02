const qfaceRootUrl = new URL('https://koishi.js.org/QFace/');

interface QFaceIndexAsset {
  name: string;
  path: string;
  type: number;
}

interface QFaceIndexEntry {
  assets?: unknown;
  describe?: unknown;
  emojiId?: unknown;
}

export interface QqFaceAsset {
  label: string;
  url: string;
}

let qfaceIndexPromise: Promise<unknown> | undefined;

export async function loadQqFaceAsset(faceId: string): Promise<QqFaceAsset | undefined> {
  return resolveQqFaceAsset(await loadQFaceIndex(), faceId);
}

export function resolveQqFaceAsset(index: unknown, faceId: string): QqFaceAsset | undefined {
  if (!Array.isArray(index)) return undefined;
  const entry = index.find((item): item is QFaceIndexEntry => {
    return Boolean(item && typeof item === 'object' && String((item as QFaceIndexEntry).emojiId) === String(faceId));
  });
  if (!entry || !Array.isArray(entry.assets)) return undefined;

  const assets = entry.assets.filter(isQFaceIndexAsset);
  const expectedName = `${faceId}.png`;
  const asset =
    assets.find((item) => item.type === 0 && item.name === expectedName) ??
    assets.find((item) => item.type === 0) ??
    assets.find((item) => item.type === 2);
  if (!asset) return undefined;

  let url: URL;
  try {
    url = new URL(asset.path, qfaceRootUrl);
  } catch {
    return undefined;
  }
  if (url.origin !== qfaceRootUrl.origin || !url.pathname.startsWith('/QFace/assets/qq_emoji/')) return undefined;
  const description = typeof entry.describe === 'string' ? entry.describe.replace(/^\/+/, '').trim() : '';
  return {
    label: description || `QQ 表情 ${faceId}`,
    url: url.href,
  };
}

async function loadQFaceIndex(): Promise<unknown> {
  qfaceIndexPromise ??= fetch(new URL('assets/qq_emoji/_index.json', qfaceRootUrl), {
    cache: 'force-cache',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
    .then((response) => {
      if (!response.ok) throw new Error(`QFace index request failed with status ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .catch((error: unknown) => {
      qfaceIndexPromise = undefined;
      throw error;
    });
  return qfaceIndexPromise;
}

function isQFaceIndexAsset(value: unknown): value is QFaceIndexAsset {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Partial<QFaceIndexAsset>).name === 'string' &&
      typeof (value as Partial<QFaceIndexAsset>).path === 'string' &&
      typeof (value as Partial<QFaceIndexAsset>).type === 'number',
  );
}
