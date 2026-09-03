import { eq, and, isNull, gt } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import { userSessions } from '../db/schema';

export class SessionRepository {
  private db: Database;

  constructor(db: Database | D1Database) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

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
    await this.db.insert(userSessions).values({
      gymId: params.gymId,
      userId: params.userId,
      tokenHash: params.tokenHash,
      refreshTokenHash: params.refreshTokenHash ?? null,
      refreshTokenExpiresAt: params.refreshTokenExpiresAt ?? null,
      issuedAt: params.issuedAt,
      expiresAt: params.expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
  }

  async findActiveByTokenHash(tokenHash: string) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.refreshTokenHash, refreshTokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.refreshTokenExpiresAt ?? 0, now)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(userSessions)
      .set({ revokedAt: now })
      .where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt)));
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
      .update(userSessions)
      .set({ revokedAt: now })
      .where(eq(userSessions.refreshTokenHash, params.oldRefreshTokenHash));

    const old = await this.db
      .select({
        gymId: userSessions.gymId,
        userId: userSessions.userId,
        ip: userSessions.ip,
        userAgent: userSessions.userAgent,
      })
      .from(userSessions)
      .where(eq(userSessions.refreshTokenHash, params.oldRefreshTokenHash))
      .limit(1)
      .then((rows) => rows[0]);

    if (!old) return null;

    const row = await this.db
      .insert(userSessions)
      .values({
        gymId: old.gymId,
        userId: old.userId,
        tokenHash: params.newAccessTokenHash,
        refreshTokenHash: params.newRefreshTokenHash,
        refreshTokenExpiresAt: params.newRefreshTokenExpiresAt,
        issuedAt: now,
        expiresAt: params.newAccessTokenExpiresAt,
        ip: old.ip,
        userAgent: old.userAgent,
      })
      .returning({ id: userSessions.id });

    return row[0]?.id ?? null;
  }

  async revokeAllForUser(gymId: number, userId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(userSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(userSessions.gymId, gymId),
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt)
        )
      );
  }
}
