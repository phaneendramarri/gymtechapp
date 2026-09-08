import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Tag, Check, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreatePlanRequestSchema } from '@gymtech/shared';

export const PlansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.permissions?.includes('plans');

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
      const parsed = CreatePlanRequestSchema.safeParse({
        name,
        durationMonths: Number(durationMonths),
        pricePaise: Math.round(Number(priceRupees) * 100),
        admissionFeePaise: Math.round(Number(admissionFeeRupees) * 100),
        taxPercentage: 0,
        billingPeriod: 'MONTHLY',
        description: description || undefined,
      });
      if (!parsed.success) {
        setError(parsed.error.errors.map((e) => e.message).join(', '));
        setIsSubmitting(false);
        return;
      }

      await api.createPlan({
        name,
        durationMonths: Number(durationMonths),
        pricePaise: Math.round(Number(priceRupees) * 100),
        admissionFeePaise: Math.round(Number(admissionFeeRupees) * 100),
        taxPercentage: 0,
        billingPeriod: 'MONTHLY',
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
      title="Membership Plans"
      description="The catalog of membership packages available at your front desk."
      actions={
        canManage && (
          <Button variant="default" size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5 font-semibold text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> New Plan
          </Button>
        )
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No plans created yet"
          description="Create your first membership package — pick a duration, set a price, and it becomes available at the front desk."
          action={
            canManage ? (
              <Button variant="default" onClick={() => setDialogOpen(true)} className="font-semibold gap-1.5">
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
              <Card
                key={p.id}
                className="flex flex-col justify-between border-border/80 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden group"
              >
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> Package
                      </p>
                      <h3 className="text-lg font-bold text-foreground mt-0.5 truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                    </div>
                    <Badge variant={p.isActive ? 'default' : 'outline'} className="text-[10px]">
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-foreground">
                        {formatCurrency(p.pricePaise)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        / {p.durationMonths} {p.durationMonths === 1 ? 'month' : 'months'}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      ≈ <span className="text-foreground font-semibold">{formatCurrency(Math.round(monthly * 100))}</span> / month effective
                    </p>

                    {p.admissionFeePaise > 0 && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1.5 flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500" />
                        + {formatCurrency(p.admissionFeePaise)} one-time admission
                      </p>
                    )}

                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" /> {p.durationMonths} {p.durationMonths === 1 ? 'month term' : 'months term'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ID #{p.id}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold">New Membership Plan</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the package duration, price, and optional admission fees.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="planName" className="text-xs font-semibold">Plan Name *</Label>
              <Input
                id="planName"
                required
                placeholder="e.g. Quarterly Strength & Conditioning"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-xs font-semibold">Duration (Months) *</Label>
                <Input
                  id="duration"
                  type="number"
                  required
                  min="1"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs font-semibold">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  required
                  min="0"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admissionFee" className="text-xs font-semibold">Admission Fee (₹, optional)</Label>
              <Input
                id="admissionFee"
                type="number"
                min="0"
                value={admissionFeeRupees}
                onChange={(e) => setAdmissionFeeRupees(Number(e.target.value))}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">Description (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs resize-none"
                placeholder="What facilities, classes, or privileges are included?"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs h-8 font-semibold">
                {isSubmitting ? 'Creating…' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
