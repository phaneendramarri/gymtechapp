// filepath: apps/api/src/routes/auth.routes.ts
import { Hono } from 'hono';
import {
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  MemberLoginRequestSchema,
} from '@gymtech/shared';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { AuditService, extractClientInfo } from '../services/audit.service';
import { verifyTurnstileToken } from '../lib/turnstile';
import { hashPassword } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { jsonErr, jsonOk } from './helpers';

export const authRoutes = new Hono();

authRoutes.post('/login', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid credentials payload', 400);

  if (parsed.data.turnstileToken) {
    const ip = c.req.header('cf-connecting-ip') || undefined;
    const turnstileRes = await verifyTurnstileToken(parsed.data.turnstileToken, ctx.env.TURNSTILE_SECRET_KEY, ip);
    if (!turnstileRes.success) return jsonErr(turnstileRes.error || 'Bot verification failed', 403);
  }

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET);
  const client = extractClientInfo(c.req.raw);
  try {
    const res = await authService.login(parsed.data.email, parsed.data.password);
    const audit = new AuditService(ctx.env.DB);
    await audit.recordGymEvent({
      gymId: res.user.gymId ?? 0,
      actorUserId: res.user.id,
      actorRole: res.user.role,
      action: 'auth.login.success',
      entityType: 'user',
      entityId: res.user.id,
      ip: client.ip,
      userAgent: client.userAgent,
    });
    return jsonOk(res);
  } catch (e: any) {
    try {
      const u = await ctx.env.DB
        .prepare(`SELECT id, gym_id FROM users WHERE LOWER(email) = ? LIMIT 1`)
        .bind(parsed.data.email.toLowerCase().trim())
        .first<{ id: number; gym_id: number }>();
      if (u) {
        const audit = new AuditService(ctx.env.DB);
        await audit.recordGymEvent({
          gymId: u.gym_id,
          actorUserId: u.id,
          actorRole: null,
          action: 'auth.login.failed',
          entityType: 'user',
          entityId: u.id,
          ip: client.ip,
          userAgent: client.userAgent,
          metadata: { reason: e.message },
        });
      }
    } catch {}
    return jsonErr(e.message, 401);
  }
}));

authRoutes.post('/platform-login', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr('Invalid credentials payload', 400);
  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET);
  const client = extractClientInfo(c.req.raw);
  try {
    const res = await authService.loginPlatformAdmin(parsed.data.email, parsed.data.password);
    const audit = new AuditService(ctx.env.DB);
    await audit.recordSaasEvent({
      actorAdminId: res.user.id,
      affectedGymId: null,
      action: 'auth.platform_login.success',
      entityType: 'platform_admin',
      entityId: res.user.id,
      ip: client.ip,
      userAgent: client.userAgent,
    });
    return jsonOk(res);
  } catch (e: any) {
    return jsonErr(e.message, 401);
  }
}));

authRoutes.get('/me', requireAuth, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET);
  const res = await authService.getCurrentUser(ctx.user!);
  return jsonOk(res);
}));

