import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck,
  CreditCard,
  Users,
  AlertTriangle,
  Clock,
  Repeat2,
  MessageCircle,
  Phone,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Wallet,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Sparkline } from '@/components/shared/Sparkline';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpiringMember } from '@gymtech/shared';

/* -------------------------------------------------------------------------- */
/*  Animation recipes                                                         */
/* -------------------------------------------------------------------------- */

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
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

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export const DashboardPage: React.FC = () => {
  const { user, gym } = useAuth();

  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    refetchInterval: 30_000,
  });

  const now = new Date();
  const isManager = user?.role === 'MANAGER';
  const firstName = user?.name?.split(' ')[0];

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

  /* ----- The 3 things a gym owner should do today ----- */
  const actions: { tone: 'primary' | 'warn' | 'default'; icon: React.ReactNode; title: string; sub: string; href: string; cta: string }[] = [];
  if (expiring.length > 0) {
    actions.push({
      tone: 'primary',
      icon: <CalendarCheck className="h-4 w-4" />,
      title: `Renew ${expiring.length} membership${expiring.length === 1 ? '' : 's'} ending this week`,
      sub: 'Send a WhatsApp nudge, or log a renewal payment right from the list.',
      href: '/members',
      cta: 'Open renewal queue',
    });
  }
  if (atRisk.length > 0) {
    actions.push({
      tone: 'warn',
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
      tone: 'default',
      icon: <Sparkles className="h-4 w-4" />,
      title: 'You are caught up.',
      sub: 'No renewals due, no at-risk members, no outstanding dues. Add a member to keep momentum.',
      href: '/members/new',
      cta: 'Add a member',
    });
  }
  // Cap at 3.
  const topActions = actions.slice(0, 3);

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
            className="text-ink-3"
          >
            <span className={cn(isRefetching && 'animate-spin')}>
              <Repeat2 className="h-3.5 w-3.5" />
            </span>
            <span className="hidden sm:inline">{isRefetching ? 'Refreshing' : 'Refresh'}</span>
          </Button>
          <Button asChild size="sm" className="bg-(--ink) text-(--ink-inverse) hover:bg-ink-2 border-(--ink) gap-1.5">
            <Link to="/members/new">
              <UserPlus className="h-3.5 w-3.5" /> New member
            </Link>
          </Button>
        </>
      }
    >
      {/* ============================================================
          HERO — Today's snapshot
          One calm, confident block. No "Operating System" jargon.
          ============================================================ */}
      <motion.section
        {...fadeUp(0)}
        className="flex flex-col gap-1 pt-10 pb-8 border-b border-(--line)"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="gt-kicker">
            <span className="size-1.5 rounded-full bg-(--iron)" /> Today at {gym?.name || 'your gym'}
          </span>
          {todayCount > 0 && (
            <span className="gt-live-pill">
              {todayCount} on the floor now
            </span>
          )}
          <span className="text-meta">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </motion.section>

      {/* ============================================================
          DO THESE 3 THINGS — action-oriented
          ============================================================ */}
      <motion.section {...fadeUp(0.05)} className="pt-8">
        <header className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="gt-kicker gt-kicker-iron">Do these today</p>
            <h2 className="text-h2 text-ink mt-1.5">Three things that move the needle</h2>
          </div>
          <p className="text-meta hidden sm:block">
            Updated <span className="num text-ink-2">{timeAgo(Math.floor(now.getTime() / 1000) - 30)}</span>
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {topActions.map((a, i) => (
            <Link
              key={i}
              to={a.href}
              data-tone={a.tone}
              className="gt-action"
            >
              <span className="gt-action-icon">{a.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-ink leading-snug">
                  {a.title}
                </span>
                <span className="block text-[12px] text-ink-3 mt-1 leading-relaxed">
                  {a.sub}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink-3 shrink-0" />
            </Link>
          ))}
        </div>
      </motion.section>

      {/* ============================================================
          COMMAND STRIP — the four numbers a gym owner checks daily.
          Single dense band, no card stack.
          ============================================================ */}
      <motion.section {...fadeUp(0.1)} className="pt-10">
        <header className="mb-4">
          <p className="gt-kicker">By the numbers</p>
        </header>

        <div className="gt-strip">
          <StripCell
            label="Check-ins today"
            value={todayCount}
            spark={last7Days}
            live
            foot={last7Days.length > 0 ? `Last 7 days avg ${Math.round(last7Days.reduce((a: number, b: number) => a + b, 0) / last7Days.length)}` : 'Awaiting first check-in'}
          />
          <StripCell
            label="Revenue this month"
            value={compactNumber(mtd)}
            prefix="₹"
            spark={revSeries}
            delta={revSeries.length >= 2 ? pct(revSeries) : undefined}
            foot={revSeries.length > 0 ? 'vs. last 6 months' : undefined}
          />
          <StripCell
            label="Active members"
            value={active}
            foot={expiring.length > 0 ? `${expiring.length} expiring in 7 days` : 'All healthy'}
          />
          <StripCell
            label={isManager ? 'At-risk' : 'Outstanding dues'}
            value={isManager ? atRisk.length : compactNumber(pending)}
            prefix={isManager ? undefined : '₹'}
            tone={isManager ? (atRisk.length > 0 ? 'warn' : 'default') : pending > 0 ? 'warn' : 'default'}
            foot={
              isManager
                ? atRisk.length > 0
                  ? 'Inactive 14+ days'
                  : 'None flagged'
                : pending > 0
                  ? `${atRisk.length} at-risk`
                  : 'All settled'
            }
          />
        </div>
      </motion.section>

      {/* ============================================================
          BODY — two columns
          Left: today's floor + weekly pulse
          Right: renewals + recent payments
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-10">

        {/* LEFT ------------------------------------------------------------ */}
        <div className="lg:col-span-2 flex flex-col gap-10 min-w-0">

          {/* Today's floor — live check-in stream */}
          <motion.section {...fadeUp(0.15)}>
            <header className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="gt-kicker">On the floor</p>
                <h2 className="text-h2 text-ink mt-1.5">Today's check-ins</h2>
              </div>
              <Link to="/attendance" className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1 group">
                Open check-in desk
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </header>

            {isLoading ? (
              <SkeletonRows rows={4} />
            ) : todayCheckIns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-(--line) px-6 py-8 text-center">
                <p className="text-h3 text-ink">No one has checked in yet.</p>
                <p className="text-meta mt-1.5 max-w-md mx-auto">
                  When a member scans in or the desk logs them, you'll see the live stream here.
                </p>
                <div className="mt-4">
                  <Button asChild size="sm" className="bg-iron text-iron-ink hover:bg-iron-hover border-iron">
                    <Link to="/attendance">
                      Open the desk
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line-2 border-t border-b border-(--line)">
                {todayCheckIns.slice(0, 6).map((c: any) => (
                  <li key={c.id} className="flex items-center gap-3 py-3.5">
                    <span className="gt-avatar" data-size="md">
                      {initials(c.first_name, c.last_name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {c.first_name} {c.last_name || ''}
                      </p>
                      <p className="text-meta mt-0.5 font-mono">
                        {c.member_code}
                      </p>
                    </div>
                      <span className="text-meta hidden sm:inline">
                      {c.check_in_time ? new Date(c.check_in_time * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <span className="gt-tag" data-tone={c.method === 'FACE_ID' ? 'iron' : 'ok'}>
                      <CheckCircle2 className="h-3 w-3" /> {c.method === 'FACE_ID' ? 'Face ID' : c.method === 'QR' ? 'QR' : 'Desk'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          {/* Weekly pulse — single chart, no card stacking */}
          <motion.section {...fadeUp(0.2)}>
            <header className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="gt-kicker">Pulse</p>
                <h2 className="text-h2 text-ink mt-1.5">Footfall, last 7 days</h2>
              </div>
              <div className="text-right">
                <p className="text-meta">Total</p>
                <p className="text-h3 text-ink num mt-0.5">
                  {last7Days.reduce((a: number, b: number) => a + b, 0)}
                </p>
              </div>
            </header>

            {last7Days.length > 0 ? (
              <WeeklyBars data={weeklyAttendance.slice(-7)} />
            ) : (
              <div className="rounded-lg border border-dashed border-(--line) px-6 py-10 text-center">
                <p className="text-meta">Footfall will appear here once members start checking in.</p>
              </div>
            )}
          </motion.section>
        </div>

        {/* RIGHT RAIL ------------------------------------------------------ */}
        <motion.aside {...fadeUp(0.15)} className="flex flex-col min-w-0">

          {/* Renewals — the action card the gym owner actually opens */}
          <div className="gt-rail-block">
            <header className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="gt-kicker">Renewals</p>
                <h2 className="text-h2 text-ink mt-1.5">
                  Ending this week
                  {expiring.length > 0 && (
                    <span className="text-h3 text-ink-3 num ml-2">{expiring.length}</span>
                  )}
                </h2>
              </div>
              <Link to="/members" className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </header>

            {isLoading ? (
              <SkeletonRows rows={3} />
            ) : expiring.length === 0 ? (
              <p className="text-meta py-3">No renewals due this week. Nice.</p>
            ) : (
              <ul className="flex flex-col">
                {expiring.slice(0, 4).map((m: ExpiringMember) => {
                  const due = (m.due_amount_paise || 0) / 100;
                  return (
                    <li key={m.id} className="group flex items-center gap-3 py-3 border-t border-(--line-2) first:border-t-0">
                      <span className="gt-avatar" data-size="md">
                        {initials(m.first_name, m.last_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {m.first_name} {m.last_name || ''}
                        </p>
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          {m.plan_name || 'Plan'} · ends {endDateLabel(m.end_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm num text-ink font-medium">
                          {due > 0 ? formatCurrency(due) : '—'}
                        </p>
                        <p className="text-[10px] text-ink-3 mt-0.5">
                          {due > 0 ? 'due' : 'paid'}
                        </p>
                      </div>
                      <a
                        href={m.whatsapp_url || `https://wa.me/91${m.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="WhatsApp reminder"
                        className="size-8 rounded-md text-(--positive) hover:bg-(--positive-soft) flex items-center justify-center shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent payments */}
          <div className="gt-rail-block">
            <header className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="gt-kicker">Cash in</p>
                <h2 className="text-h2 text-ink mt-1.5">Recent payments</h2>
              </div>
              <Link to="/payments" className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </header>

            {isLoading ? (
              <SkeletonRows rows={3} />
            ) : recentPayments.length === 0 ? (
              <p className="text-meta py-3">No payments logged yet today.</p>
            ) : (
              <ul className="flex flex-col">
                {recentPayments.slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex items-center gap-3 py-3 border-t border-line-2 first:border-t-0">
                    <span className="gt-avatar" data-size="md" style={{ backgroundColor: 'var(--positive-soft)', color: 'var(--positive)' }}>
                      <CreditCard className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {p.member_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Member'}
                      </p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        {p.payment_mode || 'Cash'} · {timeAgo(p.payment_date)}
                      </p>
                    </div>
                    <p className="text-sm num text-ink font-medium shrink-0">
                      {formatCurrency((p.amount_paise || 0) / 100)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* At-risk — only if there are any */}
          {atRisk.length > 0 && (
            <div className="gt-rail-block">
              <header className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="gt-kicker" style={{ color: 'var(--warning)' }}>At risk</p>
                  <h2 className="text-h2 text-ink mt-1.5">
                    Gone quiet
                    <span className="text-h3 text-ink-3 num ml-2">{atRisk.length}</span>
                  </h2>
                </div>
              </header>
              <ul className="flex flex-col">
                {atRisk.slice(0, 4).map((m: any) => (
                  <li key={m.id} className="group flex items-center gap-3 py-3 border-t border-(--line-2) first:border-t-0">
                    <span className="gt-avatar" data-size="md">
                      {initials(m.name?.split(' ')[0], m.name?.split(' ')[1])}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{m.name}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Inactive {m.daysInactive}d · {m.plan}
                      </p>
                    </div>
                    <a
                      href={`tel:${m.phone}`}
                      className="size-8 rounded-md text-ink-3 hover:text-ink hover:bg-(--surface-2) flex items-center justify-center shrink-0"
                      aria-label="Call"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.aside>
      </div>
    </AppShell>
  );
};

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

const StripCell: React.FC<{
  label: string;
  value: number | string;
  prefix?: string;
  spark?: number[];
  delta?: { value: string; up: boolean };
  live?: boolean;
  tone?: 'default' | 'warn';
  foot?: string;
}> = ({ label, value, prefix, spark, delta, live, tone = 'default', foot }) => (
  <div className="gt-strip-cell">
    <div className="flex items-center gap-1.5">
      <span className="text-eyebrow">{label}</span>
      {live && <span className="size-1.5 rounded-full bg-(--positive) gt-live" />}
    </div>
    <div className="flex items-baseline gap-1 mt-1">
      {prefix && <span className={cn('text-stat-md text-ink-2', tone === 'warn' && 'text-(--warning)')}>{prefix}</span>}
      <span className={cn('text-stat-xl text-ink num', tone === 'warn' && 'text-(--warning)')}>
        {value}
      </span>
      {delta && (
        <span className={cn(
          'text-xs font-medium num ml-1.5 inline-flex items-center gap-0.5',
          delta.up ? 'text-(--positive)' : 'text-(--danger)'
        )}>
          {delta.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta.value}
        </span>
      )}
    </div>
    {foot && <p className="text-[11px] text-ink-3 mt-1">{foot}</p>}
    {spark && spark.length > 0 && (
      <div className="mt-2 -mb-1">
        <Sparkline data={spark} width={180} height={28} strokeClassName="stroke-ink-2" fillClassName="fill-ink-3/5" />
      </div>
    )}
  </div>
);

const SkeletonRows: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="gt-skel h-12" />
    ))}
  </div>
);

const WeeklyBars: React.FC<{ data: { day: string; count: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="border-t border-b border-(--line) py-6 px-2">
      <div className="flex items-end gap-3 h-32">
        {data.map((d, i) => {
          const pct = (d.count / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <span className="text-[10px] text-ink num font-mono">{d.count}</span>
              <div className="w-full bg-(--surface-2) rounded-sm relative h-full overflow-hidden">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-0 left-0 right-0 bg-ink-2 rounded-sm"
                />
              </div>
              <span className="text-[10px] text-ink-3 font-mono uppercase">{d.day.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function pct(series: number[]): { value: string; up: boolean } | undefined {
  if (series.length < 2) return undefined;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) return undefined;
  const change = ((last - prev) / prev) * 100;
  return {
    value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
    up: change >= 0,
  };
}
