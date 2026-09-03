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

  constructor(private db: D1Database, private jwtSecret: string, appUrl?: string) {
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

  async login(email: string, passwordPlain: string): Promise<{ token: string; refreshToken: string; user: SessionUser; gym?: Gym | null }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) { throw new Error(GENERIC_INVALID_CREDENTIALS); }
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
        await this.userRepo.upgradePasswordHash(user.id, user.gymId, newHash, 'argon2id');
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
    const { token, jti: accessJti } = await this._createAccessToken(sessionUser);
    const { token: refreshToken, jti: refreshJti } = await createRefreshToken(this.jwtSecret);
    const now = Math.floor(Date.now() / 1000);

    await this.sessionRepo.create({
      gymId: user.gymId, userId: user.id, tokenHash: accessJti, refreshTokenHash: refreshJti,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS,
      issuedAt: now, expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });

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
        await this.userRepo.upgradePlatformAdminPasswordHash(admin.id, newHash, 'argon2id');
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
    const { token, jti: accessJti } = await this._createAccessToken(sessionUser);
    const { token: refreshToken, jti: refreshJti } = await createRefreshToken(this.jwtSecret);
    const now = Math.floor(Date.now() / 1000);

    await this.sessionRepo.create({
      gymId: 0, userId: admin.id, tokenHash: accessJti, refreshTokenHash: refreshJti,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS,
      issuedAt: now, expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });

    return { token, refreshToken, user: sessionUser };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: SessionUser } | null> {
    const refreshJti = await hashOpaqueToken(refreshToken, this.jwtSecret);
    const session = await this.sessionRepo.findActiveByRefreshTokenHash(refreshJti);
    if (!session) return null;

    const userRow = await this.userRepo.findById(session.userId as number);
    if (!userRow) return null;

    const permissions = await this.userRepo.getPermissionsForUser(userRow.id);
    const sessionUser: SessionUser = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role as UserRole,
      gymId: userRow.gymId,
      isOwner: Boolean(userRow.isOwner),
      permissions,
      roleId: userRow.roleId ?? null,
    };

    const { token, jti: newAccessJti } = await this._createAccessToken(sessionUser);
    const { token: newRefreshToken, jti: newRefreshJti } = await createRefreshToken(this.jwtSecret);
    const now = Math.floor(Date.now() / 1000);

    await this.sessionRepo.create({
      gymId: userRow.gymId ?? 0, userId: userRow.id, tokenHash: newAccessJti, refreshTokenHash: newRefreshJti,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS,
      issuedAt: now, expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    });

    return { token, refreshToken: newRefreshToken, user: sessionUser };
  }

  async logout(jti: string): Promise<void> {
    await this.sessionRepo.revokeByTokenHash(jti);
  }

  async getCurrentUser(user: SessionUser): Promise<{ user: SessionUser; gym?: Gym | null }> {
    let gym: Gym | null = null;
    if (user.gymId) {
      gym = await this.db.prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`).bind(user.gymId).first<Gym>();
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
      isOwner: false,
      permissions: [], // Members have no dashboard permissions
      roleId: null,
    };
    const { token } = await this._createAccessToken(sessionUser);
    return token;
  }

  async verifyToken(token: string) {
    const payload = await verifySessionToken(token, this.jwtSecret, { iss: this.ISS, aud: this.AUD });
    if (!payload) return null;
    return { userId: payload.id, email: payload.email, role: payload.role, gymId: payload.gymId, jti: payload.jti };
  }
}