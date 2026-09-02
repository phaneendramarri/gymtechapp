// filepath: apps/api/src/routes/settings.routes.ts
import { Hono } from 'hono';
import {
  NotificationSettingsRequestSchema,
  SendNotificationRequestSchema,
  ChannelBalance,
  NotificationSettingsResponse,
} from '@gymtech/shared';
import { requireGym, requireRole } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { extractClientInfo } from '../services/audit.service';
import { LicenseRepository } from '../repositories/license.repository';
import { LicenseService } from '../services/license.service';
import { NotificationService } from '../lib/notifications';
import { jsonErr, jsonOk } from './helpers';

export const settingsRoutes = new Hono();

const DEFAULT_NOTIFICATION_SETTINGS = {
  reminderDays: 7, welcomeEnabled: true, receiptEnabled: true, expiryEnabled: true,
};

settingsRoutes.get('/notifications', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: any };
  const saved = tenant.gym.notification_settings_json ? JSON.parse(tenant.gym.notification_settings_json) : {};

  const licenseRepo = new LicenseRepository(ctx.env.DB, ctx.gymId!);
  const license = await licenseRepo.findByGymId(ctx.gymId!);
  const maxSms = license?.max_sms ?? 0, smsUsed = license?.sms_used ?? 0;
  const maxWhatsapp = license?.max_whatsapp ?? 0, whatsappUsed = license?.whatsapp_used ?? 0;
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

settingsRoutes.put('/notifications', requireGym, requireRole('OWNER', 'MANAGER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = NotificationSettingsRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid notification settings', 400);
  await ctx.env.DB.prepare(`UPDATE gyms SET notification_settings_json = ?, updated_at = unixepoch() WHERE id = ? AND gym_id = ?`).bind(JSON.stringify(parsed.data), ctx.gymId!, ctx.gymId!).run();
  return jsonOk(parsed.data);
}));

settingsRoutes.post('/notifications/dispatch', requireGym, requireRole('OWNER', 'MANAGER', 'STAFF', 'TRAINER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const body = await c.req.json().catch(() => ({}));
  const parsed = SendNotificationRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid dispatch payload', 400);

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