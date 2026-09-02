// filepath: tests/unit/media-filebase.spec.ts
import { describe, it, expect } from 'vitest';
import {
  makeKey,
  parseGymIdFromKey,
} from '../../apps/api/src/lib/filebase';
import {
  MAX_UPLOAD_BYTES,
  MAX_SIGNED_URL_TTL_SECONDS,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
} from '../../apps/api/src/lib/media';

describe('Filebase key helpers (Phase 2.2)', () => {
  describe('makeKey', () => {
    it('namespaces objects under the gymId', () => {
      expect(makeKey(5, 'photo.jpg')).toBe('5/photo.jpg');
      expect(makeKey(42, 'receipt.pdf')).toBe('42/receipt.pdf');
    });

    it('refuses path-traversal segments (security)', () => {
      expect(() => makeKey(1, '../etc/passwd')).toThrow(/path separators/);
      expect(() => makeKey(1, '../../secret')).toThrow(/path separators/);
      expect(() => makeKey(1, '..')).toThrow(/path separators/);
      expect(() => makeKey(1, 'subdir/file.jpg')).toThrow(/path separators/);
      expect(() => makeKey(1, 'C:\\Windows\\file')).toThrow(/path separators/);
    });

    it('refuses keys containing ".." anywhere', () => {
      // Even ".." embedded in the middle is rejected.
      expect(() => makeKey(1, 'foo..bar')).toThrow(/path separators/);
    });

    it('sanitizes special characters but keeps them in the same gym namespace', () => {
      expect(makeKey(1, 'photo with spaces.jpg')).toBe('1/photo_with_spaces.jpg');
      expect(makeKey(1, 'weird?name*chars')).toBe('1/weird_name_chars');
    });

    it('refuses invalid gymId', () => {
      expect(() => makeKey(0, 'x')).toThrow(/Invalid gymId/);
      expect(() => makeKey(-1, 'x')).toThrow(/Invalid gymId/);
      expect(() => makeKey(1.5, 'x')).toThrow(/Invalid gymId/);
    });

    it('refuses empty or whitespace-only filenames', () => {
      expect(() => makeKey(1, '')).toThrow(/Invalid object key/);
      expect(() => makeKey(1, '   ')).toThrow(/Invalid object key/);
      expect(() => makeKey(1, '\t\n')).toThrow(/Invalid object key/);
    });

    it('truncates long filenames to 200 chars', () => {
      const long = 'a'.repeat(500) + '.jpg';
      const result = makeKey(1, long);
      // The basename portion is capped at 200 chars.
      expect(result.length).toBeLessThanOrEqual(1 + 1 + 200); // gymId + '/' + 200
    });
  });

  describe('parseGymIdFromKey', () => {
    it('extracts the gymId from a valid key', () => {
      expect(parseGymIdFromKey('5/photo.jpg')).toBe(5);
      expect(parseGymIdFromKey('42/abc/def.pdf')).toBe(42);
    });

    it('returns null for malformed keys', () => {
      expect(parseGymIdFromKey('photo.jpg')).toBeNull();   // no slash
      expect(parseGymIdFromKey('/photo.jpg')).toBeNull();   // empty prefix
      expect(parseGymIdFromKey('abc/photo.jpg')).toBeNull(); // non-numeric prefix
      expect(parseGymIdFromKey('0/photo.jpg')).toBeNull();   // zero
      expect(parseGymIdFromKey('-1/x')).toBeNull();
    });
  });
});

describe('Media service constants (Phase 2.2)', () => {
  it('enforces a sane upload size limit', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it('default signed URL TTL is 15 minutes (industry standard)', () => {
    expect(DEFAULT_SIGNED_URL_TTL_SECONDS).toBe(15 * 60);
  });

  it('max signed URL TTL is capped at 1 hour (prevents perpetual URLs)', () => {
    expect(MAX_SIGNED_URL_TTL_SECONDS).toBe(60 * 60);
    expect(MAX_SIGNED_URL_TTL_SECONDS).toBeGreaterThan(DEFAULT_SIGNED_URL_TTL_SECONDS);
  });
});

describe('Tenant isolation contract', () => {
  // The service layer is the enforcement point: parseGymIdFromKey(key) must
  // match the requested gymId before any read/write happens. These tests
  // document the invariant the routes rely on.
  it('cross-tenant key access is detectable by parseGymIdFromKey', () => {
    const keyForGym5 = makeKey(5, 'secret.jpg');
    const keyForGym6 = makeKey(6, 'secret.jpg');
    expect(parseGymIdFromKey(keyForGym5)).toBe(5);
    expect(parseGymIdFromKey(keyForGym6)).toBe(6);
  });

  it('attacker cannot forge a key for another gym by tampering with the prefix', () => {
    // Any path-traversal attempt is rejected outright. The only way to get
    // a key that points to gym 6 is to call makeKey(6, ...).
    expect(() => makeKey(5, '../6/secret.jpg')).toThrow();
    expect(() => makeKey(5, '5/6/secret.jpg')).toThrow();
  });
});
