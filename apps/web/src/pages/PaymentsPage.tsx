import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowDownToLine, CreditCard, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { PaymentTable } from '@/components/payments/PaymentTable';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency } from '@/lib/utils';
import { Sparkline } from '@/components/shared/Sparkline';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as any },
});

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCollect =
    user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.role === 'STAFF';

  const { data, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments({ limit: 200 }),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.getMembers({ limit: 200 }),
  });

  const payments = data?.payments || [];
  const summary = data?.summary || { monthlyRevenue: 0, todayRevenue: 0, pendingDues: 0 };
  const members = membersData?.members || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoicePaymentId, setInvoicePaymentId] = useState<number | null>(null);

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const mtd = (summary.monthlyRevenue || 0) / 100;
  const today = (summary.todayRevenue || 0) / 100;
  const dues = (summary.pendingDues || 0) / 100;

  // Mini chart for monthly trend (use last 12 data points, derived from recent payments list)
  const monthBuckets = React.useMemo(() => {
    const buckets = new Map<string, number>();
    payments.forEach((p: any) => {
      const d = new Date(p.payment_date * 1000);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(k, (buckets.get(k) || 0) + (p.amount_paise || 0) / 100);
    });
    return Array.from(buckets.entries()).sort().map(([, v]) => v);
  }, [payments]);

  return (
    <AppShell
      title="Payments"
      description="Every rupee in, every rupee outstanding. Search, filter, issue receipts."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/reports/export?type=payments', '_blank')}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Export
          </Button>
          {canCollect && (
            <Button size="sm" className="gt-btn-primary" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Collect payment
            </Button>
          )}
        </>
      }
    >
      {/* Strip KPIs */}
      <motion.section
        {...fadeUp(0)}
        className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 pb-8 border-b border-[var(--line)]"
      >
        <StripKpi
          eyebrow="Today"
          value={formatCurrency(today)}
          icon={<Calendar className="h-3.5 w-3.5" />}
          hint="across all members"
        />
        <StripKpi
          eyebrow="This month"
          value={formatCurrency(mtd)}
          icon={<CreditCard className="h-3.5 w-3.5" />}
          spark={monthBuckets}
        />
        <StripKpi
          eyebrow="Avg ticket"
          value={payments.length ? formatCurrency(mtd / payments.length * 30) : '—'}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          hint="last 30 days"
        />
        <StripKpi
          eyebrow="Pending dues"
          value={formatCurrency(dues)}
          tone="warn"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          hint={`across ${members.length} members`}
        />
      </motion.section>

      {/* Ledger */}
      <motion.section {...fadeUp(0.05)} className="pt-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-eyebrow">Ledger</p>
            <h2 className="text-h2 text-ink mt-1.5">
              Recent payments <span className="text-h3 text-ink-3 num">{payments.length}</span>
            </h2>
          </div>
        </div>

        <PaymentTable
          payments={payments}
          isLoading={isLoading}
          onOpenInvoice={(id) => setInvoicePaymentId(id)}
        />
      </motion.section>

      <InvoiceDialog
        paymentId={invoicePaymentId}
        open={!!invoicePaymentId}
        onOpenChange={(open) => !open && setInvoicePaymentId(null)}
      />

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </AppShell>
  );
};

const StripKpi: React.FC<{
  eyebrow: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warn';
  spark?: number[];
}> = ({ eyebrow, value, icon, hint, tone = 'default', spark }) => (
  <div>
    <div className="flex items-center gap-1.5 text-eyebrow">
      {icon}
      <span>{eyebrow}</span>
    </div>
    <p
      className={cn(
        'text-stat-xl mt-2 num',
        tone === 'warn' && 'text-[var(--warning)]'
      )}
    >
      {value}
    </p>
    {hint && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
    {spark && spark.length > 0 && (
      <div className="mt-3 -mb-1">
        <Sparkline data={spark} width={180} height={28} strokeClassName="stroke-ink-2" fillClassName="fill-ink-3/5" />
      </div>
    )}
  </div>
);
