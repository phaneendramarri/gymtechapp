import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, CheckCircle2, AlertCircle, Dumbbell, Calendar, User, Clock, IndianRupee } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { CreatePtPackageRequest } from '@gymtech/shared';

interface CreatePtPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMemberId?: number;
  initialTrainerId?: number;
  onSuccess?: (packageId: number) => void;
}

const PACKAGE_PRESETS = [
  { name: 'Transformation Starter', sessions: 12, defaultPrice: 12000 },
  { name: 'Strength & Conditioning', sessions: 24, defaultPrice: 22000 },
  { name: 'Elite Performance', sessions: 36, defaultPrice: 30000 },
  { name: 'Kickstart Trial', sessions: 5, defaultPrice: 5500 },
];

export const CreatePtPackageDialog: React.FC<CreatePtPackageDialogProps> = ({
  open,
  onOpenChange,
  initialMemberId,
  initialTrainerId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [memberId, setMemberId] = useState<string>(initialMemberId ? String(initialMemberId) : '');
  const [trainerId, setTrainerId] = useState<string>(initialTrainerId ? String(initialTrainerId) : '');
  const [packageName, setPackageName] = useState('Standard Transformation');
  const [totalSessions, setTotalSessions] = useState('12');
  const [amountRupees, setAmountRupees] = useState('12000');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 180);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  // Fetch members list for picker
  const { data: membersData } = useQuery({
    queryKey: ['members', 'pt-package-dialog'],
    queryFn: () => api.getMembers({ limit: 300 }),
    enabled: open && !initialMemberId,
  });

  // Fetch staff list for trainer picker
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
    enabled: open,
  });

  const trainers = useMemo(() => {
    const all = staffData?.staff || [];
    const matched = all.filter((s: any) => {
      const roleUpper = (s.role || '').toUpperCase();
      const roleName = (s.roleName || '').toLowerCase();
      return (
        roleUpper === 'TRAINER' ||
        roleName.includes('train') ||
        roleName.includes('coach') ||
        roleName.includes('instructor')
      );
    });
    return matched.length > 0 ? matched : all;
  }, [staffData]);

  useEffect(() => {
    if (initialMemberId) setMemberId(String(initialMemberId));
    if (initialTrainerId) setTrainerId(String(initialTrainerId));
  }, [initialMemberId, initialTrainerId]);

  // Set default trainer if only 1 exists
  useEffect(() => {
    if (!trainerId && trainers.length > 0) {
      setTrainerId(String(trainers[0].id));
    }
  }, [trainers, trainerId]);

  const applyPreset = (preset: typeof PACKAGE_PRESETS[0]) => {
    setPackageName(preset.name);
    setTotalSessions(String(preset.sessions));
    setAmountRupees(String(preset.defaultPrice));
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreatePtPackageRequest) => api.createPtPackage(payload),
    onSuccess: (res) => {
      toast('success', 'PT Package Created', `Client successfully enrolled in ${packageName}.`);
      queryClient.invalidateQueries({ queryKey: ['pt-packages'] });
      queryClient.invalidateQueries({ queryKey: ['ptPackages'] });
      queryClient.invalidateQueries({ queryKey: ['memberPtPackages'] });
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      onOpenChange(false);
      onSuccess?.(res.id);
    },
    onError: (err: any) => {
      toast('error', 'Failed to create PT package', err.message || 'Please check the entered values');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const memNum = parseInt(memberId, 10);
    const trainerNum = parseInt(trainerId, 10);
    const sessionsNum = parseInt(totalSessions, 10);
    const rupeesNum = parseFloat(amountRupees || '0');

    if (!memNum) {
      toast('error', 'Select a member', 'Please choose a member for this PT package.');
      return;
    }
    if (!trainerNum) {
      toast('error', 'Select a trainer', 'Please assign a personal trainer.');
      return;
    }
    if (!sessionsNum || sessionsNum <= 0) {
      toast('error', 'Invalid sessions', 'Session count must be at least 1.');
      return;
    }

    createMutation.mutate({
      memberId: memNum,
      trainerId: trainerNum,
      packageName: packageName.trim() || 'Personal Training',
      totalSessions: sessionsNum,
      amountPaise: Math.round(rupeesNum * 100),
      startDate,
      expiryDate: expiryDate || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Trophy className="size-5" />
            <DialogTitle className="text-lg font-bold">Enroll Member in PT Package</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Create an active personal training package with session allocation and coach assignment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Quick presets */}
          <div>
            <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Quick Templates
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PACKAGE_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                    packageName === p.name && totalSessions === String(p.sessions)
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card hover:bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {p.name} ({p.sessions} sess)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Member picker (if not preselected) */}
            {!initialMemberId ? (
              <div className="space-y-1.5">
                <Label htmlFor="pt-member-select" className="text-xs font-semibold">
                  Member <span className="text-destructive">*</span>
                </Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger id="pt-member-select" className="h-9 text-xs">
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
            ) : null}

            {/* Trainer picker */}
            <div className={`space-y-1.5 ${initialMemberId ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor="pt-trainer-select" className="text-xs font-semibold">
                Personal Trainer <span className="text-destructive">*</span>
              </Label>
              <Select value={trainerId} onValueChange={setTrainerId}>
                <SelectTrigger id="pt-trainer-select" className="h-9 text-xs">
                  <SelectValue placeholder="Assign coach..." />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.name} {t.roleName ? `(${t.roleName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Package Title */}
          <div className="space-y-1.5">
            <Label htmlFor="pt-pkg-name" className="text-xs font-semibold">
              Package Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pt-pkg-name"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. Fat Loss Transformation, Strength 12-Pack"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Sessions & Price */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="pt-sessions-count" className="text-xs font-semibold">
                Total Sessions <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Dumbbell className="size-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  id="pt-sessions-count"
                  type="number"
                  min="1"
                  max="500"
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(e.target.value)}
                  className="h-9 pl-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-pkg-price" className="text-xs font-semibold">
                Package Price (₹)
              </Label>
              <div className="relative">
                <span className="text-xs font-mono absolute left-3 top-2.5 text-muted-foreground">₹</span>
                <Input
                  id="pt-pkg-price"
                  type="number"
                  min="0"
                  step="100"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="h-9 pl-7 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="pt-start-date" className="text-xs font-semibold">
                Start Date
              </Label>
              <Input
                id="pt-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-expiry-date" className="text-xs font-semibold">
                Valid Until (Expiry)
              </Label>
              <Input
                id="pt-expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Training goals & notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pt-notes" className="text-xs font-semibold">
              Training Focus / Health Notes <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="pt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on mobility and squat depth. Recovering from mild left knee strain."
              className="text-xs min-h-[64px]"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending}
              className="text-xs h-8 font-semibold gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              {createMutation.isPending ? 'Enrolling…' : 'Enroll in Package'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
