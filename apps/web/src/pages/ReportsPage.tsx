import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowDownToLine, FileText, Users, IndianRupee, CalendarCheck, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/shared/Sparkline';

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
        <div className="flex items-center gap-1 rounded-md border border-[var(--line)] p-0.5 bg-[var(--surface-2)]">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'h-7 px-2.5 rounded text-[11px] font-medium transition-colors',
                period === p.key
                  ? 'bg-[var(--surface)] text-ink shadow-sm'
                  : 'text-ink-3 hover:text-ink-2'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="gt-skel h-32" />
          <div className="gt-skel h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8">
          {/* Left — narrative + chart */}
          <div className="lg:col-span-2 flex flex-col gap-10 min-w-0">
            <section>
              <p className="text-eyebrow">Headline</p>
              <h2 className="text-h2 text-ink mt-1.5">
                <span className="text-stat-xl num text-ink">{formatCurrency(data?.periodRevenue || 0)}</span>{' '}
                <span className="text-h3 text-ink-3 font-normal">collected this {period === 'year' ? 'year' : period === 'quarter' ? 'quarter' : 'month'}</span>
              </h2>
              <p className="text-meta mt-2">
                Across <span className="num text-ink font-medium">{data?.periodPaymentCount || 0}</span> payments.
              </p>
            </section>

            <section>
              <SectionHeader eyebrow="Trend" title="Revenue over the last 6 months" />
              {trend.length === 0 ? (
                <p className="text-meta">No data yet.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--iron)" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="var(--iron)" stopOpacity={0} />
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
                        }}
                        labelStyle={{ color: 'var(--ink-3)', fontSize: 11 }}
                        formatter={(v: any) => [formatCurrency(Number(v) * 100), 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--iron)"
                        strokeWidth={2}
                        fill="url(#revGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section>
              <SectionHeader eyebrow="Plans" title="Plan breakdown" />
              {planBreakdown.length === 0 ? (
                <p className="text-meta">No plan data yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line-2)]">
                  {planBreakdown.slice(0, 6).map((p: any) => {
                    const max = Math.max(...planBreakdown.map((x: any) => Number(x.count) || 0)) || 1;
                    const pct = Math.round(((Number(p.count) || 0) / max) * 100);
                    return (
                      <li key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-ink truncate">{p.name}</span>
                            <span className="text-ink-3 num text-[11px]">{p.count}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--ink)] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <p className="text-sm num text-ink">{formatCurrency(p.revenue || 0)}</p>
                        <ChevronRight className="h-3.5 w-3.5 text-ink-3" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Right — exports + KPI strip */}
          <aside className="flex flex-col gap-10 min-w-0">
            <section>
              <p className="text-eyebrow mb-3">Today's snapshot</p>
              <div className="grid grid-cols-2 gap-4">
                <Mini
                  icon={<IndianRupee className="h-3.5 w-3.5" />}
                  label="Today"
                  value={formatCurrency(metrics?.todayAttendance ? (data?.periodRevenue || 0) : 0)}
                />
                <Mini
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Active"
                  value={(metrics?.activeMembers ?? 0).toString()}
                />
                <Mini
                  icon={<CalendarCheck className="h-3.5 w-3.5" />}
                  label="Check-ins"
                  value={(metrics?.todayAttendance ?? 0).toString()}
                />
                <Mini
                  icon={<IndianRupee className="h-3.5 w-3.5" />}
                  label="Dues"
                  value={formatCurrency(metrics?.pendingDues || 0)}
                />
              </div>
            </section>

            <div className="h-px bg-[var(--line)]" />

            <section>
              <p className="text-eyebrow mb-3">Exports</p>
              <ul className="flex flex-col">
                {[
                  { key: 'payments' as const, label: 'All payments', desc: 'CSV, full ledger' },
                  { key: 'members' as const, label: 'Members', desc: 'CSV, all records' },
                  { key: 'attendance' as const, label: 'Attendance', desc: 'CSV, last 5,000 visits' },
                  { key: 'dues' as const, label: 'Outstanding dues', desc: 'CSV, who owes what' },
                ].map((e, i) => (
                  <li key={e.key} className={cn(i > 0 && 'border-t border-[var(--line-2)]')}>
                    <button
                      onClick={() => handleExport(e.key)}
                      disabled={exporting === e.key}
                      className="w-full flex items-center gap-3 py-3 -mx-2 px-2 rounded-md hover:bg-[var(--surface-2)] transition-colors text-left"
                    >
                      <FileText className="h-4 w-4 text-ink-3 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{e.label}</p>
                        <p className="text-[11px] text-ink-3 mt-0.5">{e.desc}</p>
                      </div>
                      <ArrowDownToLine className="h-3.5 w-3.5 text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
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

const Mini: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-1.5 text-eyebrow">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-stat-md num text-ink mt-1.5">{value}</p>
  </div>
);
