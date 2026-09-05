import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import { communicationLogs } from '../db/schema';
import type { CommunicationLogRow } from '@gymtech/shared';

export interface ListCommunicationLogsOptions {
  channel?: 'SMS' | 'WHATSAPP' | 'EMAIL';
  limit?: number;
  offset?: number;
}

export interface ListCommunicationLogsResult {
  logs: CommunicationLogRow[];
  total: number;
}

export class CommunicationRepository {
  private db: Database;

  constructor(db: Database | D1Database, private gymId: number) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async list(opts: ListCommunicationLogsOptions = {}): Promise<ListCommunicationLogsResult> {
    const { channel, limit = 50, offset = 0 } = opts;

    const conditions = [eq(communicationLogs.gymId, this.gymId)];
    if (channel) conditions.push(eq(communicationLogs.channel, channel));

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(communicationLogs)
        .where(where)
        .orderBy(desc(communicationLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(communicationLogs)
        .where(where),
    ]);

    return {
      logs: rows as CommunicationLogRow[],
      total: countResult[0]?.count ?? 0,
    };
  }
}
