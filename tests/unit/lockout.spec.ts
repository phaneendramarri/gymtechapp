// filepath: tests/unit/lockout.spec.ts
import { describe, it, expect } from 'vitest';
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  isAccountLocked,
  nextLockoutSeconds,
  GENERIC_INVALID_CREDENTIALS,
} from '../../apps/api/src/lib/lockout';

describe('Account Lockout Policy', () => {
  describe('isAccountLocked', () => {
    it('treats a missing lock as unlocked', () => {
      expect(isAccountLocked(0, null)).toBe(false);
      expect(isAccountLocked(5, null)).toBe(false);
    });

    it('treats a lock in the past as unlocked (stale lock auto-expires)', () => {
      const now = 1_700_000_000;
      expect(isAccountLocked(5, now - 1, now)).toBe(false);
    });

    it('treats a future lock as locked', () => {
      const now = 1_700_000_000;
      expect(isAccountLocked(5, now + 60, now)).toBe(true);
    });
  });

  describe('nextLockoutSeconds (progressive)', () => {
    it('does not lock below the first threshold', () => {
      expect(nextLockoutSeconds(0)).toBeNull();
      expect(nextLockoutSeconds(4)).toBeNull();
    });

    it('locks for 15 minutes at 5 failures', () => {
      expect(nextLockoutSeconds(5)).toBe(15 * 60);
      expect(nextLockoutSeconds(9)).toBe(15 * 60);
    });

    it('escalates to 1 hour at 10 failures', () => {
      expect(nextLockoutSeconds(10)).toBe(60 * 60);
      expect(nextLockoutSeconds(19)).toBe(60 * 60);
    });

    it('escalates to 24 hours at 20 failures', () => {
      expect(nextLockoutSeconds(20)).toBe(24 * 60 * 60);
      expect(nextLockoutSeconds(100)).toBe(24 * 60 * 60);
    });
  });

  describe('GENERIC_INVALID_CREDENTIALS', () => {
    it('is the same string regardless of reason (anti-enumeration)', () => {
      expect(GENERIC_INVALID_CREDENTIALS).toBe('Invalid email or password');
      // Production rule: the same string MUST be returned for
      //  - user-not-found
      //  - wrong-password
      //  - account-locked
      // so attackers cannot enumerate accounts or detect lockout state.
    });
  });

  describe('Constants', () => {
    it('MAX_FAILED_LOGIN_ATTEMPTS is set to 5 (industry standard)', () => {
      expect(MAX_FAILED_LOGIN_ATTEMPTS).toBe(5);
    });
    it('LOCKOUT_DURATION_SECONDS is 15 minutes', () => {
      expect(LOCKOUT_DURATION_SECONDS).toBe(15 * 60);
    });
  });
});
