import React from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, AlertCircle, Shield, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { CreateStaffRequestSchema, GYM_FEATURES, GYM_FEATURE_LABELS, MenuItem } from '@gymtech/shared';
import { cn } from '@/lib/utils';

interface StaffInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: number; name: string; isOwner?: boolean }[];
}

export const StaffInviteDialog: React.FC<StaffInviteDialogProps> = ({
  open,
  onOpenChange,
  roles,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStaffMutation = useMutation({
    mutationFn: (data: any) => api.createStaff(data),
    onSuccess: () => {
      toast('success', 'Staff member invited');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setName(''); setEmail(''); setPhone(''); setPassword(''); setSelectedRoleId(null); setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to invite staff');
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedRoleId) {
      setError('Please select a role');
      return;
    }
    setIsSubmitting(true);
    createStaffMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      password,
      roleId: selectedRoleId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-96 space-y-4 py-4">
            {error && (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Ramesh Patel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ramesh@gym.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min. 6 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId">Role *</Label>
              <select
                id="roleId"
                value={selectedRoleId ? String(selectedRoleId) : ''}
                onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                required
              >
                <option value="">Select a role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}{r.isOwner ? ' (Owner)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Inviting…' : 'Invite User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};