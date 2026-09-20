/**
 * Gym repository — tenant-row lookups that are not scoped to a gym yet
 * (slug resolution happens before the request has a gymId).
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface GymSlugRow {
  id: number;
  name: string;
  slug: string;
}

export class GymRepository {
  constructor(private db: D1Database) {}

  async findBySlug(slug: string): Promise<GymSlugRow | null> {
    const row = await this.db
      .prepare(`SELECT id, name, slug FROM gyms WHERE slug = ? AND deletedAt IS NULL LIMIT 1`)
      .bind(slug)
      .first<GymSlugRow>();
    return row ?? null;
  }
}
