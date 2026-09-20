/**
 * Counter repository — single owner of the `counters` table.
 *
 * The atomic upsert used to be duplicated in MemberRepository (member codes)
 * and PaymentRepository (year-scoped receipts). Both now call `nextValue`
 * here; the format (prefix/padding) is the caller's concern.
 */
import type { D1Database } from '../db/client';

export class CounterRepository {
  constructor(private d1: D1Database) {}

  /**
   * Atomically allocate the next value for a gym-scoped counter.
   * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` — no read/write race.
   */
  async nextValue(gymId: number, counterType: string): Promise<number> {
    const result = await this.d1
      .prepare(
        `INSERT INTO counters (gymId, counterType, value)
         VALUES (?, ?, 1)
         ON CONFLICT (gymId, counterType) DO UPDATE SET value = value + 1
         RETURNING value AS nextVal`
      )
      .bind(gymId, counterType)
      .all<{ nextVal?: number }>();
    return result.results?.[0]?.nextVal ?? 1;
  }
}
