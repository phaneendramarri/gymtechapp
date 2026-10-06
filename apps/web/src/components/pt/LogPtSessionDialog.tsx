import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, CheckCircle2, Clock, Calendar, User, FileText, Sparkles, AlertCircle } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import type { PtPackage, LogPtSessionRequest } from '@gymtech/shared';

interface LogPtSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPackage?: PtPackage | null;
  memberId?: number;
  onSuccess?: (remainingSessions: number) => void;
}

export const LogPtSessionDialog: React.FC<LogPtSessionDialogProps> = ({
  open,
  onOpenChange,
  selectedPackage,
  memberId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [packageId, setPackageId] = useState<string>(selectedPackage?.id ? String(selectedPackage.id) : '');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionNotes, setSessionNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [signedOff, setSignedOff] = useState(true);

  // If no package preselected, query active packages
  const { data: packagesData } = useQuery({
    queryKey: ['pt-packages', 'picker', memberId],
    queryFn: () => api.getPtPackages(memberId ? { memberId } : undefined),
    enabled: open && !selectedPackage,
  });

  const availablePackages = packagesData?.packages || [];
  const activePackage = selectedPackage || availablePackages.find((p) => String(p.id) === packageId);

  useEffect(() => {
    if (selectedPackage?.id) {
      setPackageId(String(selectedPackage.id));
    } else if (availablePackages.length > 0 && !packageId) {
      const firstActive = availablePackages.find((p) => (p.completedSessions || 0) < p.totalSessions);
      if (firstActive) setPackageId(String(firstActive.id));
    }
  }, [selectedPackage, availablePackages, packageId]);

  const completed = activePackage?.completedSessions ?? 0;
  const total = activePackage?.totalSessions ?? 0;
  const nextSessionNumber = completed + 1;
  const remainingAfterThis = Math.max(0, total - nextSessionNumber);

  const logMutation = useMutation({
    mutationFn: (payload: LogPtSessionRequest) => api.logPtSession(payload),
    onSuccess: (res) => {
      toast(
        'success',
        `Session #${nextSessionNumber} Logged!`,
        `${res.remainingSessions} session${res.remainingSessions === 1 ? '' : 's'} remaining in this package.`
      );
      queryClient.invalidateQueries({ queryKey: ['pt-packages'] });
      queryClient.invalidateQueries({ queryKey: ['ptPackages'] });
      queryClient.invalidateQueries({ queryKey: ['pt-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['ptSessions'] });
      queryClient.invalidateQueries({ queryKey: ['memberPtPackages'] });
      queryClient.invalidateQueries({ queryKey: ['memberPtSessions'] });
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-portal'] });
      onOpenChange(false);
      setSessionNotes('');
      setFeedback('');
      onSuccess?.(res.remainingSessions);
    },
    onError: (err: any) => {
      toast('error', 'Failed to log PT session', err.message || 'Something went wrong');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pkgNum = parseInt(packageId, 10);
    if (!pkgNum) {
      toast('error', 'Select a package', 'Please select which PT package to log this session under.');
      return;
    }
    if (completed >= total) {
      toast('error', 'Package Completed', 'All sessions in this package have already been logged.');
      return;
    }

    logMutation.mutate({
      packageId: pkgNum,
      sessionDate,
      sessionNotes: sessionNotes.trim() || undefined,
      feedback: feedback.trim() || undefined,
      signedOffByMember: signedOff,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Dumbbell className="size-5" />
            <DialogTitle className="text-lg font-bold">Log Workout Session</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Record training exercises, track client performance, and update package progress.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Package Selector (if multiple available) */}
          {!selectedPackage && (
            <div className="space-y-1.5">
              <Label htmlFor="pt-session-pkg-select" className="text-xs font-semibold">
                Client & PT Package <span className="text-destructive">*</span>
              </Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger id="pt-session-pkg-select" className="h-9 text-xs">
                  <SelectValue placeholder="Choose active package..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availablePackages.map((p) => {
                    const isFull = (p.completedSessions || 0) >= p.totalSessions;
                    return (
                      <SelectItem
                        key={p.id}
                        value={String(p.id)}
                        disabled={isFull}
                        className="text-xs"
                      >
                        {p.memberName || 'Member'} — {p.packageName} ({p.completedSessions}/{p.totalSessions} done)
                        {isFull ? ' [Completed]' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active Package Banner */}
          {activePackage && (
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>{activePackage.packageName}</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-background">
                    Session {nextSessionNumber} of {total}
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Client: <strong className="text-foreground">{activePackage.memberName || 'Member'}</strong> · Coach:{' '}
                  <strong className="text-foreground">{activePackage.trainerName || 'Trainer'}</strong>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono font-bold text-primary">
                  {remainingAfterThis} left
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">after this session</p>
              </div>
            </div>
          )}

          {/* Session Date */}
          <div className="space-y-1.5">
            <Label htmlFor="session-date" className="text-xs font-semibold">
              Session Date <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Calendar className="size-3.5 absolute left-2.5 top-3 text-muted-foreground" />
              <Input
                id="session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="h-9 pl-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Workout / Exercise Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="session-notes" className="text-xs font-semibold">
                Workout Summary & Exercises
              </Label>
              <span className="text-[10px] text-muted-foreground">Exercises, sets, weights</span>
            </div>
            <Textarea
              id="session-notes"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Back & Biceps:&#10;• Deadlifts: 3 x 5 @ 100kg&#10;• Lat Pulldown: 4 x 10 @ 55kg&#10;• Barbell Rows: 3 x 8 @ 60kg&#10;• Hammer Curls: 3 x 12 @ 14kg"
              className="text-xs font-mono min-h-[90px]"
            />
          </div>

          {/* Trainer Feedback / Remarks */}
          <div className="space-y-1.5">
            <Label htmlFor="session-feedback" className="text-xs font-semibold">
              Coach Remarks & Feedback <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="session-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Good hip drive on deadlifts. Suggested 10 min extra hydration."
              className="h-9 text-xs"
            />
          </div>

          {/* Member Sign-off */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Member Attended & Signed Off</p>
              <p className="text-[11px] text-muted-foreground">Confirm that the member was present on the floor</p>
            </div>
            <Switch checked={signedOff} onCheckedChange={setSignedOff} />
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
              disabled={logMutation.isPending || (activePackage && completed >= total)}
              className="text-xs h-8 font-semibold gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              {logMutation.isPending ? 'Logging…' : `Log Session #${nextSessionNumber}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
