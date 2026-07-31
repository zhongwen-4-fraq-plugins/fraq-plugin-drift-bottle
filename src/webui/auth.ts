import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 10;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_PREFIX = 'scrypt-v1';

export interface WebuiCredentialStore {
  webuiPasswordHash(): Promise<string | undefined>;
  clearWebuiPasswordHash(): Promise<void>;
  webuiAccountPasswordHash(userId: number): Promise<string | undefined>;
  setWebuiAccount(userId: number, passwordHash: string, approvedBy?: number): Promise<void>;
  removeWebuiAccount(userId: number): Promise<void>;
  hasWebuiRegistrationRequest(userId: number): Promise<boolean>;
  createWebuiRegistrationRequest(userId: number, passwordHash: string): Promise<void>;
  removeWebuiRegistrationRequest(userId: number): Promise<void>;
  approveWebuiRegistrationRequest(userId: number, approvedBy: number): Promise<boolean>;
}

export type WebuiRegistrationRequestResult = 'account-exists' | 'created' | 'pending';

export interface WebuiInitialCredential {
  password: string;
  userId: number;
}

export class WebuiAuth {
  private readonly sessions = new Map<string, { expiresAt: number; userId: number }>();

  constructor(private readonly store: WebuiCredentialStore) {}

  async initializeOwners(ownerIds: number[]): Promise<WebuiInitialCredential[]> {
    const owners = [...new Set(ownerIds.filter(isValidQqNumber))];
    if (owners.length === 0) return [];
    const legacyPasswordHash = await this.store.webuiPasswordHash();
    if (legacyPasswordHash) {
      const firstOwnerId = owners[0];
      if (!(await this.store.webuiAccountPasswordHash(firstOwnerId))) {
        await this.store.setWebuiAccount(firstOwnerId, legacyPasswordHash, firstOwnerId);
      }
      await this.store.clearWebuiPasswordHash();
    }

    const credentials: WebuiInitialCredential[] = [];
    for (const userId of owners) {
      if (await this.store.webuiAccountPasswordHash(userId)) continue;
      const password = generateInitialPassword();
      await this.store.setWebuiAccount(userId, await hashPassword(password), userId);
      credentials.push({ password, userId });
    }
    return credentials;
  }

  async removeAccount(userId: number): Promise<void> {
    await this.store.removeWebuiAccount(userId);
  }

  async createSession(userId: number, password: string): Promise<string | undefined> {
    const passwordHash = await this.store.webuiAccountPasswordHash(userId);
    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      return undefined;
    }

    this.pruneExpiredSessions();
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, userId });
    return token;
  }

  async requestRegistration(userId: number, password: string): Promise<WebuiRegistrationRequestResult> {
    if (await this.store.webuiAccountPasswordHash(userId)) {
      return 'account-exists';
    }
    if (await this.store.hasWebuiRegistrationRequest(userId)) {
      return 'pending';
    }
    await this.store.createWebuiRegistrationRequest(userId, await hashPassword(password));
    return 'created';
  }

  async cancelRegistration(userId: number): Promise<void> {
    await this.store.removeWebuiRegistrationRequest(userId);
  }

  async approveRegistration(userId: number, approvedBy: number): Promise<boolean> {
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

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    activeToken?: string,
  ): Promise<boolean> {
    const passwordHash = await this.store.webuiAccountPasswordHash(userId);
    if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
      return false;
    }

    await this.store.setWebuiAccount(userId, await hashPassword(newPassword));
    for (const [token, session] of this.sessions) {
      if (session.userId === userId && token !== activeToken) {
        this.sessions.delete(token);
      }
    }
    return true;
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
  const passwordLength = randomInt(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH + 1);

  while (characters.length < passwordLength) {
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
