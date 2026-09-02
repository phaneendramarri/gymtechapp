import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { RenewMembershipResponse } from '@gymtech/shared';

export const RenewMemberPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: memberData } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.getMemberDetail(parseInt(id!, 10)),
    enabled: !!id,
  });

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const member = memberData?.member;
  const plans = plansData?.plans || [];

  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'>('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenewMembershipResponse | null>(null);

  React.useEffect(() => {
    if (plans.length > 0 && planId === undefined) {
      setPlanId(plans[0].id);
      setPaymentAmount(plans[0].price_paise / 100);
    }
  }, [plans, planId]);

  const handlePlanChange = (selectedId: string) => {
    const numericId = parseInt(selectedId, 10);
    setPlanId(numericId);
    const selected = plans.find((p) => p.id === numericId);
    if (selected) {
      setPaymentAmount(selected.price_paise / 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.renewMembership(parseInt(id!, 10), {
        planId: planId!,
        startDate: startDate || undefined,
        discountPaise: Math.round((Number(discountAmount) || 0) * 100),
        paymentPaise: Math.round((Number(paymentAmount) || 0) * 100),
        paymentMode,
        referenceId: referenceId || undefined,
        notes: notes || undefined,
      });

      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch (err: any) {
      setError(err.message || 'Failed to renew membership');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title={`Renew Plan — ${member?.first_name || 'Member'}`} breadcrumb="Members">
      <div className="max-w-xl mx-auto w-full flex flex-col gap-6">
        <div>
          <a
            href={`#/members/${id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to {member?.first_name || 'Member'}'s Profile
          </a>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            Renew / Extend Membership
          </h2>
          <p className="text-xs text-muted-foreground">
            Assign a new package duration and record the renewal fee
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {result ? (
          <Card className="border-ok/30 bg-card shadow-md p-8 text-center flex flex-col items-center gap-4">
            <div className="size-14 rounded-full bg-ok/10 text-ok flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">
                Membership Successfully Renewed
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                The membership for {member?.first_name} has been extended.
              </p>
              {result.receiptNumber && (
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  Payment Receipt: {result.receiptNumber}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mt-4 w-full max-w-sm">
              {result.whatsappUrl && (
                <Button asChild className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-xs h-10">
                  <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4 mr-2 fill-current" /> Send WhatsApp
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1 h-10 text-xs font-medium">
                <a href={`#/members/${id}`}>View Profile</a>
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold">Renewal Package &amp; Payment</CardTitle>
                <CardDescription className="text-xs">
                  {member?.first_name} {member?.last_name || ''} ({member?.member_code})
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planId" className="text-xs font-semibold">Select Plan *</Label>
                  <Select value={planId?.toString() ?? ''} onValueChange={handlePlanChange}>
                    <SelectTrigger id="planId" className="text-xs">
                      <SelectValue placeholder="Choose renewal package" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} ({p.duration_months} mo) — ₹{(p.price_paise / 100).toLocaleString('en-IN')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="discount" className="text-xs font-semibold">Discount (₹)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="paymentAmount" className="text-xs font-semibold">
                      Payment Collected (₹) *
                    </Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      min="0"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="paymentMode" className="text-xs font-semibold">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                      <SelectTrigger id="paymentMode" className="text-xs">
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
                    <Label htmlFor="referenceId" className="text-xs font-semibold">Reference / Notes</Label>
                    <Input
                      id="referenceId"
                      placeholder="Transaction note"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button asChild variant="ghost" className="text-xs">
                <a href={`#/members/${id}`}>Cancel</a>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-bold text-xs h-10 px-6"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Renewal & Payment'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
};
