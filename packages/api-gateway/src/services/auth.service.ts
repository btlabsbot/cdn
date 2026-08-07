import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { signSession, verifySession, type SessionPayload } from "@lynxnodes/shared";
import type { GatewayConfig } from "../config/env";
import { loadUsers, saveUsers, type StoredUser } from "./credentialStore";

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH);
}

function buildUser(username: string, password: string): StoredUser {
  const salt = randomBytes(16);
  const hash = hashPassword(password, salt);
  return {
    username,
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    createdAt: new Date().toISOString(),
  };
}

export type RegisterResult = { token: string } | { error: string };

/**
 * Multi-user auth (self-registration): a small in-memory map of accounts,
 * persisted to data/auth.json (salt + scrypt hash only, never plaintext).
 * On first boot it seeds a single account from ADMIN_USERNAME/PASSWORD —
 * after that those env vars are ignored, accounts come from the DB file.
 *
 * Registration is open by default (this is meant for a small internal
 * team dashboard) but can be turned off with ALLOW_REGISTRATION=false
 * once the team it's for has accounts.
 */
class AuthService {
  private users: Map<string, StoredUser>;
  private authSecret: string;
  private allowRegistration: boolean;

  constructor(config: GatewayConfig) {
    this.authSecret = config.authSecret;
    this.allowRegistration = config.allowRegistration;

    const persisted = loadUsers();
    if (persisted.length > 0) {
      this.users = new Map(persisted.map((u) => [u.username, u]));
      return;
    }

    // First boot: seed one account from env vars and persist it.
    const seedUser = buildUser(config.adminUsername, config.adminPassword);
    this.users = new Map([[seedUser.username, seedUser]]);
    this.persist();
  }

  private persist(): void {
    saveUsers(Array.from(this.users.values()));
  }

  private matches(user: StoredUser, password: string): boolean {
    const candidate = hashPassword(password, Buffer.from(user.salt, "hex"));
    const expected = Buffer.from(user.hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  /** Returns a signed session token on success, or null on bad credentials. */
  login(username: string, password: string): string | null {
    const user = this.users.get(username);
    if (!user || !this.matches(user, password)) return null;
    return signSession(username, this.authSecret);
  }

  verify(token: string | undefined | null): SessionPayload | null {
    return verifySession(token, this.authSecret);
  }

  isRegistrationAllowed(): boolean {
    return this.allowRegistration;
  }

  /** Creates a new account and returns a signed session (auto-login). */
  register(username: string, password: string): RegisterResult {
    if (!this.allowRegistration) {
      return { error: "El registro de nuevas cuentas está desactivado" };
    }
    if (this.users.has(username)) {
      return { error: "Ese usuario ya existe" };
    }

    const user = buildUser(username, password);
    this.users.set(username, user);
    this.persist();
    return { token: signSession(username, this.authSecret) };
  }

  /**
   * Changes one user's password after verifying their current one.
   * Returns false (and changes nothing) if currentPassword is wrong.
   */
  changePassword(username: string, currentPassword: string, newPassword: string): boolean {
    const user = this.users.get(username);
    if (!user || !this.matches(user, currentPassword)) return false;

    const updated = buildUser(username, newPassword);
    this.users.set(username, updated);
    this.persist();
    return true;
  }
}

export function createAuthService(config: GatewayConfig): AuthService {
  return new AuthService(config);
}

export type { AuthService };
