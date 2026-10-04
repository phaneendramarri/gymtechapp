// filepath: apps/api/src/repositories/password-reset.repository.ts
/**
 * Password-reset repository — single owner of the `userPasswordResets`
 * table. The statements used to live inline in routes/auth.routes.ts.
 */
import type { D1Database } from '../db/client';

export interface PasswordResetRecord {
  id: number;
  gymId: number;
  userId: number;
  tokenHash: string;
  expiresAt: number;
  usedAt: number | null;
  createdAt: number;
}

export class PasswordResetRepository {
  constructor(private d1: D1Database) {}

  async create(input: { gymId: number; userId: number; tokenHash: string; expiresAt: number }): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO userPasswordResets (gymId, userId, tokenHash, expiresAt, createdAt)
         VALUES (?, ?, ?, ?, unixepoch())`
      )
      .bind(input.gymId, input.userId, input.tokenHash, input.expiresAt)
      .run();
  }

  /** Invalidate all live reset tokens for a user (single-live-token rule). */
  async invalidatePriorTokens(gymId: number, userId: number): Promise<void> {
    await this.d1
      .prepare(`UPDATE userPasswordResets SET usedAt = unixepoch() WHERE gymId = ? AND userId = ? AND usedAt IS NULL`)
      .bind(gymId, userId)
      .run();
  }

  /** Find the live reset record for an opaque token hash (unused, unexpired). */
  async findValidByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null> {
    const row = await this.d1
      .prepare(
        `SELECT id, gymId, userId, tokenHash, expiresAt, usedAt, createdAt
         FROM userPasswordResets
         WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > unixepoch()
         LIMIT 1`
      )
      .bind(tokenHash)
      .first<PasswordResetRecord>();
    return row ?? null;
  }

  /** Atomically set the new password and mark the reset token used. */
  async consumeAndSetPassword(input: { gymId: number; userId: number; resetId: number; passwordHash: string }): Promise<void> {
    await this.d1.batch([
      this.d1
        .prepare(`UPDATE users SET passwordHash = ?, updatedAt = unixepoch() WHERE id = ? AND gymId = ?`)
        .bind(input.passwordHash, input.userId, input.gymId),
      // Guard with usedAt IS NULL so a concurrent double-submit of the same
      // token cannot consume it twice (TOCTOU replay).
      this.d1
        .prepare(`UPDATE userPasswordResets SET usedAt = unixepoch() WHERE id = ? AND gymId = ? AND usedAt IS NULL`)
        .bind(input.resetId, input.gymId),
    ]);
  }
}
