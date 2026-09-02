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

  constructor(
    private db: D1Database,
    private gymId: number,
    private userId: number,
    private gymName: string = 'Our Gym'
  ) {
    this.memberRepo = new MemberRepository(db, gymId);
    this.membershipRepo = new MembershipRepository(db, gymId);
    this.planRepo = new PlanRepository(db, gymId);
    this.paymentRepo = new PaymentRepository(db, gymId);
    this.attendanceRepo = new AttendanceRepository(db, gymId);
    this.audit = new AuditService(db);
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
      member_code: memberCode,
      first_name: data.firstName.trim(),
      last_name: data.lastName?.trim() ?? null,
      email: data.email?.trim() ?? null,
      phone: data.phone.trim(),
      gender: (data.gender ?? null) as Gender,
      date_of_birth: data.dateOfBirth ?? null,
      photo_url: data.photoUrl ?? null,
      face_embedding: data.faceEmbedding ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      pincode: data.pincode ?? null,
      emergency_contact_name: data.emergencyContactName ?? null,
      emergency_contact_phone: data.emergencyContactPhone ?? null,
      health_notes: data.healthNotes ?? null,
      status: 'ACTIVE',
      joined_date: joinedTimestamp,
    });

    const startTimestamp = joinedTimestamp;
    const endTimestamp = calculateMembershipEndDate(startTimestamp, plan.duration_months);

    const fin = calculateMembershipFinancials({
      planPrice: plan.price_paise,
      admissionFee: plan.admission_fee_paise ?? 0,
      discountAmount: data.discountPaise ?? 0,
      initialPaymentAmount: data.initialPaymentPaise ?? 0,
    });

    const membershipId = await this.membershipRepo.create({
      member_id: memberId,
      membership_plan_id: plan.id,
      start_date: startTimestamp,
      end_date: endTimestamp,
      total_amount_paise: fin.totalAmount,
      discount_paise: fin.discountAmount,
      final_amount_paise: fin.finalAmount,
      paid_amount_paise: fin.paidAmount,
      due_amount_paise: fin.dueAmount,
      created_by_user_id: this.userId,
    });

    let receiptNumber: string | undefined;
    if (fin.paidAmount > 0) {
      receiptNumber = await this.paymentRepo.getNextReceiptNumber();
      await this.paymentRepo.record({
        member_id: memberId,
        membership_id: membershipId,
        receipt_number: receiptNumber,
        amount_paise: fin.paidAmount,
        payment_date: startTimestamp,
        payment_mode: data.paymentMode ?? 'CASH',
        reference_id: data.referenceId ?? null,
        recorded_by_user_id: this.userId,
        notes: `Initial payment on registration for ${plan.name}`,
        payment_type: 'GYM',
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

    const endTimestamp = calculateMembershipEndDate(startTimestamp, plan.duration_months);
    const fin = calculateMembershipFinancials({
      planPrice: plan.price_paise,
      admissionFee: 0,
      discountAmount: data.discountPaise ?? 0,
      initialPaymentAmount: data.paymentPaise ?? 0,
    });

    const membershipId = await this.membershipRepo.create({
      member_id: data.memberId,
      membership_plan_id: plan.id,
      start_date: startTimestamp,
      end_date: endTimestamp,
      total_amount_paise: fin.totalAmount,
      discount_paise: fin.discountAmount,
      final_amount_paise: fin.finalAmount,
      paid_amount_paise: fin.paidAmount,
      due_amount_paise: fin.dueAmount,
      notes: data.notes ?? 'Renewal',
      created_by_user_id: this.userId,
    });

    let receiptNumber: string | undefined;
    if (fin.paidAmount > 0) {
      receiptNumber = await this.paymentRepo.getNextReceiptNumber();
      await this.paymentRepo.record({
        member_id: data.memberId,
        membership_id: membershipId,
        receipt_number: receiptNumber,
        amount_paise: fin.paidAmount,
        payment_date: nowSec,
        payment_mode: data.paymentMode ?? 'CASH',
        reference_id: data.referenceId ?? null,
        recorded_by_user_id: this.userId,
        notes: `Renewal payment for ${plan.name}`,
        payment_type: 'GYM',
      });
    }

    const notif = new NotificationService(this.gymName);
    const whatsappUrl = notif.generateWhatsAppUrl({
      recipientPhone: member.phone,
      recipientName: `${member.first_name} ${member.last_name ?? ''}`.trim(),
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

    const [memberships, payments, attendance] = await Promise.all([
      this.membershipRepo.findByMemberId(memberId),
      this.paymentRepo.list({ memberId, limit: 20 }),
      this.attendanceRepo.listByMember(memberId, 30),
    ]);
    const activeMembership = memberships.find((m) => m.status === 'ACTIVE') || null;
    return { member, activeMembership, memberships, payments, attendance };
  }
}
