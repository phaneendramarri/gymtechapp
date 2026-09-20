/**
 * Feature-flag resolution.
 *
 * A gym's enabled features live in `licenses.features` as a JSON object, e.g.
 *   {"members": true, "payments": true, "pt_collections": false}
 *
 * Semantics (deliberately forgiving so legacy data keeps working):
 *   - missing, unparsable, empty, or non-object JSON → ALL features enabled
 *     (this is the default for every license created before gating existed)
 *   - a non-empty object → exactly the keys explicitly set to `true`
 *
 * Keeping this pure makes it unit-testable and safe to call from middleware
 * on every request.
 */
import { GYM_FEATURES, type GymFeatureKey } from '@gymtech/shared';

export function parseEnabledFeatures(raw: string | null | undefined): GymFeatureKey[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  const map = parsed as Record<string, unknown>;
  if (Object.keys(map).length === 0) return [];

  return GYM_FEATURES.filter((key) => map[key] === true);
}

export function isFeatureEnabled(
  raw: string | null | undefined,
  key: GymFeatureKey,
): boolean {
  return parseEnabledFeatures(raw).includes(key);
}
