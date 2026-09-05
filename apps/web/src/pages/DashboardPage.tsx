import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Users,
  AlertTriangle,
  Repeat2,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  Wallet,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/shared/MetricCard';
import { ScrollSpyNav } from '@/components/layout/ScrollSpyNav';

const DASHBOARD_SECTIONS = [
  { id: 'hero', label: 'Overview' },
  { id: 'actions', label: 'Actions' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'floor', label: 'Floor' },
  { id: 'renewals', label: 'Renewals' },
  { id: 'payments', label: 'Payments' },
  { id: 'atrisk', label: 'At-risk' },
] as const;

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpiringMember } from '@gymtech/shared';

/* -------------------------------------------------------------------------- */
/*  Animation                                                                 */
/* -------------------------------------------------------------------------- */

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function greeting(now: Date, name?: string) {
  const h = now.getHours();
  const prefix = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${prefix}, ${name}` : prefix;
}

function greetingLine(metrics: any) {
  const today = metrics?.todayAttendance ?? 0;
  if (today === 0) return 'A quiet start — your floor is ready when your members are.';
  if (today < 10) return `${today} member${today === 1 ? '' : 's'} on the floor so far. The day is still young.`;
  if (today < 30) return `Strong turnout — ${today} members checked in already.`;
  return `Big day — ${today} members through the door and counting.`;
}

function compactNumber(n: number) {
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
}

function initials(first?: string | null, last?: string | null) {
  return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || '·';
}

function timeAgo(unix: number) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function endDateLabel(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function pct(series: number[]) {
  if (series.length < 2) return undefined;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return undefined;
  const delta = ((last - first) / first) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

/* -------------------------------------------------------------------------- */
/*  Skeleton row helpers                                                      */
/* -------------------------------------------------------------------------- */

const SkeletonRow = () => (
  <div className="flex items-center gap-3 py-3.5">
    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-4 w-32 mb-1.5 rounded" />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
    <Skeleton className="h-4 w-16 rounded" />
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

import { CardGridSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';

export const DashboardPage: React.FC = () => {
  const { user, gym } = useAuth();

  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    refetchInterval: 30_000,
  });

  const now = new Date();
  const firstName = user?.name?.split(' ')[0];

  if (isLoading) {
    return (
      <AppShell
        breadcrumb="Today"
        title={greeting(now, firstName)}
        description="Syncing real-time floor attendance, revenue, and member activity..."
      >
        <div className="space-y-8 py-2">
          <CardGridSkeleton count={3} cols={3} />
          <CardGridSkeleton count={4} cols={4} />
          <TableSkeleton rows={4} columns={5} />
        </div>
      </AppShell>
    );
  }

  const mtd = (metrics?.monthlyRevenue || 0) / 100;
  const pending = (metrics?.pendingDues || 0) / 100;
  const todayCount = metrics?.todayAttendance ?? 0;
  const active = metrics?.activeMembers ?? 0;
  const expiring = metrics?.expiringSoon ?? [];
  const atRisk = metrics?.atRiskMembers ?? [];
  const todayCheckIns = metrics?.todayCheckIns ?? [];
  const recentPayments = metrics?.recentPayments ?? [];
  const weeklyAttendance = metrics?.weeklyAttendance ?? [];
  const monthlyTrend = metrics?.monthlyRevenueTrend ?? [];

  const last7Days = weeklyAttendance.slice(-7).map((d: any) => d.count);
  const revSeries = monthlyTrend.slice(-6).map((m: any) => m.revenue);
  const revDelta = pct(revSeries);

  /* ----- Action cards ----- */
  const actions: { tone: 'default' | 'warn' | 'success'; icon: React.ReactNode; title: string; sub: string; href: string; cta: string }[] = [];
  if (expiring.length > 0) {
    actions.push({
      tone: 'warn',
      icon: <CalendarCheck className="h-4 w-4" />,
      title: `Renew ${expiring.length} membership${expiring.length === 1 ? '' : 's'} ending this week`,
      sub: 'Send a WhatsApp nudge, or log a renewal payment right from the list.',
      href: '/members',
      cta: 'Open renewal queue',
    });
  }
  if (atRisk.length > 0) {
    actions.push({
      tone: 'default',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `Re-engage ${atRisk.length} at-risk member${atRisk.length === 1 ? '' : 's'}`,
      sub: 'Members inactive for 14+ days. A quick check-in message goes a long way.',
      href: '/members',
      cta: 'See who needs a nudge',
    });
  }
  if (pending > 0) {
    actions.push({
      tone: 'default',
      icon: <Wallet className="h-4 w-4" />,
      title: `Collect ${formatCurrency(pending)} in outstanding dues`,
      sub: 'Members with a positive balance on their membership. Record a payment in seconds.',
      href: '/payments',
      cta: 'Record a payment',
    });
  }
  if (actions.length === 0) {
    actions.push({
      tone: 'success',
      icon: <Sparkles className="h-4 w-4" />,
      title: 'You are caught up.',
      sub: 'No renewals due, no at-risk members, no outstanding dues. Add a member to keep momentum.',
      href: '/members/new',
      cta: 'Add a member',
    });
  }
  const topActions = actions.slice(0, 3);

  const toneClasses = {
    warn: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50',
    default: 'border-border bg-card',
    success: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50',
  };
  const toneIconBg = {
    warn: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    default: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <AppShell
      breadcrumb="Today"
      title={greeting(now, firstName)}
      description={greetingLine(metrics)}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-muted-foreground"
          >
            <span className={cn(isRefetching && 'animate-spin')}>
              <Repeat2 className="h-3.5 w-3.5" />
            </span>
            <span className="hidden sm:inline ml-1.5">{isRefetching ? 'Refreshing' : 'Refresh'}</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/members/new">
              <UserPlus className="h-3.5 w-3.5" /> New member
            </Link>
          </Button>
        </>
      }
    >
      <ScrollSpyNav items={DASHBOARD_SECTIONS.map(s => ({ id: s.id, label: s.label }))} />

      <div className="space-y-10">

        {/* ============================================================
            HERO — greeting
            ============================================================ */}
        <motion.section id="hero" {...fadeUp(0)} className="pt-2 pb-6 border-b border-border scroll-mt-28">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant="secondary" className="font-medium text-xs">
                  {gym?.name || 'Your gym'}
                </Badge>
                {todayCount > 0 ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-mono text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {todayCount} on floor now
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground font-mono text-xs">
                    Floor awaiting arrivals
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                {greetingLine(metrics)}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ============================================================
            PRIORITY ACTIONS
            ============================================================ */}
        <motion.section id="actions" {...fadeUp(0.05)} className="scroll-mt-28">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Three things to prioritise</h2>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topActions.map((a, i) => (
              <Link
                key={i}
                to={a.href}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border transition-colors hover:bg-accent/50 group',
                  toneClasses[a.tone]
                )}
              >
                <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', toneIconBg[a.tone])}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.sub}</p>
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary mt-2 group-hover:underline">
                    {a.cta} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ============================================================
            METRICS ROW
            ============================================================ */}
        <motion.section id="metrics" {...fadeUp(0.1)} className="scroll-mt-28">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Check-ins today"
              value={todayCount}
              icon={Users}
              sub={last7Days.length > 0 ? `Avg ${Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length)}/day (7d)` : 'Awaiting first check-in'}
            />
            <MetricCard
              label="Revenue this month"
              value={compactNumber(mtd)}
              prefix="₹"
              icon={CreditCard}
              delta={revDelta}
              sub="vs. last 6 months"
            />
            <MetricCard
              label="Active members"
              value={active}
              icon={CheckCircle2}
              sub={expiring.length > 0 ? `${expiring.length} expiring in 7 days` : 'All healthy'}
            />
            <MetricCard
              label={user?.isOwner ? 'At-risk' : 'Outstanding dues'}
              value={user?.isOwner ? atRisk.length : formatCurrency(pending)}
              icon={user?.isOwner ? AlertTriangle : Wallet}
              sub={
                user?.isOwner
                  ? atRisk.length > 0 ? 'Inactive 14+ days' : 'None flagged'
                  : pending > 0 ? `${atRisk.length} at-risk` : 'All settled'
              }
            />
          </div>
        </motion.section>

        {/* ============================================================
            TWO-COLUMN BODY
            ============================================================ */}
        <div id="checkins" className="grid grid-cols-1 lg:grid-cols-3 gap-8 scroll-mt-28">

          {/* LEFT — check-ins + weekly pulse */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Today's check-ins */}
            <motion.section {...fadeUp(0.15)}>
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Today's check-ins</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Live floor activity</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  <Link to="/attendance">
                    Open check-in desk <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-0">
                      {[0, 1, 2, 3].map(i => <SkeletonRow key={i} />)}
                    </div>
                  ) : todayCheckIns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No one has checked in yet</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        When a member scans in or the desk logs them, you'll see the live stream here.
                      </p>
                      <Button asChild size="sm" className="mt-4 gap-1.5">
                        <Link to="/attendance">Open the desk <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {todayCheckIns.slice(0, 6).map((c: any) => (
                        <li key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(c.firstName, c.lastName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.firstName} {c.lastName || ''}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground">{c.memberCode}</p>
                          </div>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {c.checkInTime
                              ? new Date(c.checkInTime * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </span>
                          <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                            {c.method === 'FACE_ID' ? (
                              <><CheckCircle2 className="h-3 w-3" /> Face ID</>
                            ) : c.method === 'QR' ? (
                              <><CheckCircle2 className="h-3 w-3" /> QR</>
                            ) : (
                              <><CheckCircle2 className="h-3 w-3" /> Desk</>
                            )}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.section>

            {/* Weekly attendance bars */}
            <motion.section id="floor" {...fadeUp(0.2)} className="scroll-mt-28">
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Footfall, last 7 days</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Daily check-in trend</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {last7Days.reduce((a: number, b: number) => a + b, 0)}
                  </p>
                </div>
              </div>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  {last7Days.length > 0 ? (
                    <div className="flex items-end gap-2 h-28">
                      {weeklyAttendance.slice(-7).map((d: any, i: number) => {
                        const max = Math.max(...last7Days, 1);
                        const height = Math.round((d.count / max) * 100);
                        const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className="w-full rounded-t-md bg-primary/20 hover:bg-primary/30 transition-colors rounded-b-sm"
                                style={{ height: `${height}%`, minHeight: '4px' }}
                                title={`${d.count} check-ins`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{dayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-28 text-sm text-muted-foreground">
                      Footfall will appear here once members start checking in.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </div>

          {/* RIGHT RAIL */}
          <motion.aside {...fadeUp(0.15)} className="flex flex-col gap-6">

            {/* Renewals */}
            <div id="renewals" className="scroll-mt-28">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Ending this week</h2>
                  <p className="text-sm text-muted-foreground">Renewals</p>
                </div>
                <Link to="/members" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Card className="border-border/50">
                <CardContent className="p-0 divide-y divide-border">
                  {isLoading ? (
                    <div className="p-4 space-y-0">{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</div>
                  ) : expiring.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-sm font-medium text-foreground">No renewals due</p>
                      <p className="text-xs text-muted-foreground mt-1">You're all caught up this week.</p>
                    </div>
                  ) : (
                    expiring.slice(0, 4).map((m: ExpiringMember) => {
                      const due = (m.dueAmountPaise || 0) / 100;
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                          <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(m.firstName, m.lastName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {m.firstName} {m.lastName || ''}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {m.planName || 'Plan'} · {endDateLabel(m.endDate)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-foreground tabular-nums">
                              {due > 0 ? formatCurrency(due) : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">{due > 0 ? 'due' : 'paid'}</p>
                          </div>
                          <a
                            href={m.whatsappUrl || `https://wa.me/91${m.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Send WhatsApp reminder"
                            className="size-8 rounded-md text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 flex items-center justify-center shrink-0"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent payments */}
            <div id="payments" className="scroll-mt-28">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent payments</h2>
                  <p className="text-sm text-muted-foreground">Cash in</p>
                </div>
                <Link to="/payments" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Card className="border-border/50">
                <CardContent className="p-0 divide-y divide-border">
                  {isLoading ? (
                    <div className="p-4 space-y-0">{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</div>
                  ) : recentPayments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">No payments yet today</p>
                      <p className="text-xs text-muted-foreground mt-1">Payments will appear here as they're recorded.</p>
                    </div>
                  ) : (
                    recentPayments.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.memberName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Member'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.paymentMode || 'Cash'} · {timeAgo(p.paymentDate)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                          {formatCurrency((p.amountPaise || 0) / 100)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* At-risk (only if there are any) */}
            {atRisk.length > 0 && (
              <div id="atrisk" className="scroll-mt-28">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">At-risk members</h2>
                    <p className="text-sm text-muted-foreground">Inactive 14+ days</p>
                  </div>
                  <Link to="/members" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    All <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="p-0 divide-y divide-amber-200 dark:divide-amber-900">
                    {atRisk.slice(0, 4).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(m.firstName, m.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {m.firstName} {m.lastName || ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Last seen {timeAgo(m.lastAttendanceAt || m.createdAt)}
                          </p>
                        </div>
                        <a
                          href={m.whatsappUrl || `https://wa.me/91${m.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Send WhatsApp check-in"
                          className="size-8 rounded-md text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50 flex items-center justify-center shrink-0"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.aside>
        </div>
      </div>
    </AppShell>
  );
};
