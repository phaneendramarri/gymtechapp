import { describe, it, expect } from 'vitest';
import {
  calculateMembershipFinancials,
  calculateMembershipEndDate,
  applyPayment,
} from '../../apps/api/src/lib/calculations';

describe('Gym SaaS Financial & Membership Calculations', () => {
  it('calculates package financials, discount, and due amount accurately in Paise', () => {
    const planPriceRupees = 4000;
    const admissionFeeRupees = 500;
    const discountRupees = 500;
    const initialPaymentRupees = 2000;

    const result = calculateMembershipFinancials({
      planPrice: planPriceRupees * 100,
      admissionFee: admissionFeeRupees * 100,
      discountAmount: discountRupees * 100,
      initialPaymentAmount: initialPaymentRupees * 100,
    });

    expect(result.totalAmount).toBe(450000);
    expect(result.finalAmount).toBe(400000);
    expect(result.paidAmount).toBe(200000);
    expect(result.dueAmount).toBe(200000);
  });

  it('handles zero discount and full payment', () => {
    const result = calculateMembershipFinancials({
      planPrice: 150000,
      admissionFee: 0,
      discountAmount: 0,
      initialPaymentAmount: 150000,
    });

    expect(result.dueAmount).toBe(0);
  });

  it('never lets paid amount exceed the final amount even if overpaid', () => {
    const result = calculateMembershipFinancials({
      planPrice: 100000,
      admissionFee: 0,
      initialPaymentAmount: 999999,
    });

    expect(result.paidAmount).toBe(100000);
    expect(result.dueAmount).toBe(0);
  });

  it('calculates membership duration dates correctly using a standard 30-day month', () => {
    const startTimestamp = 1700000000; // fixed timestamp
    const durationMonths = 3;
    const endTimestamp = calculateMembershipEndDate(startTimestamp, durationMonths);

    expect(endTimestamp).toBe(startTimestamp + 90 * 86400);
    expect(endTimestamp).toBeGreaterThan(startTimestamp);
  });

  it('updates dues when additional payment is logged', () => {
    const finalAmount = 400000;
    let progress = applyPayment(finalAmount, 0, 200000);
    expect(progress.dueAmount).toBe(200000);

    progress = applyPayment(finalAmount, progress.paidAmount, 100000);

    expect(progress.paidAmount).toBe(300000);
    expect(progress.dueAmount).toBe(100000);
  });

  it('never reports a negative due amount even if payments exceed the final amount', () => {
    const progress = applyPayment(400000, 380000, 100000);
    expect(progress.paidAmount).toBe(480000);
    expect(progress.dueAmount).toBe(0);
  });
});
