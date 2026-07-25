import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

const PASSWORD_LENGTH = 10;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_PREFIX = 'scrypt-v1';

export interface WebuiCredentialStore {
  webuiPasswordHash(): string | undefined;
  setWebuiPasswordHash(hash: string): void;
}

export class WebuiAuth {
  private passwordHash?: string;
  private readonly sessions = new Map<string, number>();

  constructor(private readonly store: WebuiCredentialStore) {}

  async initialize(): Promise<string | undefined> {
    this.passwordHash = this.store.webuiPasswordHash();
    if (this.passwordHash) {
      return undefined;
    }

    const password = generateInitialPassword();
    this.passwordHash = await hashPassword(password);
    this.store.setWebuiPasswordHash(this.passwordHash);
    return password;
  }

  async createSession(password: string): Promise<string | undefined> {
    if (!this.passwordHash || !(await verifyPassword(password, this.passwordHash))) {
      return undefined;
    }

    this.pruneExpiredSessions();
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
  }

  isSessionValid(token: string | undefined): boolean {
    if (!token) {
      return false;
    }

    const expiresAt = this.sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  revokeSession(token: string | undefined): void {
    if (token) {
      this.sessions.delete(token);
    }
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.sessions) {
      if (expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}

export function generateInitialPassword(): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
  const allCharacters = groups.join('');
  const characters = groups.map((group) => group[randomInt(group.length)]);

  while (characters.length < PASSWORD_LENGTH) {
    characters.push(allCharacters[randomInt(allCharacters.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join('');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await derivePassword(password, salt);
  return `${HASH_PREFIX}:${salt.toString('base64url')}:${digest.toString('base64url')}`;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [prefix, saltValue, digestValue, extra] = encodedHash.split(':');
  if (prefix !== HASH_PREFIX || !saltValue || !digestValue || extra) {
    return false;
  }

  try {
    const expected = Buffer.from(digestValue, 'base64url');
    const actual = await derivePassword(password, Buffer.from(saltValue, 'base64url'));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}
