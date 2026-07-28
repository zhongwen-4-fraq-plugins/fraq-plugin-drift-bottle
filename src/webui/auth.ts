import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

const PASSWORD_LENGTH = 10;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_PREFIX = 'scrypt-v1';

export interface WebuiCredentialStore {
  webuiPasswordHash(): string | undefined;
  setWebuiPasswordHash(hash: string): void;
  clearWebuiPasswordHash(): void;
  webuiAccountCount(): number;
  webuiAccountPasswordHash(userId: number): string | undefined;
  setWebuiAccount(userId: number, passwordHash: string, approvedBy?: number): void;
  hasWebuiRegistrationRequest(userId: number): boolean;
  createWebuiRegistrationRequest(userId: number, passwordHash: string): void;
  removeWebuiRegistrationRequest(userId: number): void;
  approveWebuiRegistrationRequest(userId: number, approvedBy: number): boolean;
}

export type WebuiRegistrationRequestResult = 'account-exists' | 'created' | 'pending';

export class WebuiAuth {
  private readonly sessions = new Map<string, { expiresAt: number; userId: number }>();

  constructor(private readonly store: WebuiCredentialStore) {}

  async initialize(ownerId: number | undefined): Promise<{ password: string; userId: number } | undefined> {
    if (!isValidQqNumber(ownerId) || this.store.webuiAccountCount() > 0) {
      return undefined;
    }

    const legacyPasswordHash = this.store.webuiPasswordHash();
    if (legacyPasswordHash) {
      this.store.setWebuiAccount(ownerId, legacyPasswordHash, ownerId);
      this.store.clearWebuiPasswordHash();
      return undefined;
    }

    const password = generateInitialPassword();
    this.store.setWebuiAccount(ownerId, await hashPassword(password), ownerId);
    return { password, userId: ownerId };
  }

  async createSession(userId: number, password: string): Promise<string | undefined> {
    const passwordHash = this.store.webuiAccountPasswordHash(userId);
    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      return undefined;
    }

    this.pruneExpiredSessions();
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, userId });
    return token;
  }

  async requestRegistration(userId: number, password: string): Promise<WebuiRegistrationRequestResult> {
    if (this.store.webuiAccountPasswordHash(userId)) {
      return 'account-exists';
    }
    if (this.store.hasWebuiRegistrationRequest(userId)) {
      return 'pending';
    }
    this.store.createWebuiRegistrationRequest(userId, await hashPassword(password));
    return 'created';
  }

  cancelRegistration(userId: number): void {
    this.store.removeWebuiRegistrationRequest(userId);
  }

  approveRegistration(userId: number, approvedBy: number): boolean {
    return this.store.approveWebuiRegistrationRequest(userId, approvedBy);
  }

  sessionUserId(token: string | undefined): number | undefined {
    if (!token) {
      return undefined;
    }

    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return session.userId;
  }

  isSessionValid(token: string | undefined): boolean {
    return this.sessionUserId(token) !== undefined;
  }

  revokeSession(token: string | undefined): void {
    if (token) {
      this.sessions.delete(token);
    }
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) {
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

export function parseQqAccount(account: unknown): number | undefined {
  if (typeof account !== 'string' || !/^[1-9]\d{4,11}$/.test(account)) {
    return undefined;
  }
  const userId = Number(account);
  return isValidQqNumber(userId) ? userId : undefined;
}

export function isValidWebuiPassword(password: unknown): password is string {
  return typeof password === 'string' && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,10}$/.test(password);
}

function isValidQqNumber(value: number | undefined): value is number {
  return Number.isSafeInteger(value) && value !== undefined && value >= 10_000 && value <= 999_999_999_999;
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
