/**
 * Password-reset repository — single owner of the `user_password_resets`
 * table. The statements used to live inline in routes/auth.routes.ts.
 */
import type { D1Database } from '../db/client';

export interface PasswordResetRecord {
  id: number;
  gym_id: number;
  user_id: number;
  token_hash: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

export class PasswordResetRepository {
  constructor(private d1: D1Database) {}

  async create(input: { gymId: number; userId: number; tokenHash: string; expiresAt: number }): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO user_password_resets (gym_id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, unixepoch())`
      )
      .bind(input.gymId, input.userId, input.tokenHash, input.expiresAt)
      .run();
  }

  /** Find the live reset record for an opaque token hash (unused, unexpired). */
  async findValidByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null> {
    const row = await this.d1
      .prepare(
        `SELECT * FROM user_password_resets
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > unixepoch()
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
        .prepare(`UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ? AND gym_id = ?`)
        .bind(input.passwordHash, input.userId, input.gymId),
      this.d1
        .prepare(`UPDATE user_password_resets SET used_at = unixepoch() WHERE id = ? AND gym_id = ?`)
        .bind(input.resetId, input.gymId),
    ]);
  }
}
