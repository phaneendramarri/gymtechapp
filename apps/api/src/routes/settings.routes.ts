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
import { SettingsRepository } from '../repositories/settings.repository';
import { LicenseService } from '../services/license.service';
import { NotificationService } from '../lib/notifications';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const settingsRoutes = new Hono();

// Gym Profile Settings
settingsRoutes.get('/gym', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const settingsRepo = new SettingsRepository(ctx.env.DB);
  const gymRow = await settingsRepo.getGymProfile(ctx.gymId!);
  return jsonOk(gymRow || (c.get('tenant' as never) as { gym: any }).gym);
}));

settingsRoutes.patch('/gym', requireGym, requirePermission('settings'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const { name, phone, email, address, city, state, pincode, gstNumber, currency, logoUrl } = body;

  const settingsRepo = new SettingsRepository(ctx.env.DB);
  const current = await settingsRepo.getGymProfile(ctx.gymId!);
  if (!current) return jsonErr('Gym not found', 404);

  const coalesce = (v: unknown, fallback: string | null) =>
    v !== undefined ? (v ? String(v).trim() : null) : fallback;

  const patch = {
    name: name !== undefined ? String(name).trim() : current.name,
    phone: phone !== undefined ? String(phone).trim() : current.phone,
    email: coalesce(email, current.email),
    address: coalesce(address, current.address),
    city: coalesce(city, current.city),
    state: coalesce(state, current.state),
    pincode: coalesce(pincode, current.pincode),
    gstNumber: coalesce(gstNumber, current.gstNumber),
    currency: currency !== undefined ? String(currency).trim() : current.currency,
    logoUrl: coalesce(logoUrl, current.logoUrl),
  };
  await settingsRepo.updateGymProfile(ctx.gymId!, patch);

  const updated = await settingsRepo.getGymProfile(ctx.gymId!);
  await auditGymFromCtx(c, 'gym.update', 'gym', ctx.gymId!, { before: current, after: updated });
  return jsonOk(updated);
}));

const DEFAULT_NOTIFICATION_SETTINGS = {
  reminderDays: 7, welcomeEnabled: true, receiptEnabled: true, expiryEnabled: true,
};

settingsRoutes.get('/notifications', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const saved = await new SettingsRepository(ctx.env.DB).getNotificationSettings(ctx.gymId!) ?? {};

  const licenseRepo = new LicenseRepository(ctx.env.DB, ctx.gymId!);
  const license = await licenseRepo.findByGymId(ctx.gymId!);
  const maxSms = license?.maxSms ?? 0, smsUsed = license?.smsUsed ?? 0;
  const maxWhatsapp = license?.maxWhatsapp ?? 0, whatsappUsed = license?.whatsappUsed ?? 0;
  const smsBalance: ChannelBalance = { total: maxSms, used: smsUsed, remaining: Math.max(0, maxSms - smsUsed) };
  const whatsappBalance: ChannelBalance = { total: maxWhatsapp, used: whatsappUsed, remaining: Math.max(0, maxWhatsapp - whatsappUsed) };

  const emailServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = ctx.env.RESEND_API_KEY ? 'ACTIVE' : 'NOT_CONFIGURED';
  const smsServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  const whatsappServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';

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
  await new SettingsRepository(ctx.env.DB).setNotificationSettings(ctx.gymId!, parsed.data);
  return jsonOk(parsed.data);
}));

settingsRoutes.post('/notifications/dispatch', requireGym, requirePermission('settings'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = SendNotificationRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid dispatch payload');

  const { channel, recipientPhone, recipientName, type, params, memberId } = parsed.data;

  // A message attributed to a member must belong to this gym. The log row's
  // composite FK enforces this at the DB level, but a clear 404 is friendlier
  // than a constraint violation.
  if (memberId) {
    const owned = await ctx.env.DB
      .prepare('SELECT id FROM members WHERE id = ? AND gymId = ? AND deletedAt IS NULL')
      .bind(memberId, ctx.gymId!)
      .first();
    if (!owned) return jsonErr('Member not found in this gym', 404);
  }

  const licenseRepo = new LicenseRepository(ctx.env.DB, ctx.gymId!);
  const license = await licenseRepo.findByGymId(ctx.gymId!);
  if (!license) return jsonErr('Gym license not found', 400);

  const client = extractClientInfo(c.req.raw);
  const licenseService = new LicenseService(ctx.env.DB, ctx.gymId!);

  if (channel === 'SMS') {
    const deduction = await licenseService.consumeCommunicationQuota({
      channel: 'SMS', credits: 1, recipientPhone, recipientName,
      messageType: type, memberId: memberId ?? null, dispatchedById: ctx.user?.id, ip: client.ip,
    });
    if (!deduction.success) return jsonErr(deduction.error || 'Insufficient SMS balance.', 402);
    return jsonOk({ success: true, channel: 'SMS', recipientPhone, remainingCredits: deduction.remainingCredits, message: `SMS dispatched to ${recipientName}.` });
  } else if (channel === 'WHATSAPP') {
    const deduction = await licenseService.consumeCommunicationQuota({
      channel: 'WHATSAPP', credits: 1, recipientPhone, recipientName,
      messageType: type, memberId: memberId ?? null, dispatchedById: ctx.user?.id, ip: client.ip,
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
