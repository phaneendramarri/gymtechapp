import { eq, and, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { lockers, lockerAllocations, members } from '../db/schema';
import type { Locker, LockerAllocation } from '@gymtech/shared';

export class LockerRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listLockers(gymId: number): Promise<Locker[]> {
    const lockerRows = await this.db
      .select()
      .from(lockers)
      .where(eq(lockers.gymId, gymId))
      .orderBy(lockers.lockerNumber);

    // Get active allocations
    const activeAllocations = await this.db
      .select({
        id: lockerAllocations.id,
        gymId: lockerAllocations.gymId,
        lockerId: lockerAllocations.lockerId,
        memberId: lockerAllocations.memberId,
        memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
        memberCode: members.memberCode,
        startDate: lockerAllocations.startDate,
        endDate: lockerAllocations.endDate,
        depositPaise: lockerAllocations.depositPaise,
        rentPaise: lockerAllocations.rentPaise,
        status: lockerAllocations.status,
        createdAt: lockerAllocations.createdAt,
      })
      .from(lockerAllocations)
      .innerJoin(members, eq(lockerAllocations.memberId, members.id))
      .where(and(eq(lockerAllocations.gymId, gymId), eq(lockerAllocations.status, 'ACTIVE')));

    const allocMap = new Map<number, LockerAllocation>();
    for (const a of activeAllocations) {
      allocMap.set(a.lockerId, a as any);
    }

    return lockerRows.map((l) => ({
      id: l.id,
      gymId: l.gymId,
      lockerNumber: l.lockerNumber,
      zone: l.zone,
      status: l.status as any,
      currentAllocation: allocMap.get(l.id) ?? null,
      createdAt: l.createdAt,
    }));
  }

  async createLocker(gymId: number, data: { lockerNumber: string; zone?: string | null }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(lockers)
      .values({
        gymId,
        lockerNumber: data.lockerNumber,
        zone: data.zone ?? null,
        status: 'AVAILABLE',
        createdAt: now,
      })
      .returning({ id: lockers.id });
    return inserted.id;
  }

  async deleteLocker(gymId: number, id: number): Promise<void> {
    await this.db.delete(lockers).where(and(eq(lockers.gymId, gymId), eq(lockers.id, id)));
  }

  async allocateLocker(
    gymId: number,
    data: { lockerId: number; memberId: number; startDate: string; endDate: string; depositPaise: number; rentPaise: number }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [alloc] = await this.db
      .insert(lockerAllocations)
      .values({
        gymId,
        lockerId: data.lockerId,
        memberId: data.memberId,
        startDate: data.startDate,
        endDate: data.endDate,
        depositPaise: data.depositPaise,
        rentPaise: data.rentPaise,
        status: 'ACTIVE',
        createdAt: now,
      })
      .returning({ id: lockerAllocations.id });

    // Mark locker occupied
    await this.db
      .update(lockers)
      .set({ status: 'OCCUPIED' })
      .where(and(eq(lockers.gymId, gymId), eq(lockers.id, data.lockerId)));

    return alloc.id;
  }

  async terminateAllocation(gymId: number, allocationId: number): Promise<void> {
    const alloc = await this.db
      .select()
      .from(lockerAllocations)
      .where(and(eq(lockerAllocations.gymId, gymId), eq(lockerAllocations.id, allocationId)))
      .get();

    if (!alloc) throw new Error('Allocation not found');

    await this.db
      .update(lockerAllocations)
      .set({ status: 'TERMINATED' })
      .where(and(eq(lockerAllocations.gymId, gymId), eq(lockerAllocations.id, allocationId)));

    // Mark locker available
    await this.db
      .update(lockers)
      .set({ status: 'AVAILABLE' })
      .where(and(eq(lockers.gymId, gymId), eq(lockers.id, alloc.lockerId)));
  }
}
