import { Browser, BrowserContext, Page } from '@playwright/test';

// The API rate-limits per IP (auth 10/min, write 120/min, read 600/min).
// Chromium tests all originate from 127.0.0.1, so every spec mints its own
// client IP via the CF-Connecting-IP header — the same isolation the
// integration harness uses. Without this, unrelated tests consume each
// other's budgets and flake with 429s.
//
// The second octet is randomised per run because the limiter's state is
// KV-backed and outlives the process: a fixed address sequence would reuse the
// previous run's buckets and fail with inherited 429s.
const RUN_PREFIX = 180 + Math.floor(Math.random() * 60);
let ipCounter = 10;

export function nextTestIp(): string {
  ipCounter += 1;
  return `10.${RUN_PREFIX}.${Math.floor(ipCounter / 254)}.${(ipCounter % 254) + 1}`;
}

export async function isolatedContext(
  browser: Browser,
  opts: { storageState?: string; ip?: string } = {}
): Promise<{ context: BrowserContext; page: Page; ip: string }> {
  const ip = opts.ip ?? nextTestIp();
  const context = await browser.newContext({
    ...(opts.storageState ? { storageState: opts.storageState } : {}),
    extraHTTPHeaders: { 'CF-Connecting-IP': ip },
  });
  const page = await context.newPage();
  return { context, page, ip };
}

export const OWNER_STATE = 'tests/e2e-live/.auth/owner.json';
export const ADMIN_STATE = 'tests/e2e-live/.auth/admin.json';

export interface TestMember {
  id: number;
  memberCode: string;
  phone: string;
  firstName: string;
}

/** Double-submit CSRF header, read from the context's own cookie jar. */
export async function csrfHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const csrf = (await context.cookies()).find((c) => c.name === 'gym_csrf')?.value;
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

let phoneCounter = 0;

/**
 * Enroll a member through the same API call the New Member form makes.
 *
 * Specs must never depend on a member id or `MEM-…` code from an earlier run:
 * codes are minted from a counter and the local database outlives the process,
 * so a hardcoded code silently points at a member that no longer exists.
 * Creating the subject of the test keeps every spec self-contained.
 */
export async function createMember(
  context: BrowserContext,
  overrides: Partial<TestMember> & { planId?: number } = {}
): Promise<TestMember> {
  const planId = overrides.planId ?? (await firstPlanId(context));
  phoneCounter += 1;
  const phone = overrides.phone ?? `9${String(Date.now()).slice(-8)}${phoneCounter % 10}`;
  const firstName = overrides.firstName ?? 'E2E Member';

  const res = await context.request.post('/api/members', {
    headers: await csrfHeaders(context),
    data: {
      firstName,
      lastName: 'Live',
      phone,
      planId,
      initialPaymentPaise: 0,
      paymentMode: 'CASH',
    },
  });
  if (!res.ok()) {
    throw new Error(`member create failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as { member: { id: number; memberCode: string; phone: string; firstName: string } };
  return {
    id: body.member.id,
    memberCode: body.member.memberCode,
    phone: body.member.phone,
    firstName: body.member.firstName ?? firstName,
  };
}

/** Id of the gym's oldest active plan — the fixture every new member needs. */
export async function firstPlanId(context: BrowserContext): Promise<number> {
  const res = await context.request.get('/api/plans');
  const body = (await res.json()) as { plans?: Array<{ id: number }> };
  const planId = body.plans?.[0]?.id;
  if (!planId) throw new Error('no membership plan exists — run pnpm db:seed:local');
  return planId;
}

/** Id of the signed-in staff user, for flows that need a trainer/subject id. */
export async function currentUserId(context: BrowserContext): Promise<number> {
  const res = await context.request.get('/api/auth/me');
  const body = (await res.json()) as { user?: { id: number } };
  const id = body.user?.id;
  if (!id) throw new Error('could not resolve the signed-in user id');
  return id;
}
