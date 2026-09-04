import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import {
  Users,
  IndianRupee,
  CalendarCheck,
  CreditCard,
  UserCog,
  Building2,
  Plus,
  Search,
  Archive,
  Pencil,
  Loader2,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type {
  Member,
  GymMembershipPlan,
  Payment,
  CreatePlanRequest,
  RecordPaymentRequest,
  CheckInRequest,
  CreateStaffRequest,
} from '@gymtech/shared';

// ---------------------------------------------------------------------------
// Members Sub-tab
// ---------------------------------------------------------------------------
const MembersTab: React.FC<{ gymId: number }> = ({ gymId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Add member form state
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
  });

  // Edit member form state
  const [editForm, setEditForm] = useState<Partial<Member>>({});

  // Fetch members
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-gym-members', gymId, search, statusFilter],
    queryFn: () => api.getMembers({ search: search || undefined, status: statusFilter, limit: 200 }, gymId),
  });

  const members: Member[] = data?.members || [];

  // Create member mutation
  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.createMember(payload as any, gymId),
    onSuccess: () => {
      toast('success', 'Member created', `${form.firstName} has been added.`);
      setShowAddForm(false);
      setForm({ firstName: '', lastName: '', phone: '', email: '', gender: 'MALE' });
      queryClient.invalidateQueries({ queryKey: ['admin-gym-members', gymId] });
    },
    onError: (err: any) => toast('error', 'Failed to create member', err.message),
  });

  // Update member mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Member> }) =>
      api.updateMember(id, payload as any, gymId),
    onSuccess: (updated: Member) => {
      toast('success', 'Member updated', `${updated.firstName}'s profile has been saved.`);
      setEditingMember(null);
      queryClient.invalidateQueries({ queryKey: ['admin-gym-members', gymId] });
    },
    onError: (err: any) => toast('error', 'Failed to update member', err.message),
  });

  // Archive member mutation
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.archiveMember(id, gymId),
    onSuccess: (_: any, id: number) => {
      toast('success', 'Member archived', 'Member record has been archived.');
      setDeletingMember(null);
      queryClient.invalidateQueries({ queryKey: ['admin-gym-members', gymId] });
    },
    onError: (err: any) => toast('error', 'Archive failed', err.message),
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    await createMutation.mutateAsync(form);
    setFormSaving(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setFormSaving(true);
    await updateMutation.mutateAsync({ id: editingMember.id, payload: editForm });
    setFormSaving(false);
  };

  const handleOpenEdit = (m: Member) => {
    setEditForm({
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      email: m.email,
      gender: m.gender as any,
    });
    setEditingMember(m);
  };

  const STATUS_TABS_M: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'FROZEN', label: 'Frozen' },
    { key: 'EXPIRED', label: 'Expired' },
    { key: 'BLOCKED', label: 'Blocked' },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs w-56"
            />
          </div>
          <div className="flex gap-1">
            {STATUS_TABS_M.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={statusFilter === t.key ? 'default' : 'outline'}
                onClick={() => setStatusFilter(t.key)}
                className="h-8 text-xs"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowAddForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Member
        </Button>
      </div>

      {/* Table */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead className="text-xs">Name &amp; Code</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Plan</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Dues</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id} className="hover:bg-secondary/40">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">
                          {m.firstName} {m.lastName || ''}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {m.memberCode || `#${m.id}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs font-mono">
                        <span>{m.phone}</span>
                        {m.email && <span className="text-muted-foreground text-[10px]">{m.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={(m.status as any) || 'ACTIVE'} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleOpenEdit(m)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingMember(m)}
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add New Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold gt-label-required">First Name</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="text-xs"
                  placeholder="Rahul"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Last Name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="text-xs"
                  placeholder="Sharma"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Phone</Label>
              <Input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="text-xs font-mono"
                placeholder="9876543210"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="text-xs"
                placeholder="rahul@example.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v: any) => setForm({ ...form, gender: v })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gap-1.5" disabled={formSaving}>
                {formSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(o) => !o && setEditingMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Edit Member — {editingMember?.firstName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold gt-label-required">First Name</Label>
                <Input
                  required
                  value={editForm.firstName ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Last Name</Label>
                <Input
                  value={editForm.lastName ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Phone</Label>
              <Input
                required
                type="tel"
                value={editForm.phone ?? ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="text-xs font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Email</Label>
              <Input
                type="email"
                value={editForm.email ?? ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingMember(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={formSaving}>
                {formSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={!!deletingMember}
        onOpenChange={(o) => !o && setDeletingMember(null)}
        title={`Archive ${deletingMember?.firstName}?`}
        description="This will soft-delete the member. Their historical records will be preserved."
        confirmLabel="Archive"
        destructive
        onConfirm={() => { if (deletingMember) archiveMutation.mutate(deletingMember.id); }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Payments Sub-tab
// ---------------------------------------------------------------------------
const PaymentsTab: React.FC<{ gymId: number }> = ({ gymId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [amountPaise, setAmountPaise] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gym-payments', gymId],
    queryFn: () => api.getPayments({ limit: 50 }, gymId),
  });

  const payments: Payment[] = data?.payments || [];

  const recordMutation = useMutation({
    mutationFn: (payload: RecordPaymentRequest) => api.recordPayment(payload, gymId),
    onSuccess: () => {
      toast('success', 'Payment recorded', 'Payment has been logged successfully.');
      setShowAddForm(false);
      setMemberId('');
      setAmountPaise('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['admin-gym-payments', gymId] });
    },
    onError: (err: any) => toast('error', 'Failed to record payment', err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await recordMutation.mutateAsync({
      memberId: Number(memberId),
      amountPaise: Number(amountPaise),
      paymentMode: paymentMode as RecordPaymentRequest['paymentMode'],
      notes,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Payments</h3>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowAddForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Record Payment
        </Button>
      </div>

      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead className="text-xs">Member ID</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                    No payments recorded.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-secondary/40">
                    <TableCell className="text-xs font-mono">#{p.memberId}</TableCell>
                    <TableCell className="text-xs font-semibold text-ink">
                      {formatCurrency(p.amountPaise)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {p.paymentMode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.notes || '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {p.paymentDate
                        ? new Date(p.paymentDate * 1000).toLocaleDateString('en-IN')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Member ID</Label>
              <Input
                required
                type="number"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="text-xs font-mono"
                placeholder="1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Amount (₹)</Label>
              <Input
                required
                type="number"
                value={amountPaise}
                onChange={(e) => setAmountPaise(e.target.value)}
                className="text-xs font-mono"
                placeholder="150000 = ₹1,500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
                placeholder="Monthly membership fee"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Attendance Sub-tab
// ---------------------------------------------------------------------------
const AttendanceTab: React.FC<{ gymId: number }> = ({ gymId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [memberIdOrCode, setMemberIdOrCode] = useState('');
  const [method, setMethod] = useState<'MANUAL' | 'QR' | 'FACE_ID'>('MANUAL');
  const [checkingIn, setCheckingIn] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gym-attendance', gymId],
    queryFn: () => api.getAttendance(gymId),
  });

  const logs: any[] = data?.logs || [];

  const checkInMutation = useMutation({
    mutationFn: (payload: CheckInRequest) => api.checkIn(payload, gymId),
    onSuccess: () => {
      toast('success', 'Checked in', 'Member attendance has been recorded.');
      setMemberIdOrCode('');
      queryClient.invalidateQueries({ queryKey: ['admin-gym-attendance', gymId] });
    },
    onError: (err: any) => toast('error', 'Check-in failed', err.message),
  });

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberIdOrCode) return;
    setCheckingIn(true);
    await checkInMutation.mutateAsync({ memberIdOrCode, method });
    setCheckingIn(false);
  };

  return (
    <div className="space-y-4">
      {/* Manual check-in form */}
      <Card className="border-border shadow-xs">
        <CardContent className="pt-4">
          <form onSubmit={handleCheckIn} className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Member ID or Code</Label>
              <Input
                value={memberIdOrCode}
                onChange={(e) => setMemberIdOrCode(e.target.value)}
                className="text-xs font-mono h-8 w-40"
                placeholder="123 or GT-001"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as 'MANUAL' | 'QR' | 'FACE_ID')}
              >
                <SelectTrigger className="text-xs h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="QR">QR</SelectItem>
                  <SelectItem value="FACE_ID">Face ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" className="gap-1.5 h-8" disabled={checkingIn || !memberIdOrCode}>
              {checkingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
              Check In
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Attendance log */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead className="text-xs">Member ID</TableHead>
                <TableHead className="text-xs">Date &amp; Time</TableHead>
                <TableHead className="text-xs">Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center text-xs text-muted-foreground">
                    No attendance records.
                  </TableCell>
                </TableRow>
              ) : (
                logs.slice(0, 50).map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-secondary/40">
                    <TableCell className="text-xs font-mono">#{log.memberId}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.timestamp ? new Date(log.timestamp * 1000).toLocaleString('en-IN') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {log.method || 'MANUAL'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Plans Sub-tab
// ---------------------------------------------------------------------------
const PlansTab: React.FC<{ gymId: number }> = ({ gymId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<GymMembershipPlan | null>(null);
  const [form, setForm] = useState<Partial<CreatePlanRequest>>({
    name: '',
    description: '',
    durationMonths: 1,
    pricePaise: 0,
    admissionFeePaise: 0,
    taxPercentage: 0,
  });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gym-plans', gymId],
    queryFn: () => api.getPlans(gymId),
  });

  const plans: GymMembershipPlan[] = data?.plans || [];

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlanRequest) => api.createPlan(payload, gymId),
    onSuccess: () => {
      toast('success', 'Plan created', 'New membership plan has been added.');
      setShowAddForm(false);
      setForm({ name: '', description: '', durationMonths: 1, pricePaise: 0, admissionFeePaise: 0, taxPercentage: 0 });
      queryClient.invalidateQueries({ queryKey: ['admin-gym-plans', gymId] });
    },
    onError: (err: any) => toast('error', 'Failed to create plan', err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.archivePlan(id, gymId),
    onSuccess: () => {
      toast('success', 'Plan archived', 'Plan has been archived.');
      setDeletingPlan(null);
      queryClient.invalidateQueries({ queryKey: ['admin-gym-plans', gymId] });
    },
    onError: (err: any) => toast('error', 'Archive failed', err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createMutation.mutateAsync(form as CreatePlanRequest);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowAddForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Plan
        </Button>
      </div>

      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Admission Fee</TableHead>
                <TableHead className="text-xs">Price</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                    No plans configured.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id} className="hover:bg-secondary/40">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{plan.name}</span>
                        {plan.description && (
                          <span className="text-[10px] text-muted-foreground">{plan.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{plan.durationMonths} month{plan.durationMonths !== 1 ? 's' : ''}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(plan.admissionFeePaise)}</TableCell>
                    <TableCell className="text-xs font-semibold">{formatCurrency(plan.pricePaise)}</TableCell>
                    <TableCell>
                      <StatusBadge status={plan.isActive === 1 ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeletingPlan(plan)}
                        title="Archive plan"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Plan Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Membership Plan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Plan Name</Label>
              <Input
                required
                value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
                placeholder="Monthly Basic"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-xs"
                placeholder="1-month unlimited access"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold gt-label-required">Duration (months)</Label>
                <Input
                  required
                  type="number"
                  min={1}
                  value={form.durationMonths ?? ''}
                  onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold gt-label-required">Price (₹)</Label>
                <Input
                  required
                  type="number"
                  min={0}
                  value={form.pricePaise ?? ''}
                  onChange={(e) => setForm({ ...form, pricePaise: Number(e.target.value) })}
                  className="text-xs font-mono"
                  placeholder="150000 = ₹1,500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Admission Fee (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.admissionFeePaise ?? 0}
                  onChange={(e) => setForm({ ...form, admissionFeePaise: Number(e.target.value) })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold">Tax %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.taxPercentage ?? 0}
                  onChange={(e) => setForm({ ...form, taxPercentage: Number(e.target.value) })}
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Create Plan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Plan Confirm */}
      <ConfirmDialog
        open={!!deletingPlan}
        onOpenChange={(o) => !o && setDeletingPlan(null)}
        title={`Archive "${deletingPlan?.name}"?`}
        description="This plan will no longer be available for new memberships."
        confirmLabel="Archive"
        destructive
        onConfirm={() => { if (deletingPlan) archiveMutation.mutate(deletingPlan.id); }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Staff Sub-tab
// ---------------------------------------------------------------------------
const StaffTab: React.FC<{ gymId: number }> = ({ gymId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'STAFF',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gym-staff', gymId],
    queryFn: () => api.getStaff(gymId),
  });

  const staff: any[] = data?.staff || [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createStaff(payload, gymId),
    onSuccess: () => {
      toast('success', 'Staff member added', `${form.name} has been added.`);
      setShowAddForm(false);
      setForm({ name: '', email: '', phone: '', role: 'STAFF', password: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-gym-staff', gymId] });
    },
    onError: (err: any) => toast('error', 'Failed to add staff', err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.archiveStaff(id, gymId),
    onSuccess: () => {
      toast('success', 'Staff archived', 'Staff member has been archived.');
      setDeletingStaff(null);
      queryClient.invalidateQueries({ queryKey: ['admin-gym-staff', gymId] });
    },
    onError: (err: any) => toast('error', 'Archive failed', err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createMutation.mutateAsync(form);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowAddForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Staff
        </Button>
      </div>

      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">
                    No staff members found.
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((s) => (
                  <TableRow key={s.id} className="hover:bg-secondary/40">
                    <TableCell className="text-xs font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{s.email || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{s.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{s.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={(s.status as any) || 'ACTIVE'} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeletingStaff(s)}
                        title="Archive staff"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Full Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
                placeholder="Priya Patel"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Email</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="text-xs"
                placeholder="priya@gym.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Phone</Label>
              <Input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="text-xs font-mono"
                placeholder="9876543210"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold gt-label-required">Password</Label>
              <Input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="text-xs font-mono"
                placeholder="Minimum 8 characters"
                minLength={8}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Staff
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Staff Confirm */}
      <ConfirmDialog
        open={!!deletingStaff}
        onOpenChange={(o) => !o && setDeletingStaff(null)}
        title={`Archive ${deletingStaff?.name}?`}
        description="This staff member will lose access to the gym dashboard."
        confirmLabel="Archive"
        destructive
        onConfirm={() => { if (deletingStaff) archiveMutation.mutate(deletingStaff.id); }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main GymCrudTab
// ---------------------------------------------------------------------------
interface GymCrudTabProps {
  gymId: number;
  gymName: string;
}

export const GymCrudTab: React.FC<GymCrudTabProps> = ({ gymId, gymName }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">{gymName}</h2>
          <Badge variant="outline" className="font-mono text-xs">#{gymId}</Badge>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="bg-secondary/40 p-1 border border-border/60 rounded-xl">
          <TabsTrigger value="members" className="gap-1.5 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 text-xs font-semibold">
            <IndianRupee className="h-3.5 w-3.5" /> Payments
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5 text-xs font-semibold">
            <CalendarCheck className="h-3.5 w-3.5" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" /> Plans
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5 text-xs font-semibold">
            <UserCog className="h-3.5 w-3.5" /> Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <MembersTab gymId={gymId} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab gymId={gymId} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab gymId={gymId} />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab gymId={gymId} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffTab gymId={gymId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
