import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  MessageCircle,
  Pencil,
  Snowflake,
  Play,
  RefreshCw,
  Receipt,
  User,
  Mail,
  MapPin,
  Heart,
  Cake,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { EditMemberDialog } from '@/components/members/EditMemberDialog';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export const MemberDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const memberId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.isOwner;
  const canRecord =
    user?.isOwner || user?.permissions?.includes('members');

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.getMemberDetail(memberId),
    enabled: !!memberId,
  });

  const freezeMutation = useMutation({
    mutationFn: (action: 'freeze' | 'unfreeze') =>
      action === 'freeze' ? api.freezeMember(memberId) : api.unfreezeMember(memberId),
    onSuccess: (res) => {
      toast('success', res.status === 'FROZEN' ? 'Membership paused' : 'Membership resumed', res.message);
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (err: any) => {
      toast('error', 'Freeze action failed', err.message);
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Member" breadcrumb="Members">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Member not found" breadcrumb="Members">
        <div className="p-6 rounded-md border border-(--danger)/30 bg-danger-soft text-(--danger) text-sm">
          We couldn't find this member. They may have been deleted.
        </div>
      </AppShell>
    );
  }

  const member = data.member;
  const activeMembership = data.activeMembership as any;
  const memberships = (data.memberships || []) as any[];
  const payments = (data.payments || []) as any[];
  const attendance = (data.attendance || []) as any[];

  const fullName = `${member.first_name} ${member.last_name || ''}`.trim();
  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() || '·';
  const isFrozen = member.status === 'FROZEN';
  const due = activeMembership ? (activeMembership.due_amount_paise || 0) / 100 : 0;
  const endDate = activeMembership ? new Date(activeMembership.end_date * 1000) : null;
  const daysToEnd = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;

  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSendWhatsApp = async () => {
    if (!member) return;
    setIsSendingWa(true);
    try {
      const res = await api.dispatchNotification({
        recipientPhone: member.phone,
        recipientName: member.first_name,
        channel: 'WHATSAPP',
        type: 'CUSTOM',
        params: { memberCode: member.member_code },
      });
      toast('success', 'WhatsApp Dispatched', `1 credit deducted. (${res.remainingCredits} credits remaining)`);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast('error', 'Cannot Send WhatsApp', err.message || 'Check your message credits or contact Super Admin.');
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleSendSms = async () => {
    if (!member) return;
    setIsSendingSms(true);
    try {
      const res = await api.dispatchNotification({
        recipientPhone: member.phone,
        recipientName: member.first_name,
        channel: 'SMS',
        type: 'CUSTOM',
        params: { memberCode: member.member_code },
      });
      toast('success', 'SMS Dispatched', `SMS sent to ${member.first_name}. 1 credit deducted. (${res.remainingCredits} credits remaining)`);
    } catch (err: any) {
      toast('error', 'Cannot Send SMS', err.message || 'Check your SMS credits or contact Super Admin.');
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <AppShell
      breadcrumb={[
        { label: 'Members', href: '/members' },
        { label: fullName },
      ]}
      title={fullName}
      description={`Member since ${new Date(member.joined_date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${member.member_code}`}
      actions={
        <>
          <Button
            onClick={handleSendWhatsApp}
            disabled={isSendingWa}
            size="sm"
            variant="outline"
            className="gt-btn gt-btn-secondary h-9 gap-1.5"
            title="Dispatch WhatsApp message (1 credit deducted)"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            {isSendingWa ? 'Sending…' : 'WhatsApp'}
          </Button>
          <Button
            onClick={handleSendSms}
            disabled={isSendingSms}
            size="sm"
            variant="outline"
            className="gt-btn gt-btn-secondary h-9 gap-1.5"
            title="Dispatch SMS alert (1 credit deducted)"
          >
            <Smartphone className="h-3.5 w-3.5 text-blue-600" />
            {isSendingSms ? 'Sending…' : 'Send SMS'}
          </Button>
          {canRecord && (
            <Button onClick={() => setIsPaymentOpen(true)} size="sm" className="gt-btn-primary">
              <Receipt className="h-3.5 w-3.5" /> Record payment
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8">
        {/* LEFT — identity + plan + history */}
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-10">
          {/* Identity card */}
          <section>
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-md bg-surface-2 text-ink flex items-center justify-center text-lg font-semibold shrink-0 overflow-hidden">
                {member.photo_url ? (
                  <img src={member.photo_url} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'gt-chip',
                      isFrozen ? 'gt-chip-info' :
                      member.status === 'BLOCKED' ? 'gt-chip-danger' :
                      member.status === 'EXPIRED' ? 'gt-chip-warn' :
                      'gt-chip-ok'
                    )}
                  >
                    <span className="gt-dot h-1 w-1" style={{ background: 'currentColor' }} />
                    {member.status}
                  </span>
                  {activeMembership && (
                    <span className="gt-chip gt-chip-muted">
                      {activeMembership.plan_name || 'Active plan'}
                    </span>
                  )}
                </div>

                {activeMembership ? (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                    <StatCell
                      label="Plan ends"
                      value={endDate ? endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      tone={daysToEnd !== null && daysToEnd <= 7 ? 'warn' : 'default'}
                      sub={daysToEnd !== null ? `${daysToEnd}d remaining` : ''}
                    />
                    <StatCell
                      label="Plan fee"
                      value={formatCurrency(activeMembership.final_amount_paise)}
                    />
                    <StatCell
                      label="Paid"
                      value={formatCurrency(activeMembership.paid_amount_paise)}
                      tone="ok"
                    />
                    <StatCell
                      label="Pending due"
                      value={formatCurrency(activeMembership.due_amount_paise)}
                      tone={due > 0 ? 'warn' : 'default'}
                    />
                  </div>
                ) : (
                  <p className="text-meta mt-3">No active membership. Enroll this member in a plan to get started.</p>
                )}

                {canManage && activeMembership && (
                  <div className="mt-5 flex items-center gap-2 flex-wrap">
                    {isFrozen ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={freezeMutation.isPending}
                        onClick={() => freezeMutation.mutate('unfreeze')}
                      >
                        <Play className="h-3.5 w-3.5" /> Resume
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={freezeMutation.isPending}
                        onClick={() => freezeMutation.mutate('freeze')}
                      >
                        <Snowflake className="h-3.5 w-3.5" /> Freeze
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/members/${memberId}/renew`}>
                        <RefreshCw className="h-3.5 w-3.5" /> Renew plan
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Contact + details */}
          <section>
            <SectionHeader eyebrow="Profile" title="Contact & details" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={member.phone} />
              <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={member.email || '—'} />
              {member.address && (
                <DetailRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Address"
                  value={[member.address, member.city, member.pincode].filter(Boolean).join(', ')}
                />
              )}
              {member.date_of_birth && (
                <DetailRow
                  icon={<Cake className="h-3.5 w-3.5" />}
                  label="Birthday"
                  value={new Date(member.date_of_birth * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                />
              )}
              <DetailRow
                icon={<Heart className="h-3.5 w-3.5" />}
                label="Emergency contact"
                value={member.emergency_contact_name ? `${member.emergency_contact_name} (${member.emergency_contact_phone || '—'})` : '—'}
              />
              {member.health_notes && (
                <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Health notes" value={member.health_notes} />
              )}
            </dl>
          </section>

          {/* Plan history */}
          <section>
            <SectionHeader eyebrow="History" title="Memberships" count={memberships.length} />
            {memberships.length === 0 ? (
              <p className="text-meta">No memberships yet.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {memberships.map((m: any) => (
                  <li key={m.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{m.plan_name || 'Plan'}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        {new Date(m.start_date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' → '}
                        {new Date(m.end_date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'gt-chip',
                        m.status === 'ACTIVE' ? 'gt-chip-ok' :
                        m.status === 'FROZEN' ? 'gt-chip-info' :
                        m.status === 'CANCELLED' ? 'gt-chip-muted' : 'gt-chip-warn'
                      )}
                    >
                      {m.status}
                    </span>
                    <p className="text-sm num text-ink">{formatCurrency(m.final_amount_paise)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT — payments + attendance */}
        <aside className="flex flex-col gap-10 min-w-0">
          <section>
            <SectionHeader eyebrow="Ledger" title="Payments" count={payments.length} link={{ label: 'All', href: '/payments' }} />
            {payments.length === 0 ? (
              <p className="text-meta">No payments yet.</p>
            ) : (
              <ul className="flex flex-col">
                {payments.slice(0, 8).map((p: any) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 border-t border-(--line-2) first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm num text-ink">{formatCurrency(p.amount_paise)}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        {new Date(p.payment_date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}{p.payment_mode}
                      </p>
                    </div>
                    <span className="gt-chip gt-chip-muted font-mono text-[10px]">{p.receipt_number}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader eyebrow="Activity" title="Recent check-ins" count={attendance.length} link={{ label: 'Floor', href: '/attendance' }} />
            {attendance.length === 0 ? (
              <p className="text-meta">No check-ins recorded.</p>
            ) : (
              <ul className="flex flex-col">
                {attendance.slice(0, 8).map((a: any) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 border-t border-(--line-2) first:border-t-0"
                  >
                    <span className="gt-dot gt-dot-positive h-1.5 w-1.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{a.method} check-in</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        {new Date(a.check_in_time * 1000).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <EditMemberDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        member={member}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['member', id] })}
      />

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        members={[member]}
        onPaymentSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['member', id] });
          queryClient.invalidateQueries({ queryKey: ['members'] });
        }}
      />
    </AppShell>
  );
};

/* ----------------------------- subcomponents ----------------------------- */

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  count?: number;
  link?: { label: string; href: string };
}> = ({ eyebrow, title, count, link }) => (
  <div className="flex items-end justify-between gap-4 mb-4">
    <div>
      <p className="text-eyebrow">{eyebrow}</p>
      <h2 className="text-h2 text-ink mt-1.5 flex items-center gap-2">
        {title}
        {typeof count === 'number' && <span className="text-h3 text-ink-3 num">{count}</span>}
      </h2>
    </div>
    {link && (
      <a
        href={link.href}
        className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1"
      >
        {link.label} <ChevronRight className="h-3 w-3" />
      </a>
    )}
  </div>
);

const StatCell: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'ok' | 'warn';
}> = ({ label, value, sub, tone = 'default' }) => (
  <div>
    <p className="text-eyebrow">{label}</p>
    <p
      className={cn(
        'text-stat-md mt-1.5 num',
        tone === 'ok' && 'text-(--positive)',
        tone === 'warn' && 'text-(--warning)'
      )}
    >
      {value}
    </p>
    {sub && <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>}
  </div>
);

const DetailRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
    <div className="min-w-0 flex-1">
      <p className="text-eyebrow">{label}</p>
      <p className="text-sm text-ink mt-1 wrap-break-word">{value}</p>
    </div>
  </div>
);
