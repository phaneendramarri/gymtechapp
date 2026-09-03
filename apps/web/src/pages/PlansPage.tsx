import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Tag } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export const PlansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.isOwner;

  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const plans = data?.plans || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [priceRupees, setPriceRupees] = useState<number>(1500);
  const [admissionFeeRupees, setAdmissionFeeRupees] = useState<number>(0);
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.createPlan({
        name,
        durationMonths: Number(durationMonths),
        pricePaise: Math.round(Number(priceRupees) * 100),
        admissionFeePaise: Math.round(Number(admissionFeeRupees) * 100),
        taxPercentage: 0,
        description: description || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setDialogOpen(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Membership plans"
      description="The catalog of packages you sell to your members. Simple, predictable, easy to tweak."
      actions={
        canManage && (
          <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New plan
          </Button>
        )
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="gt-skel h-44" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No plans yet."
          description="Create your first membership package — pick a duration, set a price, and it becomes available at the front desk."
          action={
            canManage ? (
              <Button variant="default" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Create plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p: any) => {
            const monthly = (p.pricePaise / 100) / Math.max(1, p.durationMonths);
            return (
              <article
                key={p.id}
                className="flex flex-col gap-4 p-6 rounded-md border border-(--line) bg-(--surface) hover:border-(--ink-3) transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-eyebrow">Plan</p>
                    <h3 className="text-h2 text-ink mt-1 truncate">{p.name}</h3>
                  </div>
                  <span className={p.isActive ? 'gt-chip gt-chip-ok' : 'gt-chip gt-chip-muted'}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <p className="text-stat-xl num text-ink">
                    {formatCurrency(p.pricePaise)}
                  </p>
                  <p className="text-[11px] text-ink-3 mt-1">
                    per {p.durationMonths}-month term
                    {' · '}
                    <span className="num">{formatCurrency(Math.round(monthly * 100))}</span>/mo effective
                  </p>
                  {p.admissionFeePaise > 0 && (
                    <p className="text-[11px] text-ink-3 mt-1">
                      + {formatCurrency(p.admissionFeePaise)} one-time admission
                    </p>
                  )}
                </div>

                {p.description && (
                  <p className="text-meta text-ink-2 line-clamp-2">{p.description}</p>
                )}

                <div className="mt-auto pt-3 border-t border-line-2 flex items-center justify-between text-[11px] text-ink-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {p.durationMonths} mo
                  </span>
                  <span className="font-mono">ID {p.id}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New membership plan</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreatePlan} className="flex flex-col gap-3">
            <Field label="Name *">
              <input
                required
                placeholder="e.g. Quarterly Strength"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="gt-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (months) *">
                <input
                  type="number"
                  required
                  min="1"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="gt-input"
                />
              </Field>
              <Field label="Price (₹) *">
                <input
                  type="number"
                  required
                  min="0"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(Number(e.target.value))}
                  className="gt-input"
                />
              </Field>
            </div>
            <Field label="Admission fee (₹)">
              <input
                type="number"
                min="0"
                value={admissionFeeRupees}
                onChange={(e) => setAdmissionFeeRupees(Number(e.target.value))}
                className="gt-input"
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="gt-input min-h-18 py-2"
                placeholder="What does this plan include?"
              />
            </Field>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gt-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create plan'}
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
