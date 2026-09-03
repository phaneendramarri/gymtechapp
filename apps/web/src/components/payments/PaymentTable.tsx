import React from 'react';
import { CreditCard, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { DataTable, type DataTableColumn, type DataTableBulkAction } from '@/components/ui/data-table';
import { EmptyPaymentsIllustration } from '@/components/shared/illustrations';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

interface PaymentTableProps {
  payments: any[];
  isLoading?: boolean;
  onOpenInvoice: (paymentId: number) => void;
}

const getModeBadge = (mode: string) => {
  const m = (mode || '').toUpperCase();
  if (m === 'UPI')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] bg-chart-2/10 text-chart-2 border border-chart-2/20 font-bold">
        UPI
      </span>
    );
  if (m === 'CASH')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] bg-ok/10 text-ok border border-ok/20 font-bold">
        CASH
      </span>
    );
  if (m === 'CARD')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] bg-chart-5/10 text-chart-5 border border-chart-5/20 font-bold">
        CARD
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] bg-secondary text-foreground font-medium">
      {mode}
    </span>
  );
};

export const PaymentTable: React.FC<PaymentTableProps> = ({
  payments,
  isLoading,
  onOpenInvoice,
}) => {
  const { toast } = useToast()

  const columns: DataTableColumn<any>[] = [
    {
      id: 'receipt',
      header: 'Receipt No',
      sortAccessor: (p) => p.receiptNumber,
      cell: (p) => (
        <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
          {p.receiptNumber}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      sortAccessor: (p) => p.paymentDate,
      cell: (p) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(p.paymentDate * 1000).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      id: 'member',
      header: 'Member',
      sortAccessor: (p) => `${p.firstName} ${p.lastName || ''}`.toLowerCase(),
      cell: (p) => (
        <div className="flex flex-col text-xs min-w-0">
          <span className="font-semibold text-foreground truncate">
            {p.firstName} {p.lastName || ''}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {p.memberCode} • {p.phone}
          </span>
        </div>
      ),
    },
    {
      id: 'mode',
      header: 'Mode',
      sortAccessor: (p) => p.paymentMode,
      cell: (p) => getModeBadge(p.paymentMode),
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: (p) => (
        <span className="font-mono text-xs text-muted-foreground">{p.reference_id || '—'}</span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortAccessor: (p) => p.amountPaise,
      numeric: true,
      cell: (p) => (
        <span className="font-mono font-bold text-xs text-foreground">
          {formatCurrency(p.amountPaise)}
        </span>
      ),
    },
  ]

  const bulkActions: DataTableBulkAction<any>[] = [
    {
      id: 'export',
      label: 'Export CSV',
      icon: Download,
      onClick: (rows) => {
        toast('success', `Exported ${rows.length} payment${rows.length === 1 ? '' : 's'}`, 'Your CSV is ready in Downloads.')
      },
    },
  ]

  return (
    <Card className="border-border shadow-xs overflow-hidden bg-card rounded-xl">
      <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between bg-card">
        <CardTitle className="font-display text-base font-bold">Payment Ledger</CardTitle>
        <span className="font-mono text-xs text-muted-foreground">
          {payments.length} transaction records
        </span>
      </CardHeader>
      <CardContent className="p-4">
        {payments.length === 0 && !isLoading ? (
          <EmptyState
            illustration={<EmptyPaymentsIllustration className="w-full h-auto" />}
            title="No transactions recorded"
            description="Payments collected from members will appear in this ledger."
            onboardingSteps={[
              { n: 1, label: 'Add members' },
              { n: 2, label: 'Collect payment' },
              { n: 3, label: 'Auto receipts' },
            ]}
          />
        ) : (
          <DataTable
            columns={columns}
            data={payments}
            rowKey={(p) => p.id}
            selectable
            bulkActions={bulkActions}
            onView={(p) => onOpenInvoice(p.id)}
            isLoading={isLoading}
            defaultSort={{ id: 'date', direction: 'desc' }}
            pageSize={25}
            emptyState={
              <EmptyState
                icon={CreditCard}
                title="No transactions"
                description="Payments collected from members will appear in this ledger."
              />
            }
          />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span>Showing {payments.length} entries</span>
        </div>
      </CardContent>
    </Card>
  )
}
