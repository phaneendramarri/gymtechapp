import { describe, it, expect } from 'vitest';
import { parsePageParams, toSafeErrorMessage, parseQueryInt, queryId } from '../../apps/api/src/routes/helpers';
import { paramId } from '../../apps/api/src/middleware/params';
import { CreateGymRequestSchema, ALL_FEATURES_ENABLED_JSON } from '../../packages/shared/src/contracts';
import { parseEnabledFeatures } from '../../apps/api/src/lib/features';
import { GYM_FEATURES } from '../../packages/shared/src/constants';

describe('audit fixes', () => {
  it('parsePageParams falls back on non-numeric input', () => {
    expect(parsePageParams('abc', 'xyz', 'members')).toEqual({ limit: 50, offset: 0 });
    expect(parsePageParams('9999', '-5')).toEqual({ limit: 100, offset: 0 });
  });
  it('paramId rejects trailing-garbage ids', () => {
    expect(() => paramId({ id: '12abc' })).toThrow();
    expect(() => paramId({ id: '' })).toThrow();
    expect(paramId({ id: '42' })).toBe(42);
  });
  it('new gyms default to all features enabled', () => {
    const parsed = CreateGymRequestSchema.safeParse({
      gymName: 'G', slug: 'g', gymPhone: '9999999999', licenseName: 'P',
      licenseCode: 'P', ownerName: 'O', ownerEmail: 'o@x.com',
      ownerPhone: '9999999999', ownerPassword: 'secret1',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parseEnabledFeatures(parsed.data.features)).toEqual([...GYM_FEATURES]);
      expect(parsed.data.features).toBe(ALL_FEATURES_ENABLED_JSON);
    }
  });
  it('queryId strict-parses id filters', () => {
    expect(queryId(undefined, 'memberId')).toBeUndefined();
    expect(queryId('', 'memberId')).toBeUndefined();
    expect(queryId('42', 'memberId')).toBe(42);
    expect(() => queryId('abc', 'memberId')).toThrow();
    expect(() => queryId('12abc', 'memberId')).toThrow();
    expect(() => queryId('0', 'memberId')).toThrow();
  });
  it('parseQueryInt falls back on garbage dates/limits', () => {
    expect(parseQueryInt(undefined, 0)).toBe(0);
    expect(parseQueryInt('abc', 0)).toBe(0);
    expect(parseQueryInt('12abc', 100)).toBe(100);
    expect(parseQueryInt('250', 100)).toBe(250);
  });
  it('sanitizes driver internals', () => {
    const drizzle = 'Failed query: select "users"."id" from "users" where params: a,1';
    expect(toSafeErrorMessage(new Error(drizzle), 'Fallback')).toBe('Fallback');
    expect(toSafeErrorMessage(new Error('Member not found'), 'Fallback')).toBe('Member not found');
    expect(toSafeErrorMessage(new Error('UNIQUE constraint failed: users.email'), 'Fallback')).toBe(
      'A record with these details already exists.'
    );
  });
});
