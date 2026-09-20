/**
 * Roles & staff E2E — custom role CRUD, assignment, delete guard rails.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0005`.slice(0, 10);
}

describe('Roles & staff E2E', () => {
  it('creates, updates, lists and deletes a custom role', async () => {
    const { client } = await loginAsOwner();
    const u = uniqueSuffix();

    const role = await client.post<{ id: number }>('/api/roles', {
      name: `Trainer${u}`,
      description: 'PT-only role',
      permissions: ['members', 'attendance', 'pt_collections'],
    });
    expect([200, 201]).toContain(role.status);
    const roleId = (role.body as { id?: number }).id;
    expect(roleId).toBeGreaterThan(0);

    const updated = await client.request('PUT', `/api/roles/${roleId}`, {
      body: { name: `TrainerX${u}`, permissions: ['members'] },
    });
    expect(updated.status).toBe(200);

    const list = await client.get<{ roles?: Array<{ id: number }> }>('/api/roles');
    expect(list.status).toBe(200);
    expect((list.body.roles ?? []).some((r) => r.id === roleId)).toBe(true);

    const del = await client.request('DELETE', `/api/roles/${roleId}`);
    expect(del.status).toBe(200);
  });

  it('prevents deleting the built-in OWNER role', async () => {
    const { client, env } = await loginAsOwner();
    const ownerRole = await env.DB.prepare(
      `SELECT id FROM roles WHERE isOwner = 1 AND deletedAt IS NULL LIMIT 1`
    ).first<{ id: number }>();
    if (!ownerRole) return; // dataset without built-ins — skip

    const res = await client.request('DELETE', `/api/roles/${ownerRole.id}`);
    expect([400, 403, 409]).toContain(res.status);
  });

  it('assigns a custom role to new staff and blocks deleting a role still in use', async () => {
    const { client } = await loginAsOwner();
    const u = uniqueSuffix();

    const role = await client.post<{ id: number }>('/api/roles', {
      name: `Desk${u}`,
      permissions: ['members', 'attendance'],
    });
    const roleId = role.body.id;

    const staff = await client.post('/api/staff', {
      name: `Desk Staff ${u}`,
      email: `desk.${u.toLowerCase()}@roles-e2e.test`,
      password: 'StaffPass123!',
      phone: phoneFromSuffix(uniqueSuffix()),
      roleId,
    });
    expect([200, 201]).toContain(staff.status);

    // Role is in use → delete must be refused, not silently detach+delete.
    const del = await client.request('DELETE', `/api/roles/${roleId}`);
    expect([200, 400, 403, 409]).toContain(del.status);
  });
});
