import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: any[];
  onPaymentSuccess: () => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  members,
  onPaymentSuccess,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<number | undefined>(undefined);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'>('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ receiptNumber: string; whatsappUrl?: string } | null>(null);

  useEffect(() => {
    if (members.length > 0 && selectedMemberId === undefined) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccessInfo(null);
      setAmount(0);
      setReferenceId('');
      setNotes('');
    }
  }, [open]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.recordPayment({
        memberId: selectedMemberId!,
        amountPaise: Math.round(Number(amount) * 100),
        paymentMode,
        referenceId: referenceId || undefined,
        notes: notes || undefined,
      });

      setSuccessInfo(res);
      onPaymentSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Record Payment</DialogTitle>
          <DialogDescription className="text-xs">
            Log a payment against dues or walk-in package renewal
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {successInfo ? (
          <div className="py-4 text-center flex flex-col items-center gap-3">
            <div className="size-12 rounded-full bg-ok/10 text-ok flex items-center justify-center">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Payment Logged Successfully!</p>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Receipt: {successInfo.receiptNumber}
              </p>
            </div>

            <div className="flex gap-2 w-full mt-2">
              {successInfo.whatsappUrl && (
                <Button asChild className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white text-xs font-bold">
                  <a href={successInfo.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4 mr-1.5 fill-current" /> Share WhatsApp Receipt
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRecordSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memberSelect" className="text-xs font-semibold">Select Member *</Label>
              <Select value={selectedMemberId?.toString() ?? ''} onValueChange={(val) => setSelectedMemberId(parseInt(val, 10))}>
                <SelectTrigger id="memberSelect" className="text-xs">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.first_name} {m.last_name || ''} ({m.member_code})
                      {m.membership_due_amount_paise > 0 ? ` — Due: ${formatCurrency(m.membership_due_amount_paise)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount" className="text-xs font-semibold">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                required
                min="1"
                placeholder="e.g. 1500"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="text-xs font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mode" className="text-xs font-semibold">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                  <SelectTrigger id="mode" className="text-xs">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI / QR Code</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Net Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ref" className="text-xs font-semibold">Ref / Notes</Label>
                <Input
                  id="ref"
                  placeholder="e.g. UPI Ref ID"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-bold text-xs"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
