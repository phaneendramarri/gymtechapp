import { UserRepository } from '../repositories/user.repository';
import {
  hashPassword,
  verifyPassword,
  isLegacyHash,
  createSessionToken,
  verifySessionToken,
} from '../lib/session';
import {
  GENERIC_INVALID_CREDENTIALS,
  isAccountLocked,
  nextLockoutSeconds,
} from '../lib/lockout';
import type { SessionUser, Gym, UserRole } from '@gymtech/shared';

export class AuthService {
  private userRepo: UserRepository;

  constructor(private db: D1Database, private jwtSecret: string) {
    this.userRepo = new UserRepository(db);
  }

  async login(email: string, passwordPlain: string): Promise<{ token: string; user: SessionUser; gym?: Gym | null }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't leak whether the account exists.
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('This account has been deactivated or suspended');
    }

    // Lockout gate — runs BEFORE password verification to prevent
    // password-guessing against a known-locked account.
    if (isAccountLocked(user.failed_login_count, user.locked_until)) {
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }

    const ok = await verifyPassword(passwordPlain, user.password_hash);
    if (!ok) {
      // Increment the failure counter and apply progressive lockout.
      const newCount = await this.userRepo.incrementFailedLogin(user.id, user.gym_id);
      const lockSeconds = nextLockoutSeconds(newCount);
      if (lockSeconds !== null) {
        const until = Math.floor(Date.now() / 1000) + lockSeconds;
        await this.userRepo.setLockUntil(user.id, user.gym_id, until);
      }
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }

    // Successful login — reset the failure counter and clear any prior lock.
    if (user.failed_login_count > 0 || user.locked_until !== null) {
      await this.userRepo.resetFailedLogin(user.id, user.gym_id);
    }

    // Lazy rehash: if the stored hash is in the legacy SHA-256 format,
    // upgrade it to Argon2id in the background (after we've returned).
    if (isLegacyHash(user.password_hash)) {
      try {
        const newHash = await hashPassword(passwordPlain);
        await this.userRepo.upgradePasswordHash(user.id, user.gym_id, newHash, 'argon2id');
      } catch (err) {
        // Non-fatal — login still succeeds. Surface to logs for ops.
        console.error('Lazy rehash failed for user', user.id, err);
      }
    }

    let gym: Gym | null = null;
    if (user.gym_id) {
      gym = await this.db
        .prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`)
        .bind(user.gym_id)
        .first<Gym>();
      if (gym && gym.status === 'SUSPENDED') {
        throw new Error('This gym account has been suspended by the platform administrator');
      }
    }

    await this.userRepo.updateLastLogin(user.id);

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      gymId: user.gym_id,
    };

    const token = await createSessionToken(sessionUser, this.jwtSecret);

    return { token, user: sessionUser, gym };
  }

  /**
   * Platform admin login. The session is bound to a `gymId === null` so the
   * `requireGym` middleware will refuse tenant-scoped access.
   */
  async loginPlatformAdmin(email: string, passwordPlain: string): Promise<{ token: string; user: SessionUser }> {
    const admin = await this.userRepo.findPlatformAdminByEmail(email);
    if (!admin) {
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    if (admin.status !== 'ACTIVE') {
      throw new Error('This admin account is disabled');
    }
    if (isAccountLocked(admin.failed_login_count, admin.locked_until)) {
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    const ok = await verifyPassword(passwordPlain, admin.password_hash);
    if (!ok) {
      const newCount = await this.userRepo.incrementPlatformAdminFailedLogin(admin.id);
      const lockSeconds = nextLockoutSeconds(newCount);
      if (lockSeconds !== null) {
        const until = Math.floor(Date.now() / 1000) + lockSeconds;
        await this.userRepo.setPlatformAdminLockUntil(admin.id, until);
      }
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    if (admin.failed_login_count > 0 || admin.locked_until !== null) {
      await this.userRepo.resetPlatformAdminFailedLogin(admin.id);
    }

    // Lazy rehash for legacy platform admin hashes.
    if (isLegacyHash(admin.password_hash)) {
      try {
        const newHash = await hashPassword(passwordPlain);
        await this.userRepo.upgradePlatformAdminPasswordHash(admin.id, newHash, 'argon2id');
      } catch (err) {
        console.error('Lazy rehash failed for platform admin', admin.id, err);
      }
    }

    await this.db
      .prepare(`UPDATE platform_admins SET last_login_at = unixepoch() WHERE id = ?`)
      .bind(admin.id)
      .run();

    const sessionUser: SessionUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'PLATFORM_ADMIN' as UserRole,
      gymId: null,
    };
    const token = await createSessionToken(sessionUser, this.jwtSecret);
    return { token, user: sessionUser };
  }

  async getCurrentUser(user: SessionUser): Promise<{ user: SessionUser; gym?: Gym | null }> {
    let gym: Gym | null = null;
    if (user.gymId) {
      gym = await this.db
        .prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`)
        .bind(user.gymId)
        .first<Gym>();
    }
    return { user, gym };
  }

  async signMemberToken(member: { id: number; gymId: number; memberCode: string; phone: string; name: string }): Promise<string> {
    const sessionUser: SessionUser = {
      id: member.id,
      email: `${member.memberCode.toLowerCase()}@member.gymtech.app`,
      name: member.name,
      role: 'MEMBER',
      gymId: member.gymId,
    };
    return await createSessionToken(sessionUser, this.jwtSecret);
  }

  async verifyToken(token: string) {
    const payload = await verifySessionToken(token, this.jwtSecret);
    if (!payload) return null;
    return {
      userId: payload.id,
      email: payload.email,
      role: payload.role,
      gymId: payload.gymId,
    };
  }
}
