import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle } from 'lucide-react';
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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const StaffPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
  });

  const staff = data?.staff || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'STAFF' | 'TRAINER'>('STAFF');
  const [password, setPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.createStaff({
        name,
        email,
        phone,
        role,
        password,
        permissions: [],
      });
      setDialogOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const groups = {
    OWNER: staff.filter((s: any) => s.role === 'OWNER'),
    MANAGER: staff.filter((s: any) => s.role === 'MANAGER'),
    STAFF: staff.filter((s: any) => s.role === 'STAFF'),
    TRAINER: staff.filter((s: any) => s.role === 'TRAINER'),
  };

  return (
    <AppShell
      title="Team"
      description="Owners, managers, front-desk, trainers. One console, four roles."
      actions={
        canManage && (
          <Button size="sm" className="gt-btn-primary" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add member
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
        <div className="gt-empty py-16">
          <p className="text-h2 text-ink">No teammates yet.</p>
          <p className="text-meta max-w-md">
            Invite your front desk, managers, and trainers — each gets a role and a sign-in.
          </p>
          {canManage && (
            <Button className="gt-btn-primary mt-3" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add first teammate
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
          {(['OWNER', 'MANAGER', 'TRAINER', 'STAFF'] as const).map((group) =>
            groups[group].length > 0 ? (
              <section key={group}>
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-eyebrow">{labelFor(group)}</p>
                  <p className="text-[11px] text-ink-3 num">{groups[group].length}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {groups[group].map((s: any) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-md border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--ink-3)] transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-[var(--surface-2)] text-ink-2 flex items-center justify-center text-sm font-semibold shrink-0">
                        {(s.name?.[0] || '·').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                        <p className="text-[11px] text-ink-3 mt-0.5 truncate font-mono">
                          {s.email} · {s.phone || '—'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'gt-chip',
                          s.status === 'ACTIVE' ? 'gt-chip-ok' : 'gt-chip-muted'
                        )}
                      >
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add teammate</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAddStaff} className="flex flex-col gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Role *">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="gt-input"
                >
                  <option value="STAFF">Front Desk</option>
                  <option value="TRAINER">Trainer</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </Field>
              <Field label="Temp password *">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="gt-input"
                />
              </Field>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gt-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Adding…' : 'Add teammate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

function labelFor(role: string) {
  switch (role) {
    case 'OWNER': return 'Owners';
    case 'MANAGER': return 'Managers';
    case 'TRAINER': return 'Trainers';
    case 'STAFF': return 'Front desk';
    default: return role;
  }
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-ink">{label}</label>
    {children}
  </div>
);
