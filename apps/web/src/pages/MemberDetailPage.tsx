import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Calendar,
  CreditCard,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EditMemberDialog } from '@/components/members/EditMemberDialog';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ErrorState } from '@/components/shared/ErrorState';
import { DetailSkeleton } from '@/components/shared/LoadingSkeleton';

export const MemberDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const memberId = parseInt(id || '0', 10);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.isOwner;
  const canRecord = user?.isOwner || user?.permissions?.includes('members');

  const { data, isLoading, error, refetch } = useQuery({
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
      <AppShell title="Loading Member..." breadcrumb="Members">
        <DetailSkeleton className="py-2" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Member Not Found" breadcrumb="Members">
        <ErrorState
          title="Member record not found"
          description={(error as Error)?.message || "We couldn't retrieve this member record. It may have been archived, removed, or the link is invalid."}
          onRetry={() => refetch()}
          backHref="/members"
          backLabel="Back to Members Directory"
        />
      </AppShell>
    );
  }

  const member = data.member;
  const activeMembership = data.activeMembership as any;
  const memberships = (data.memberships || []) as any[];
  const payments = (data.payments || []) as any[];
  const attendance = (data.attendance || []) as any[];

  const fullName = `${member.firstName} ${member.lastName || ''}`.trim();
  const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() || 'M';
  const isFrozen = member.status === 'FROZEN';
  const due = activeMembership ? (activeMembership.dueAmountPaise || 0) / 100 : 0;
  const endDate = activeMembership ? new Date(activeMembership.endDate * 1000) : null;
  const daysToEnd = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;

  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSendWhatsApp = async () => {
    if (!member) return;
    setIsSendingWa(true);
    try {
      const res = await api.dispatchNotification({
        recipientPhone: member.phone,
        recipientName: member.firstName,
        channel: 'WHATSAPP',
        type: 'CUSTOM',
        params: { memberCode: member.memberCode },
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
        recipientName: member.firstName,
        channel: 'SMS',
        type: 'CUSTOM',
        params: { memberCode: member.memberCode },
      });
      toast('success', 'SMS Dispatched', `SMS sent to ${member.firstName}. 1 credit deducted. (${res.remainingCredits} credits remaining)`);
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
      description={`Member since ${new Date(member.joinedDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${member.memberCode}`}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleSendWhatsApp}
            disabled={isSendingWa}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            title="Dispatch WhatsApp message (1 credit deducted)"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {isSendingWa ? 'Sending…' : 'WhatsApp'}
          </Button>
          <Button
            onClick={handleSendSms}
            disabled={isSendingSms}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            title="Dispatch SMS alert (1 credit deducted)"
          >
            <Smartphone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {isSendingSms ? 'Sending…' : 'Send SMS'}
          </Button>
          {canRecord && (
            <Button onClick={() => setIsPaymentOpen(true)} size="sm" className="h-8 gap-1.5 text-xs font-semibold">
              <Receipt className="h-3.5 w-3.5" /> Record payment
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* TOP: Identity & Membership Overview Card */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 rounded-xl border border-border shrink-0 text-lg font-bold">
                  {member.photoUrl ? (
                    <AvatarImage src={member.photoUrl} alt={fullName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{fullName}</h2>
                    <Badge
                      variant={isFrozen ? 'secondary' :
                        member.status === 'BLOCKED' ? 'destructive' :
                        member.status === 'EXPIRED' ? 'destructive' :
                        'default'
                      }
                      className="text-xs"
                    >
                      {member.status}
                    </Badge>
                    {activeMembership && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {activeMembership.planName || 'Active plan'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    ID: {member.memberCode} · Joined {new Date(member.joinedDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 flex-wrap">
                  {activeMembership && (
                    isFrozen ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={freezeMutation.isPending}
                        onClick={() => freezeMutation.mutate('unfreeze')}
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-500" /> Resume
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={freezeMutation.isPending}
                        onClick={() => freezeMutation.mutate('freeze')}
                      >
                        <Snowflake className="h-3.5 w-3.5 text-blue-500" /> Freeze
                      </Button>
                    )
                  )}
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setIsEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit Profile
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Link to={`/members/${memberId}/renew`}>
                      <RefreshCw className="h-3.5 w-3.5" /> Renew Plan
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Metric strip */}
            {activeMembership ? (
              <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Plan ends</p>
                  <p className="text-base font-bold font-mono text-foreground mt-1">
                    {endDate ? endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                  <p className={cn("text-[11px] font-mono mt-0.5", daysToEnd !== null && daysToEnd <= 7 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground")}>
                    {daysToEnd !== null ? `${daysToEnd} days remaining` : ''}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Plan fee</p>
                  <p className="text-base font-bold font-mono text-foreground mt-1">
                    {formatCurrency(activeMembership.finalAmountPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Total package cost</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Paid</p>
                  <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCurrency(activeMembership.paidAmountPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Settled to date</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Pending due</p>
                  <p className={cn("text-base font-bold font-mono mt-1", due > 0 ? "text-destructive" : "text-foreground")}>
                    {formatCurrency(activeMembership.dueAmountPaise)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{due > 0 ? 'Payment pending' : 'Fully settled'}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground font-mono">No active membership plan currently assigned.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details & Memberships History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact & Personal Details */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Contact & Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <DetailItem icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />} label="Phone number" value={member.phone} />
                  <DetailItem icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />} label="Email address" value={member.email || '—'} />
                  {member.address && (
                    <DetailItem
                      icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                      label="Residential address"
                      value={[member.address, member.city, member.pincode].filter(Boolean).join(', ')}
                    />
                  )}
                  {member.dateOfBirth && (
                    <DetailItem
                      icon={<Cake className="h-3.5 w-3.5 text-muted-foreground" />}
                      label="Birthday"
                      value={new Date(member.dateOfBirth * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    />
                  )}
                  <DetailItem
                    icon={<Heart className="h-3.5 w-3.5 text-muted-foreground" />}
                    label="Emergency contact"
                    value={member.emergencyContactName ? `${member.emergencyContactName} (${member.emergencyContactPhone || '—'})` : '—'}
                  />
                  {member.healthNotes && (
                    <DetailItem icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} label="Health notes / injuries" value={member.healthNotes} />
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Membership History */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Membership History
                    <span className="text-xs font-normal text-muted-foreground font-mono">({memberships.length})</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {memberships.length === 0 ? (
                  <p className="p-6 text-xs text-muted-foreground text-center font-mono">No past memberships on record.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {memberships.map((m: any) => (
                      <li key={m.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{m.planName || 'Membership Plan'}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {new Date(m.startDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' → '}
                            {new Date(m.endDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={
                              m.status === 'ACTIVE' ? 'default' :
                              m.status === 'FROZEN' ? 'secondary' :
                              m.status === 'CANCELLED' ? 'outline' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {m.status}
                          </Badge>
                          <p className="text-sm font-mono font-bold text-foreground">{formatCurrency(m.finalAmountPaise)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Col: Ledger & Check-in Stream */}
          <div className="space-y-6">
            {/* Payments Ledger */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Payments
                    <span className="text-xs font-normal text-muted-foreground font-mono">({payments.length})</span>
                  </CardTitle>
                  <Link to="/payments" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
                    All <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {payments.length === 0 ? (
                  <p className="p-6 text-xs text-muted-foreground text-center font-mono">No payment transactions recorded.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {payments.slice(0, 6).map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between p-3.5 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-bold font-mono text-foreground">{formatCurrency(p.amountPaise)}</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {new Date(p.paymentDate * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' · '}{p.paymentMode}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">{p.receiptNumber}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Check-ins Activity */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Recent Check-ins
                    <span className="text-xs font-normal text-muted-foreground font-mono">({attendance.length})</span>
                  </CardTitle>
                  <Link to="/attendance" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
                    Floor <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {attendance.length === 0 ? (
                  <p className="p-6 text-xs text-muted-foreground text-center font-mono">No check-in history yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {attendance.slice(0, 6).map((a: any) => (
                      <li key={a.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/20 transition-colors">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground">{a.method} check-in</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {new Date(a.checkInTime * 1000).toLocaleString('en-IN', {
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
              </CardContent>
            </Card>
          </div>
        </div>
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

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground mt-0.5 break-words">{value}</p>
    </div>
  </div>
);
