import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  IndianRupee,
  Clock,
  CheckCircle2,
  Plus,
  Dumbbell,
  Search,
  Calendar,
  User,
  Activity,
  FileText,
  Flame,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { CreatePtPackageDialog } from '@/components/pt/CreatePtPackageDialog';
import { LogPtSessionDialog } from '@/components/pt/LogPtSessionDialog';
import type { PtPackage } from '@gymtech/shared';

export const PtCollectionsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'packages' | 'sessions' | 'collections' | 'commissions'>('packages');

  // Dialogs
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isNewPackageOpen, setIsNewPackageOpen] = useState(false);
  const [isLogSessionOpen, setIsLogSessionOpen] = useState(false);
  const [selectedPackageForSession, setSelectedPackageForSession] = useState<PtPackage | null>(null);

  // Filters
  const [packageSearch, setPackageSearch] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('ALL');

  // Record Collection Form State
  const [form, setForm] = useState({
    memberId: '',
    trainerId: '',
    sessions: '12',
    amount: '',
    commissionPercentage: '30',
    paymentMode: 'UPI' as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER',
    notes: '',
  });

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['pt-summary'],
    queryFn: () => api.getPtSummary(),
  });

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['pt-collections'],
    queryFn: () => api.getPtCollections(),
  });

  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['pt-packages'],
    queryFn: () => api.getPtPackages(),
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['pt-sessions'],
    queryFn: () => api.getPtSessions(),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', 'pt-select'],
    queryFn: () => api.getMembers({ limit: 500 }),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
  });

  const trainers = useMemo(() => {
    const allStaff = staffData?.staff || [];
    const matched = allStaff.filter((s: any) => {
      const roleUpper = (s.role || '').toUpperCase();
      const roleName = (s.roleName || '').toLowerCase();
      return (
        roleUpper === 'TRAINER' ||
        roleName.includes('train') ||
        roleName.includes('coach') ||
        roleName.includes('instructor')
      );
    });
    return matched.length > 0 ? matched : allStaff;
  }, [staffData]);

  // Mutations
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
  const allPackages = packagesData?.packages || [];
  const allSessions = sessionsData?.sessions || [];
  const canManage = Boolean(user?.isOwner || user?.permissions?.includes('*') || user?.permissions?.includes('pt_collections'));

  // Filter packages
  const filteredPackages = useMemo(() => {
    return allPackages.filter((p) => {
      const matchSearch =
        !packageSearch.trim() ||
        (p.memberName || '').toLowerCase().includes(packageSearch.toLowerCase()) ||
        (p.memberCode || '').toLowerCase().includes(packageSearch.toLowerCase()) ||
        (p.packageName || '').toLowerCase().includes(packageSearch.toLowerCase());

      const matchTrainer =
        trainerFilter === 'ALL' || String(p.trainerUserId) === trainerFilter;

      return matchSearch && matchTrainer;
    });
  }, [allPackages, packageSearch, trainerFilter]);

  const activePackagesCount = allPackages.filter((p) => p.status === 'ACTIVE' && (p.completedSessions || 0) < p.totalSessions).length;

  const handleOpenLogSessionForPackage = (pkg: PtPackage) => {
    setSelectedPackageForSession(pkg);
    setIsLogSessionOpen(true);
  };

  return (
    <AppShell
      title="Personal Training Hub"
      breadcrumb="Train"
      description="Client workout packages, session execution logs, and trainer commission settlements."
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={() => {
                  setSelectedPackageForSession(null);
                  setIsLogSessionOpen(true);
                }}
              >
                <Dumbbell className="size-3.5 text-primary" /> Log Session
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={() => setIsRecordOpen(true)}
              >
                <IndianRupee className="size-3.5" /> Record Payment
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-bold"
                onClick={() => setIsNewPackageOpen(true)}
              >
                <Plus className="size-3.5" /> Enroll in PT
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Top Summary Stats */}
      {summaryLoading || packagesLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          <StatCard
            title="Active PT Clients"
            value={String(activePackagesCount)}
            subtitle={`${allPackages.length} packages total`}
            variant="accent"
            icon={<Trophy className="size-4" />}
          />
          <StatCard
            title="Workouts Conducted"
            value={String(allSessions.length)}
            subtitle="Completed & logged sessions"
            variant="default"
            icon={<Dumbbell className="size-4" />}
          />
          <StatCard
            title="Total PT Revenue"
            value={formatCurrency(summary?.totalCollected || 0)}
            subtitle="Collected package fees"
            variant="ok"
            icon={<IndianRupee className="size-4" />}
          />
          <StatCard
            title="Commission Pending"
            value={formatCurrency(summary?.totalCommissionPending || 0)}
            subtitle="Owed to gym coaches"
            variant={(summary?.totalCommissionPending || 0) > 0 ? 'err' : 'default'}
            icon={<Clock className="size-4" />}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/60 rounded-full">
          <TabsTrigger value="packages" className="text-xs px-3.5 h-7 rounded-full gap-1.5">
            <Trophy className="size-3.5" /> Active Packages ({allPackages.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs px-3.5 h-7 rounded-full gap-1.5">
            <Dumbbell className="size-3.5" /> Session Logs ({allSessions.length})
          </TabsTrigger>
          <TabsTrigger value="collections" className="text-xs px-3.5 h-7 rounded-full gap-1.5">
            <IndianRupee className="size-3.5" /> Payment Ledger ({collections.length})
          </TabsTrigger>
          <TabsTrigger value="commissions" className="text-xs px-3.5 h-7 rounded-full gap-1.5">
            <User className="size-3.5" /> Trainer Commissions
          </TabsTrigger>
        </TabsList>

        {/* ============================================================
            TAB 1: CLIENT PACKAGES
            ============================================================ */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by client, code, or package..."
                value={packageSearch}
                onChange={(e) => setPackageSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Filter by Trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Coaches</SelectItem>
                  {trainers.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Client Package Roster</CardTitle>
                  <CardDescription className="text-[11px]">
                    Personal training package quotas, assigned trainers, and session completion rates
                  </CardDescription>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsNewPackageOpen(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="size-3" /> New Package
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {packagesLoading ? (
                <div className="p-6 flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="py-16 text-center">
                  <Trophy className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No PT packages found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Enroll a member in personal training to start tracking workout sessions and coach progress.
                  </p>
                  {canManage && (
                    <Button
                      size="sm"
                      onClick={() => setIsNewPackageOpen(true)}
                      className="mt-4 text-xs font-semibold"
                    >
                      Enroll First Client
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredPackages.map((pkg) => {
                    const completed = pkg.completedSessions || 0;
                    const total = pkg.totalSessions || 1;
                    const percent = Math.min(100, Math.round((completed / total) * 100));
                    const remaining = Math.max(0, total - completed);
                    const isCompleted = completed >= total;

                    return (
                      <div
                        key={pkg.id}
                        className="p-4 sm:px-6 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        {/* Member & Coach info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Avatar size="sm" className="size-10 border border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs font-mono">
                              {(pkg.memberName || 'M').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-foreground truncate">
                                {pkg.memberName || 'Member'}
                              </p>
                              <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-muted">
                                {pkg.memberCode}
                              </Badge>
                              {isCompleted ? (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                  COMPLETED
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px] py-0 px-1.5 bg-primary/15 text-primary border-primary/30">
                                  ACTIVE
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              <strong className="text-foreground">{pkg.packageName}</strong> · Coach:{' '}
                              <span className="font-semibold text-foreground">{pkg.trainerName || 'Assigned Coach'}</span>
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              {pkg.startDate} → {pkg.expiryDate || 'No expiry'} · {formatCurrency(pkg.pricePaise || 0)}
                            </p>
                          </div>
                        </div>

                        {/* Progress Gauge & Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:shrink-0 w-full sm:w-auto">
                          <div className="flex flex-col gap-1 w-44 sm:w-48">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-semibold text-foreground">
                                {completed} / {total} <span className="text-[10px] text-muted-foreground font-normal">sessions</span>
                              </span>
                              <span className={isCompleted ? 'text-emerald-500 font-bold' : 'text-primary font-bold'}>
                                {isCompleted ? 'Done' : `${remaining} left`}
                              </span>
                            </div>
                            <Progress value={percent} className="h-2" />
                          </div>

                          {canManage && (
                            <Button
                              size="sm"
                              variant={isCompleted ? 'outline' : 'default'}
                              disabled={isCompleted}
                              onClick={() => handleOpenLogSessionForPackage(pkg)}
                              className="h-8 text-xs font-semibold shrink-0 gap-1.5"
                            >
                              <Dumbbell className="size-3.5" />
                              <span>{isCompleted ? 'Finished' : 'Log Session'}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================
            TAB 2: SESSION ACTIVITY LOG
            ============================================================ */}
        <TabsContent value="sessions" className="space-y-4">
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Workout Session Feed</CardTitle>
                  <CardDescription className="text-[11px]">
                    Chronological audit log of all personal training sessions completed on the gym floor
                  </CardDescription>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedPackageForSession(null);
                      setIsLogSessionOpen(true);
                    }}
                    className="h-7 text-xs gap-1 font-semibold"
                  >
                    <Plus className="size-3" /> Log Session
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sessionsLoading ? (
                <div className="p-6 flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : allSessions.length === 0 ? (
                <div className="py-16 text-center">
                  <Dumbbell className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No sessions logged yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    When trainers complete workout sessions with clients, log them here to record exercise notes and update remaining balances.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {allSessions.map((s) => (
                    <div key={s.id} className="p-4 sm:px-6 hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                            Session #{s.sessionNumber}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            Coach: {s.trainerName || 'Trainer'}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {s.sessionDate}
                          </span>
                        </div>
                        {s.signedOffByMember && (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 border-emerald-500/20">
                            <CheckCircle2 className="size-3" /> Signed off
                          </Badge>
                        )}
                      </div>

                      {s.notes ? (
                        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-xs font-mono text-foreground whitespace-pre-line">
                          {s.notes}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No workout notes recorded.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================
            TAB 3: FINANCIAL COLLECTIONS LEDGER
            ============================================================ */}
        <TabsContent value="collections" className="space-y-4">
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">PT Fee Receipts & Collections</CardTitle>
                  <CardDescription className="text-[11px]">
                    Every personal training payment collected from members with year-scoped receipt numbers
                  </CardDescription>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => setIsRecordOpen(true)}
                    className="h-7 text-xs gap-1 font-semibold"
                  >
                    <Plus className="size-3" /> Record Payment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {collectionsLoading ? (
                <div className="p-6 flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
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
                      <TableHead>Payment Mode</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {c.receiptNumber || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">{c.memberName || 'Member'}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{c.memberCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">{c.trainerName || 'Trainer'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.sessions}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                          {formatCurrency(c.amountPaise)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(c.commissionPaise)}
                          <span className="text-[10px] text-muted-foreground ml-1">({c.commissionPercentage}%)</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono bg-muted">
                            {c.paymentMode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.commissionStatus === 'PAID' ? 'secondary' : 'default'}
                            className={`text-[10px] ${
                              c.commissionStatus === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {c.commissionStatus}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={settleMutation.isPending}
                              onClick={() =>
                                settleMutation.mutate({
                                  id: c.id,
                                  status: c.commissionStatus === 'PAID' ? 'PENDING' : 'PAID',
                                })
                              }
                            >
                              {c.commissionStatus === 'PAID' ? 'Revert to Pending' : 'Mark as Paid'}
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
        </TabsContent>

        {/* ============================================================
            TAB 4: TRAINER COMMISSIONS BREAKDOWN
            ============================================================ */}
        <TabsContent value="commissions" className="space-y-4">
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-semibold">Trainer Commission Breakdown</CardTitle>
              <CardDescription className="text-[11px]">
                Net revenues collected and pending commission payouts calculated per coach
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(summary?.byTrainer || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No trainer payouts accumulated yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainer</TableHead>
                      <TableHead className="text-right">Collections Count</TableHead>
                      <TableHead className="text-right">PT Revenue</TableHead>
                      <TableHead className="text-right">Commission Pending</TableHead>
                      <TableHead className="text-right">Commission Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary!.byTrainer.map((t) => (
                      <TableRow key={t.trainerId}>
                        <TableCell className="font-semibold text-xs text-foreground">{t.trainerName}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{t.collections}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                          {formatCurrency(t.collected)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(t.commissionPending)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(t.commissionPaid)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enroll in Package Dialog */}
      <CreatePtPackageDialog
        open={isNewPackageOpen}
        onOpenChange={setIsNewPackageOpen}
      />

      {/* Log Workout Session Dialog */}
      <LogPtSessionDialog
        open={isLogSessionOpen}
        onOpenChange={(open) => {
          setIsLogSessionOpen(open);
          if (!open) setSelectedPackageForSession(null);
        }}
        selectedPackage={selectedPackageForSession}
      />

      {/* Record Financial Collection Dialog */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Record PT Collection</DialogTitle>
            <DialogDescription className="text-xs">
              Record payment for personal training and compute coach commission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <Label htmlFor="rec-member" className="text-xs font-semibold">Member</Label>
              <Select value={form.memberId} onValueChange={(v) => setForm((p) => ({ ...p, memberId: v }))}>
                <SelectTrigger id="rec-member" className="h-9 text-xs">
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {(membersData?.members || []).map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                      {m.firstName} {m.lastName || ''} ({m.memberCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-trainer" className="text-xs font-semibold">Coach / Trainer</Label>
              <Select value={form.trainerId} onValueChange={(v) => setForm((p) => ({ ...p, trainerId: v }))}>
                <SelectTrigger id="rec-trainer" className="h-9 text-xs">
                  <SelectValue placeholder="Select coach..." />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rec-sessions" className="text-xs font-semibold">Sessions</Label>
                <Input
                  id="rec-sessions"
                  type="number"
                  min="1"
                  value={form.sessions}
                  onChange={(e) => setForm((p) => ({ ...p, sessions: e.target.value }))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rec-amount" className="text-xs font-semibold">Amount (₹)</Label>
                <Input
                  id="rec-amount"
                  type="number"
                  placeholder="e.g. 15000"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rec-comm" className="text-xs font-semibold">Commission %</Label>
                <Input
                  id="rec-comm"
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionPercentage}
                  onChange={(e) => setForm((p) => ({ ...p, commissionPercentage: e.target.value }))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rec-mode" className="text-xs font-semibold">Payment Mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(v) => setForm((p) => ({ ...p, paymentMode: v as any }))}
                >
                  <SelectTrigger id="rec-mode" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI" className="text-xs">UPI</SelectItem>
                    <SelectItem value="CASH" className="text-xs">Cash</SelectItem>
                    <SelectItem value="CARD" className="text-xs">Card</SelectItem>
                    <SelectItem value="BANK_TRANSFER" className="text-xs">Bank Transfer</SelectItem>
                    <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.amount && form.commissionPercentage && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Computed Coach Payout:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(
                    Math.round(
                      parseFloat(form.amount || '0') *
                        (parseFloat(form.commissionPercentage || '0') / 100) *
                        100
                    )
                  )}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsRecordOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={recordMutation.isPending || !form.memberId || !form.trainerId || !form.amount}
              onClick={() => recordMutation.mutate()}
              className="text-xs h-8 font-semibold"
            >
              {recordMutation.isPending ? 'Recording…' : 'Record Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
