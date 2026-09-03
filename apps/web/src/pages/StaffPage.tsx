import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { GYM_FEATURE_LABELS } from '@gymtech/shared';

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
  // Only the gym owner can add/edit users
  const canManage = user?.isOwner === true;

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="gt-skel h-20" />
          ))}
        </div>
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
        <ul className="flex flex-col gap-2">
          {staff.map((s: any) => (
            <li
              key={s.id}
              className="flex items-center gap-3 p-3 rounded-md border border-(--line) bg-(--surface) hover:border-(--ink-3) transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-(--surface-2) text-ink-2 flex items-center justify-center text-sm font-semibold shrink-0">
                {(s.name?.[0] || '·').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                  {s.isOwner === 1 && (
                    <span className="gt-chip gt-chip-iron text-[10px]">Owner</span>
                  )}
                </div>
                <p className="text-[11px] text-ink-3 mt-0.5 truncate font-mono">
                  {s.email} · {s.phone || '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {/* Permissions are stored in user_permissions table; staff list query joins them */}
                {(s.permissions as string[] || []).map((perm: string) => (
                  <span key={perm} className="gt-chip gt-chip-muted text-[10px]">{perm}</span>
                ))}
              </div>
              <span className={cn('gt-chip', s.status === 'ACTIVE' ? 'gt-chip-ok' : 'gt-chip-muted')}>
                {s.status}
              </span>
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
            <Field label="Full name *">
              <input
                required
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="gt-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *">
                <input
                  type="email"
                  required
                  placeholder="ramesh@gym.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="gt-input font-mono"
                />
              </Field>
              <Field label="Phone *">
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="gt-input font-mono"
                />
              </Field>
            </div>

            <Field label="Temporary password *">
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gt-input"
              />
            </Field>

            <Field label="Menu access *">
              <p className="text-[11px] text-ink-3 mb-2">Select every menu this user should be able to see.</p>
              <div className="grid grid-cols-2 gap-2">
                {availablePerms.map((key) => {
                  const label = GYM_FEATURE_LABELS[key as keyof typeof GYM_FEATURE_LABELS]?.name ?? key;
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-xs',
                        selectedPerms.includes(key)
                          ? 'border-primary bg-(--surface-2) text-ink'
                          : 'border-(--line) text-ink-3 hover:border-(--ink-3)'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(key)}
                        onChange={() => togglePerm(key)}
                        className="accent-primary"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </Field>

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

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-ink">{label}</label>
    {children}
  </div>
);
