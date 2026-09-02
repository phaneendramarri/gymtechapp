import { describe, it, expect } from 'vitest';
import {
  calculatePtCommission,
  calculateFreezeExtension,
  isCheckInBlocked,
  splitGstInclusiveAmount,
} from '../../apps/api/src/lib/calculations';

describe('PT Commission Calculations', () => {
  it('computes trainer commission from percentage in paise', () => {
    const amountRupees = 12000;
    const commissionPct = 30;
    const amountPaise = Math.round(amountRupees * 100);

    expect(amountPaise).toBe(1200000);
    expect(calculatePtCommission(amountPaise, commissionPct)).toBe(360000);
  });

  it('handles zero commission percentage', () => {
    expect(calculatePtCommission(500000, 0)).toBe(0);
  });

  it('caps commission percentage at 100', () => {
    expect(calculatePtCommission(200000, 150)).toBe(200000);
  });

  it('floors a negative commission percentage at 0', () => {
    expect(calculatePtCommission(200000, -10)).toBe(0);
  });
});

describe('Membership Freeze / Pause Logic', () => {
  it('extends expiry by the exact frozen duration on resume', () => {
    const daySec = 86400;
    const now = 1_800_000_000;
    const originalEnd = now + 30 * daySec; // 30 days remaining
    const frozenAt = now;
    const resumeAt = frozenAt + 10 * daySec; // resumed 10 days later

    const { extendedTo } = calculateFreezeExtension(originalEnd, frozenAt, resumeAt);

    // 30 days remaining are fully preserved
    expect(extendedTo - resumeAt).toBe(30 * daySec);
  });

  it('never reduces the end date if freeze timestamps are equal', () => {
    const end = 1_800_000_000;
    const { extendedTo } = calculateFreezeExtension(end, 1_800_000_000, 1_800_000_000);
    expect(extendedTo).toBe(end);
  });

  it('blocks check-in for an expired membership on an otherwise active member', () => {
    const nowSec = 1_800_000_000;
    const blocked = isCheckInBlocked({
      memberStatus: 'ACTIVE',
      membershipEndDate: nowSec - 100,
      membershipStatus: 'ACTIVE',
      nowSec,
    });
    expect(blocked).toBe(true);
  });

  it('blocks check-in for a frozen member even with a future membership end date', () => {
    const nowSec = 1_800_000_000;
    const blocked = isCheckInBlocked({
      memberStatus: 'FROZEN',
      membershipEndDate: nowSec + 1000,
      membershipStatus: 'ACTIVE',
      nowSec,
    });
    expect(blocked).toBe(true);
  });

  it('allows check-in for an active member with a valid, unexpired membership', () => {
    const nowSec = 1_800_000_000;
    const blocked = isCheckInBlocked({
      memberStatus: 'ACTIVE',
      membershipEndDate: nowSec + 1000,
      membershipStatus: 'ACTIVE',
      nowSec,
    });
    expect(blocked).toBe(false);
  });

  it('blocks check-in when the member has no membership record at all', () => {
    const nowSec = 1_800_000_000;
    const blocked = isCheckInBlocked({
      memberStatus: 'ACTIVE',
      membershipEndDate: null,
      membershipStatus: null,
      nowSec,
    });
    expect(blocked).toBe(true);
  });
});

describe('GST Invoice Split', () => {
  it('splits a tax-inclusive amount into taxable value + CGST/SGST', () => {
    const amount = 118000; // ₹1,180 inclusive of 18% GST
    const { taxableAmount, taxAmount, cgst, sgst } = splitGstInclusiveAmount(amount, 18);

    expect(taxableAmount).toBe(100000);
    expect(taxAmount).toBe(18000);
    expect(cgst).toBe(9000);
    expect(sgst).toBe(9000);
    expect(cgst + sgst).toBe(taxAmount);
  });

  it('returns the full amount as taxable when no GST applies', () => {
    const amount = 150000;
    const { taxableAmount, taxAmount } = splitGstInclusiveAmount(amount, 0);

    expect(taxableAmount).toBe(amount);
    expect(taxAmount).toBe(0);
  });
});
