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

import { StatCard } from '@/components/shared/StatCard';
import { CardGridSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as any },
});

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCollect = user?.permissions?.includes('payments');

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
      const d = new Date(p.paymentDate * 1000);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(k, (buckets.get(k) || 0) + (p.amountPaise || 0) / 100);
    });
    return Array.from(buckets.entries()).sort().map(([, v]) => v);
  }, [payments]);

  return (
    <AppShell
      title="Payments"
      description="Every rupee collected and outstanding. Search ledger, filter records, and issue instant receipts."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/reports/export?type=payments', '_blank')}
            className="border-border gap-1.5"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
          {canCollect && (
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5 font-semibold">
              <Plus className="h-3.5 w-3.5" />
              <span>Collect payment</span>
            </Button>
          )}
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-8 py-2">
          <CardGridSkeleton count={4} cols={4} />
          <TableSkeleton rows={5} columns={6} />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <motion.section
            {...fadeUp(0)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-6"
          >
            <StatCard
              title="Today's Collection"
              value={formatCurrency(today * 100)}
              subtitle="Received today"
              icon={<Calendar className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="This Month"
              value={formatCurrency(mtd * 100)}
              subtitle="Month-to-date total"
              icon={<CreditCard className="h-4 w-4" />}
              variant="accent"
              sparkline={monthBuckets}
            />
            <StatCard
              title="Avg Collection Ticket"
              value={payments.length ? formatCurrency(Math.round((mtd / payments.length) * 30 * 100)) : '—'}
              subtitle="Estimated 30d run rate"
              icon={<TrendingUp className="h-4 w-4" />}
              variant="ok"
            />
            <StatCard
              title="Pending Dues"
              value={formatCurrency(dues * 100)}
              subtitle={`Outstanding (${members.length} members)`}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={dues > 0 ? "err" : "ok"}
            />
          </motion.section>

          {/* Ledger */}
          <motion.section {...fadeUp(0.05)} className="pt-4">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Ledger</p>
                <h2 className="text-xl font-bold tracking-tight text-foreground mt-0.5 flex items-center gap-2">
                  <span>Recent Payments</span>
                  <span className="text-sm font-normal text-muted-foreground font-mono">({payments.length})</span>
                </h2>
              </div>
            </div>

            <PaymentTable
              payments={payments}
              isLoading={isLoading}
              onOpenInvoice={(id) => setInvoicePaymentId(id)}
              onRecordPayment={() => setDialogOpen(true)}
            />
          </motion.section>
        </>
      )}

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
