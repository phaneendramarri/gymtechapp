import type { D1Database } from '@cloudflare/workers-types';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import {
  hashPassword,
  verifyPassword,
  isLegacyHash,
  createSessionToken,
  verifySessionToken,
  createRefreshToken,
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '../lib/session';
import { hashOpaqueToken, verifyOpaqueToken } from '../lib/password';
import {
  GENERIC_INVALID_CREDENTIALS,
  isAccountLocked,
  nextLockoutSeconds,
} from '../lib/lockout';
import type { SessionUser, Gym, UserRole } from '@gymtech/shared';

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private readonly ISS: string;
  private readonly AUD = 'gymtech-api';

  constructor(
    private db: D1Database,
    private jwtSecret: string,
    appUrl?: string,
    private denyListKV?: KVNamespace
  ) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.ISS = appUrl ?? 'gymtech';
  }

  private async _createAccessToken(sessionUser: SessionUser): Promise<{ token: string; jti: string }> {
    return createSessionToken(sessionUser, this.jwtSecret, {
      iss: this.ISS,
      aud: this.AUD,
      expiresInSeconds: ACCESS_TOKEN_EXPIRY_SECONDS,
    });
  }

  /**
   * M-18: Shared session minting — creates access + refresh tokens and persists
   * the session record. Used by both regular login and platform-admin login.
   */
  private async _mintSession(
    sessionUser: SessionUser,
    gymId: number | null
  ): Promise<{ token: string; refreshToken: string }> {
    const { token, jti: accessJti } = await this._createAccessToken(sessionUser);
    const { token: refreshToken, jti: refreshJti } = await createRefreshToken(this.jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    await this.sessionRepo.create({
      gymId: gymId ?? 0,
      userId: sessionUser.id,
      tokenHash: accessJti,
      refreshTokenHash: refreshJti,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS,
      issuedAt: now,
      expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });
    return { token, refreshToken };
  }

  async login(email: string, passwordPlain: string): Promise<{ token: string; refreshToken: string; user: SessionUser; gym?: Gym | null }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      const admin = await this.userRepo.findPlatformAdminByEmail(email);
      if (admin) {
        return this.loginPlatformAdmin(email, passwordPlain);
      }
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    if (user.status !== 'ACTIVE') { throw new Error('This account has been deactivated or suspended'); }
    if (isAccountLocked(user.failedLoginCount, user.lockedUntil)) { throw new Error(GENERIC_INVALID_CREDENTIALS); }

    const ok = await verifyPassword(passwordPlain, user.passwordHash);
    if (!ok) {
      const newCount = await this.userRepo.incrementFailedLogin(user.id, user.gymId);
      const lockSeconds = nextLockoutSeconds(newCount);
      if (lockSeconds !== null) {
        const until = Math.floor(Date.now() / 1000) + lockSeconds;
        await this.userRepo.setLockUntil(user.id, user.gymId, until);
      }
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    if (user.failedLoginCount > 0 || user.lockedUntil !== null) { await this.userRepo.resetFailedLogin(user.id, user.gymId); }

    if (isLegacyHash(user.passwordHash)) {
      try {
        const newHash = await hashPassword(passwordPlain);
        if (newHash.startsWith('pbkdf2$')) {
          await this.userRepo.upgradePasswordHash(user.id, user.gymId, newHash);
        }
      } catch (err) { console.error('Lazy rehash failed for user', user.id, err); }
    }

    let gym: Gym | null = null;
    if (user.gymId) {
      gym = await this.db.prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`).bind(user.gymId).first<Gym>();
      if (gym && gym.status === 'SUSPENDED') { throw new Error('This gym account has been suspended by the platform administrator'); }
    }

    await this.userRepo.updateLastLogin(user.id);

    // Load menu permissions for this user
    const permissions = await this.userRepo.getPermissionsForUser(user.id);
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      gymId: user.gymId,
      isOwner: Boolean(user.isOwner),
      permissions,
      roleId: user.roleId ?? null,
    };
    // M-18: Use shared session minting helper.
    const { token, refreshToken } = await this._mintSession(sessionUser, user.gymId);

    return { token, refreshToken, user: sessionUser, gym };
  }

  async loginPlatformAdmin(email: string, passwordPlain: string): Promise<{ token: string; refreshToken: string; user: SessionUser }> {
    const admin = await this.userRepo.findPlatformAdminByEmail(email);
    if (!admin) { throw new Error(GENERIC_INVALID_CREDENTIALS); }
    if (admin.status !== 'ACTIVE') { throw new Error('This admin account has been deactivated or suspended'); }
    if (isAccountLocked(admin.failedLoginCount, admin.lockedUntil)) { throw new Error(GENERIC_INVALID_CREDENTIALS); }

    const ok = await verifyPassword(passwordPlain, admin.passwordHash);
    if (!ok) {
      const newCount = await this.userRepo.incrementPlatformAdminFailedLogin(admin.id);
      const lockSeconds = nextLockoutSeconds(newCount);
      if (lockSeconds !== null) {
        const until = Math.floor(Date.now() / 1000) + lockSeconds;
        await this.userRepo.setPlatformAdminLockUntil(admin.id, until);
      }
      throw new Error(GENERIC_INVALID_CREDENTIALS);
    }
    if (admin.failedLoginCount > 0 || admin.lockedUntil !== null) { await this.userRepo.resetPlatformAdminFailedLogin(admin.id); }

    if (isLegacyHash(admin.passwordHash)) {
      try {
        const newHash = await hashPassword(passwordPlain);
        if (newHash.startsWith('pbkdf2$')) {
          await this.userRepo.upgradePlatformAdminPasswordHash(admin.id, newHash);
        }
      } catch (err) { console.error('Lazy rehash failed for platform admin', admin.id, err); }
    }

    await this.db.prepare(`UPDATE platform_admins SET last_login_at = unixepoch() WHERE id = ?`).bind(admin.id).run();

    const sessionUser: SessionUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'PLATFORM_ADMIN' as UserRole,
      gymId: null,
      isOwner: false,
      permissions: ['*'], // PLATFORM_ADMIN bypasses all permission checks in middleware
      roleId: null,
    };
    // M-18: Use shared session minting helper.
    const { token, refreshToken } = await this._mintSession(sessionUser, null);

    return { token, refreshToken, user: sessionUser };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: SessionUser } | null> {
    const refreshJti = await hashOpaqueToken(refreshToken, this.jwtSecret);
    const session = await this.sessionRepo.findActiveByRefreshTokenHash(refreshJti);
    if (!session) return null;

    const userRow = await this.userRepo.findById(session.userId as number);
    let sessionUser: SessionUser;
    let gymId: number | null = null;

    if (userRow) {
      if (userRow.status !== 'ACTIVE') return null;
      const permissions = await this.userRepo.getPermissionsForUser(userRow.id);
      sessionUser = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role as UserRole,
        gymId: userRow.gymId,
        isOwner: Boolean(userRow.isOwner),
        permissions,
        roleId: userRow.roleId ?? null,
      };
      gymId = userRow.gymId;
    } else {
      const adminRow = await this.db
        .prepare(`SELECT * FROM platform_admins WHERE id = ? AND deleted_at IS NULL AND status = 'ACTIVE'`)
        .bind(session.userId)
        .first<any>();
      if (!adminRow) return null;

      sessionUser = {
        id: adminRow.id,
        email: adminRow.email,
        name: adminRow.name,
        role: 'PLATFORM_ADMIN' as UserRole,
        gymId: null,
        isOwner: false,
        permissions: ['*'],
        roleId: null,
      };
    }

    const { token, jti: newAccessJti } = await this._createAccessToken(sessionUser);
    const { token: newRefreshToken, jti: newRefreshJti } = await createRefreshToken(this.jwtSecret);
    const now = Math.floor(Date.now() / 1000);

    // M-12: Revoke the old session immediately after rotating credentials.
    // This invalidates the old refresh token so it cannot be replayed.
    await this.sessionRepo.revokeByTokenHash(session.tokenHash);

    await this.sessionRepo.create({
      gymId: gymId ?? 0,
      userId: sessionUser.id,
      tokenHash: newAccessJti,
      refreshTokenHash: newRefreshJti,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS,
      issuedAt: now,
      expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });

    return { token, refreshToken: newRefreshToken, user: sessionUser };
  }

  async logout(jti: string): Promise<void> {
    await this.sessionRepo.revokeByTokenHash(jti);

    // Phase 3.5d: Add jti to KV denylist so requireAuth/requireGym can reject
    // the token immediately on subsequent requests without a DB round-trip.
    // The TTL ensures the entry auto-expires when the token would have expired anyway.
    if (this.denyListKV) {
      await this.denyListKV.put(`denylist:${jti}`, '1', {
        expirationTtl: ACCESS_TOKEN_EXPIRY_SECONDS,
      });
    }
  }

  async getCurrentUser(user: SessionUser): Promise<{ user: SessionUser; gym?: Gym | null }> {
    let gym: Gym | null = null;
    if (user.gymId) {
      gym = await this.db.prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`).bind(user.gymId).first<Gym>();
    }
    return { user, gym };
  }

  async signMemberToken(member: { id: number; gymId: number; memberCode: string; phone: string; name: string }): Promise<{ token: string; jti: string }> {
    const sessionUser: SessionUser = {
      id: member.id,
      email: `${member.memberCode.toLowerCase()}@member.gymtech.app`,
      name: member.name,
      role: 'MEMBER',
      gymId: member.gymId,
      isOwner: false,
      permissions: [], // Members have no dashboard permissions
      roleId: null,
    };
    const { token, jti } = await this._createAccessToken(sessionUser);

    // CR-5 fix: Insert session record so the token can be revoked via logout/revokeByTokenHash.
    const now = Math.floor(Date.now() / 1000);
    await this.sessionRepo.create({
      gymId: member.gymId,
      userId: member.id,
      tokenHash: jti,
      refreshTokenHash: undefined,
      refreshTokenExpiresAt: undefined,
      issuedAt: now,
      expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });

    return { token, jti };
  }

  async verifyToken(token: string) {
    const payload = await verifySessionToken(token, this.jwtSecret, { iss: this.ISS, aud: this.AUD });
    if (!payload) return null;
    return { userId: payload.id, email: payload.email, role: payload.role, gymId: payload.gymId, jti: payload.jti };
  }
}