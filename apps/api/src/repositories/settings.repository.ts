/**
 * Settings repository — single owner of `platform_settings` and the
 * `gyms.notification_settings_json` column. The statements used to live
 * inline in routes/admin.routes.ts and routes/settings.routes.ts.
 */
import type { D1Database } from '../db/client';

/** Default gateway config used when nothing is persisted yet. */
export const DEFAULT_COMMUNICATIONS_CONFIG = {
  smtp: {
    enabled: false,
    provider: 'CUSTOM',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
  },
  smsGateway: { enabled: false, provider: 'FAST2SMS', apiKey: '', senderId: 'GYMTC' },
  whatsappGateway: {
    enabled: false,
    provider: 'META_CLOUD_API',
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
  },
};

export interface GymProfile {
  id: number;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  currency: string;
  logoUrl: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export class SettingsRepository {
  constructor(private d1: D1Database) {}

  // ---- platform_settings (key/value JSON, platform scope) -----------------

  async getPlatformSetting<T>(key: string): Promise<T | null> {
    const row = await this.d1
      .prepare(`SELECT value_json FROM platform_settings WHERE key = ?`)
      .bind(key)
      .first<{ value_json: string }>();
    return row?.value_json ? (JSON.parse(row.value_json) as T) : null;
  }

  async putPlatformSetting(key: string, value: unknown): Promise<void> {
    await this.d1
      .prepare(
        `INSERT INTO platform_settings (key, value_json, updated_at) VALUES (?, ?, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = unixepoch()`
      )
      .bind(key, JSON.stringify(value))
      .run();
  }

  // ---- gym profile --------------------------------------------------------

  private static readonly GYM_PROFILE_COLS = `
    id, name, slug, phone, email, address, city, state, pincode,
    gst_number AS gstNumber, currency, logo_url AS logoUrl, status,
    created_at AS createdAt, updated_at AS updatedAt`;

  async getGymProfile(gymId: number): Promise<GymProfile | null> {
    const row = await this.d1
      .prepare(`SELECT ${SettingsRepository.GYM_PROFILE_COLS} FROM gyms WHERE id = ?`)
      .bind(gymId)
      .first<GymProfile>();
    return row ?? null;
  }

  async updateGymProfile(
    gymId: number,
    patch: {
      name: string;
      phone: string;
      email: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      pincode: string | null;
      gstNumber: string | null;
      currency: string;
      logoUrl: string | null;
    }
  ): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE gyms
         SET name = ?, phone = ?, email = ?, address = ?, city = ?, state = ?,
             pincode = ?, gst_number = ?, currency = ?, logo_url = ?, updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(
        patch.name,
        patch.phone,
        patch.email,
        patch.address,
        patch.city,
        patch.state,
        patch.pincode,
        patch.gstNumber,
        patch.currency,
        patch.logoUrl,
        gymId
      )
      .run();
  }

  // ---- gym notification settings (JSON column on gyms) --------------------

  async getNotificationSettings<T>(gymId: number): Promise<T | null> {
    const row = await this.d1
      .prepare(`SELECT notification_settings_json FROM gyms WHERE id = ?`)
      .bind(gymId)
      .first<{ notification_settings_json: string | null }>();
    return row?.notification_settings_json ? (JSON.parse(row.notification_settings_json) as T) : null;
  }

  async setNotificationSettings(gymId: number, settings: unknown): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE gyms SET notification_settings_json = ?, updated_at = unixepoch() WHERE id = ?`
      )
      .bind(JSON.stringify(settings), gymId)
      .run();
  }
}
