import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowDownToLine, CreditCard, AlertTriangle, TrendingUp, Calendar, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PaymentTable } from '@/components/payments/PaymentTable';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/toast';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'OWNER' || Boolean(user?.isOwner);
  const canCollect = isOwner || user?.permissions?.includes('payments');
  const [isExporting, setIsExporting] = useState(false);

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

  const [activeTab, setActiveTab] = useState<'all' | 'dues'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoicePaymentId, setInvoicePaymentId] = useState<number | null>(null);
  const [collectMemberId, setCollectMemberId] = useState<number | undefined>(undefined);
  const [collectAmount, setCollectAmount] = useState<number | undefined>(undefined);

  const pendingDuesMembers = useMemo(() => {
    return members.filter((m: any) => {
      const due = m.membership_due_amount_paise ?? m.dueAmountPaise ?? m.due_amount_paise ?? 0;
      return Number(due) > 0;
    });
  }, [members]);

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleOpenCollect = (memberId?: number, duePaise?: number) => {
    setCollectMemberId(memberId);
    setCollectAmount(duePaise ? duePaise / 100 : undefined);
    setDialogOpen(true);
  };

  const mtd = (summary.monthlyRevenue || 0) / 100;
  const today = (summary.todayRevenue || 0) / 100;
  const dues = (summary.pendingDues || 0) / 100;

  // Mini chart for monthly trend (use last 12 data points, derived from recent payments list)
  const monthBuckets = useMemo(() => {
    const buckets = new Map<string, number>();
    payments.forEach((p: any) => {
      const d = new Date(p.paymentDate * 1000);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(k, (buckets.get(k) || 0) + (p.amountPaise || 0) / 100);
    });
    return Array.from(buckets.entries()).sort().map(([, v]) => v);
  }, [payments]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await api.downloadReportExport('payments');
      toast('success', 'Export ready', 'Payments ledger downloaded as CSV.');
    } catch (err: any) {
      toast('error', 'Export failed', err.message || 'Could not download payments export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      title="Payments"
      description="Every rupee collected and outstanding. Search ledger, track pending member dues, and issue instant receipts."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="border-border gap-1.5"
          >
            <ArrowDownToLine className={cn("h-3.5 w-3.5", isExporting && "animate-bounce")} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
          {canCollect && (
            <Button size="sm" onClick={() => handleOpenCollect()} className="gap-1.5 font-semibold">
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
              subtitle={`Outstanding (${pendingDuesMembers.length} members)`}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={dues > 0 ? "err" : "ok"}
            />
          </motion.section>

          {/* Tabbed View: All Transactions vs Pending Dues */}
          <motion.section {...fadeUp(0.05)} className="pt-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">
                    All Transactions ({payments.length})
                  </TabsTrigger>
                  <TabsTrigger value="dues" className="text-xs gap-1.5">
                    <span>Pending Dues</span>
                    {pendingDuesMembers.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                        {pendingDuesMembers.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all" className="m-0">
                <PaymentTable
                  payments={payments}
                  isLoading={isLoading}
                  onOpenInvoice={(id) => setInvoicePaymentId(id)}
                  onRecordPayment={() => handleOpenCollect()}
                />
              </TabsContent>

              <TabsContent value="dues" className="m-0">
                <Card className="border-border shadow-xs overflow-hidden bg-card rounded-xl">
                  <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="font-display text-base font-bold">Outstanding Member Dues</CardTitle>
                    <span className="font-mono text-xs text-muted-foreground">
                      {pendingDuesMembers.length} members with balances
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    {pendingDuesMembers.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="size-10 text-emerald-500" />
                        <h3 className="font-bold text-sm text-foreground">All Dues Settled!</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          There are currently no members with outstanding balances on their active plans.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {pendingDuesMembers.map((m: any) => {
                          const duePaise = m.membership_due_amount_paise ?? m.dueAmountPaise ?? m.due_amount_paise ?? 0;
                          const initials = `${(m.first_name?.[0] || m.firstName?.[0] || '').toUpperCase()}${(m.last_name?.[0] || m.lastName?.[0] || '').toUpperCase()}` || 'M';
                          const name = `${m.first_name || m.firstName || ''} ${m.last_name || m.lastName || ''}`.trim();
                          const code = m.member_code || m.memberCode || '';
                          const phone = m.phone || '';
                          const plan = m.plan_name || m.planName || 'Active Membership';

                          return (
                            <li key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="size-9 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Link to={`/members/${m.id}`} className="font-semibold text-sm text-foreground hover:text-primary truncate">
                                      {name}
                                    </Link>
                                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                      {code}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                                    {phone} {plan ? `· ${plan}` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                                <div className="text-left sm:text-right">
                                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Due Amount</p>
                                  <p className="text-base font-bold font-mono text-destructive">
                                    {formatCurrency(duePaise)}
                                  </p>
                                </div>

                                {canCollect && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenCollect(m.id, duePaise)}
                                    className="text-xs font-bold gap-1.5 h-8"
                                  >
                                    <CreditCard className="size-3.5" /> Collect
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
        initialMemberId={collectMemberId}
        initialAmount={collectAmount}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </AppShell>
  );
};
