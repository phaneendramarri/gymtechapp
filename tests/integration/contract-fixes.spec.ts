/**
 * Contract-fix regression tests.
 *
 * Background: five UI flows called endpoints that didn't exist (404 on click).
 * These specs pin the canonical REST surface the frontend uses so the breaks
 * cannot silently return:
 *   GET  /api/classes/bookings?scheduleId=&bookingDate=   (roster, date-scoped)
 *   POST /api/classes/bookings                            (book, date-scoped capacity)
 *   POST /api/classes/bookings/:id/cancel
 *   POST /api/lockers/allocations/:id/terminate           (release locker)
 *   GET  /api/expenses/pnl                                (P&L statement)
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

/** Day-of-week index (0=Sun..6=Sat) for a YYYY-MM-DD date string. */
function dayIndex(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

describe('Class bookings — flat REST surface', () => {
  it('books a member, lists the date-scoped roster, and cancels', async () => {
    const { client } = await loginAsOwner();
    const suffix = uniqueSuffix();

    const cls = await client.post<{ id: number }>('/api/classes', {
      name: `Contract Fix Class ${suffix}`,
      durationMinutes: 45,
      maxCapacity: 12,
      color: '#22c55e',
    });
    expect(cls.status).toBe(201);

    // Capacity 1 so the second same-day booking must land on the waitlist.
    const schedule = await client.post<{ id: number }>('/api/classes/schedules', {
      classId: cls.body.id,
      dayOfWeek: dayIndex('2026-01-05'),
      startTime: '07:00',
      endTime: '07:45',
      maxCapacity: 1,
    });
    expect(schedule.status).toBe(201);

    const membersRes = await client.get<{ members: Array<{ id: number }> }>('/api/members?limit=2');
    expect(membersRes.status).toBe(200);
    const [m1, m2] = membersRes.body.members;
    if (!m1 || !m2) return; // dataset lacks fixtures — skip

    const bookingDate = '2026-01-05';

    const b1 = await client.post<{ id: number; bookingStatus: string }>('/api/classes/bookings', {
      scheduleId: schedule.body.id,
      memberId: m1.id,
      bookingDate,
    });
    expect(b1.status).toBe(201);
    expect(b1.body.bookingStatus).toBe('BOOKED');

    const b2 = await client.post<{ id: number; bookingStatus: string }>('/api/classes/bookings', {
      scheduleId: schedule.body.id,
      memberId: m2.id,
      bookingDate,
    });
    expect(b2.status).toBe(201);
    expect(b2.body.bookingStatus).toBe('WAITLIST');

    const roster = await client.get<{ bookings: Array<{ id: number; memberId: number; status: string }> }>(
      `/api/classes/bookings?scheduleId=${schedule.body.id}&bookingDate=${bookingDate}`
    );
    expect(roster.status).toBe(200);
    const byMember = new Map(roster.body.bookings.map((b) => [b.memberId, b.status]));
    expect(byMember.get(m1.id)).toBe('BOOKED');
    expect(byMember.get(m2.id)).toBe('WAITLIST');

    // A different day has no bookings for this schedule.
    const otherDay = await client.get<{ bookings: unknown[] }>(
      `/api/classes/bookings?scheduleId=${schedule.body.id}&bookingDate=2026-01-06`
    );
    expect(otherDay.status).toBe(200);
    expect(otherDay.body.bookings).toHaveLength(0);

    const cancel = await client.post(`/api/classes/bookings/${b1.body.id}/cancel`);
    expect(cancel.status).toBe(200);

    const rosterAfter = await client.get<{ bookings: Array<{ id: number; status: string }> }>(
      `/api/classes/bookings?scheduleId=${schedule.body.id}&bookingDate=${bookingDate}`
    );
    expect(rosterAfter.status).toBe(200);
    const cancelled = rosterAfter.body.bookings.find((b) => b.id === b1.body.id);
    expect(cancelled?.status).toBe('CANCELLED');
  });
});

describe('Locker release and P&L — canonical paths', () => {
  it('releases an allocated locker via POST /terminate', async () => {
    const { client, env } = await loginAsOwner();

    const member = await env.DB.prepare(
      `SELECT id FROM members WHERE deletedAt IS NULL ORDER BY id ASC LIMIT 1`
    ).first<{ id: number }>();
    if (!member) return; // dataset lacks fixtures — skip

    const suffix = uniqueSuffix();
    const locker = await client.post<{ id: number }>('/api/lockers', {
      lockerNumber: `CF-${suffix}`,
      zone: 'A',
    });
    expect(locker.status).toBe(201);

    const alloc = await client.post<{ id: number }>('/api/lockers/allocate', {
      lockerId: locker.body.id,
      memberId: member.id,
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      depositPaise: 50000,
      rentPaise: 20000,
    });
    expect(alloc.status).toBe(201);

    const release = await client.post(`/api/lockers/allocations/${alloc.body.id}/terminate`);
    expect(release.status).toBe(200);

    const lockers = await client.get<{ lockers: Array<{ id: number; status: string }> }>('/api/lockers');
    const released = lockers.body.lockers.find((l) => l.id === locker.body.id);
    expect(released?.status).toBe('AVAILABLE');
  });

  it('resolves members by code via GET /api/members/lookup regardless of paging', async () => {
    const { client, env } = await loginAsOwner();

    // Oldest member — sits beyond any 100-row page, which broke client-side lookups before.
    const row = await env.DB.prepare(
      `SELECT memberCode FROM members WHERE deletedAt IS NULL ORDER BY memberCode ASC LIMIT 1`
    ).first<{ memberCode: string }>();
    if (!row) return; // dataset lacks fixtures — skip

    const res = await client.get<{ member: { id: number; memberCode: string } }>(
      `/api/members/lookup?identifier=${encodeURIComponent(row.memberCode)}`
    );
    expect(res.status).toBe(200);
    expect(res.body.member.memberCode.toLowerCase()).toBe(row.memberCode.toLowerCase());

    const miss = await client.get('/api/members/lookup?identifier=NOPE-404');
    expect(miss.status).toBe(404);
  });

  it('creates a PT package and logs a session through the real columns', async () => {
    const { client, env } = await loginAsOwner();

    const member = await env.DB.prepare(
      `SELECT id FROM members WHERE deletedAt IS NULL ORDER BY id ASC LIMIT 1`
    ).first<{ id: number }>();
    const trainer = await env.DB.prepare(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.roleId AND r.name = 'TRAINER'
       WHERE u.gymId = (SELECT gymId FROM users WHERE email = ?) AND u.deletedAt IS NULL
       ORDER BY u.id ASC LIMIT 1`
    ).bind('owner@gymtech.app').first<{ id: number }>();
    if (!member || !trainer) return; // dataset lacks fixtures — skip

    const pkg = await client.post<{ id: number }>('/api/pt/packages', {
      memberId: member.id,
      trainerId: trainer.id,
      packageName: 'Audit Package',
      totalSessions: 2,
      amountPaise: 500000,
    });
    expect(pkg.status).toBe(201);

    // Listing must return the camelCase contract (no raw snake_case leak).
    const list = await client.get<{ packages: Array<Record<string, unknown>> }>('/api/pt/packages');
    expect(list.status).toBe(200);
    const created = list.body.packages.find((p) => p.id === pkg.body.id);
    expect(created).toBeDefined();
    expect(created!.packageName).toBe('Audit Package');
    expect(created!.usedSessions).toBe(0);
    expect(created!.completedSessions).toBe(0);
    expect((created as any).package_name).toBeUndefined();

    // Out-of-gym trainer must be refused (tenant isolation on the package owner).
    const otherTrainer = await env.DB.prepare(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.roleId
       WHERE u.gymId <> (SELECT gymId FROM users WHERE email = ?) AND u.deletedAt IS NULL
       ORDER BY u.id ASC LIMIT 1`
    ).bind('owner@gymtech.app').first<{ id: number }>();
    if (otherTrainer) {
      const cross = await client.post('/api/pt/packages', {
        memberId: member.id,
        trainerId: otherTrainer.id,
        totalSessions: 4,
        amountPaise: 400000,
      });
      expect(cross.status).toBe(404);
    }

    // Log sessions until completion.
    const s1 = await client.post<{ id: number; remainingSessions: number }>('/api/pt/sessions', {
      packageId: pkg.body.id,
      sessionNotes: 'Leg day',
    });
    expect(s1.status).toBe(201);
    expect(s1.body.remainingSessions).toBe(1);

    const s2 = await client.post<{ id: number; remainingSessions: number }>('/api/pt/sessions', {
      packageId: pkg.body.id,
      sessionNotes: 'Pull day',
    });
    expect(s2.status).toBe(201);
    expect(s2.body.remainingSessions).toBe(0);

    // Package is complete — a third session must be refused.
    const s3 = await client.post('/api/pt/sessions', { packageId: pkg.body.id });
    expect(s3.status).toBe(400);

    const after = await client.get<{ sessions: Array<Record<string, unknown>> }>(
      `/api/pt/sessions?packageId=${pkg.body.id}`
    );
    expect(after.status).toBe(200);
    expect(after.body.sessions).toHaveLength(2);
    expect(after.body.sessions[0]?.sessionNumber).toBeDefined();
    expect((after.body.sessions[0] as any)?.session_notes).toBeUndefined();
  });

  it('returns a P&L statement from GET /api/expenses/pnl', async () => {
    const { client } = await loginAsOwner();

    const res = await client.get<{
      revenuePaise: { memberships: number; pt: number; pos: number; total: number };
      expensesPaise: { byCategory: Array<{ category: string; amountPaise: number }>; total: number };
      netProfitPaise: number;
    }>('/api/expenses/pnl');
    expect(res.status).toBe(200);
    expect(typeof res.body.revenuePaise.total).toBe('number');
    expect(typeof res.body.expensesPaise.total).toBe('number');
    expect(res.body.revenuePaise.total).toBe(
      res.body.revenuePaise.memberships + res.body.revenuePaise.pt + res.body.revenuePaise.pos
    );
    expect(res.body.netProfitPaise).toBe(res.body.revenuePaise.total - res.body.expensesPaise.total);

    // Period filtering must be accepted and respected (revenue cannot exceed the all-time figure).
    const windowed = await client.get<{ revenuePaise: { total: number } }>(
      '/api/expenses/pnl?from=2026-01-01&to=2026-01-31'
    );
    expect(windowed.status).toBe(200);
    expect(windowed.body.revenuePaise.total).toBeLessThanOrEqual(res.body.revenuePaise.total);
  });
});
