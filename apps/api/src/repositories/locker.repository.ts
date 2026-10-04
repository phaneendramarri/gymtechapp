import { eq, and, sql, isNull } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database } from '../db/client';
import { createDatabase } from '../db/client';
import { lockers, lockerAllocations, members } from '../db/schema';
import type { Locker, LockerAllocation } from '@gymtech/shared';

export class LockerRepository {
  private db: Database;

  constructor(d1OrDb: Database | D1Database, private gymId?: number) {
    this.db = (d1OrDb as any).prepare ? createDatabase(d1OrDb as D1Database) : (d1OrDb as Database);
  }

  private resolveGymId(explicitGymId?: number): number {
    const id = explicitGymId ?? this.gymId;
    if (!id) throw new Error('gymId must be provided in constructor or method call');
    return id;
  }

  async listLockers(gymId?: number): Promise<Locker[]> {
    const targetGymId = this.resolveGymId(gymId);
    const lockerRows = await this.db
      .select()
      .from(lockers)
      .where(and(eq(lockers.gymId, targetGymId), isNull(lockers.deletedAt)))
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
      .innerJoin(members, and(eq(lockerAllocations.memberId, members.id), eq(members.gymId, targetGymId), isNull(members.deletedAt)))
      .where(and(eq(lockerAllocations.gymId, targetGymId), eq(lockerAllocations.status, 'ACTIVE'), isNull(lockerAllocations.deletedAt)));

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
    const targetGymId = this.resolveGymId(gymId);
    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await this.db
      .insert(lockers)
      .values({
        gymId: targetGymId,
        lockerNumber: data.lockerNumber,
        zone: data.zone ?? null,
        status: 'AVAILABLE',
        createdAt: now,
      })
      .returning({ id: lockers.id });
    return inserted.id;
  }

  async deleteLocker(gymId: number, id: number): Promise<void> {
    const targetGymId = this.resolveGymId(gymId);
    const now = Math.floor(Date.now() / 1000);
    // Refuse while any active allocation row references it — terminate them first.
    const refs = await this.db
      .select({ id: lockerAllocations.id })
      .from(lockerAllocations)
      .where(and(eq(lockerAllocations.gymId, targetGymId), eq(lockerAllocations.lockerId, id), eq(lockerAllocations.status, 'ACTIVE')))
      .limit(1);
    if (refs.length > 0) {
      throw new Error('Locker cannot be deleted while allocations reference it. Terminate them first.');
    }
    await this.db
      .update(lockers)
      .set({ deletedAt: now })
      .where(and(eq(lockers.gymId, targetGymId), eq(lockers.id, id), isNull(lockers.deletedAt)));
  }

  async allocateLocker(
    gymId: number,
    data: { lockerId: number; memberId: number; startDate: string; endDate: string; depositPaise: number; rentPaise: number }
  ): Promise<number> {
    const targetGymId = this.resolveGymId(gymId);
    const now = Math.floor(Date.now() / 1000);

    // Guard: refuse to double-book an already-occupied locker
    const locker = await this.db
      .select({ id: lockers.id, status: lockers.status })
      .from(lockers)
      .where(and(eq(lockers.gymId, targetGymId), eq(lockers.id, data.lockerId), isNull(lockers.deletedAt)))
      .get();
    if (!locker) throw new Error('Locker not found');
    const active = await this.db
      .select({ id: lockerAllocations.id })
      .from(lockerAllocations)
      .where(and(eq(lockerAllocations.gymId, targetGymId), eq(lockerAllocations.lockerId, data.lockerId), eq(lockerAllocations.status, 'ACTIVE')))
      .get();
    if (active) throw new Error('Locker is already occupied');

    const [alloc] = await this.db
      .insert(lockerAllocations)
      .values({
        gymId: targetGymId,
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
      .where(and(eq(lockers.gymId, targetGymId), eq(lockers.id, data.lockerId)));

    return alloc.id;
  }

  async terminateAllocation(gymId: number, allocationId: number): Promise<void> {
    const targetGymId = this.resolveGymId(gymId);
    const alloc = await this.db
      .select()
      .from(lockerAllocations)
      .where(and(eq(lockerAllocations.gymId, targetGymId), eq(lockerAllocations.id, allocationId)))
      .get();

    if (!alloc) throw new Error('Allocation not found');

    await this.db
      .update(lockerAllocations)
      .set({ status: 'TERMINATED' })
      .where(and(eq(lockerAllocations.gymId, targetGymId), eq(lockerAllocations.id, allocationId)));

    // Mark locker available
    await this.db
      .update(lockers)
      .set({ status: 'AVAILABLE' })
      .where(and(eq(lockers.gymId, targetGymId), eq(lockers.id, alloc.lockerId)));
  }
}
