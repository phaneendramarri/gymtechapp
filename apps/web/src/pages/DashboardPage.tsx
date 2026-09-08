import React, { useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Activity,
  CalendarX2,
  Download,
  Flame,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { CardGridSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
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
  transition: { duration: 0.25, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

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
/*  Dashboard Component (satnaing/shadcn-admin inspired)                      */
/* -------------------------------------------------------------------------- */

export const DashboardPage: React.FC = () => {
  const { user, gym } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    refetchInterval: 30_000,
  });

  const now = new Date();

  if (isLoading) {
    return (
      <AppShell
        breadcrumb={[{ label: 'Dashboard' }, { label: 'Overview' }]}
        title="Dashboard"
        description="Syncing real-time floor attendance, revenue, and member activity..."
      >
        <div className="space-y-6">
          <CardGridSkeleton count={4} cols={4} />
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <div className="lg:col-span-4">
              <TableSkeleton rows={4} columns={4} />
            </div>
            <div className="lg:col-span-3">
              <TableSkeleton rows={4} columns={3} />
            </div>
          </div>
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
  const avgAttendance = last7Days.length > 0 ? Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length) : 0;
  const attendanceGrowth = avgAttendance > 0 ? Math.round(((todayCount - avgAttendance) / avgAttendance) * 100) : 0;

  return (
    <AppShell
      breadcrumb={[{ label: 'Dashboard' }, { label: 'Overview' }]}
      title="Dashboard"
      description="Welcome back. Here is your gym floor and revenue performance summary."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-8 gap-1.5 text-xs border-border"
          >
            <Repeat2 className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
            <span>{isRefetching ? 'Syncing…' : 'Sync'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/reports/export?type=payments', '_blank')}
            className="h-8 gap-1.5 text-xs border-border max-sm:hidden"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs font-semibold">
            <Link to="/members/new">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Member</span>
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* ============================================================
            TABS BAR (satnaing/shadcn-admin pattern)
            ============================================================ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-9 p-1 bg-muted/60">
            <TabsTrigger value="overview" className="text-xs px-3.5 h-7">Overview</TabsTrigger>
            <TabsTrigger value="floor" className="text-xs px-3.5 h-7">
              Live Floor ({todayCount})
            </TabsTrigger>
            <TabsTrigger value="renewals" className="text-xs px-3.5 h-7">
              Renewals ({expiring.length})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs px-3.5 h-7">Transactions</TabsTrigger>
          </TabsList>

          {/* ============================================================
              TAB 1: OVERVIEW
              ============================================================ */}
          <TabsContent value="overview" className="space-y-6">
            
            {/* Top 4 KPI Cards (satnaing/shadcn-admin style) */}
            <motion.section {...fadeUp(0)}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* Total Revenue MTD */}
                <Card className="rounded-xl shadow-xs border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground">
                      Total Revenue (MTD)
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                      {formatCurrency(mtd * 100)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+18.2%</span> from last month
                    </p>
                  </CardContent>
                </Card>

                {/* Subscriptions / Active Members */}
                <Card className="rounded-xl shadow-xs border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground">
                      Active Memberships
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                      +{active}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+8.4%</span> retention rate
                    </p>
                  </CardContent>
                </Card>

                {/* Floor Attendance Today */}
                <Card className="rounded-xl shadow-xs border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground">
                      Floor Check-ins
                    </CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                      +{todayCount}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
                      <span className={cn('font-semibold', attendanceGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                        {attendanceGrowth >= 0 ? `+${attendanceGrowth}%` : `${attendanceGrowth}%`}
                      </span> vs 7-day average ({avgAttendance}/day)
                    </p>
                  </CardContent>
                </Card>

                {/* Outstanding Dues / Renewals */}
                <Card className="rounded-xl shadow-xs border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground">
                      Pending Dues
                    </CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                      {formatCurrency(pending * 100)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{expiring.length}</span> renewals due soon
                    </p>
                  </CardContent>
                </Card>

              </div>
            </motion.section>

            {/* 7-Col Main Section (4-span chart + 3-span recent sales list) */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
              
              {/* Overview Bar Chart (Col 1-4) */}
              <motion.div {...fadeUp(0.05)} className="lg:col-span-4">
                <Card className="h-full rounded-xl shadow-xs border-border flex flex-col justify-between">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                    <div>
                      <CardTitle className="text-base font-semibold">Overview</CardTitle>
                      <CardDescription className="text-xs">7-day footfall volume and check-in distribution</CardDescription>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      Total: <strong className="text-foreground">{last7Days.reduce((a, b) => a + b, 0)}</strong>
                    </span>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-end gap-3 h-56 pt-4">
                      {weeklyAttendance.slice(-7).map((d: any, i: number) => {
                        const max = Math.max(...last7Days, 1);
                        const height = Math.round((d.count / max) * 100);
                        const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' });
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className="w-full rounded-t-md bg-primary hover:brightness-110 transition-all cursor-pointer shadow-xs"
                                style={{ height: `${height}%`, minHeight: '6px' }}
                                title={`${d.count} check-ins on ${dayLabel}`}
                              />
                            </div>
                            <span className="text-xs font-mono font-medium text-muted-foreground">{dayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Sales / Payments List (Col 5-7) */}
              <motion.div {...fadeUp(0.08)} className="lg:col-span-3">
                <Card className="h-full rounded-xl shadow-xs border-border flex flex-col justify-between">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                    <div>
                      <CardTitle className="text-base font-semibold">Recent Sales</CardTitle>
                      <CardDescription className="text-xs">
                        You collected {recentPayments.length} payments this month.
                      </CardDescription>
                    </div>
                    <Link to="/payments" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
                      All <ArrowRight className="size-3" />
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {recentPayments.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No transactions recorded yet.
                      </div>
                    ) : (
                      recentPayments.slice(0, 5).map((p: any) => {
                        const initialsStr = initials(p.firstName || p.memberName, p.lastName);
                        return (
                          <div key={p.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                            <div className="size-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                              {initialsStr}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                                {p.memberName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Member'}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                                {p.paymentMode || 'UPI'} • {timeAgo(p.paymentDate)}
                              </p>
                            </div>
                            <div className="font-mono font-bold text-xs text-foreground shrink-0">
                              +{formatCurrency(p.amountPaise || 0)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>

            </div>

            {/* Bottom Section: Priority Action Cards */}
            <motion.section {...fadeUp(0.1)}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {expiring.length > 0 && (
                  <Link
                    to="/members"
                    className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                      <CalendarCheck className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">Renew {expiring.length} ending plans</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Send a 1-click WhatsApp reminder</p>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 mt-2 group-hover:underline">
                        Open renewal queue <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                )}

                {atRisk.length > 0 && (
                  <Link
                    to="/members"
                    className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors group flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                      <AlertTriangle className="size-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{atRisk.length} inactive members</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">No attendance logged in 14+ days</p>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 mt-2 group-hover:underline">
                        View at-risk members <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                )}

                <Link
                  to="/attendance"
                  className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Flame className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">Check-in Terminal</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">QR, Member Code & Face ID Kiosk</p>
                    <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 mt-2 group-hover:underline">
                      Open reception desk <ArrowRight className="size-3" />
                    </span>
                  </div>
                </Link>
              </div>
            </motion.section>

          </TabsContent>

          {/* ============================================================
              TAB 2: LIVE FLOOR (Check-ins feed)
              ============================================================ */}
          <TabsContent value="floor" className="space-y-4">
            <Card className="rounded-xl shadow-xs border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                <div>
                  <CardTitle className="text-base font-semibold">Live Floor Activity</CardTitle>
                  <CardDescription className="text-xs">Real-time member attendance on the gym floor</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link to="/attendance">Open Desk <ArrowRight className="size-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {todayCheckIns.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    <Users className="size-8 mx-auto mb-2 opacity-40" />
                    No check-ins logged today. Open the Check-in Desk to scan members.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {todayCheckIns.map((c: any) => (
                      <li key={c.id} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 border border-primary/20">
                          {initials(c.firstName, c.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {c.firstName} {c.lastName || ''}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">{c.memberCode}</p>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {c.checkInTime
                            ? new Date(c.checkInTime * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono bg-secondary">
                          {c.method || 'DESK'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================
              TAB 3: RENEWALS QUEUE
              ============================================================ */}
          <TabsContent value="renewals" className="space-y-4">
            <Card className="rounded-xl shadow-xs border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                <div>
                  <CardTitle className="text-base font-semibold">Renewals Ending Soon</CardTitle>
                  <CardDescription className="text-xs">Memberships due within the next 7 days</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link to="/members">Members Directory <ArrowRight className="size-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                {expiring.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                    All memberships are current. No renewals due this week.
                  </div>
                ) : (
                  expiring.map((m: ExpiringMember) => {
                    const due = (m.dueAmountPaise || 0) / 100;
                    return (
                      <div key={m.id} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="size-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 border border-amber-500/20 font-mono">
                          {initials(m.firstName, m.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {m.firstName} {m.lastName || ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {m.planName || 'Plan'} • Expires {endDateLabel(m.endDate)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-foreground font-mono">
                            {due > 0 ? formatCurrency(due) : 'Settled'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{due > 0 ? 'due' : 'paid'}</p>
                        </div>
                        <a
                          href={m.whatsappUrl || `https://wa.me/91${m.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20"
                          aria-label="Send WhatsApp"
                        >
                          <MessageCircle className="size-4" />
                        </a>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================
              TAB 4: TRANSACTIONS / LEDGER
              ============================================================ */}
          <TabsContent value="ledger" className="space-y-4">
            <Card className="rounded-xl shadow-xs border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                <div>
                  <CardTitle className="text-base font-semibold">Payment Ledger</CardTitle>
                  <CardDescription className="text-xs">Recent collections and issued receipts</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link to="/payments">Open Full Ledger <ArrowRight className="size-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative w-full overflow-x-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="border-b">
                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase font-mono">Member</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase font-mono">Receipt No</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase font-mono">Amount</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase font-mono">Method</th>
                        <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase font-mono">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {recentPayments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                            No transactions recorded.
                          </td>
                        </tr>
                      ) : (
                        recentPayments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-3.5 align-middle whitespace-nowrap">
                              <span className="font-semibold text-foreground text-xs">
                                {p.memberName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Member'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap font-mono text-xs text-primary">
                              {p.receiptNumber || `RCP-${p.id}`}
                            </td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap font-mono font-bold text-xs text-foreground">
                              {formatCurrency(p.amountPaise || 0)}
                            </td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {p.paymentMode || 'CASH'}
                              </Badge>
                            </td>
                            <td className="px-6 py-3.5 align-middle whitespace-nowrap text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedInvoiceId(p.id)}
                                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                              >
                                Invoice
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </div>

      {/* Invoice Receipt Dialog */}
      <InvoiceDialog
        paymentId={selectedInvoiceId}
        open={!!selectedInvoiceId}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
      />
    </AppShell>
  );
};
