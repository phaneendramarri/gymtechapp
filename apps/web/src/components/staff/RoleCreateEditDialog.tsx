import React, { useEffect } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { GYM_FEATURES, GYM_FEATURE_LABELS, MenuItem } from '@gymtech/shared';
import { cn } from '@/lib/utils';

interface GymRole {
  id: number;
  gymId?: number;
  name: string;
  permissions: string[];
  menuItemIds?: number[];
  isOwner?: boolean;
  isDefault?: boolean;
}

interface RoleCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole: GymRole | null;
  allRoles: GymRole[];
  menus: MenuItem[];
}

export const RoleCreateEditDialog: React.FC<RoleCreateEditDialogProps> = ({
  open,
  onOpenChange,
  editingRole,
  allRoles,
  menus,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [roleMenuItemIds, setRoleMenuItemIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; permissions: string[]; menuItemIds: number[] }) => api.createGymRole(data),
    onSuccess: () => {
      toast('success', 'Role created');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create role');
      setIsSubmitting(false);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: number; name?: string; permissions?: string[]; menuItemIds?: number[] }) =>
      api.updateGymRole(data.id, { name: data.name, permissions: data.permissions, menuItemIds: data.menuItemIds }),
    onSuccess: () => {
      toast('success', 'Role updated');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update role');
      setIsSubmitting(false);
    },
  });

  const resetForm = () => {
    setRoleName('');
    setRolePerms([]);
    setRoleMenuItemIds([]);
    setError(null);
  };

  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name);
      const perms = Array.isArray(editingRole.permissions) ? [...editingRole.permissions] : [];
      setRolePerms(perms);
      if (Array.isArray(editingRole.menuItemIds) && editingRole.menuItemIds.length > 0) {
        setRoleMenuItemIds([...editingRole.menuItemIds]);
      } else {
        const matched = menus.filter((m) => perms.includes(m.key)).map((m) => m.id);
        setRoleMenuItemIds(matched);
      }
      setError(null);
    } else {
      resetForm();
    }
  }, [editingRole, menus]);

  const togglePermission = (perm: string) => {
    setRolePerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
    const menu = menus.find((m) => m.key === perm);
    if (menu) {
      setRoleMenuItemIds((prev) =>
        prev.includes(menu.id) ? prev.filter((id) => id !== menu.id) : [...prev, menu.id]
      );
    }
  };

  const toggleMenuItem = (menu: MenuItem) => {
    setRoleMenuItemIds((prev) =>
      prev.includes(menu.id) ? prev.filter((id) => id !== menu.id) : [...prev, menu.id]
    );
    setRolePerms((prev) =>
      prev.includes(menu.key) ? prev.filter((p) => p !== menu.key) : [...prev, menu.key]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }
    setIsSubmitting(true);
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        name: roleName.trim(),
        permissions: rolePerms,
        menuItemIds: roleMenuItemIds,
      });
    } else {
      createRoleMutation.mutate({
        name: roleName.trim(),
        permissions: rolePerms,
        menuItemIds: roleMenuItemIds,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {editingRole
              ? 'Modify role name, permissions, and menu access.'
              : 'Create a new custom role with specific permissions and menu access.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[60vh] space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name *</Label>
              <Input id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} required placeholder="e.g., Front Desk, Floor Trainer" />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Permissions & Menu Access</h4>
                <p className="text-xs text-muted-foreground">
                  Syncs bidirectionally: checking a menu enables its permission, and vice versa.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-80 overflow-y-auto p-2 border rounded-lg bg-muted/30">
                {menus
                  .filter((m) => m.isActive && !m.adminOnly)
                  .map((menu) => {
                    const icon = menu.icon ? (
                      <span className="flex items-center justify-center w-5 h-5">
                        <Shield className="w-4 h-4" />
                      </span>
                    ) : null;
                    return (
                      <Label
                        key={menu.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                          roleMenuItemIds.includes(menu.id)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background border-muted hover:bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={roleMenuItemIds.includes(menu.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRoleMenuItemIds((prev) =>
                              checked ? (prev.includes(menu.id) ? prev : [...prev, menu.id]) : prev.filter((id) => id !== menu.id)
                            );
                            setRolePerms((prev) =>
                              checked ? (prev.includes(menu.key) ? prev : [...prev, menu.key]) : prev.filter((p) => p !== menu.key)
                            );
                          }}
                          className="size-4 rounded border-border text-primary focus:ring-primary shrink-0 accent-primary cursor-pointer"
                        />
                        <span className="flex items-center gap-2 flex-1 pointer-events-none">
                          {icon}
                          <span className="text-sm font-medium">{menu.label}</span>
                        </span>
                        <ShieldCheck className={cn('w-4 h-4 shrink-0 pointer-events-none', roleMenuItemIds.includes(menu.id) ? 'text-primary' : 'text-muted-foreground')} />
                      </Label>
                    );
                  })}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (editingRole ? 'Saving…' : 'Creating…') : (editingRole ? 'Save Changes' : 'Create Role')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};