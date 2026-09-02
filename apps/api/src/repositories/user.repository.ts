import type { User, UserRole } from '@gymtech/shared';

export type StaffListItem = Omit<User, 'password_hash'>;

export class UserRepository {
  constructor(private db: D1Database) {}

  async findByEmail(email: string): Promise<User | null> {
    return await this.db
      .prepare(`SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(email.toLowerCase().trim())
      .first<User>();
  }

  async findById(id: number): Promise<User | null> {
    return await this.db
      .prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<User>();
  }

  async findPlatformAdminByEmail(email: string): Promise<any | null> {
    return await this.db
      .prepare(`SELECT * FROM platform_admins WHERE email = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(email.toLowerCase().trim())
      .first<any>();
  }

  async listGymStaff(gymId: number): Promise<StaffListItem[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, gym_id, name, email, phone, role, status,
                permissions, last_login_at, created_at, updated_at
         FROM users
         WHERE gym_id = ? AND deleted_at IS NULL
         ORDER BY created_at ASC`
      )
      .bind(gymId)
      .all<StaffListItem>();
    return results || [];
  }

  async listPlatformAdmins(): Promise<any[]> {
    const { results } = await this.db
      .prepare(`SELECT id, email, name, status, created_at FROM platform_admins WHERE deleted_at IS NULL`)
      .all<any>();
    return results || [];
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.db
      .prepare(`UPDATE users SET last_login_at = unixepoch() WHERE id = ?`)
      .bind(id)
      .run();
  }

  /**
   * Increment failed_login_count and return the new count. Resets the
   * counter (instead of incrementing) if the account was previously
   * locked but the lockout has expired — we don't punish the user for
   * a stale lock.
   */
  async incrementFailedLogin(id: number, gymId: number): Promise<number> {
    const res = await this.db
      .prepare(
        `UPDATE users
         SET failed_login_count = CASE
             WHEN locked_until IS NOT NULL AND locked_until > unixepoch()
               THEN failed_login_count + 1
             ELSE 1
           END,
           updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?
         RETURNING failed_login_count`
      )
      .bind(id, gymId)
      .first<{ failed_login_count: number }>();
    return res?.failed_login_count ?? 0;
  }

  async resetFailedLogin(id: number, gymId: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users
         SET failed_login_count = 0,
             locked_until = NULL,
             updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?`
      )
      .bind(id, gymId)
      .run();
  }

  async setLockUntil(id: number, gymId: number, untilUnix: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users
         SET locked_until = ?, updated_at = unixepoch()
         WHERE id = ? AND gym_id = ?`
      )
      .bind(untilUnix, id, gymId)
      .run();
  }

  // --- platform_admins equivalents ---

  async incrementPlatformAdminFailedLogin(id: number): Promise<number> {
    const res = await this.db
      .prepare(
        `UPDATE platform_admins
         SET failed_login_count = CASE
             WHEN locked_until IS NOT NULL AND locked_until > unixepoch()
               THEN failed_login_count + 1
             ELSE 1
           END,
           updated_at = unixepoch()
         WHERE id = ?
         RETURNING failed_login_count`
      )
      .bind(id)
      .first<{ failed_login_count: number }>();
    return res?.failed_login_count ?? 0;
  }

  async resetPlatformAdminFailedLogin(id: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE platform_admins
         SET failed_login_count = 0,
             locked_until = NULL,
             updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(id)
      .run();
  }

  async setPlatformAdminLockUntil(id: number, untilUnix: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE platform_admins
         SET locked_until = ?, updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(untilUnix, id)
      .run();
  }

  /**
   * Upgrade a user's password hash to a new algorithm. Used by the lazy
   * rehash path in AuthService after a successful login against a legacy
   * SHA-256 hash.
   */
  async upgradePasswordHash(id: number, gymId: number, newHash: string, algo: 'argon2id' | 'sha256'): Promise<void> {
    await this.db
      .prepare(`UPDATE users SET password_hash = ?, password_algo = ?, updated_at = unixepoch() WHERE id = ? AND gym_id = ?`)
      .bind(newHash, algo, id, gymId)
      .run();
  }

  async upgradePlatformAdminPasswordHash(id: number, newHash: string, algo: 'argon2id' | 'sha256'): Promise<void> {
    await this.db
      .prepare(`UPDATE platform_admins SET password_hash = ?, password_algo = ?, updated_at = unixepoch() WHERE id = ?`)
      .bind(newHash, algo, id)
      .run();
  }

  async create(data: Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login_at' | 'failed_login_count' | 'locked_until' | 'deleted_at' | 'password_hash' | 'password_algo'> & { password_hash: string; password_algo?: 'sha256' | 'argon2id' }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO users (
          gym_id, name, email, phone, password_hash, password_algo, role, status, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`
      )
      .bind(
        data.gym_id,
        data.name,
        data.email.toLowerCase().trim(),
        data.phone ?? null,
        data.password_hash,
        data.password_algo ?? 'argon2id',
        data.role,
        data.permissions ?? '{}',
        now,
        now
      )
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async createPlatformAdmin(data: { email: string; password_hash: string; name: string; password_algo?: 'sha256' | 'argon2id' }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const res = await this.db
      .prepare(
        `INSERT INTO platform_admins (email, password_hash, password_algo, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`
      )
      .bind(data.email.toLowerCase().trim(), data.password_hash, data.password_algo ?? 'argon2id', data.name, now, now)
      .run();
    return Number(res.meta?.last_row_id ?? res.meta?.lastInsertRowid ?? 0);
  }

  async softDelete(id: number, gymId: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE users
         SET deleted_at = unixepoch(), status = 'DISABLED', updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`
      )
      .bind(id, gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async restore(id: number, gymId: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE users
         SET deleted_at = NULL, status = 'ACTIVE', updated_at = unixepoch()
         WHERE id = ? AND gym_id = ? AND deleted_at IS NOT NULL`
      )
      .bind(id, gymId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async update(id: number, gymId: number, patch: Partial<User>): Promise<boolean> {
    const fields: string[] = [];
    const bindings: any[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      bindings.push(patch.name);
    }
    if (patch.phone !== undefined) {
      fields.push('phone = ?');
      bindings.push(patch.phone);
    }
    if (patch.role !== undefined) {
      fields.push('role = ?');
      bindings.push(patch.role);
    }
    if (patch.status !== undefined) {
      fields.push('status = ?');
      bindings.push(patch.status);
    }
    if (patch.password_hash !== undefined) {
      fields.push('password_hash = ?');
      fields.push('password_algo = ?');
      bindings.push(patch.password_hash);
      bindings.push(patch.password_algo ?? 'argon2id');
    }
    if (fields.length === 0) return false;
    fields.push('updated_at = unixepoch()');
    bindings.push(id, gymId);

    const res = await this.db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
      .bind(...bindings)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
}