authRoutes.post('/forgot-password', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid email address', 400);

  const email = parsed.data.email.toLowerCase().trim();
  const user: any = await ctx.env.DB
    .prepare(`SELECT id, gym_id, name, email FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(email)
    .first();
  if (!user) {
    return jsonOk({ success: true, message: 'If an account exists with that email, a password reset link has been dispatched.' });
  }

  const token = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  const tokenHash = await hashPassword(token);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  await ctx.env.DB
    .prepare(`INSERT INTO user_password_resets (gym_id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, unixepoch())`)
    .bind(user.gym_id, user.id, tokenHash, expiresAt)
    .run();

  const emailService = new EmailService(ctx.env);
  const sendResult = await emailService.sendPasswordResetEmail({ to: user.email, name: user.name, token });

  return jsonOk({
    success: true,
    message: 'A password reset link has been sent to your email address.',
    devResetUrl: sendResult.resetUrl,
  });
}));

authRoutes.post('/reset-password', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ResetPasswordRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid password reset payload', 400);

  const { token, newPassword } = parsed.data;
  const tokenHash = await hashPassword(token);
  const resetRecord: any = await ctx.env.DB
    .prepare(`SELECT * FROM user_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > unixepoch() LIMIT 1`)
    .bind(tokenHash)
    .first();
  if (!resetRecord) return jsonErr('Reset link is invalid or has expired.', 400);

  const user: any = await ctx.env.DB
    .prepare(`SELECT id, name, email FROM users WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
    .bind(resetRecord.user_id, resetRecord.gym_id)
    .first();
  if (!user) return jsonErr('Associated user account was not found', 404);

  const newHash = await hashPassword(newPassword);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ? AND gym_id = ?`).bind(newHash, user.id, resetRecord.gym_id),
    ctx.env.DB.prepare(`UPDATE user_password_resets SET used_at = unixepoch() WHERE id = ? AND gym_id = ?`).bind(resetRecord.id, resetRecord.gym_id),
  ]);

  const emailService = new EmailService(ctx.env);
  await emailService.sendPasswordResetConfirmation({ to: user.email, name: user.name });

  return jsonOk({ success: true, message: 'Your password has been successfully reset.' });
}));

authRoutes.post('/member-login', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = MemberLoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonErr(parsed.error.errors[0]?.message || 'Invalid login details', 400);

  if (parsed.data.turnstileToken) {
    const ip = c.req.header('cf-connecting-ip') || undefined;
    const turnstileRes = await verifyTurnstileToken(parsed.data.turnstileToken, ctx.env.TURNSTILE_SECRET_KEY, ip);
    if (!turnstileRes.success) return jsonErr(turnstileRes.error || 'Bot verification failed', 403);
  }

  const ident = parsed.data.identifier.trim();
  const code = parsed.data.codeOrPin.trim();
  const member: any = await ctx.env.DB.prepare(`
    SELECT m.*, g.name as gym_name, g.slug as gym_slug
    FROM members m JOIN gyms g ON g.id = m.gym_id
    WHERE (m.member_code = ? OR m.phone = ? OR m.email = ?) AND m.deleted_at IS NULL
    LIMIT 1
  `).bind(ident, ident, ident).first();

  if (!member) return jsonErr('No member account found with this phone number or member code', 404);

  const memberCodeMatches = member.member_code.toUpperCase() === code.toUpperCase();
  const phoneMatches = member.phone.endsWith(code) || member.phone === code;
  const identMatchesCode = member.member_code.toUpperCase() === ident.toUpperCase();

  if (!memberCodeMatches && !phoneMatches && !identMatchesCode) {
    return jsonErr('Invalid verification credential.', 401);
  }

  const activeMembership: any = await ctx.env.DB.prepare(`
    SELECT ms.*, mp.name as plan_name
    FROM memberships ms LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id
    WHERE ms.member_id = ? AND ms.gym_id = ?
    ORDER BY ms.end_date DESC LIMIT 1
  `).bind(member.id, member.gym_id).first();

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET);
  const token = await authService.signMemberToken({
    id: member.id, gymId: member.gym_id, memberCode: member.member_code,
    phone: member.phone, name: `${member.first_name} ${member.last_name || ''}`.trim(),
  });

  return jsonOk({
    token,
    member,
    activeMembership: activeMembership || null,
    gym: { id: member.gym_id, name: member.gym_name, slug: member.gym_slug },
  });
}));

authRoutes.get('/portal', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonErr('Unauthorized: Member token required', 401);

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET);
  const session = await authService.verifyToken(token);
  if (!session || !session.userId || session.role !== 'MEMBER') {
    return jsonErr('Invalid or expired member session', 401);
  }

  const member: any = await ctx.env.DB.prepare(`
    SELECT m.*, g.name as gym_name, g.address as gym_address, g.phone as gym_phone
    FROM members m JOIN gyms g ON g.id = m.gym_id
    WHERE m.id = ? AND m.deleted_at IS NULL
  `).bind(session.userId).first();
  if (!member) return jsonErr('Member record not found', 404);

  const [memberships, payments, attendance] = await Promise.all([
    ctx.env.DB.prepare(`SELECT ms.*, mp.name as plan_name, mp.duration_months FROM memberships ms LEFT JOIN membership_plans mp ON mp.id = ms.membership_plan_id WHERE ms.member_id = ? AND ms.gym_id = ? ORDER BY ms.end_date DESC`).bind(member.id, member.gym_id).all(),
    ctx.env.DB.prepare(`SELECT * FROM payments WHERE member_id = ? AND gym_id = ? ORDER BY payment_date DESC LIMIT 20`).bind(member.id, member.gym_id).all(),
    ctx.env.DB.prepare(`SELECT * FROM attendance WHERE member_id = ? AND gym_id = ? ORDER BY check_in_time DESC LIMIT 30`).bind(member.id, member.gym_id).all(),
  ]);

  const ms = (memberships.results || []) as any[];
  const activeMembership = ms.find((m) => m.status === 'ACTIVE') || ms[0] || null;

  return jsonOk({
    member, activeMembership, memberships: ms,
    payments: payments.results || [],
    attendance: attendance.results || [],
    gym: { name: member.gym_name, address: member.gym_address, phone: member.gym_phone },
  });
}));