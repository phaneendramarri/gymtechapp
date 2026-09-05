import { z } from 'zod';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle, Users, Shield, Mail, Phone } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/LoadingSkeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { CreateStaffRequestSchema, GYM_FEATURE_LABELS } from '@gymtech/shared';

/** All possible menu permission keys */
const ALL_PERMISSION_KEYS = [
  'dashboard',
  'members',
  'attendance',
  'payments',
  'pt_collections',
  'plans',
  'staff',
  'reports',
  'settings',
  'audit_logs',
] as const;

export const StaffPage: React.FC = () => {
  const { user, gym } = useAuth();
  const queryClient = useQueryClient();
  // Only users with 'staff' permission can add/edit users
  const canManage = user?.permissions?.includes('staff');

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
  });

  const staff = data?.staff || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissions available for grant — based on gym's enabled features
  const availablePerms = (gym?.enabledFeatures?.length ?? 0) > 0
    ? (gym!.enabledFeatures as readonly string[])
    : ALL_PERMISSION_KEYS;

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // M-9: Validate form data against Zod schema before sending to API.
      const parsed = CreateStaffRequestSchema.safeParse({ name, email, phone, password, role: 'STAFF', permissions: selectedPerms });
      if (!parsed.success) {
        setError(parsed.error.errors.map((e) => e.message).join(', '));
        setIsSubmitting(false);
        return;
      }

      await api.createStaff({
        name,
        email,
        phone,
        password,
        role: 'STAFF',
        permissions: selectedPerms,
      });
      setDialogOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setSelectedPerms([]);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (err: any) {
      setError(err.message || 'Failed to add user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Team"
      description="Invite team members and control exactly which menus each person can access."
      actions={
        canManage && (
          <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Invite user
          </Button>
        )
      }
    >
      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet."
          description="Invite your first team member and choose which menus they can access."
          action={
            canManage ? (
              <Button variant="default" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Invite first user
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staff.map((s: any) => (
            <li key={s.id}>
              <Card className="flex flex-col justify-between p-4 hover:border-primary/40 hover:shadow-sm transition-all h-full">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {(s.name?.[0] || '·').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink truncate">{s.name}</p>
                      {s.isOwner === 1 ? (
                        <Badge variant="secondary" className="text-[10px] font-medium">Owner</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-ink-3">Staff</Badge>
                      )}
                      <Badge
                        variant={s.status === 'ACTIVE' ? 'default' : 'outline'}
                        className="ml-auto text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1.5 text-xs text-ink-3">
                      <span className="flex items-center gap-1.5 truncate font-mono">
                        <Mail className="h-3 w-3 shrink-0" /> {s.email}
                      </span>
                      {s.phone && (
                        <span className="flex items-center gap-1.5 truncate font-mono">
                          <Phone className="h-3 w-3 shrink-0" /> {s.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-(--line) flex items-center gap-1.5 flex-wrap">
                  <Shield className="h-3 w-3 text-ink-3 shrink-0" />
                  <span className="text-[10px] font-medium text-ink-3 uppercase tracking-wider">Access:</span>
                  {(s.permissions as string[] || []).length > 0 ? (
                    (s.permissions as string[]).map((perm: string) => (
                      <span
                        key={perm}
                        className="text-[10px] bg-(--surface-2) text-ink-2 px-1.5 py-0.5 rounded border border-(--line)"
                      >
                        {GYM_FEATURE_LABELS[perm as keyof typeof GYM_FEATURE_LABELS]?.name ?? perm}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-ink-3 italic">None specified</span>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAddStaff} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-name"
                required
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="ramesh@gym.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-phone">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="staff-phone"
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-password">
                Temporary password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Menu access <span className="text-destructive">*</span>
              </Label>
              <p className="text-[11px] text-ink-3 mb-1">Select every menu this user should be able to access.</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {availablePerms.map((key) => {
                  const label = GYM_FEATURE_LABELS[key as keyof typeof GYM_FEATURE_LABELS]?.name ?? key;
                  const isChecked = selectedPerms.includes(key);
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors text-xs select-none',
                        isChecked
                          ? 'border-primary bg-primary/5 text-ink font-medium'
                          : 'border-(--line) text-ink-3 hover:border-border hover:bg-muted/30'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => togglePerm(key)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" disabled={isSubmitting || selectedPerms.length === 0}>
                {isSubmitting ? 'Adding…' : 'Invite user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
