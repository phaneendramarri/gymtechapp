// filepath: apps/api/src/scheduled.ts
/**
 * Cloudflare Workers Cron Trigger handlers.
 *
 * Scheduled by `triggers.crons` in wrangler.jsonc:
 *   - "0 * * * *"  — hourly: license expiry sweep, PT-freeze expiry sweep
 *   - "0 2 * * *"  — daily 02:00 UTC: comms retention purge, invoice generation, attendance rollups
 *
 * Each job MUST:
 *   1. Catch and log its own errors (no throw — one bad job must not
 *      poison the others).
 *   2. Be idempotent (cron may retry on transient failure).
 *   3. Finish within the Worker CPU-time budget (~30s on standard plan).
 *
 * Heavy work belongs in `services/`; this file just orchestrates.
 */
import type { ExecutionContext } from '@cloudflare/workers-types';
import type { WorkerEnv } from './worker';
import { createDatabase } from './db/client';
import { gyms } from './db/schema';
import { eq } from 'drizzle-orm';

export interface ScheduledEvent {
  /** Cron expression that fired this handler, e.g. "0 * * * *". */
  cron: string;
  /** Unix timestamp (ms) when the trigger fired. */
  scheduledTime: number;
}

type Job = (env: WorkerEnv, event: ScheduledEvent) => Promise<void>;

/**
 * List all active gym IDs. Used as the iteration set for tenant-scoped
 * cron jobs so each gym is processed independently.
 */
async function listActiveGymIds(env: WorkerEnv): Promise<number[]> {
  const db = createDatabase(env.DB);
  const rows = await db
    .select({ id: gyms.id })
    .from(gyms)
    .where(eq(gyms.status, 'ACTIVE'))
    .all();
  return rows.map((r) => r.id);
}

/** Hourly sweep — license expiry, PT-freeze expiry. */
const hourlyJobs: Job[] = [
  async (env, event) => {
    console.log('[scheduled] hourly sweep start', {
      cron: event.cron,
      ts: event.scheduledTime,
    });
    const ids = await listActiveGymIds(env);
    const { LicenseService } = await import('./services/license.service');
    for (const gymId of ids) {
      try {
        const svc = new LicenseService(env.DB, gymId);
        const result = await svc.sweepExpiries();
        if (result.expiredLicenses > 0 || result.expiredMemberships > 0 || result.expiredMembers > 0) {
          console.log(`[scheduled] gym ${gymId} sweep completed:`, result);
        }
      } catch (err) {
        console.error('[scheduled] license sweep failed for gym', gymId, err);
      }
    }
  },
];

/** Daily batch — retention purge, invoice generation, attendance rollups. */
const dailyJobs: Job[] = [
  async (env, event) => {
    console.log('[scheduled] daily jobs start', {
      cron: event.cron,
      ts: event.scheduledTime,
    });
    // GDPR retention: delete communication logs past their retention window.
    // Invoices + attendance rollups arrive with their tables in later phases.
    const { CommunicationRepository } = await import('./repositories/communication.repository');
    const nowUnix = Math.floor(Date.now() / 1000);
    const ids = await listActiveGymIds(env);
    for (const gymId of ids) {
      try {
        const purged = await new CommunicationRepository(env.DB).purgeExpired(gymId, nowUnix);
        if (purged > 0) console.log(`[scheduled] gym ${gymId}: purged ${purged} expired comms logs`);
      } catch (err) {
        console.error('[scheduled] comms retention purge failed for gym', gymId, err);
      }
    }
  },
];

export default {
  async scheduled(
    event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const isHourly = event.cron === '0 * * * *';
    const jobs = isHourly ? hourlyJobs : dailyJobs;

    // waitUntil lets us return immediately but keep the Worker alive
    // until all jobs finish (or hit the 30s CPU budget).
    ctx.waitUntil(
      (async () => {
        for (const job of jobs) {
          try {
            await job(env, event);
          } catch (err) {
            console.error('[scheduled] job threw', { cron: event.cron, err });
          }
        }
      })()
    );
  },
};