import React from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertCircle, UserCheck, UserX, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface StaffEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: any;
  roles: { id: number; name: string; isOwner?: boolean }[];
}

export const StaffEditDialog: React.FC<StaffEditDialogProps> = ({
  open,
  onOpenChange,
  staff,
  roles,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStaffMutation = useMutation({
    mutationFn: (data: { id: number; name: string; phone: string; roleId: number | null; status: 'ACTIVE' | 'DISABLED' }) =>
      api.updateStaff(data.id, { name: data.name, phone: data.phone, roleId: data.roleId, status: data.status }),
    onSuccess: () => {
      toast('success', 'Staff updated');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update staff');
      setIsSubmitting(false);
    },
  });

  React.useEffect(() => {
    if (staff) {
      setEditName(staff.name || '');
      setEditPhone(staff.phone || '');
      setEditRoleId(staff.roleId ? Number(staff.roleId) : null);
      setEditStatus(staff.status || 'ACTIVE');
      setError(null);
    }
  }, [staff]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!staff) return;
    setIsSubmitting(true);
    updateStaffMutation.mutate({
      id: staff.id,
      name: editName.trim(),
      phone: editPhone.trim(),
      roleId: editRoleId,
      status: editStatus,
    });
  };

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Staff</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-96 space-y-4 py-4">
            {error && (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
            <div className="space-y-2">
              <Label htmlFor="editName">Full Name *</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRoleId">Role</Label>
              <Select value={editRoleId ? String(editRoleId) : ''} onValueChange={(v) => setEditRoleId(v ? Number(v) : null)}>
                <SelectTrigger id="editRoleId">
                  <SelectValue placeholder="No role assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No role</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}{r.isOwner ? ' (Owner)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Switch id="editStatus" checked={editStatus === 'ACTIVE'} onCheckedChange={(c) => setEditStatus(c ? 'ACTIVE' : 'DISABLED')} />
              <Label htmlFor="editStatus" className="mb-0 cursor-pointer">Active</Label>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};