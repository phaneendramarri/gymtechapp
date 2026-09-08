import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowDownToLine, FileText, Users, IndianRupee, CalendarCheck, ChevronRight, Download, TrendingUp, BarChart3 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { CardGridSkeleton } from '@/components/shared/LoadingSkeleton';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const PERIODS: { key: 'month' | 'quarter' | 'year'; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 90 Days' },
  { key: 'year', label: 'This Year' },
];

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
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

  const { data, isLoading } = useQuery({
    queryKey: ['reports', period],
    queryFn: () => api.getReports(period),
  });

  const metrics = data?.metrics;
  const planBreakdown = data?.planBreakdown || [];
  const trend = metrics?.monthlyRevenueTrend || [];

  return (
    <AppShell
      title="Business Reports & Analytics"
      description="Track financial performance, membership subscriptions, and export operational datasets."
      actions={
        <Tabs
          value={period}
          onValueChange={(val) => setPeriod(val as 'month' | 'quarter' | 'year')}
        >
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
      {isLoading ? (
        <div className="flex flex-col gap-6">
          <CardGridSkeleton count={4} />
          <Card className="h-80 animate-pulse bg-muted/40" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Period Revenue</span>
                  <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-foreground mt-2">
                  {formatCurrency(data?.periodRevenue || 0)}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Across {data?.periodPaymentCount || 0} settlements
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active Members</span>
                  <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-foreground mt-2">
                  {(metrics?.activeMembers ?? 0).toString()}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Enrolled & in good standing
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Check-ins Today</span>
                  <div className="h-7 w-7 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <CalendarCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-foreground mt-2">
                  {(metrics?.todayAttendance ?? 0).toString()}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Floor visits recorded
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pending Dues</span>
                  <div className="h-7 w-7 rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-destructive mt-2">
                  {formatCurrency(metrics?.pendingDues || 0)}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Uncollected balances
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Revenue Area Chart */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trajectory
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Monthly collection trends across all active payment modes.
                      </CardDescription>
                    </div>
                  </div>
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
                            className="text-xs font-mono text-muted-foreground"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            className="text-xs font-mono text-muted-foreground"
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
                              color: 'hsl(var(--foreground))',
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

              {/* Plan breakdown */}
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

            {/* Right 1 col: Exports */}
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
                          <Download className={cn("h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors", exporting === e.key && "animate-bounce text-primary")} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
