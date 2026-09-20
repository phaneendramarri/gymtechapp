// filepath: apps/api/src/routes/auth.routes.ts
import { Hono } from 'hono';
import {
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  MemberLoginRequestSchema,
} from '@gymtech/shared';
import { MemberRepository } from '../repositories/member.repository';
import { GymRepository } from '../repositories/gym.repository';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { AuditService, extractClientInfo } from '../services/audit.service';
import { verifyTurnstileToken, type TurnstileAppEnv } from '../lib/turnstile';
import type { AppEnv } from '../app';
import { hashPassword, hashOpaqueToken, verifyOpaqueToken } from '../lib/session';
import {
  buildSessionCookie,
  buildCsrfCookie,
  buildClearSessionCookie,
  generateCsrfToken,
  readCookie,
  COOKIE_NAMES,
} from '../lib/cookies';
import { requireAuth } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const authRoutes = new Hono();

/**
 * Run the Turnstile check for a password login and return the rejection
 * `Response`, or `null` to continue.
 *
 * Development is exempt on purpose. The SPA is built in production mode — even
 * for `pnpm dev` on the single Worker — so its widget carries the real site key,
 * which a developer's local secret cannot verify. A strict check therefore
 * rejected every local sign-in with "Bot verification failed", which reads as a
 * wrong password and is impossible to diagnose from the UI. Staging and
 * production always verify (and `verifyTurnstileToken` fails closed there).
 */
async function rejectFailedBotCheck(
  env: AppEnv,
  token: string | undefined,
  ip: string | undefined,
  action: string
): Promise<Response | null> {
  if (!token || !env.TURNSTILE_SECRET_KEY) return null;

  const appEnv = (env.APP_ENV ?? 'production') as TurnstileAppEnv;
  if (appEnv === 'development') {
    console.warn('[turnstile] development environment — skipping bot verification');
    return null;
  }

  const result = await verifyTurnstileToken(token, env.TURNSTILE_SECRET_KEY, ip, appEnv, {
    expectedAction: action,
    expectedHostnames: ['localhost', '127.0.0.1', 'gymtech.ap-fitapp.workers.dev', 'gymtech.app'],
  });
  return result.success ? null : jsonErr('Bot verification failed. Please try again.', 403);
}

authRoutes.post('/login', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid credentials payload');

  const botCheck = await rejectFailedBotCheck(
    ctx.env,
    parsed.data.turnstileToken,
    c.req.header('cf-connecting-ip'),
    'login'
  );
  if (botCheck) return botCheck;

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
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
    // Set httpOnly session cookie + readable CSRF cookie. The body still
    // includes `token` and `user` for clients that can't use cookies
    // (e.g. mobile apps), but the web app will ignore the body and rely
    // on the cookies.
    const csrf = generateCsrfToken();
    // Cookies go through jsonOk's dedicated `cookies` argument so each gets its
    // own Set-Cookie header. Folding them into one header with ", " makes
    // browsers keep only the first cookie, so `gym_csrf` would never arrive and
    // every subsequent write would need a CSRF re-fetch.
    return jsonOk(res, 200, { 'X-CSRF-Token': csrf }, [
      buildSessionCookie(res.token, ctx.env.APP_ENV),
      buildCsrfCookie(csrf, ctx.env.APP_ENV),
    ]);
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
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid credentials payload');
  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const client = extractClientInfo(c.req.raw);

  try {
    const res = await authService.loginPlatformAdmin(parsed.data.email, parsed.data.password);
    const audit = new AuditService(ctx.env.DB);
    await audit.recordGymEvent({
      gymId: 0,
      actorUserId: res.user.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'auth.platform_login.success',
      entityType: 'platform_admin',
      entityId: res.user.id,
      ip: client.ip,
      userAgent: client.userAgent,
    });
    const csrf = generateCsrfToken();
    // Cookies go through jsonOk's dedicated `cookies` argument so each gets its
    // own Set-Cookie header. Folding them into one header with ", " makes
    // browsers keep only the first cookie, so `gym_csrf` would never arrive and
    // every subsequent write would need a CSRF re-fetch.
    return jsonOk(res, 200, { 'X-CSRF-Token': csrf }, [
      buildSessionCookie(res.token, ctx.env.APP_ENV),
      buildCsrfCookie(csrf, ctx.env.APP_ENV),
    ]);
  } catch (e: any) {
    return jsonErr(e.message, 401);
  }
}));

/**
 * GET /auth/csrf — bootstrap a CSRF token for cookie-based sessions.
 *
 * The double-submit pattern requires a non-httpOnly `gym_csrf` cookie plus a
 * matching `X-CSRF-Token` header. Login responses already set both, but the
 * SPA can land on a page (new tab, expired session) without one — this
 * endpoint issues a fresh pair. It is CSRF-exempt because it only *creates*
 * a token and requires no session.
 */
