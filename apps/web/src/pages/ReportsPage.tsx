import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ArrowDownToLine,
  FileText,
  Users,
  IndianRupee,
  CalendarCheck,
  Download,
  TrendingUp,
  BarChart3,
  Activity,
  UserPlus,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ─── Date helpers ────────────────────────────────────────────────────────────

function periodToRange(period: 'month' | 'quarter' | 'year'): { startDate: number; endDate: number } {
  const now = Math.floor(Date.now() / 1000);
  const offsets: Record<string, number> = {
    month: 30 * 86400,
    quarter: 90 * 86400,
    year: 365 * 86400,
  };
  return { startDate: now - offsets[period], endDate: now };
}

const PERIODS: { key: 'month' | 'quarter' | 'year'; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 90 Days' },
  { key: 'year', label: 'This Year' },
];

// ─── Report stat tile (local to this page; the shared StatCard has a
// different prop API) ────────────────────────────────────────────────────

const ReportStat: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg?: string;
  valueClass?: string;
}> = ({ label, value, sub, icon, iconBg = 'bg-primary/10 text-primary', valueClass }) => (
  <Card className="border-border shadow-xs">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', iconBg)}>{icon}</div>
      </div>
      <p className={cn('text-2xl font-bold font-mono text-foreground mt-2', valueClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground font-mono mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ period: 'month' | 'quarter' | 'year' }> = ({ period }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', period],
    queryFn: () => api.getReports(period),
  });

  const metrics = data?.metrics;
  const planBreakdown = data?.planBreakdown || [];
  const trend = metrics?.monthlyRevenueTrend || [];

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStat
          label="Period Revenue"
          value={formatCurrency(data?.periodRevenue || 0)}
          sub={`Across ${data?.periodPaymentCount || 0} settlements`}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <ReportStat
          label="Active Members"
          value={String(metrics?.activeMembers ?? 0)}
          sub="Enrolled & in good standing"
          icon={<Users className="h-3.5 w-3.5" />}
          iconBg="bg-emerald-500/10 text-emerald-500"
        />
        <ReportStat
          label="Check-ins Today"
          value={String(metrics?.todayAttendance ?? 0)}
          sub="Floor visits recorded"
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          iconBg="bg-blue-500/10 text-blue-500"
        />
        <ReportStat
          label="Pending Dues"
          value={formatCurrency(metrics?.pendingDues || 0)}
          sub="Uncollected balances"
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          iconBg="bg-destructive/10 text-destructive"
          valueClass="text-destructive"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trajectory
              </CardTitle>
              <CardDescription className="text-xs">
                Monthly collection trends across all active payment modes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {trend.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-xs text-muted-foreground font-mono">
                  No historical revenue trend points available.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportsRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D9480F" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#D9480F" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(v: any) => [formatCurrency(Number(v) * 100), 'Collected']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#D9480F"
                        strokeWidth={2.5}
                        fill="url(#reportsRevGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Subscription Distribution by Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {planBreakdown.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                  No plan breakdown data recorded yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {planBreakdown.slice(0, 6).map((p: any) => {
                    const max = Math.max(...planBreakdown.map((x: any) => Number(x.count) || 0)) || 1;
                    const pct = Math.round(((Number(p.count) || 0) / max) * 100);
                    return (
                      <li key={p.name} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0 flex-1 pr-6">
                          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                            <span className="text-foreground truncate">{p.name}</span>
                            <span className="text-muted-foreground font-mono">{p.count} members</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono text-foreground">{formatCurrency(p.revenue || 0)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <ExportsPanel />
      </div>
    </div>
  );
};

// ─── Tab: Revenue ─────────────────────────────────────────────────────────────

const RevenueTab: React.FC<{ period: 'month' | 'quarter' | 'year' }> = ({ period }) => {
  const { startDate, endDate } = periodToRange(period);
  const groupBy = period === 'year' ? 'month' : period === 'quarter' ? 'week' : 'day';

  const { data, isLoading } = useQuery({
    queryKey: ['reports-revenue', period],
    queryFn: () => api.getRevenueReport({ startDate, endDate, groupBy }),
  });

  if (isLoading) return <TabSkeleton />;

  const total = data?.totalRevenue;
  const timeSeries = data?.timeSeries || [];
  const byPlan = data?.revenueByPlan || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStat
          label="Total Revenue"
          value={formatCurrency(total?.total_paise || 0)}
          sub={`${total?.payment_count || 0} payments`}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <ReportStat
          label="Cash"
          value={formatCurrency(total?.cash_paise || 0)}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          iconBg="bg-amber-500/10 text-amber-600"
        />
        <ReportStat
          label="UPI / Card"
          value={formatCurrency((total?.upi_paise || 0) + (total?.card_paise || 0))}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          iconBg="bg-blue-500/10 text-blue-600"
        />
        <ReportStat
          label="Bank Transfer"
          value={formatCurrency(total?.bank_paise || 0)}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          iconBg="bg-purple-500/10 text-purple-600"
        />
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Revenue Over Time
          </CardTitle>
          <CardDescription className="text-xs">Collections grouped by {groupBy}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {timeSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground font-mono">
              No revenue data for this period.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D9480F" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#D9480F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${Math.round(v / 100)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue_paise" stroke="#D9480F" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Revenue by Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {byPlan.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground font-mono">No plan data.</div>
          ) : (
            <ul className="divide-y divide-border">
              {byPlan.map((p) => {
                const max = Math.max(...byPlan.map((x) => x.revenue_paise)) || 1;
                return (
                  <li key={p.plan_name} className="flex items-center justify-between p-4 hover:bg-muted/20">
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium truncate">{p.plan_name || 'Unknown Plan'}</span>
                        <span className="text-muted-foreground font-mono">{p.member_count} members</span>
                      </div>
                      <Progress value={Math.round((p.revenue_paise / max) * 100)} className="h-1.5" />
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold font-mono">{formatCurrency(p.revenue_paise)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.payment_count} txns</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Tab: Membership ──────────────────────────────────────────────────────────

const MembershipTab: React.FC<{ period: 'month' | 'quarter' | 'year' }> = ({ period }) => {
  const { startDate, endDate } = periodToRange(period);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-membership', period],
    queryFn: () => api.getMembershipReport({ startDate, endDate }),
  });

  if (isLoading) return <TabSkeleton />;

  const summary = data?.summary;
  const byPlan = data?.byPlan || [];
  const expiring = data?.expiring || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <ReportStat
          label="Total Active"
          value={String(summary?.total_active ?? 0)}
          icon={<Users className="h-3.5 w-3.5" />}
          iconBg="bg-emerald-500/10 text-emerald-500"
        />
        <ReportStat
          label="New Members"
          value={String(summary?.new_memberships ?? 0)}
          sub="Joined this period"
          icon={<UserPlus className="h-3.5 w-3.5" />}
          iconBg="bg-blue-500/10 text-blue-500"
        />
        <ReportStat
          label="Renewals"
          value={String(summary?.renewals ?? 0)}
          icon={<Activity className="h-3.5 w-3.5" />}
          iconBg="bg-primary/10 text-primary"
        />
        <ReportStat
          label="Expired"
          value={String(summary?.expired ?? 0)}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          iconBg="bg-amber-500/10 text-amber-600"
          valueClass="text-amber-600"
        />
        <ReportStat
          label="Frozen"
          value={String(summary?.frozen ?? 0)}
          icon={<Clock className="h-3.5 w-3.5" />}
          iconBg="bg-slate-400/10 text-slate-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Active Members by Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {byPlan.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">No plan data.</div>
            ) : (
              <ul className="divide-y divide-border">
                {byPlan.map((p) => {
                  const max = Math.max(...byPlan.map((x) => x.active_count)) || 1;
                  return (
                    <li key={p.plan_name} className="p-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium truncate">{p.plan_name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {p.expiring_soon > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              {p.expiring_soon} expiring
                            </Badge>
                          )}
                          <span className="font-mono text-muted-foreground">{p.active_count} active</span>
                        </div>
                      </div>
                      <Progress value={Math.round((p.active_count / max) * 100)} className="h-1.5" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Expiring Soon
            </CardTitle>
            <CardDescription className="text-xs">Members whose memberships expire within 7 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {expiring.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                No memberships expiring soon. 🎉
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {expiring.slice(0, 8).map((m) => (
                  <li key={m.member_id} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {m.member_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{m.member_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{m.plan_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono text-amber-600">
                        {new Date(m.end_date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
  );
};

// ─── Tab: Attendance ──────────────────────────────────────────────────────────

const AttendanceTab: React.FC<{ period: 'month' | 'quarter' | 'year' }> = ({ period }) => {
  const { startDate, endDate } = periodToRange(period);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-attendance', period],
    queryFn: () => api.getAttendanceReport({ startDate, endDate }),
  });

  // useMemo must run on every render — it cannot sit behind the early
  // return below (hook-order crash, React #310). It reads empty arrays
  // while loading, which is harmless.
  const peakHoursPre = data?.peakHours || [];
  const peakHoursFormatted = useMemo(
    () =>
      peakHoursPre.map((h) => ({
        ...h,
        label: `${h.hour}:00`,
      })),
    [peakHoursPre]
  );

  if (isLoading) return <TabSkeleton />;

  const summary = data?.summary;
  const byDay = data?.byDay || [];
  const topMembers = data?.topMembers || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <ReportStat
          label="Total Check-ins"
          value={String(summary?.total_checkins ?? 0)}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          iconBg="bg-blue-500/10 text-blue-500"
        />
        <ReportStat
          label="Unique Members"
          value={String(summary?.unique_members ?? 0)}
          sub="Distinct visitors"
          icon={<Users className="h-3.5 w-3.5" />}
          iconBg="bg-emerald-500/10 text-emerald-500"
        />
        <ReportStat
          label="Daily Average"
          value={String(Math.round(summary?.avg_daily ?? 0))}
          sub="Check-ins per day"
          icon={<Activity className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Daily Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {byDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-mono">
                No attendance data for this period.
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: any) => [v, 'Check-ins']}
                    />
                    <Bar dataKey="checkin_count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Peak Hours
            </CardTitle>
            <CardDescription className="text-xs">When your gym is busiest</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {peakHoursFormatted.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-mono">
                No hourly data.
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHoursFormatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: any) => [v, 'Check-ins']}
                    />
                    <Bar dataKey="checkin_count" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Most Active Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground font-mono">No data.</div>
          ) : (
            <ul className="divide-y divide-border">
              {topMembers.slice(0, 10).map((m, idx) => {
                const max = topMembers[0]?.checkin_count || 1;
                return (
                  <li key={m.member_id} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                    <span className="w-5 text-[11px] text-muted-foreground font-mono text-center">{idx + 1}</span>
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {m.member_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{m.member_name}</p>
                      <Progress value={Math.round((m.checkin_count / max) * 100)} className="h-1 mt-1" />
                    </div>
                    <span className="text-sm font-bold font-mono shrink-0">{m.checkin_count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Tab: Growth ──────────────────────────────────────────────────────────────

const GrowthTab: React.FC<{ period: 'month' | 'quarter' | 'year' }> = ({ period }) => {
  const { startDate, endDate } = periodToRange(period);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-growth', period],
    queryFn: () => api.getMemberGrowthReport(startDate, endDate),
  });

  if (isLoading) return <TabSkeleton />;

  const summary = data?.summary;
  const series = data?.series || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <ReportStat
          label="New Joins"
          value={String(summary?.total_joins ?? 0)}
          sub="Members enrolled"
          icon={<UserPlus className="h-3.5 w-3.5" />}
          iconBg="bg-emerald-500/10 text-emerald-500"
        />
        <ReportStat
          label="Churned"
          value={String(summary?.total_churned ?? 0)}
          sub="Memberships lapsed"
          icon={<Users className="h-3.5 w-3.5" />}
          iconBg="bg-destructive/10 text-destructive"
          valueClass="text-destructive"
        />
        <ReportStat
          label="Net Growth"
          value={`${(summary?.net_growth ?? 0) >= 0 ? '+' : ''}${summary?.net_growth ?? 0}`}
          sub="Joins minus churn"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          iconBg={(summary?.net_growth ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}
          valueClass={(summary?.net_growth ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Member Growth Over Time
          </CardTitle>
          <CardDescription className="text-xs">New joins vs. membership churn</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {series.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs text-muted-foreground font-mono">
              No growth data for this period.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="joins" name="New Joins" fill="#10B981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="churned" name="Churned" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Exports Panel ────────────────────────────────────────────────────────────

const ExportsPanel: React.FC = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (type: 'payments' | 'members' | 'attendance' | 'dues') => {
    setExporting(type);
    try {
      await api.downloadReportExport(type);
      toast('success', 'Export ready', `${type} report downloaded as CSV.`);
    } catch (err: any) {
      toast('error', 'Export failed', err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary" /> Data Exports
          </CardTitle>
          <CardDescription className="text-xs">
            Download full CSV datasets for accounting, auditing, or CRM sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          <ul className="divide-y divide-border">
            {[
              { key: 'payments' as const, label: 'Payments Ledger', desc: 'All settled UPI, Cash & Card transactions' },
              { key: 'members' as const, label: 'Members Directory', desc: 'Active, expiring & archived member profiles' },
              { key: 'attendance' as const, label: 'Attendance Logs', desc: 'Biometric & QR scan check-in history' },
              { key: 'dues' as const, label: 'Outstanding Dues', desc: 'Pending balances with contact numbers' },
            ].map((e) => (
              <li key={e.key} className="p-2">
                <button
                  onClick={() => handleExport(e.key)}
                  disabled={exporting === e.key}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{e.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{e.desc}</p>
                  </div>
                  <Download className={cn('h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors', exporting === e.key && 'animate-bounce text-primary')} />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const TabSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-72 rounded-lg" />
    <Skeleton className="h-48 rounded-lg" />
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AppShell
      title="Business Reports & Analytics"
      description="Track financial performance, membership subscriptions, and export operational datasets."
      actions={
        <Tabs value={period} onValueChange={(val) => setPeriod(val as 'month' | 'quarter' | 'year')}>
          <TabsList className="h-8 p-1 bg-muted/60">
            {PERIODS.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs px-3 h-6">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-9">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="size-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5 text-xs">
            <IndianRupee className="size-3.5" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="membership" className="gap-1.5 text-xs">
            <Users className="size-3.5" /> Membership
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5 text-xs">
            <CalendarCheck className="size-3.5" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="growth" className="gap-1.5 text-xs">
            <TrendingUp className="size-3.5" /> Growth
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab period={period} />
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueTab period={period} />
        </TabsContent>
        <TabsContent value="membership">
          <MembershipTab period={period} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab period={period} />
        </TabsContent>
        <TabsContent value="growth">
          <GrowthTab period={period} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
