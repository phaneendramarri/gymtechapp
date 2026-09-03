// filepath: apps/api/src/services/member.service.ts
import { MemberRepository } from '../repositories/member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AuditService } from './audit.service';
import { NotificationService } from '../lib/notifications';
import {
  calculateMembershipFinancials,
  calculateMembershipEndDate,
  isWithinLicenseLimit,
} from '../lib/calculations';
import { encryptFaceEmbedding, decryptFaceEmbedding } from '../lib/crypto';
import type {
  Member,
  Membership,
  Payment,
  Attendance,
  PaymentMode,
  Gender,
} from '@gymtech/shared';

export class MemberService {
  private memberRepo: MemberRepository;
  private membershipRepo: MembershipRepository;
  private planRepo: PlanRepository;
  private paymentRepo: PaymentRepository;
  private attendanceRepo: AttendanceRepository;
  private audit: AuditService;
  private env: Record<string, string | undefined>;

  constructor(
    private db: D1Database,
    private gymId: number,
    private userId: number,
    private gymName: string = 'Our Gym',
    env?: Record<string, string | undefined>
  ) {
    this.memberRepo = new MemberRepository(db, gymId);
    this.membershipRepo = new MembershipRepository(db, gymId);
    this.planRepo = new PlanRepository(db, gymId);
    this.paymentRepo = new PaymentRepository(db, gymId);
    this.attendanceRepo = new AttendanceRepository(db, gymId);
    this.audit = new AuditService(db);
    this.env = env ?? {};
  }