authRoutes.get('/csrf', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const csrf = generateCsrfToken();
  return jsonOk(
    { csrfToken: csrf },
    200,
    {
      'Set-Cookie': buildCsrfCookie(csrf, ctx.env.APP_ENV),
      'X-CSRF-Token': csrf,
    }
  );
}));

authRoutes.get('/me', requireAuth, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const res = await authService.getCurrentUser(ctx.user!);
  return jsonOk(res);
}));

/**
 * POST /auth/refresh — Sliding-window refresh token rotation.
 * Accepts { refreshToken } in body, returns { token, refreshToken }.
 * The old refresh token is immediately revoked after use (rotation).
 */
authRoutes.post('/refresh', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return jsonErr('refreshToken is required', 400);
  }

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const result = await authService.refreshToken(refreshToken);
  if (!result) return jsonErr('Invalid or expired refresh token', 401);

  const csrf = generateCsrfToken();
  // Separate Set-Cookie headers — see the login handler for why folding breaks
  // the CSRF double-submit cookie.
  return jsonOk(
    { token: result.token, refreshToken: result.refreshToken, user: result.user },
    200,
    { 'X-CSRF-Token': csrf },
    [
      buildSessionCookie(result.token, ctx.env.APP_ENV),
      buildCsrfCookie(csrf, ctx.env.APP_ENV),
    ]
  );
}));

