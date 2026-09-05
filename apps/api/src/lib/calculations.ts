// Pure, unit-testable business logic shared by route handlers/services.
// Keeping these calculations here (instead of inline in index.ts) means the
// same logic that runs in production is what the unit tests exercise.

export interface MembershipFinancials {
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  dueAmount: number;
}

// All amounts are in paise (₹1 = 100 paise).
export function calculateMembershipFinancials(params: {
  planPrice: number;
  admissionFee: number;
  discountAmount?: number;
  initialPaymentAmount?: number;
}): MembershipFinancials {
  const totalAmount = params.planPrice + params.admissionFee;
  const discountAmount = Math.max(0, params.discountAmount || 0);
  const finalAmount = Math.max(0, totalAmount - discountAmount);
  const paidAmount = Math.min(finalAmount, Math.max(0, params.initialPaymentAmount || 0));
  const dueAmount = Math.max(0, finalAmount - paidAmount);
  return { totalAmount, discountAmount, finalAmount, paidAmount, dueAmount };
}

// Membership durations use a standard 30-day month, matching plan.duration_months.
export function calculateMembershipEndDate(startTimestampSec: number, durationMonths: number): number {
  return startTimestampSec + durationMonths * 30 * 86400;
}

export function applyPayment(
  finalAmount: number,
  currentPaidAmount: number,
  additionalPaid: number
): { paidAmount: number; dueAmount: number } {
  const paidAmount = currentPaidAmount + additionalPaid;
  const dueAmount = Math.max(0, finalAmount - paidAmount);
  return { paidAmount, dueAmount };
}

export function calculatePtCommission(amountPaise: number, commissionPercentage: number): number {
  const cappedPct = Math.min(100, Math.max(0, commissionPercentage));
  return Math.round(amountPaise * (cappedPct / 100));
}

export function calculateFreezeExtension(
  endDate: number,
  frozenAt: number,
  resumeAtSec: number
): { extendedTo: number; frozenDurationSec: number } {
  const frozenDurationSec = Math.max(0, resumeAtSec - frozenAt);
  return { extendedTo: endDate + frozenDurationSec, frozenDurationSec };
}

// Mirrors the exact guard used at check-in time: block anyone whose membership
// has lapsed/has no active record, or whose member record is frozen/cancelled.
export function isCheckInBlocked(params: {
  memberStatus: string;
  membershipEndDate: number | null;
  membershipStatus: string | null;
  nowSec: number;
}): boolean {
  const isExpired =
    params.membershipEndDate === null ||
    params.membershipEndDate < params.nowSec ||
    params.membershipStatus === 'EXPIRED';
  const isFrozenOrCancelled = params.memberStatus === 'FROZEN' || params.memberStatus === 'CANCELLED' || params.memberStatus === 'BLOCKED';
  return isExpired || isFrozenOrCancelled;
}

export interface GstSplit {
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
}

// Amounts are stored tax-inclusive; splits into taxable value + CGST/SGST (SAC 999723).
export function splitGstInclusiveAmount(amount: number, taxPercentage: number): GstSplit {
  const taxableAmount = taxPercentage > 0 ? Math.round(amount / (1 + taxPercentage / 100)) : amount;
  const taxAmount = amount - taxableAmount;
  const cgst = Math.round(taxAmount / 2);
  const sgst = taxAmount - cgst;
  return { taxableAmount, taxAmount, cgst, sgst };
}

// A max of 0 or less is treated as "unlimited" (matches the Enterprise plan convention).
export function isWithinLicenseLimit(currentCount: number, maxCount: number): boolean {
  if (maxCount <= 0) return true;
  return currentCount < maxCount;
}

export function calculateBulkImportCapacity(
  currentActive: number,
  maxMembers: number,
  incomingBatch: number
): { remainingCapacity: number; imported: number; skipped: number } {
  if (maxMembers <= 0) {
    return { remainingCapacity: incomingBatch, imported: incomingBatch, skipped: 0 };
  }
  const remainingCapacity = Math.max(0, maxMembers - currentActive);
  const imported = Math.min(incomingBatch, remainingCapacity);
  const skipped = incomingBatch - imported;
  return { remainingCapacity, imported, skipped };
}

export type ChurnRiskLevel = 'HIGH' | 'MEDIUM';

// Mirrors DashboardService.getAtRiskMembers: members are only surfaced once 7+ days
// inactive, so daysInactive is floored at 7.
export function computeChurnRisk(
  lastCheckInSec: number | null,
  membershipStartSec: number,
  nowSec: number
): { daysInactive: number; riskLevel: ChurnRiskLevel } {
  const lastSec = lastCheckInSec ?? membershipStartSec;
  const daysInactive = Math.max(7, Math.floor((nowSec - lastSec) / 86400));
  return { daysInactive, riskLevel: daysInactive >= 14 ? 'HIGH' : 'MEDIUM' };
}
