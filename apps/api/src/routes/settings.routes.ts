// filepath: apps/api/src/routes/settings.routes.ts
import { Hono } from 'hono';
import {
  NotificationSettingsRequestSchema,
  SendNotificationRequestSchema,
  ChannelBalance,
  NotificationSettingsResponse,
} from '@gymtech/shared';
import { requireGym, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { extractClientInfo, auditGymFromCtx } from '../services/audit.service';
import { LicenseRepository } from '../repositories/license.repository';
import { LicenseService } from '../services/license.service';
import { NotificationService } from '../lib/notifications';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const settingsRoutes = new Hono();

// Gym Profile Settings
settingsRoutes.get('/gym', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const gymRow = await ctx.env.DB.prepare(`
    SELECT id, name, slug, phone, email, address, city, state, pincode, gst_number as gstNumber,
           currency, logo_url as logoUrl, status, created_at as createdAt, updated_at as updatedAt
    FROM gyms WHERE id = ? /* gym_id */
  `).bind(ctx.gymId!).first();
  return jsonOk(gymRow || tenant.gym);
}));

settingsRoutes.patch('/gym', requireGym, requirePermission('settings'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const { name, phone, email, address, city, state, pincode, gstNumber, currency, logoUrl } = body;

  const current: any = await ctx.env.DB.prepare('SELECT * FROM gyms WHERE id = ? /* gym_id */').bind(ctx.gymId!).first();
  if (!current) return jsonErr('Gym not found', 404);

  const updatedName = name !== undefined ? String(name).trim() : current.name;
  const updatedPhone = phone !== undefined ? String(phone).trim() : current.phone;
  const updatedEmail = email !== undefined ? (email ? String(email).trim() : null) : current.email;
  const updatedAddress = address !== undefined ? (address ? String(address).trim() : null) : current.address;
  const updatedCity = city !== undefined ? (city ? String(city).trim() : null) : current.city;
  const updatedState = state !== undefined ? (state ? String(state).trim() : null) : current.state;
  const updatedPincode = pincode !== undefined ? (pincode ? String(pincode).trim() : null) : current.pincode;
  const updatedGst = gstNumber !== undefined ? (gstNumber ? String(gstNumber).trim() : null) : current.gst_number;
  const updatedCurrency = currency !== undefined ? String(currency).trim() : current.currency;
  const updatedLogo = logoUrl !== undefined ? (logoUrl ? String(logoUrl).trim() : null) : current.logo_url;

  await ctx.env.DB.prepare(`
    UPDATE gyms
    SET name = ?, phone = ?, email = ?, address = ?, city = ?, state = ?,
        pincode = ?, gst_number = ?, currency = ?, logo_url = ?, updated_at = unixepoch()
    WHERE id = ? /* gym_id */
  `).bind(
    updatedName, updatedPhone, updatedEmail, updatedAddress, updatedCity, updatedState,
    updatedPincode, updatedGst, updatedCurrency, updatedLogo, ctx.gymId!
  ).run();

  const updated: any = await ctx.env.DB.prepare(`
    SELECT id, name, slug, phone, email, address, city, state, pincode, gst_number as gstNumber,
           currency, logo_url as logoUrl, status, created_at as createdAt, updated_at as updatedAt
    FROM gyms WHERE id = ? /* gym_id */
  `).bind(ctx.gymId!).first();

  await auditGymFromCtx(c, 'gym.update', 'gym', ctx.gymId!, { before: current, after: updated });
  return jsonOk(updated);
}));

const DEFAULT_NOTIFICATION_SETTINGS = {
  reminderDays: 7, welcomeEnabled: true, receiptEnabled: true, expiryEnabled: true,
};

