// filepath: apps/api/src/routes/admin.routes.ts
import { Hono } from 'hono';
import {
  CreateGymRequestSchema,
  ToggleGymStatusRequestSchema,
  UpdateLicenseRequestSchema,
  UpdateGymFeaturesRequestSchema,
  AdminUserUpdateRequestSchema,
  UpdateLicenseLimitsRequestSchema,
  PlatformCommunicationsConfigSchema,
  TestSmtpRequestSchema,
  TopUpCreditsRequestSchema,
} from '@gymtech/shared';
import { requireSuperAdminMiddleware } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { AdminRepository } from '../repositories/admin.repository';
import { LicenseRepository } from '../repositories/license.repository';
import { AuditService, auditSaasFromCtx } from '../services/audit.service';
import { EmailService } from '../services/email.service';
import { jsonErr, jsonOk, jsonValidationErr, parsePageParams, jsonPaginated } from './helpers';

export const adminRoutes = new Hono();

// All admin routes require platform-admin auth
adminRoutes.use('*', requireSuperAdminMiddleware);

const auditSaas = auditSaasFromCtx;

adminRoutes.get('/gyms', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const adminRepo = new AdminRepository(ctx.env.DB);
  return jsonOk({ gyms: await adminRepo.listGyms() });
}));

adminRoutes.get('/metrics', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const adminRepo = new AdminRepository(ctx.env.DB);
  return jsonOk(await adminRepo.getPlatformMetrics());
}));

adminRoutes.get('/licenses', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const licenseRepo = new LicenseRepository(ctx.env.DB, 0);
  return jsonOk({ licenses: await licenseRepo.listAll() });
}));

adminRoutes.patch('/licenses', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateLicenseRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid license payload');

  // Verify the gym exists before updating its license
  const gymRow = await ctx.env.DB.prepare(`SELECT id FROM gyms WHERE id = ?`).bind(parsed.data.gymId).first();
  if (!gymRow) return jsonErr(`Gym with ID ${parsed.data.gymId} not found`, 404);

  const licenseRepo = new LicenseRepository(ctx.env.DB, 0);
  const before = await licenseRepo.findByGymId(parsed.data.gymId);
  await licenseRepo.updateByGym(parsed.data.gymId, {
    name: parsed.data.name, pricePaise: parsed.data.pricePaise,
    maxMembers: parsed.data.maxMembers, maxOwners: parsed.data.maxOwners,
    maxManagers: parsed.data.maxManagers, maxStaffTotal: parsed.data.maxStaffTotal,
    maxSms: parsed.data.maxSms, maxWhatsapp: parsed.data.maxWhatsapp, maxEmail: parsed.data.maxEmail,
    features: parsed.data.features, expiresAt: parsed.data.expiresAt, status: parsed.data.status,
  });
  const after = await licenseRepo.findByGymId(parsed.data.gymId);
  await auditSaas(ctx, 'license.update', parsed.data.gymId, 'license', after?.id ?? null, { before, after });
  return jsonOk(after);
}));

adminRoutes.post('/gyms', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateGymRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid gym data');
  const adminRepo = new AdminRepository(ctx.env.DB);
  try {
    const result = await adminRepo.createGymWithOwner({
      gymName: parsed.data.gymName, slug: parsed.data.slug, gymPhone: parsed.data.gymPhone, city: parsed.data.city,
      ownerName: parsed.data.ownerName, ownerEmail: parsed.data.ownerEmail, ownerPhone: parsed.data.ownerPhone,
      ownerPasswordPlain: parsed.data.ownerPassword,
      licenseName: parsed.data.licenseName, licenseCode: parsed.data.licenseCode,
      pricePaise: parsed.data.pricePaise, billingPeriod: parsed.data.billingPeriod,
      maxMembers: parsed.data.maxMembers, maxOwners: parsed.data.maxOwners,
      maxManagers: parsed.data.maxManagers, maxStaffTotal: parsed.data.maxStaffTotal,
      features: parsed.data.features, durationDays: parsed.data.durationDays,
    });
    await auditSaas(ctx, 'gym.create', result.gymId, 'gym', result.gymId, { after: { slug: parsed.data.slug, ownerEmail: parsed.data.ownerEmail } });
    return jsonOk(result, 201);
  } catch (e: any) { return jsonErr(e.message, 400); }
}));

adminRoutes.post('/gyms/:id/status', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ToggleGymStatusRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid status payload');
  const adminRepo = new AdminRepository(ctx.env.DB);
  const before = await ctx.env.DB.prepare(`SELECT * FROM gyms WHERE id = ?`).bind(id).first();
  await adminRepo.toggleGymStatus(id, parsed.data.status);
  await auditSaas(ctx, 'gym.status', id, 'gym', id, { before: { status: before?.status }, after: { status: parsed.data.status } });
  return jsonOk({ success: true, gymId: id, status: parsed.data.status });
}));

adminRoutes.get('/gyms/:id/features', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const adminRepo = new AdminRepository(ctx.env.DB);
  return jsonOk({ features: await adminRepo.getGymFeatures(id) });
}));

