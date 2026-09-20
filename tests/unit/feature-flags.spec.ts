import { describe, it, expect } from 'vitest';
import { parseEnabledFeatures, isFeatureEnabled } from '../../apps/api/src/lib/features';
import { GYM_FEATURES } from '../../packages/shared/src/constants';

/**
 * Guard the license → feature-flag contract.
 *
 * `licenses.features` is the single source of truth for feature gating
 * (API `requireFeature` + the platform-admin toggles).
 *
 * SECURITY: The default is now SECURE BY DEFAULT — missing, empty, or malformed
 * JSON means NO features enabled. This prevents accidental feature exposure
 * when license data is corrupted or missing. Legacy licenses must be explicitly
 * migrated to include the features JSON.
 */
describe('parseEnabledFeatures', () => {
  it('treats a missing map as NO features enabled (secure default)', () => {
    expect(parseEnabledFeatures(null)).toEqual([]);
    expect(parseEnabledFeatures(undefined)).toEqual([]);
    expect(parseEnabledFeatures('')).toEqual([]);
  });

  it('treats an empty object as NO features enabled (secure default)', () => {
    expect(parseEnabledFeatures('{}')).toEqual([]);
  });

  it('treats unparsable JSON as NO features enabled (fail closed)', () => {
    expect(parseEnabledFeatures('{not json')).toEqual([]);
    expect(parseEnabledFeatures('"a string"')).toEqual([]);
    expect(parseEnabledFeatures('[]')).toEqual([]);
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

  it('is false for every feature when the map is empty (secure default)', () => {
    expect(isFeatureEnabled('{}', 'audit_logs')).toBe(false);
  });
});
