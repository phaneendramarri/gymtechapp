import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface InvoiceDialogProps {
  paymentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatINR = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export const InvoiceDialog: React.FC<InvoiceDialogProps> = ({ paymentId, open, onOpenChange }) => {
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', paymentId],
    queryFn: () => api.getInvoice(paymentId!),
    enabled: open && !!paymentId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Tax Invoice / Receipt</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : error || !invoice ? (
          <p className="py-8 text-center text-xs text-destructive">
            {(error as any)?.message || 'Invoice could not be loaded.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4 text-xs" id="invoice-print-area">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg font-bold text-foreground">{invoice.gym.name}</p>
                {invoice.gym.address && (
                  <p className="text-muted-foreground">
                    {invoice.gym.address}
                    {invoice.gym.city ? `, ${invoice.gym.city}` : ''}
                    {invoice.gym.state ? `, ${invoice.gym.state}` : ''} {invoice.gym.pincode || ''}
                  </p>
                )}
                {invoice.gym.phone && <p className="text-muted-foreground">Ph: {invoice.gym.phone}</p>}
                {invoice.gym.gstNumber && (
                  <p className="font-mono text-muted-foreground">GSTIN: {invoice.gym.gstNumber}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-foreground">{invoice.receiptNumber}</p>
                <p className="text-muted-foreground">
                  {new Date(invoice.paymentDate * 1000).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="h-px bg-border/60" />

            {/* Billed to */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Billed To
              </p>
              <p className="font-semibold text-foreground">{invoice.member.name}</p>
              <p className="text-muted-foreground font-mono">
                {invoice.member.memberCode} • {invoice.member.phone}
              </p>
            </div>

            {/* Line item */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Description</th>
                  <th className="py-1.5 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 text-foreground">
                    <p className="font-medium">{invoice.planName || 'Gym membership / fitness services'}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">SAC: {invoice.sacCode || '999723'} (Fitness Club Services)</p>
                  </td>
                  <td className="py-2 text-right font-mono">{formatINR(invoice.taxableAmount)}</td>
                </tr>
                {invoice.taxAmount > 0 && (
                  <>
                    <tr className="text-muted-foreground">
                      <td className="py-1 pl-3">CGST @ {invoice.taxPercentage / 2}%</td>
                      <td className="py-1 text-right font-mono">{formatINR(invoice.cgst)}</td>
                    </tr>
                    <tr className="text-muted-foreground">
                      <td className="py-1 pl-3">SGST @ {invoice.taxPercentage / 2}%</td>
                      <td className="py-1 text-right font-mono">{formatINR(invoice.sgst)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-t border-border font-bold text-foreground">
                  <td className="py-2">Total ({invoice.paymentMode})</td>
                  <td className="py-2 text-right font-mono">{formatINR(invoice.amount)}</td>
                </tr>
              </tbody>
            </table>

            {invoice.referenceId && (
              <p className="text-muted-foreground font-mono">Reference: {invoice.referenceId}</p>
            )}
            {invoice.notes && <p className="text-muted-foreground">Note: {invoice.notes}</p>}

            <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
              This is a computer-generated receipt from {invoice.gym.name} via GymTech.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="self-end text-xs"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 size-3.5" /> Print / Save PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
