import type { D1Database } from '@cloudflare/workers-types';

export class SessionRepository {
  constructor(private db: D1Database) {}

  async create(params: {
    gymId: number;
    userId: number;
    tokenHash: string;
    refreshTokenHash?: string;
    refreshTokenExpiresAt?: number;
    issuedAt: number;
    expiresAt: number;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO user_sessions (gym_id, user_id, token_hash, refresh_token_hash, refresh_token_expires_at, issued_at, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.gymId,
        params.userId,
        params.tokenHash,
        params.refreshTokenHash ?? null,
        params.refreshTokenExpiresAt ?? null,
        params.issuedAt,
        params.expiresAt,
        params.ip ?? null,
        params.userAgent ?? null
      )
      .run();
  }

  async findActiveByTokenHash(tokenHash: string) {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .prepare(
        `SELECT * FROM user_sessions
         WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`
      )
      .bind(tokenHash, now)
      .first<Record<string, unknown>>();
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string) {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .prepare(
        `SELECT * FROM user_sessions
         WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_token_expires_at > ?`
      )
      .bind(refreshTokenHash, now)
      .first<Record<string, unknown>>();
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(`UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ?`)
      .bind(now, tokenHash)
      .run();
  }

  async rotateRefreshToken(params: {
    oldRefreshTokenHash: string;
    newRefreshTokenHash: string;
    newRefreshTokenExpiresAt: number;
    newAccessTokenHash: string;
    newAccessTokenExpiresAt: number;
  }): Promise<number | null> {
    const now = Math.floor(Date.now() / 1000);

    await this.db
      .prepare(`UPDATE user_sessions SET revoked_at = ? WHERE refresh_token_hash = ?`)
      .bind(now, params.oldRefreshTokenHash)
      .run();

    const old = await this.db
      .prepare(`SELECT gym_id, user_id, ip, user_agent FROM user_sessions WHERE refresh_token_hash = ? LIMIT 1`)
      .bind(params.oldRefreshTokenHash)
      .first<{ gym_id: number; user_id: number; ip: string | null; user_agent: string | null }>();

    if (!old) return null;

    const result = await this.db
      .prepare(
        `INSERT INTO user_sessions (gym_id, user_id, token_hash, refresh_token_hash, refresh_token_expires_at, issued_at, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        old.gym_id,
        old.user_id,
        params.newAccessTokenHash,
        params.newRefreshTokenHash,
        params.newRefreshTokenExpiresAt,
        now,
        params.newAccessTokenExpiresAt,
        old.ip,
        old.user_agent
      )
      .run();

    return result.meta?.last_row_id ?? null;
  }

  async revokeAllForUser(gymId: number, userId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(
        `UPDATE user_sessions SET revoked_at = ?
         WHERE gym_id = ? AND user_id = ? AND revoked_at IS NULL`
      )
      .bind(now, gymId, userId)
      .run();
  }
}