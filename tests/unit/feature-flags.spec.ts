import { describe, it, expect } from 'vitest';
import { parseEnabledFeatures, isFeatureEnabled } from '../../apps/api/src/lib/features';
import { GYM_FEATURES } from '../../packages/shared/src/constants';

/**
 * Guard the license → feature-flag contract.
 *
 * `licenses.features` is the single source of truth for feature gating
 * (API `requireFeature` + the platform-admin toggles). The semantics below
 * are what keep legacy licenses working after gating became real.
 */
describe('parseEnabledFeatures', () => {
  it('treats a missing map as "all features enabled" (legacy default)', () => {
    expect(parseEnabledFeatures(null)).toEqual([...GYM_FEATURES]);
    expect(parseEnabledFeatures(undefined)).toEqual([...GYM_FEATURES]);
    expect(parseEnabledFeatures('')).toEqual([...GYM_FEATURES]);
  });

  it('treats an empty object as "all features enabled"', () => {
    expect(parseEnabledFeatures('{}')).toEqual([...GYM_FEATURES]);
  });

  it('treats unparsable JSON as "all features enabled" instead of throwing', () => {
    expect(parseEnabledFeatures('{not json')).toEqual([...GYM_FEATURES]);
    expect(parseEnabledFeatures('"a string"')).toEqual([...GYM_FEATURES]);
    expect(parseEnabledFeatures('[]')).toEqual([...GYM_FEATURES]);
  });

  it('returns exactly the keys explicitly set to true', () => {
    const raw = JSON.stringify({ members: true, payments: true, reports: false });
    expect(parseEnabledFeatures(raw)).toEqual(['members', 'payments']);
  });

  it('ignores unknown keys and non-boolean truthy values', () => {
    const raw = JSON.stringify({ members: true, not_a_feature: true, reports: 1 });
    expect(parseEnabledFeatures(raw)).toEqual(['members']);
  });

  it('supports disabling everything', () => {
    const disabled = Object.fromEntries(GYM_FEATURES.map((k) => [k, false]));
    expect(parseEnabledFeatures(JSON.stringify(disabled))).toEqual([]);
  });

  it('preserves catalog order regardless of JSON key order', () => {
    const raw = JSON.stringify({ reports: true, dashboard: true });
    expect(parseEnabledFeatures(raw)).toEqual(['dashboard', 'reports']);
  });
});

describe('isFeatureEnabled', () => {
  it('is true when the feature is explicitly enabled', () => {
    expect(isFeatureEnabled(JSON.stringify({ members: true }), 'members')).toBe(true);
  });

  it('is false when the map omits the feature', () => {
    expect(isFeatureEnabled(JSON.stringify({ members: true }), 'payments')).toBe(false);
  });

  it('is true for every feature when the map is empty (legacy license)', () => {
    expect(isFeatureEnabled('{}', 'audit_logs')).toBe(true);
  });
});