settingsRoutes.get('/notifications', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const saved = tenant.gym.notification_settings_json ? JSON.parse(tenant.gym.notification_settings_json) : {};

  const licenseRepo = new LicenseRepository(ctx.env.DB, ctx.gymId!);
  const license = await licenseRepo.findByGymId(ctx.gymId!);
  const maxSms = license?.maxSms ?? 0, smsUsed = license?.smsUsed ?? 0;
  const maxWhatsapp = license?.maxWhatsapp ?? 0, whatsappUsed = license?.whatsappUsed ?? 0;
  const smsBalance: ChannelBalance = { total: maxSms, used: smsUsed, remaining: Math.max(0, maxSms - smsUsed) };
  const whatsappBalance: ChannelBalance = { total: maxWhatsapp, used: whatsappUsed, remaining: Math.max(0, maxWhatsapp - whatsappUsed) };

  let emailServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  let smsServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  let whatsappServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';

  try {
    const row = await ctx.env.DB.prepare(`SELECT value_json FROM platform_settings WHERE key = 'communications'`).first<{ value_json: string }>();
    if (row?.value_json) {
      const comms = JSON.parse(row.value_json);
      if (comms?.smtp?.enabled) emailServiceStatus = 'ACTIVE';
      if (comms?.smsGateway?.enabled) smsServiceStatus = 'ACTIVE';
      if (comms?.whatsappGateway?.enabled) whatsappServiceStatus = 'ACTIVE';
    }
  } catch {}

  const res: NotificationSettingsResponse = {
    ...DEFAULT_NOTIFICATION_SETTINGS, ...saved,
    smsBalance, whatsappBalance, emailServiceStatus, smsServiceStatus, whatsappServiceStatus,
  };
  return jsonOk(res);
}));

settingsRoutes.put('/notifications', requireGym, requirePermission('settings'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = NotificationSettingsRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid notification settings');
  // The `gyms` table is keyed by `id` (single-tenant-per-row); `gym_id`
  // does not exist on this table. Filter by `id` only.
  await ctx.env.DB
    .prepare(`UPDATE gyms SET notification_settings_json = ?, updated_at = unixepoch() WHERE id = ?`)
    .bind(JSON.stringify(parsed.data), ctx.gymId!)
    .run();
  return jsonOk(parsed.data);
}));

settingsRoutes.post('/notifications/dispatch', requireGym, requirePermission('settings'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = SendNotificationRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid dispatch payload');

  const { channel, recipientPhone, recipientName, type, params } = parsed.data;
  const licenseRepo = new LicenseRepository(ctx.env.DB, ctx.gymId!);
  const license = await licenseRepo.findByGymId(ctx.gymId!);
  if (!license) return jsonErr('Gym license not found', 400);

  const client = extractClientInfo(c.req.raw);
  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);

  if (channel === 'SMS') {
    const deduction = await licenseService.consumeCommunicationQuota({
      channel: 'SMS', credits: 1, recipientPhone, recipientName,
      messageType: type, dispatchedById: ctx.user?.id, ip: client.ip,
    });
    if (!deduction.success) return jsonErr(deduction.error || 'Insufficient SMS balance.', 402);
    return jsonOk({ success: true, channel: 'SMS', recipientPhone, remainingCredits: deduction.remainingCredits, message: `SMS dispatched to ${recipientName}.` });
  } else if (channel === 'WHATSAPP') {
    const deduction = await licenseService.consumeCommunicationQuota({
      channel: 'WHATSAPP', credits: 1, recipientPhone, recipientName,
      messageType: type, dispatchedById: ctx.user?.id, ip: client.ip,
    });
    if (!deduction.success) return jsonErr(deduction.error || 'Insufficient WhatsApp balance.', 402);
    const notifService = new NotificationService(tenant.gym.name);
    const whatsappUrl = notifService.generateWhatsAppUrl({
      recipientPhone, recipientName,
      type: type === 'CUSTOM' ? 'WELCOME' : type,
      params: (params as Record<string, string | number>) || {},
    });
    return jsonOk({ success: true, channel: 'WHATSAPP', recipientPhone, whatsappUrl, remainingCredits: deduction.remainingCredits });
  }
  return jsonErr('Unsupported channel', 400);
}));
