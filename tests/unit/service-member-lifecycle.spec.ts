import { describe, it, expect } from 'vitest';
import {
  calculateMembershipFinancials,
  calculateMembershipEndDate,
  isWithinLicenseLimit,
  calculateFreezeExtension,
  applyPayment,
  isCheckInBlocked,
} from '../../apps/api/src/lib/calculations';

describe('Member Lifecycle, Financials & License Enforcement Invariants', () => {
  describe('License Limit Enforcement', () => {
    it('allows member creation when active count is strictly under limit', () => {
      expect(isWithinLicenseLimit(50, 100)).toBe(true);
      expect(isWithinLicenseLimit(99, 100)).toBe(true);
      expect(isWithinLicenseLimit(0, 50)).toBe(true);
    });

    it('rejects member creation when active count reaches or exceeds limit', () => {
      expect(isWithinLicenseLimit(100, 100)).toBe(false);
      expect(isWithinLicenseLimit(105, 100)).toBe(false);
    });

    it('allows unlimited members when maxMembers is 0 or negative', () => {
      expect(isWithinLicenseLimit(500, 0)).toBe(true);
      expect(isWithinLicenseLimit(10000, -1)).toBe(true);
    });
  });

  describe('Membership Enrollment Financials & Term Calculations', () => {
    it('calculates total, final amount, and pending dues with discounts and admission fees', () => {
      // Annual plan: ₹12,000 (1,200,000 paise) + ₹1,000 admission (100,000 paise)
      // ₹2,000 discount (200,000 paise), ₹5,000 initial payment (500,000 paise)
      const fin = calculateMembershipFinancials({
        planPrice: 1200000,
        admissionFee: 100000,
        discountAmount: 200000,
        initialPaymentAmount: 500000,
      });

      expect(fin.totalAmount).toBe(1300000); // 12,000 + 1,000
      expect(fin.discountAmount).toBe(200000);
      expect(fin.finalAmount).toBe(1100000); // 13,000 - 2,000
      expect(fin.paidAmount).toBe(500000);
      expect(fin.dueAmount).toBe(600000);   // 11,000 - 5,000 = ₹6,000
    });

    it('caps discount so final amount never drops below zero', () => {
      const fin = calculateMembershipFinancials({
        planPrice: 100000,
        admissionFee: 0,
        discountAmount: 150000, // discount larger than price
        initialPaymentAmount: 0,
      });

      expect(fin.finalAmount).toBe(0);
      expect(fin.dueAmount).toBe(0);
    });

    it('caps initial payment so it cannot exceed final amount', () => {
      const fin = calculateMembershipFinancials({
        planPrice: 100000,
        admissionFee: 0,
        discountAmount: 0,
        initialPaymentAmount: 150000, // overpayment
      });

      expect(fin.paidAmount).toBe(100000);
      expect(fin.dueAmount).toBe(0);
    });

    it('calculates standard 30-day month membership end dates', () => {
      const start = 1750000000;
      
      // 1 month (30 days)
      const end1m = calculateMembershipEndDate(start, 1);
      expect(end1m).toBe(start + 30 * 86400);

      // 3 months (90 days)
      const end3m = calculateMembershipEndDate(start, 3);
      expect(end3m).toBe(start + 90 * 86400);

      // 12 months (360 days)
      const end12m = calculateMembershipEndDate(start, 12);
      expect(end12m).toBe(start + 360 * 86400);
    });
  });

  describe('Freeze & Unfreeze Lifecycle', () => {
    it('extends membership expiration date by the exact frozen duration', () => {
      const originalEnd = Math.floor(new Date('2026-06-30T00:00:00Z').getTime() / 1000);
      const freezeStart = Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000);
      const freezeEnd = Math.floor(new Date('2026-03-15T00:00:00Z').getTime() / 1000); // 14 days

      const res = calculateFreezeExtension(originalEnd, freezeStart, freezeEnd);
      expect(res.extendedTo).toBe(originalEnd + 14 * 86400);
      expect(res.frozenDurationSec).toBe(14 * 86400);
    });

    it('handles zero or negative freeze duration gracefully without altering end date', () => {
      const originalEnd = 1750000000;
      const res = calculateFreezeExtension(originalEnd, 1740000000, 1740000000);
      expect(res.extendedTo).toBe(originalEnd);
      expect(res.frozenDurationSec).toBe(0);
    });
  });

  describe('Payment Application to Existing Dues', () => {
    it('reduces dues and updates total paid amount', () => {
      const finalAmount = 100000;
      const currentPaid = 50000;

      // Partial payment of 30,000 paise
      const step1 = applyPayment(finalAmount, currentPaid, 30000);
      expect(step1.paidAmount).toBe(80000);
      expect(step1.dueAmount).toBe(20000);

      // Settle remaining 20,000 paise
      const step2 = applyPayment(finalAmount, step1.paidAmount, 20000);
      expect(step2.paidAmount).toBe(100000);
      expect(step2.dueAmount).toBe(0);
    });

    it('caps due amount at 0 when overpayment occurs', () => {
      const finalAmount = 50000;
      const currentPaid = 20000;

      const result = applyPayment(finalAmount, currentPaid, 40000);
      expect(result.paidAmount).toBe(60000);
      expect(result.dueAmount).toBe(0);
    });
  });

  describe('Check-In Access Evaluation', () => {
    it('allows check-in for active members with valid unexpired membership', () => {
      const now = 1750000000;
      const blocked = isCheckInBlocked({
        memberStatus: 'ACTIVE',
        membershipEndDate: now + 86400 * 30, // 30 days remaining
        membershipStatus: 'ACTIVE',
        nowSec: now,
      });
      expect(blocked).toBe(false);
    });

    it('blocks check-in when membership end date is in the past', () => {
      const now = 1750000000;
      const blocked = isCheckInBlocked({
        memberStatus: 'ACTIVE',
        membershipEndDate: now - 100, // expired
        membershipStatus: 'EXPIRED',
        nowSec: now,
      });
      expect(blocked).toBe(true);
    });

    it('blocks check-in when member status is FROZEN or CANCELLED', () => {
      const now = 1750000000;
      const frozenBlocked = isCheckInBlocked({
        memberStatus: 'FROZEN',
        membershipEndDate: now + 86400 * 30,
        membershipStatus: 'FROZEN',
        nowSec: now,
      });
      expect(frozenBlocked).toBe(true);

      const cancelledBlocked = isCheckInBlocked({
        memberStatus: 'CANCELLED',
        membershipEndDate: now + 86400 * 30,
        membershipStatus: 'ACTIVE',
        nowSec: now,
      });
      expect(cancelledBlocked).toBe(true);
    });
  });
});
