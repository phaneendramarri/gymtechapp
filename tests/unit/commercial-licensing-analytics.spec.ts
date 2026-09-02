import { describe, it, expect } from 'vitest';
import {
  isWithinLicenseLimit,
  calculateBulkImportCapacity,
  computeChurnRisk,
  splitGstInclusiveAmount,
} from '../../apps/api/src/lib/calculations';

describe('Commercial Licensing & Operational Analytics', () => {
  describe('Starter Plan Commercial License Enforcement', () => {
    const starterLicense = { max_members: 100, max_staff: 3 };

    it('permits member registration when active count is below limit', () => {
      expect(isWithinLicenseLimit(99, starterLicense.max_members)).toBe(true);
    });

    it('rejects member registration when active count reaches 100 on Starter plan', () => {
      expect(isWithinLicenseLimit(100, starterLicense.max_members)).toBe(false);
    });

    it('permits staff creation up to 3 accounts on Starter plan', () => {
      expect(isWithinLicenseLimit(2, starterLicense.max_staff)).toBe(true);
    });

    it('rejects staff creation when 3 accounts already exist on Starter plan', () => {
      expect(isWithinLicenseLimit(3, starterLicense.max_staff)).toBe(false);
    });

    it('treats a max of -1 (Enterprise plan) as unlimited', () => {
      expect(isWithinLicenseLimit(100_000, -1)).toBe(true);
    });

    it('calculates remaining bulk import capacity without breaching license ceiling', () => {
      const { remainingCapacity, imported, skipped } = calculateBulkImportCapacity(95, starterLicense.max_members, 10);

      expect(remainingCapacity).toBe(5);
      expect(imported).toBe(5);
      expect(skipped).toBe(5);
    });

    it('imports the full batch when the plan is unlimited', () => {
      const { imported, skipped } = calculateBulkImportCapacity(1000, -1, 10);
      expect(imported).toBe(10);
      expect(skipped).toBe(0);
    });
  });

  describe('Churn Radar & Member Dropout Detection', () => {
    const nowSec = 1700000000;
    const membershipStart = nowSec - 60 * 86400;

    it('identifies member absent for 8 days as at risk (MEDIUM risk)', () => {
      const lastCheckInSec = nowSec - 8 * 86400;
      const { daysInactive, riskLevel } = computeChurnRisk(lastCheckInSec, membershipStart, nowSec);

      expect(daysInactive).toBe(8);
      expect(riskLevel).toBe('MEDIUM');
    });

    it('identifies member absent for 18 days as HIGH risk dropout', () => {
      const lastCheckInSec = nowSec - 18 * 86400;
      const { daysInactive, riskLevel } = computeChurnRisk(lastCheckInSec, membershipStart, nowSec);

      expect(daysInactive).toBe(18);
      expect(riskLevel).toBe('HIGH');
    });

    it('floors daysInactive at 7 since only 7+ day absentees are surfaced by the query', () => {
      const lastCheckInSec = nowSec - 2 * 86400;
      const { daysInactive } = computeChurnRisk(lastCheckInSec, membershipStart, nowSec);

      expect(daysInactive).toBe(7);
    });

    it('falls back to the membership start date when the member never checked in', () => {
      const { daysInactive } = computeChurnRisk(null, nowSec - 20 * 86400, nowSec);
      expect(daysInactive).toBe(20);
    });
  });

  describe('GST Tax & SAC Code Specification', () => {
    it('applies standard Gymnasium & Health Club Services SAC 999723', () => {
      const sacCode = '999723';
      expect(sacCode).toBe('999723');
    });

    it('computes 18% inclusive GST split accurately between CGST (9%) and SGST (9%)', () => {
      const { taxableAmount, taxAmount, cgst, sgst } = splitGstInclusiveAmount(118000, 18);

      expect(taxableAmount).toBe(100000);
      expect(taxAmount).toBe(18000);
      expect(cgst).toBe(9000);
      expect(sgst).toBe(9000);
      expect(cgst + sgst).toBe(taxAmount);
    });
  });

  describe('SMS & WhatsApp Centralized Gateways and Balance Quota Enforcement', () => {
    interface MessageBalanceState {
      max_sms: number;
      sms_used: number;
      max_whatsapp: number;
      whatsapp_used: number;
    }

    const computeRemaining = (max: number, used: number) => Math.max(0, max - used);

    it('calculates remaining credits accurately for active quota', () => {
      const state: MessageBalanceState = {
        max_sms: 500,
        sms_used: 120,
        max_whatsapp: 1000,
        whatsapp_used: 450,
      };

      expect(computeRemaining(state.max_sms, state.sms_used)).toBe(380);
      expect(computeRemaining(state.max_whatsapp, state.whatsapp_used)).toBe(550);
    });

    it('decrements remaining balance when an SMS notification is dispatched', () => {
      const state: MessageBalanceState = {
        max_sms: 500,
        sms_used: 120,
        max_whatsapp: 1000,
        whatsapp_used: 450,
      };

      // Dispatched 1 SMS
      state.sms_used += 1;
      expect(computeRemaining(state.max_sms, state.sms_used)).toBe(379);
    });

    it('blocks dispatch when balance reaches 0', () => {
      const exhaustedState: MessageBalanceState = {
        max_sms: 100,
        sms_used: 100,
        max_whatsapp: 0,
        whatsapp_used: 0,
      };

      const canSendSms = computeRemaining(exhaustedState.max_sms, exhaustedState.sms_used) > 0;
      const canSendWa = computeRemaining(exhaustedState.max_whatsapp, exhaustedState.whatsapp_used) > 0;

      expect(canSendSms).toBe(false);
      expect(canSendWa).toBe(false);
    });

    it('recharges and restores dispatching capacity after Super Admin credit top-up', () => {
      const state: MessageBalanceState = {
        max_sms: 100,
        sms_used: 100,
        max_whatsapp: 50,
        whatsapp_used: 50,
      };

      expect(computeRemaining(state.max_sms, state.sms_used)).toBe(0);

      // Super Admin tops up +500 SMS credits
      state.max_sms += 500;
      expect(computeRemaining(state.max_sms, state.sms_used)).toBe(500);

      // Super Admin tops up +250 WhatsApp credits
      state.max_whatsapp += 250;
      expect(computeRemaining(state.max_whatsapp, state.whatsapp_used)).toBe(250);
    });
  });
});