  async createMemberWithPlan(data: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: number;
    joinedDate?: number;
    photoUrl?: string;
    faceEmbedding?: string;
    address?: string;
    city?: string;
    pincode?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    healthNotes?: string;
    planId: number;
    discountPaise?: number;
    initialPaymentPaise?: number;
    paymentMode?: PaymentMode;
    referenceId?: string;
  }) {
    // 1. License limit check
    const license = await this.db
      .prepare(`SELECT max_members FROM licenses WHERE gym_id = ?`)
      .bind(this.gymId)
      .first<{ max_members: number }>();

    if (license && license.max_members > 0) {
      const activeCount = await this.memberRepo.countActive();
      if (!isWithinLicenseLimit(activeCount, license.max_members)) {
        throw new Error(
          `License limit reached (maximum ${license.max_members} active members). Please upgrade.`
        );
      }
    }

    const plan = await this.planRepo.findById(data.planId);
    if (!plan) {
      throw new Error('Selected membership plan does not exist or is inactive');
    }

    const memberCode = await this.memberRepo.getNextMemberCode();
    const joinedTimestamp = data.joinedDate ?? Math.floor(Date.now() / 1000);

    const memberId = await this.memberRepo.create({
      memberCode: memberCode,
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim() ?? null,
      email: data.email?.trim() ?? null,
      phone: data.phone.trim(),
      gender: (data.gender ?? null) as Gender,
      dateOfBirth: data.dateOfBirth ?? null,
      photoUrl: data.photoUrl ?? null,
      faceEmbedding: data.faceEmbedding ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      pincode: data.pincode ?? null,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      healthNotes: data.healthNotes ?? null,
      status: 'ACTIVE',
      joinedDate: joinedTimestamp,
    });

    const startTimestamp = joinedTimestamp;
    const endTimestamp = calculateMembershipEndDate(startTimestamp, plan.durationMonths);

    const fin = calculateMembershipFinancials({
      planPrice: plan.pricePaise,
      admissionFee: plan.admissionFeePaise ?? 0,
      discountAmount: data.discountPaise ?? 0,
      initialPaymentAmount: data.initialPaymentPaise ?? 0,
    });

    const membershipId = await this.membershipRepo.create({
      memberId: memberId,
      membershipPlanId: plan.id,
      startDate: startTimestamp,
      endDate: endTimestamp,
      totalAmountPaise: fin.totalAmount,
      discountPaise: fin.discountAmount,
      finalAmountPaise: fin.finalAmount,
      paidAmountPaise: fin.paidAmount,
      dueAmountPaise: fin.dueAmount,
      createdByUserId: this.userId,
    });

    let receiptNumber: string | undefined;
    if (fin.paidAmount > 0) {
      receiptNumber = await this.paymentRepo.getNextReceiptNumber();
      await this.paymentRepo.record({
        memberId: memberId,
        membershipId: membershipId,
        receiptNumber: receiptNumber,
        amountPaise: fin.paidAmount,
        paymentDate: startTimestamp,
        paymentMode: data.paymentMode ?? 'CASH',
        referenceId: data.referenceId ?? null,
        recordedByUserId: this.userId,
        notes: `Initial payment on registration for ${plan.name}`,
        paymentType: 'GYM',
      });
    }

    const notif = new NotificationService(this.gymName);
    const whatsappUrl = notif.generateWhatsAppUrl({
      recipientPhone: data.phone,
      recipientName: `${data.firstName} ${data.lastName ?? ''}`.trim(),
      type: 'WELCOME',
      params: { memberCode },
    });

    await this.audit.recordGymEvent({
      gymId: this.gymId,
      actorUserId: this.userId,
      actorRole: 'STAFF',
      action: 'member.create',
      entityType: 'member',
      entityId: memberId,
      afterState: { memberCode, planId: plan.id, fin },
    });

    const createdMember = await this.memberRepo.findById(memberId);
    const createdMembership = await this.membershipRepo.findActiveByMemberId(memberId);

    return {
      member: createdMember!,
      membership: createdMembership!,
      receiptNumber,
      whatsappUrl,
    };
  }

  async renewMembership(data: {
    memberId: number;
    planId: number;
    startDate?: number;
    discountPaise?: number;
    paymentPaise?: number;
    paymentMode?: PaymentMode;
    referenceId?: string;
    notes?: string;
  }) {
    const member = await this.memberRepo.findById(data.memberId);
    if (!member) throw new Error('Member not found');

    const plan = await this.planRepo.findById(data.planId);
    if (!plan) throw new Error('Selected plan not found');

    const currentActive = await this.membershipRepo.findActiveByMemberId(data.memberId);
    const nowSec = Math.floor(Date.now() / 1000);
    let startTimestamp: number;
    if (data.startDate) {
      startTimestamp = data.startDate;
    } else if (currentActive && currentActive.end_date > nowSec) {
      startTimestamp = currentActive.end_date;
    } else {
      startTimestamp = nowSec;
    }

    const endTimestamp = calculateMembershipEndDate(startTimestamp, plan.durationMonths);
    const fin = calculateMembershipFinancials({
      planPrice: plan.pricePaise,
      admissionFee: 0,
      discountAmount: data.discountPaise ?? 0,
      initialPaymentAmount: data.paymentPaise ?? 0,
    });

    const membershipId = await this.membershipRepo.create({
      memberId: data.memberId,
      membershipPlanId: plan.id,
      startDate: startTimestamp,
      endDate: endTimestamp,
      totalAmountPaise: fin.totalAmount,
      discountPaise: fin.discountAmount,
      finalAmountPaise: fin.finalAmount,
      paidAmountPaise: fin.paidAmount,
      dueAmountPaise: fin.dueAmount,
      notes: data.notes ?? 'Renewal',
      createdByUserId: this.userId,
    });

    let receiptNumber: string | undefined;
    if (fin.paidAmount > 0) {
      receiptNumber = await this.paymentRepo.getNextReceiptNumber();
      await this.paymentRepo.record({
        memberId: data.memberId,
        membershipId: membershipId,
        receiptNumber: receiptNumber,
        amountPaise: fin.paidAmount,
        paymentDate: nowSec,
        paymentMode: data.paymentMode ?? 'CASH',
        referenceId: data.referenceId ?? null,
        recordedByUserId: this.userId,
        notes: `Renewal payment for ${plan.name}`,
        paymentType: 'GYM',
      });
    }

    const notif = new NotificationService(this.gymName);
    const whatsappUrl = notif.generateWhatsAppUrl({
      recipientPhone: member.phone,
      recipientName: `${member.firstName} ${member.lastName ?? ''}`.trim(),
      type: 'RENEWAL_CONFIRMATION',
      params: {
        newExpiryDate: new Date(endTimestamp * 1000).toLocaleDateString('en-IN'),
      },
    });

    await this.audit.recordGymEvent({
      gymId: this.gymId,
      actorUserId: this.userId,
      actorRole: 'STAFF',
      action: 'member.renew',
      entityType: 'membership',
      entityId: membershipId,
      afterState: { planId: plan.id, fin },
    });

    return { membershipId, receiptNumber, whatsappUrl };
  }

  async getMemberDetails(memberId: number) {
    const member = await this.memberRepo.findById(memberId);
    if (!member) throw new Error('Member not found');

    // Phase 4.2: decrypt face embedding before returning to client
    let decryptedFaceEmbedding: string | null = null;
    if (member.faceEmbedding && this.env.FACE_EMBEDDING_KEY) {
      try {
        decryptedFaceEmbedding = await decryptFaceEmbedding(member.faceEmbedding, this.env);
      } catch {
        // If decryption fails (e.g. legacy unencrypted data), return as-is
        decryptedFaceEmbedding = member.faceEmbedding;
      }
    }

    const [memberships, payments, attendance] = await Promise.all([
      this.membershipRepo.findByMemberId(memberId),
      this.paymentRepo.list({ memberId, limit: 20 }),
      this.attendanceRepo.listByMember(memberId, 30),
    ]);
    const activeMembership = memberships.find((m: any) => m.status === 'ACTIVE') || null;
    // Return member with decrypted face embedding, but only include if gym has biometric feature
    const { faceEmbedding: _ignored, ...memberWithoutFace } = member as any;
    return {
      member: { ...memberWithoutFace, faceEmbedding: decryptedFaceEmbedding },
      activeMembership, memberships, payments, attendance,
    };
  }
}
