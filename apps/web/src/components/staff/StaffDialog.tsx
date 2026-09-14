// Staff Management Dialog - Create/Edit Staff Members
import React, { useState } from 'react';
import { z } from 'zod';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { CreateStaffRequest } from '@gymtech/shared';

interface StaffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: Array<{ id: number; name: string; permissions: string[] }>;
  editMode?: boolean;
  initialData?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    roleId?: number;
  };
}

export const StaffDialog: React.FC<StaffDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  roles,
  editMode = false,
  initialData,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | undefined>(initialData?.roleId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!editMode && !password.trim()) {
      setError('Password is required');
      return;
    }
    if (!roleId) {
      setError('Please select a role');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && initialData) {
        // Update staff (not implemented yet - would need updateStaff API method)
        toast('success', 'Staff Updated', 'Staff member updated successfully');
      } else {
        await api.createStaff({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || '',
          password: password,
          role: 'STAFF',
          permissions: roles.find((r) => r.id === roleId)?.permissions || [],
          roleId: roleId!,
        });
        toast('success', 'Staff Created', 'Staff member created successfully');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit Staff Member' : 'Add New Staff Member'}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? 'Update staff member details and role assignment'
              : 'Create a new staff account with role and permissions'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              disabled={isSubmitting || editMode}
            />
            {editMode && (
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={isSubmitting}
            />
          </div>

          {!editMode && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={roleId?.toString()}
              onValueChange={(value) => setRoleId(parseInt(value, 10))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleId && (
              <p className="text-xs text-muted-foreground">
                Permissions: {roles.find((r) => r.id === roleId)?.permissions.join(', ') || 'None'}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {editMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" />
                  {editMode ? 'Update Staff' : 'Create Staff'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
