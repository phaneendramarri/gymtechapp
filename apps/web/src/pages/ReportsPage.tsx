import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowDownToLine, FileText, Users, IndianRupee, CalendarCheck, ChevronRight, Download, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { CardGridSkeleton } from '@/components/shared/LoadingSkeleton';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const PERIODS: { key: 'month' | 'quarter' | 'year'; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
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
      title="Reports"
      description="The shape of your business over time. Export when you need to share."
      actions={
        <Tabs
          value={period}
          onValueChange={(val) => setPeriod(val as 'month' | 'quarter' | 'year')}
        >
          <TabsList className="h-8">
            {PERIODS.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs px-3">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8">
          {/* Left — narrative + chart */}
          <div className="lg:col-span-2 flex flex-col gap-10 min-w-0">
            <section>
              <p className="text-eyebrow">Headline</p>
              <h2 className="text-h2 text-ink mt-1.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-stat-xl num text-ink">{formatCurrency(data?.periodRevenue || 0)}</span>{' '}
                <span className="text-h3 text-ink-3 font-normal">collected this {period === 'year' ? 'year' : period === 'quarter' ? 'quarter' : 'month'}</span>
              </h2>
              <p className="text-meta mt-2">
                Across <span className="num text-ink font-medium">{data?.periodPaymentCount || 0}</span> settled transactions.
              </p>
            </section>

            <section>
              <SectionHeader eyebrow="Trend" title="Revenue over the last 6 months" />
              {trend.length === 0 ? (
                <Card className="p-8 text-center text-meta">No revenue trend data yet.</Card>
              ) : (
                <Card className="p-4 pt-6">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-iron, #D9480F)" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="var(--color-iron, #D9480F)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke="var(--ink-3)"
                          tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--ink-3)"
                          tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            fontSize: 12,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                          labelStyle={{ color: 'var(--ink-3)', fontSize: 11 }}
                          formatter={(v: any) => [formatCurrency(Number(v) * 100), 'Revenue']}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="var(--color-iron, #D9480F)"
                          strokeWidth={2.5}
                          fill="url(#revGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </section>

            <section>
              <SectionHeader eyebrow="Plans" title="Plan breakdown" />
              {planBreakdown.length === 0 ? (
                <Card className="p-8 text-center text-meta">No plan subscription data yet.</Card>
              ) : (
                <Card className="p-5">
                  <ul className="divide-y divide-border">
                    {planBreakdown.slice(0, 6).map((p: any) => {
                      const max = Math.max(...planBreakdown.map((x: any) => Number(x.count) || 0)) || 1;
                      const pct = Math.round(((Number(p.count) || 0) / max) * 100);
                      return (
                        <li key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="font-medium text-ink truncate">{p.name}</span>
                              <span className="text-muted-foreground font-mono text-xs">{p.count} members</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                          <p className="text-sm font-semibold font-mono text-ink">{formatCurrency(p.revenue || 0)}</p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </section>
          </div>

          {/* Right — exports + KPI strip */}
          <aside className="flex flex-col gap-8 min-w-0">
            <section>
              <p className="text-eyebrow mb-3">Today's snapshot</p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" />
                    <span>Today</span>
                  </div>
                  <p className="text-stat-md font-mono text-ink mt-2">
                    {formatCurrency(metrics?.todayAttendance ? (data?.periodRevenue || 0) : 0)}
                  </p>
                </Card>
                <Card className="p-3.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Active</span>
                  </div>
                  <p className="text-stat-md font-mono text-ink mt-2">
                    {(metrics?.activeMembers ?? 0).toString()}
                  </p>
                </Card>
                <Card className="p-3.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Check-ins</span>
                  </div>
                  <p className="text-stat-md font-mono text-ink mt-2">
                    {(metrics?.todayAttendance ?? 0).toString()}
                  </p>
                </Card>
                <Card className="p-3.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <IndianRupee className="h-3.5 w-3.5 text-destructive" />
                    <span>Dues</span>
                  </div>
                  <p className="text-stat-md font-mono text-ink mt-2">
                    {formatCurrency(metrics?.pendingDues || 0)}
                  </p>
                </Card>
              </div>
            </section>

            <section>
              <p className="text-eyebrow mb-3">Exports</p>
              <Card className="p-2">
                <ul className="flex flex-col">
                  {[
                    { key: 'payments' as const, label: 'All payments', desc: 'CSV, full settlement ledger' },
                    { key: 'members' as const, label: 'Members', desc: 'CSV, all active & expired records' },
                    { key: 'attendance' as const, label: 'Attendance', desc: 'CSV, last 5,000 visits' },
                    { key: 'dues' as const, label: 'Outstanding dues', desc: 'CSV, unpaid balances and contacts' },
                  ].map((e, i) => (
                    <li key={e.key} className={cn(i > 0 && 'border-t border-border')}>
                      <button
                        onClick={() => handleExport(e.key)}
                        disabled={exporting === e.key}
                        className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors text-left group"
                      >
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">{e.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
                        </div>
                        <ArrowDownToLine className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  );
};

const SectionHeader: React.FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <div className="mb-4">
    <p className="text-eyebrow">{eyebrow}</p>
    <h2 className="text-h2 text-ink mt-1.5">{title}</h2>
  </div>
);
