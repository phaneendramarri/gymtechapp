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
  buildClearCsrfCookie,
  generateCsrfToken,
  readCookie,
  COOKIE_NAMES,
} from '../lib/cookies';
import { requireAuth } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { jsonErr, jsonOk, jsonValidationErr, toSafeErrorMessage } from './helpers';
import { GENERIC_INVALID_CREDENTIALS } from '../lib/lockout';
import { loadPlatformMsg91 } from '../lib/msg91';

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
        .prepare(`SELECT id, gymId FROM users WHERE LOWER(email) = ? AND deletedAt IS NULL LIMIT 1`)
        .bind(parsed.data.email.toLowerCase().trim())
        .first<{ id: number; gymId: number }>();
      if (u) {
        const audit = new AuditService(ctx.env.DB);
        await audit.recordGymEvent({
          gymId: u.gymId,
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
    } catch {} // audit best-effort only — never blocks the error response
    // Credential errors use fixed business messages; anything else (e.g. a
    // Drizzle "Failed query …" + SQL dump from a DB outage) is sanitized so
    // login failures can never leak query internals or enable enumeration.
    const safe = toSafeErrorMessage(e, GENERIC_INVALID_CREDENTIALS);
    const knownSafe = new Set([
      GENERIC_INVALID_CREDENTIALS,
      'This account has been deactivated or suspended',
      'This gym account has been suspended by the platform administrator',
      'This admin account has been deactivated or suspended',
    ]);
    return jsonErr(knownSafe.has(safe) ? safe : GENERIC_INVALID_CREDENTIALS, 401);
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
    const safe = toSafeErrorMessage(e, GENERIC_INVALID_CREDENTIALS);
    const knownSafe = new Set([
      GENERIC_INVALID_CREDENTIALS,
      'This account has been deactivated or suspended',
      'This gym account has been suspended by the platform administrator',
      'This admin account has been deactivated or suspended',
    ]);
    return jsonErr(knownSafe.has(safe) ? safe : GENERIC_INVALID_CREDENTIALS, 401);
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
    .prepare(`SELECT id, gymId, name, email FROM users WHERE LOWER(email) = ? AND deletedAt IS NULL LIMIT 1`)
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
    gymId: user.gymId,
    userId: user.id,
    tokenHash,
    expiresAt: expiresAt,
  });

  const emailService = new EmailService(
    ctx.env,
    await loadPlatformMsg91(ctx.env.DB)
  );
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
  const resetRecord: any = await resetRepo.findValidByTokenHash(tokenHash);
  if (!resetRecord) return jsonErr('Reset link is invalid or has expired.', 400);

  const resetGymId = resetRecord.gymId;
  const resetUserId = resetRecord.userId;

  const user: any = await ctx.env.DB
    .prepare(`SELECT id, name, email FROM users WHERE id = ? AND gymId = ? AND deletedAt IS NULL`)
    .bind(resetUserId, resetGymId)
    .first();
  if (!user) return jsonErr('Associated user account was not found', 404);

  const newHash = await hashPassword(newPassword);
  await resetRepo.consumeAndSetPassword({
    gymId: resetGymId,
    userId: resetUserId,
    resetId: resetRecord.id,
    passwordHash: newHash,
  });

  const emailService = new EmailService(
    ctx.env,
    await loadPlatformMsg91(ctx.env.DB)
  );
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

  // Validate member status before allowing login
  if (member.deletedAt !== null) {
    return jsonErr('Member account has been archived or deleted', 401);
  }
  if (member.status === 'BLOCKED') {
    return jsonErr('Member account is currently blocked by administrator', 403);
  }
  if (member.status === 'INACTIVE') {
    return jsonErr('Member account is inactive. Please contact the gym.', 403);
  }
  if (member.status === 'CANCELLED') {
    return jsonErr('Member account has been cancelled', 403);
  }

  const memberCode = member.memberCode ?? '';
  const phone = member.phone ?? '';
  const memberCodeMatches = memberCode.toUpperCase() === trimCode.toUpperCase();
  // phone can be NULL for portal-only imports; require at least 4 digits for suffix matching to prevent overly broad matches
  const phoneMatches = Boolean(phone && ((trimCode.length >= 4 && phone.endsWith(trimCode)) || phone === trimCode));
  const identMatchesCode = memberCode.toUpperCase() === trimIdent.toUpperCase();

  if (!memberCodeMatches && !phoneMatches && !identMatchesCode) {
    return jsonErr('Invalid verification credential.', 401);
  }

  const memberGymId = member.gymId;
  // M-17: Use shared repository helper instead of inline query.
  const memberRepo = new MemberRepository(ctx.env.DB, memberGymId);
  const activeMembership = await memberRepo.getActiveMembership(member.id);

  const authService = new AuthService(ctx.env.DB, ctx.env.JWT_SECRET, ctx.env.APP_URL);
  const { token, refreshToken } = await authService.signMemberToken({
    id: member.id, gymId: memberGymId, memberCode,
    phone, name: `${member.firstName} ${member.lastName ?? ''}`.trim(),
  });

  const csrf = generateCsrfToken();
  return jsonOk(
    {
      token,
      refreshToken,
      member: {
        id: member.id, gymId: memberGymId, memberCode,
        firstName: member.firstName, lastName: member.lastName,
        email: member.email, phone, photoUrl: member.photoUrl,
        status: member.status, joinedDate: member.joinedDate,
      },
      activeMembership: activeMembership || null,
      gym: { id: memberGymId, name: member.gymName, slug: member.gymSlug },
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

  // Map raw rows onto the camelCase contracts the portal renders
  const ms = (memberships as any[]).map((m: any) => ({
    id: m.id,
    gymId: m.gymId,
    memberId: m.memberId,
    membershipPlanId: m.membershipPlanId,
    startDate: m.startDate,
    endDate: m.endDate,
    totalAmountPaise: m.totalAmountPaise,
    discountPaise: m.discountPaise,
    finalAmountPaise: m.finalAmountPaise,
    paidAmountPaise: m.paidAmountPaise,
    dueAmountPaise: m.dueAmountPaise,
    status: m.status,
    frozenAt: m.frozenAt,
    notes: m.notes,
    planName: m.planName,
    durationMonths: m.durationMonths,
  }));
  const activeMembership = ms.find((m) => m.status === 'ACTIVE') || ms[0] || null;

  return jsonOk({
    member: {
      id: member.id,
      gymId: member.gymId,
      memberCode: member.memberCode,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      gender: member.gender,
      photoUrl: member.photoUrl,
      status: member.status,
      joinedDate: member.joinedDate,
    },
    activeMembership,
    memberships: ms,
    payments: (payments as any[]).map((p: any) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      amountPaise: p.amountPaise,
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      status: p.status,
      notes: p.notes,
    })),
    attendance: (attendance as any[]).map((a: any) => ({
      id: a.id,
      checkInTime: a.checkInTime,
      attendanceDate: a.attendanceDate,
      method: a.method,
    })),
    gym: {
      name: member.gymName,
      address: member.gymAddress,
      phone: member.gymPhone,
    },
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
      buildClearCsrfCookie(ctx.env.APP_ENV),
    ]
  );
}));