adminRoutes.put('/gyms/:id/features', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateGymFeaturesRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid features payload');
  const adminRepo = new AdminRepository(ctx.env.DB);
  const before = await adminRepo.getGymFeatures(id);
  await adminRepo.updateGymFeatures(id, parsed.data.features);
  const after = await adminRepo.getGymFeatures(id);
  await auditSaas(ctx, 'gym.features_update', id, 'gym_features', id, { before, after });
  return jsonOk({ success: true, features: after });
}));

adminRoutes.get('/gyms/:id/users', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const adminRepo = new AdminRepository(ctx.env.DB);
  return jsonOk({ users: await adminRepo.listGymUsers(id) });
}));

adminRoutes.put('/users/:id', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminUserUpdateRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid user update payload');
  const adminRepo = new AdminRepository(ctx.env.DB);
  const before = await ctx.env.DB.prepare(`SELECT id, gym_id, name, email, phone, role, status FROM users WHERE id = ?`).bind(id).first();
  if (!before) return jsonErr('User not found', 404);
  await adminRepo.updateGymUser(id, {
    name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone,
    role: parsed.data.role, status: parsed.data.status, passwordPlain: parsed.data.password,
  });
  const after = await ctx.env.DB.prepare(`SELECT id, gym_id, name, email, phone, role, status FROM users WHERE id = ?`).bind(id).first();
  await auditSaas(ctx, 'user.admin_update', (before as any).gym_id, 'user', id, { before, after });
  return jsonOk({ success: true, user: after });
}));

adminRoutes.put('/gyms/:id/license-limits', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateLicenseLimitsRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid license limits payload');
  const adminRepo = new AdminRepository(ctx.env.DB);
  const before = await ctx.env.DB.prepare(`SELECT * FROM licenses WHERE gym_id = ?`).bind(id).first();
  await adminRepo.updateLicenseLimits(id, parsed.data);
  const after = await ctx.env.DB.prepare(`SELECT * FROM licenses WHERE gym_id = ?`).bind(id).first();
  await auditSaas(ctx, 'gym.license_limits_update', id, 'license', (after as any)?.id ?? null, { before, after });
  return jsonOk({ success: true, license: after });
}));

adminRoutes.get('/audit-logs', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'audit');
  const action = c.req.query('action') || undefined;
  const affectedGymId = c.req.query('affectedGymId') ? parseInt(c.req.query('affectedGymId')!, 10) : undefined;
  const auditService = new AuditService(ctx.env.DB);
  const result = await auditService.listSaasEvents({ limit, offset, action, affectedGymId });
  return jsonPaginated(result.events, result.total, limit, offset);
}));

adminRoutes.get('/communications', safeHandler(async (c) => {
  const ctx = getCtx(c);
  try {
    const row = await ctx.env.DB.prepare(`SELECT value_json FROM platform_settings WHERE key = 'communications'`).first<{ value_json: string }>();
    const config = row?.value_json ? JSON.parse(row.value_json) : {
      smtp: { enabled: false, provider: 'CUSTOM', host: '', port: 587, secure: false, username: '', password: '', fromName: '', fromEmail: '' },
      smsGateway: { enabled: false, provider: 'FAST2SMS', apiKey: '', senderId: 'GYMTC' },
      whatsappGateway: { enabled: false, provider: 'META_CLOUD_API', accessToken: '', phoneNumberId: '', businessAccountId: '' },
    };
    return jsonOk({ config });
  } catch (e: any) { return jsonErr(e.message || 'Failed to load gateway config', 500); }
}));

adminRoutes.put('/communications', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = PlatformCommunicationsConfigSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid gateway config');
  await ctx.env.DB
    .prepare(`INSERT INTO platform_settings (key, value_json, updated_at) VALUES ('communications', ?, unixepoch())
              ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = unixepoch()`)
    .bind(JSON.stringify(parsed.data)).run();
  await auditSaas(ctx, 'communications.update', null, 'platform_settings', null, { after: { configUpdated: true } });
  return jsonOk({ success: true, config: parsed.data });
}));

adminRoutes.post('/communications/test-smtp', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = TestSmtpRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid SMTP test payload');
  const { smtp, testRecipient } = parsed.data;
  const emailService = new EmailService(ctx.env);
  const result = await emailService.sendTestSmtpEmail({
    to: testRecipient, gymName: 'GymTech Platform Central',
    smtpHost: smtp.host || 'smtp.custom-relay.net', smtpPort: smtp.port || 587, provider: smtp.provider,
  });
  // H-14: Audit platform admin SMTP test (no specific gym context)
  await auditSaas(ctx, 'communications.test_smtp', null, 'platform_settings', null, { after: { testRecipient } });
  return jsonOk(result);
}));

adminRoutes.post('/gyms/:id/top-up-credits', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const gymId = paramId(c.req.param() as Record<string, string>);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = TopUpCreditsRequestSchema.safeParse({ ...body, gymId });
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid top-up payload');
  const licenseRepo = new LicenseRepository(ctx.env.DB, 0);
  await licenseRepo.topUpCredits(gymId, parsed.data.channel, parsed.data.credits);
  const updatedLicense = await licenseRepo.findByGymId(gymId);
  await auditSaas(ctx, `credits.topup.${parsed.data.channel}`, gymId, 'license', updatedLicense?.id ?? null, { after: { channel: parsed.data.channel, added: parsed.data.credits } });
  return jsonOk({ success: true, license: updatedLicense });
}));
