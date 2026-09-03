import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, IndianRupee, Clock, CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';


export const PtCollectionsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const [form, setForm] = useState({
    memberId: '',
    trainerId: '',
    sessions: '12',
    amount: '',
    commissionPercentage: '30',
    paymentMode: 'UPI' as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER',
    notes: '',
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['pt-summary'],
    queryFn: () => api.getPtSummary(),
  });

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['pt-collections'],
    queryFn: () => api.getPtCollections(),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', 'pt-select'],
    queryFn: () => api.getMembers({ limit: 500 }),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
  });

  const trainers = useMemo(
    () => (staffData?.staff || []).filter((s: any) => s.role === 'TRAINER'),
    [staffData]
  );

  const recordMutation = useMutation({
    mutationFn: () =>
      api.recordPtCollection({
        memberId: parseInt(form.memberId, 10) || 0,
        trainerId: parseInt(form.trainerId, 10) || 0,
        sessions: parseInt(form.sessions, 10) || 0,
        amountPaise: Math.round(parseFloat(form.amount || '0') * 100),
        commissionPercentage: parseFloat(form.commissionPercentage) || 0,
        paymentMode: form.paymentMode,
        notes: form.notes || undefined,
      }),
    onSuccess: (res) => {
      toast('success', 'PT collection recorded', `Trainer commission: ${formatCurrency(res.commissionPaise)}`);
      setIsRecordOpen(false);
      setForm({ memberId: '', trainerId: '', sessions: '12', amount: '', commissionPercentage: '30', paymentMode: 'UPI', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['pt-collections'] });
      queryClient.invalidateQueries({ queryKey: ['pt-summary'] });
    },
    onError: (err: any) => {
      toast('error', 'Failed to record collection', err.message);
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'PAID' | 'PENDING' }) =>
      api.settlePtCommission(id, status),
    onSuccess: (_res, vars) => {
      toast('success', vars.status === 'PAID' ? 'Commission marked as paid' : 'Commission moved back to pending');
      queryClient.invalidateQueries({ queryKey: ['pt-collections'] });
      queryClient.invalidateQueries({ queryKey: ['pt-summary'] });
    },
    onError: (err: any) => {
      toast('error', 'Failed to update commission', err.message);
    },
  });

  const collections = collectionsData?.collections || [];
  const canManage = user?.isOwner;
  const formValid = form.memberId && form.trainerId && parseFloat(form.amount || '0') > 0;

  return (
    <AppShell title="PT Collections" breadcrumb="Billing">
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Personal Training Collections
          </h2>
          <p className="text-xs text-muted-foreground">
            Track PT package sales and trainer commission payouts
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            className="bg-primary text-primary-foreground font-bold text-xs h-9"
            onClick={() => setIsRecordOpen(true)}
          >
            <Plus className="mr-1.5 size-4" /> Record PT Collection
          </Button>
        )}
      </section>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-sm" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          <StatCard
            title="Total PT Collections"
            value={formatCurrency(summary?.totalCollected || 0)}
            subtitle="All-time PT revenue"
            variant="accent"
            icon={<Trophy className="size-4" />}
          />
          <StatCard
            title="Commission Pending"
            value={formatCurrency(summary?.totalCommissionPending || 0)}
            subtitle="Owed to trainers"
            variant={(summary?.totalCommissionPending || 0) > 0 ? 'err' : 'default'}
            icon={<Clock className="size-4" />}
          />
          <StatCard
            title="Commission Paid"
            value={formatCurrency(summary?.totalCommissionPaid || 0)}
            subtitle="Settled with trainers"
            variant="ok"
            icon={<CheckCircle2 className="size-4" />}
          />
        </div>
      )}

      {/* Trainer breakdown */}
      {(summary?.byTrainer || []).length > 0 && (
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="font-display text-base">Trainer Commission Breakdown</CardTitle>
            <CardDescription className="text-xs">Collections and pending payouts per trainer</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainer</TableHead>
                  <TableHead className="text-right">Collections</TableHead>
                  <TableHead className="text-right">PT Revenue</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary!.byTrainer.map((t) => (
                  <TableRow key={t.trainer_id}>
                    <TableCell className="font-medium text-xs">{t.trainer_name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{t.collections}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(t.collected)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-warn">{formatCurrency(t.commission_pending)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-ok">{formatCurrency(t.commission_paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Collections table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="font-display text-base">Collection History</CardTitle>
          <CardDescription className="text-xs">Every PT package payment collected from members</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {collectionsLoading ? (
            <div className="p-6 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-sm" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="size-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No PT collections yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Record a personal training package payment to start tracking trainer commissions.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {c.receipt_number || '—'}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{c.member_name?.trim()}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{c.member_code}</p>
                    </TableCell>
                    <TableCell className="text-xs">{c.trainer_name || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{c.sessions}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatCurrency(c.amount_paise)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(c.commission_paise)}
                      <span className="block text-[10px] text-muted-foreground">{c.commission_percentage}%</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.commission_status === 'PAID' ? 'default' : 'outline'} className="text-[10px]">
                        {c.commission_status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={settleMutation.isPending}
                          onClick={() =>
                            settleMutation.mutate({
                              id: c.id,
                              status: c.commission_status === 'PAID' ? 'PENDING' : 'PAID',
                            })
                          }
                        >
                          {c.commission_status === 'PAID' ? 'Revert' : 'Mark Paid'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record dialog */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Record PT Collection</DialogTitle>
            <DialogDescription className="text-xs">
              Log a personal training package payment. The trainer commission is calculated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-member">Member</Label>
              <Select value={form.memberId} onValueChange={(v) => setForm({ ...form, memberId: v })}>
                <SelectTrigger id="pt-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {(membersData?.members || []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name || ''} ({m.member_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-trainer">Trainer</Label>
              <Select value={form.trainerId} onValueChange={(v) => setForm({ ...form, trainerId: v })}>
                <SelectTrigger id="pt-trainer">
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {trainers.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No trainers found. Add a staff member with the Trainer role first.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pt-sessions">Sessions</Label>
                <Input
                  id="pt-sessions"
                  type="number"
                  min={0}
                  value={form.sessions}
                  onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pt-amount">Amount (₹)</Label>
                <Input
                  id="pt-amount"
                  type="number"
                  min={0}
                  placeholder="e.g. 12000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pt-commission">Commission %</Label>
                <Input
                  id="pt-commission"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commissionPercentage}
                  onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pt-mode">Payment Mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(v) => setForm({ ...form, paymentMode: v as typeof form.paymentMode })}
                >
                  <SelectTrigger id="pt-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {parseFloat(form.amount || '0') > 0 && (
              <div className="rounded-sm border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                <IndianRupee className="size-3.5 text-primary" />
                Trainer commission:&nbsp;
                <span className="font-mono font-bold">
                  {formatCurrency(Math.round(parseFloat(form.amount || '0') * 100 * ((parseFloat(form.commissionPercentage) || 0) / 100)))}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!formValid || recordMutation.isPending}
              onClick={() => recordMutation.mutate()}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {recordMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Record Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
