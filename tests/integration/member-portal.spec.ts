/**
 * Member-portal session authorization.
 *
 * A member session is a third principal type: its `id` is a `members.id`, not a
 * `users.id`, and it must never reach the gym-wide ledger. These specs pin that
 * boundary, because the portal screen cannot prove it on its own — the PT tab
 * rendered an empty state for months precisely because a member session was
 * treated as a trainer and scoped to `trainer_user_id = <member id>`.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { ApiClient, getTestEnv, loginAsOwner, setupHarnessTeardown } from './harness';

setupHarnessTeardown();

const GYM_SLUG = 'gymtech-club';
const BOOKING_DATE = '2026-03-02';

interface PortalMember {
  id: number;
  memberCode: string;
  phone: string;
  firstName: string;
}

/** Enroll a member through the same endpoint the New Member form uses. */
async function createMember(
  client: ApiClient,
  planId: number
): Promise<PortalMember> {
  const res = await client.post<{ member: PortalMember }>('/api/members', {
    firstName: `Portal ${Date.now().toString().slice(-6)}`,
    lastName: 'Member',
    phone: `9${String(Date.now()).slice(-9)}`,
    planId,
    initialPaymentPaise: 0,
    paymentMode: 'CASH',
  });
  expect(res.status).toBe(201);
  return res.body.member;
}

/** Sign in as a member and return the session's cookie jar. */
async function loginAsMember(member: PortalMember): Promise<ApiClient> {
  const env = await getTestEnv();
  const client = new ApiClient(env);
  const res = await client.post('/api/auth/member-login', {
    gymSlug: GYM_SLUG,
    identifier: member.phone,
    codeOrPin: member.memberCode,
  });
  expect(res.status).toBe(200);
  return client;
}

describe('Member portal — session scoping', () => {
  it('reads its own PT package and sessions, and only its own', async () => {
    const { client: owner } = await loginAsOwner();
    const planId = (await owner.get<{ plans: Array<{ id: number }> }>('/api/plans')).body.plans[0]!.id;
    const member = await createMember(owner, planId);
    const other = await createMember(owner, planId);

    const pkg = await owner.post<{ id: number }>('/api/pt/packages', {
      memberId: member.id,
      trainerId: 1,
      packageName: 'Portal Scoping Pack',
      totalSessions: 5,
      amountPaise: 100000,
      startDate: '2026-01-01',
      expiryDate: '2026-12-31',
    });
    expect(pkg.status).toBe(201);
    await owner.post('/api/pt/sessions', {
      packageId: pkg.body.id,
      sessionDate: '2026-01-10',
      sessionNotes: 'scoping baseline',
    });

    const memberClient = await loginAsMember(member);

    // Own data — and `?memberId=` pointing at someone else must not widen it.
    const own = await memberClient.get<{ packages: Array<{ memberId: number; packageName: string }> }>(
      `/api/pt/packages?memberId=${other.id}`
    );
    expect(own.status).toBe(200);
    expect(own.body.packages.map((p) => p.packageName)).toContain('Portal Scoping Pack');
    expect(own.body.packages.every((p) => p.memberId === member.id)).toBe(true);

    const sessions = await memberClient.get<{ sessions: Array<{ notes: string }> }>(
      `/api/pt/sessions?memberId=${other.id}`
    );
    expect(sessions.status).toBe(200);
    expect(sessions.body.sessions.map((s) => s.notes)).toContain('scoping baseline');
  });

  it('cannot reach the gym PT ledger, member directory, attendance or invoices', async () => {
    const { client: owner } = await loginAsOwner();
    const planId = (await owner.get<{ plans: Array<{ id: number }> }>('/api/plans')).body.plans[0]!.id;
    const member = await createMember(owner, planId);
    const memberClient = await loginAsMember(member);

    // Money and staff surfaces.
    expect((await memberClient.get('/api/pt/collections')).status).toBe(403);
    expect((await memberClient.get('/api/pt/summary')).status).toBe(403);
    expect((await memberClient.get('/api/members?limit=1')).status).toBe(403);
    expect((await memberClient.get('/api/dashboard')).status).toBe(403);

    // Attendance is recorded by staff/kiosk terminals, never by the member.
    const checkIn = await memberClient.post('/api/attendance/check-in', {
      memberIdOrCode: member.memberCode,
      method: 'MANUAL',
    });
    expect(checkIn.status).toBe(403);

    // Another member's invoice/receipt by id.
    const payments = await owner.get<{ items: Array<{ id: number }> }>('/api/payments?limit=1');
    const paymentId = payments.body.items?.[0]?.id;
    if (paymentId) {
      expect((await memberClient.get(`/api/payments/${paymentId}/invoice`)).status).toBe(403);
      expect((await memberClient.get(`/api/payments/${paymentId}/receipt`)).status).toBe(403);
    }
  });

  it('sees the class timetable and books only itself', async () => {
    const { client: owner } = await loginAsOwner();
    const planId = (await owner.get<{ plans: Array<{ id: number }> }>('/api/plans')).body.plans[0]!.id;
    const member = await createMember(owner, planId);
    const other = await createMember(owner, planId);

    const cls = await owner.post<{ id: number }>('/api/classes', {
      name: `Portal Class ${Date.now().toString().slice(-6)}`,
      durationMinutes: 45,
      maxCapacity: 5,
      color: '#0ea5e9',
    });
    const schedule = await owner.post<{ id: number }>('/api/classes/schedules', {
      classId: cls.body.id,
      dayOfWeek: 1,
      startTime: '06:00',
      endTime: '06:45',
      maxCapacity: 5,
    });

    const memberClient = await loginAsMember(member);
    const timetable = await memberClient.get<{ schedules: Array<{ id: number }> }>('/api/classes/schedules');
    expect(timetable.status).toBe(200);
    expect(timetable.body.schedules.length).toBeGreaterThan(0);

    // The body asks for someone else; the session wins.
    const booking = await memberClient.post<{ id: number; bookingStatus: string }>('/api/classes/bookings', {
      scheduleId: schedule.body.id,
      memberId: other.id,
      bookingDate: BOOKING_DATE,
    });
    expect(booking.status).toBe(201);

    const roster = await owner.get<{ bookings: Array<{ memberId: number }> }>(
      `/api/classes/bookings?scheduleId=${schedule.body.id}&bookingDate=${BOOKING_DATE}`
    );
    const booked = roster.body.bookings.find((b) => b.memberId);
    expect(booked?.memberId).toBe(member.id);
    expect(roster.body.bookings.some((b) => b.memberId === other.id)).toBe(false);
  });
});
