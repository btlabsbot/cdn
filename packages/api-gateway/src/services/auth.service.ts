import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { signSession, verifySession, type SessionPayload } from "@lynxnodes/shared";
import type { GatewayConfig } from "../config/env";
import { loadUsers, saveUsers, type StoredUser } from "./credentialStore";

const scryptAsync = promisify(scryptCb);

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, SCRYPT_KEY_LENGTH) as Promise<Buffer>;
}

async function buildUser(username: string, password: string, sessionVersion = 0): Promise<StoredUser> {
  const salt = randomBytes(16);
  const hash = await hashPassword(password, salt);
  return {
    username,
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    createdAt: new Date().toISOString(),
    sessionVersion,
  };
}

/** Burns comparable CPU for unknown users so login timing doesn't enumerate accounts. */
async function dummyHash(): Promise<void> {
  try {
    await hashPassword(randomBytes(8).toString("hex"), randomBytes(16));
  } catch {
    // best-effort only
  }
}

export type RegisterResult = { token: string } | { error: string };

/**
 * Multi-user auth (self-registration): a small in-memory map of accounts,
 * persisted to data/auth.json (salt + scrypt hash only, never plaintext).
 * On first boot it seeds a single account from ADMIN_USERNAME/PASSWORD —
 * after that those env vars are ignored, accounts come from the DB file.
 *
 * Registration is CLOSED by default (ALLOW_REGISTRATION=true to open it).
 * A corrupt auth.json fails startup closed instead of re-seeding.
 *
 * Construct via `await createAuthService(config)` (async: scrypt + seeding).
 */
class AuthService {
  private users: Map<string, StoredUser>;
  private authSecret: string;
  private allowRegistration: boolean;

  private constructor(users: Map<string, StoredUser>, config: GatewayConfig) {
    this.users = users;
    this.authSecret = config.authSecret;
    this.allowRegistration = config.allowRegistration;
  }

  static async create(config: GatewayConfig): Promise<AuthService> {
    // Fail closed on corruption: loadUsers throws CorruptStoreError, which
    // must crash startup — never fall through to re-seeding (that would wipe users).
    const persisted = loadUsers();
    if (persisted.length > 0) {
      return new AuthService(new Map(persisted.map((u) => [u.username, u])), config);
    }

    if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
      throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required when creating the first production account");
    }

    // First boot: seed one account from env vars and persist it.
    const seedUser = await buildUser(config.adminUsername, config.adminPassword);
    const svc = new AuthService(new Map([[seedUser.username, seedUser]]), config);
    svc.persist();
    return svc;
  }

  private persist(): void {
    saveUsers(Array.from(this.users.values()));
  }

  private async matches(user: StoredUser, password: string): Promise<boolean> {
    const candidate = await hashPassword(password, Buffer.from(user.salt, "hex"));
    const expected = Buffer.from(user.hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  /** Returns a signed session token on success, or null on bad credentials. */
  async login(username: string, password: string): Promise<string | null> {
    const user = this.users.get(username);
    if (!user) {
      await dummyHash();
      return null;
    }
    if (!(await this.matches(user, password))) return null;
    return signSession(username, this.authSecret, undefined, user.sessionVersion ?? 0);
  }

  verify(token: string | undefined | null): SessionPayload | null {
    const payload = verifySession(token, this.authSecret);
    if (!payload) return null;
    const user = this.users.get(payload.sub);
    if (!user || (payload.ver ?? 0) !== (user.sessionVersion ?? 0)) return null;
    return payload;
  }

  isRegistrationAllowed(): boolean {
    return this.allowRegistration;
  }

  /** Creates a new account and returns a signed session (auto-login). */
  async register(username: string, password: string): Promise<RegisterResult> {
    if (!this.allowRegistration) {
      return { error: "El registro de nuevas cuentas está desactivado" };
    }
    if (this.users.has(username)) {
      return { error: "Ese usuario ya existe" };
    }

    const user = await buildUser(username, password);
    this.users.set(username, user);
    this.persist();
    return { token: signSession(username, this.authSecret, undefined, user.sessionVersion ?? 0) };
  }

  /**
   * Changes one user's password after verifying their current one.
   * Returns false (and changes nothing) if currentPassword is wrong.
   */
  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(username);
    if (!user || !(await this.matches(user, currentPassword))) return false;

    const updated = await buildUser(username, newPassword, (user.sessionVersion ?? 0) + 1);
    this.users.set(username, updated);
    this.persist();
    return true;
  }
}

export async function createAuthService(config: GatewayConfig): Promise<AuthService> {
  return AuthService.create(config);
}

export type { AuthService };