authRoutes.post('/forgot-password', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid email address');

  const email = parsed.data.email.toLowerCase().trim();
  const user: any = await ctx.env.DB
    .prepare(`SELECT id, gym_id, name, email FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(email)
    .first();
  if (!user) {
    return jsonOk({ success: true, message: 'If an account exists with that email, a password reset link has been dispatched.' });
  }

  const token = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  // Opaque high-entropy tokens are HMAC'd, not PBKDF2'd (random salt would
  // make lookup non-deterministic, and slow KDFs are wasted on entropy we
  // already have).
  const tokenHash = await hashOpaqueToken(token, ctx.env.JWT_SECRET);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  await new PasswordResetRepository(ctx.env.DB).create({
    gymId: user.gym_id,
    userId: user.id,
    tokenHash,
    expiresAt: expiresAt,
  });

  const emailService = new EmailService(ctx.env);
  const sendResult = await emailService.sendPasswordResetEmail({ to: user.email, name: user.name, token });

  // Only include the raw reset URL in non-production environments. The URL
  // grants account access; leaking it in production is a critical vulnerability.
  const isProduction = (ctx.env.APP_ENV ?? 'production') === 'production';
  return jsonOk({
    success: true,
    message: 'A password reset link has been sent to your email address.',
    ...(isProduction ? {} : { devResetUrl: sendResult.resetUrl }),
  });
}));

authRoutes.post('/reset-password', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ResetPasswordRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid password reset payload');

  const { token, newPassword } = parsed.data;
  const tokenHash = await hashOpaqueToken(token, ctx.env.JWT_SECRET);
  const resetRepo = new PasswordResetRepository(ctx.env.DB);
  const resetRecord = await resetRepo.findValidByTokenHash(tokenHash);
  if (!resetRecord) return jsonErr('Reset link is invalid or has expired.', 400);

  const user: any = await ctx.env.DB
    .prepare(`SELECT id, name, email FROM users WHERE id = ? AND gym_id = ? AND deleted_at IS NULL`)
    .bind(resetRecord.user_id, resetRecord.gym_id)
    .first();
  if (!user) return jsonErr('Associated user account was not found', 404);

  const newHash = await hashPassword(newPassword);
  await resetRepo.consumeAndSetPassword({
    gymId: resetRecord.gym_id,
    userId: resetRecord.user_id,
    resetId: resetRecord.id,
    passwordHash: newHash,
  });

  const emailService = new EmailService(ctx.env);
  await emailService.sendPasswordResetConfirmation({ to: user.email, name: user.name });

  return jsonOk({ success: true, message: 'Your password has been successfully reset.' });
}));

authRoutes.post('/member-login', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = MemberLoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid login details');

  const botCheck = await rejectFailedBotCheck(
    ctx.env,
    parsed.data.turnstileToken,
    c.req.header('cf-connecting-ip'),
    'member_login'
  );
  if (botCheck) return botCheck;

  const { gymSlug, identifier: ident, codeOrPin: code } = parsed.data;
  const trimIdent = ident.trim();
  const trimCode = code.trim();

  // Resolve gymId from gymSlug first so the member query is tenant-scoped.
  const gymRow = await new GymRepository(ctx.env.DB).findBySlug(gymSlug);
  if (!gymRow) return jsonErr('Invalid gym identifier', 400);

  const member: any = await new MemberRepository(ctx.env.DB, gymRow.id).findLoginRow(trimIdent);

  if (!member) return jsonErr('No member account found with this phone number or member code', 404);

  const memberCodeMatches = member.member_code.toUpperCase() === trimCode.toUpperCase();
  // phone can be NULL for portal-only imports; guard the endsWith probe.
  const phoneMatches = (member.phone && (member.phone.endsWith(trimCode) || member.phone === trimCode)) || false;
  const identMatchesCode = member.member_code.toUpperCase() === trimIdent.toUpperCase();

  if (!memberCodeMatches && !phoneMatches && !identMatchesCode) {
    return jsonErr('Invalid verification credential.', 401);
  }

  // M-17: Use shared repository helper instead of inline query.
  const memberRepo = new MemberRepository(ctx.env.DB, member.gym_id);
  const activeMembership = await memberRepo.getActiveMembership(member.id);

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const { token } = await authService.signMemberToken({
    id: member.id, gymId: member.gym_id, memberCode: member.member_code,
    phone: member.phone, name: `${member.first_name} ${member.last_name || ''}`.trim(),
  });

  const csrf = generateCsrfToken();
  return jsonOk(
    {
      token,
      member: {
        id: member.id, gymId: member.gym_id, memberCode: member.member_code,
        firstName: member.first_name, lastName: member.last_name,
        email: member.email, phone: member.phone, photoUrl: member.photo_url,
        status: member.status, joinedDate: member.joined_date,
      },
      activeMembership: activeMembership || null,
      gym: { id: member.gym_id, name: member.gym_name, slug: member.gym_slug },
    },
    200,
    { 'X-CSRF-Token': csrf },
    [
      buildSessionCookie(token, ctx.env.APP_ENV),
      buildCsrfCookie(csrf, ctx.env.APP_ENV),
    ]
  );
}));

authRoutes.get('/portal', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const cookieToken = readCookie(c.req.header('Cookie'), COOKIE_NAMES.SESSION);
  const authHeader = c.req.header('Authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const token = cookieToken || bearerToken;
  if (!token) return jsonErr('Unauthorized: Member token required', 401);

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const session = await authService.verifyToken(token);
  if (!session || !session.userId || session.role !== 'MEMBER') {
    return jsonErr('Invalid or expired member session', 401);
  }

  const { member, memberships, payments, attendance } = await new MemberRepository(
    ctx.env.DB,
    session.gymId as number
  ).getPortalRows(session.userId as number);
  if (!member) return jsonErr('Member record not found', 404);

  // Map raw rows onto the camelCase contracts the portal renders — raw
  // snake_case here meant every field on the portal page rendered blank.
  const ms = (memberships as any[]).map((m: any) => ({
    id: m.id, gymId: m.gym_id, memberId: m.member_id, membershipPlanId: m.membership_plan_id,
    startDate: m.start_date, endDate: m.end_date,
    totalAmountPaise: m.total_amount_paise, discountPaise: m.discount_paise,
    finalAmountPaise: m.final_amount_paise, paidAmountPaise: m.paid_amount_paise,
    dueAmountPaise: m.due_amount_paise, status: m.status, frozenAt: m.frozen_at,
    notes: m.notes, planName: m.plan_name, durationMonths: m.duration_months,
  }));
  const activeMembership = ms.find((m) => m.status === 'ACTIVE') || ms[0] || null;

  return jsonOk({
    member: {
      id: member.id, gymId: member.gym_id, memberCode: member.member_code,
      firstName: member.first_name, lastName: member.last_name,
      email: member.email, phone: member.phone, gender: member.gender,
      photoUrl: member.photo_url, status: member.status, joinedDate: member.joined_date,
    },
    activeMembership,
    memberships: ms,
    payments: (payments as any[]).map((p: any) => ({
      id: p.id, receiptNumber: p.receipt_number, amountPaise: p.amount_paise,
      paymentDate: p.payment_date, paymentMode: p.payment_mode, status: p.status, notes: p.notes,
    })),
    attendance: (attendance as any[]).map((a: any) => ({
      id: a.id, checkInTime: a.check_in_time, attendanceDate: a.attendance_date, method: a.method,
    })),
    gym: { name: member.gym_name, address: member.gym_address, phone: member.gym_phone },
  });
}));

authRoutes.post('/logout', requireAuth, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL, ctx.env.DENYLIST_KV);
  // Revoke the session from DB so the access token can never be used again
  if (ctx.user?.jti) {
    await authService.logout(ctx.user.jti);
  }
  return jsonOk(
    { success: true, message: 'Logged out.' },
    200,
    undefined,
    [
      buildClearSessionCookie(ctx.env.APP_ENV),
      // CSRF cookie: clear by setting Max-Age=0
      buildCsrfCookie('', ctx.env.APP_ENV).replace(/Max-Age=\d+/, 'Max-Age=0'),
    ]
  );
}));