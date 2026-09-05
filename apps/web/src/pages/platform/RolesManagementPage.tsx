import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Pencil, Trash2, RotateCcw, Filter, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';
import { GYM_FEATURES, GYM_FEATURE_LABELS } from '@gymtech/shared';
import { cn } from '@/lib/utils';

// ---- Permission catalog ----
const PERMISSIONS = [
  ...GYM_FEATURES,
  'audit_logs',
  'superadmin',
] as const;
type Perm = (typeof PERMISSIONS)[number];

const PERM_LABELS: Record<Perm, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  attendance: 'Attendance',
  payments: 'Payments',
  pt_collections: 'PT Sessions',
  plans: 'Plans',
  staff: 'Staff',
  reports: 'Reports',
  settings: 'Settings',
  audit_logs: 'Audit Logs',
  superadmin: 'Super Admin',
};

interface RoleRow {
  id: number;
  gymId: number;
  name: string;
  permissions: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface RoleFormData {
  gymId: number;
  name: string;
  permissions: string[];
  isDefault: boolean;
}

export const RolesManagementPage: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterGymId, setFilterGymId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<RoleRow | null>(null);

  const [form, setForm] = useState<RoleFormData>({
    gymId: 1,
    name: '',
    permissions: [],
    isDefault: false,
  });

  // Fetch all roles
  const { data, isLoading } = useQuery({
    queryKey: ['platform-roles', filterGymId],
    queryFn: () => api.getPlatformRoles(filterGymId ? { gymId: filterGymId } : {}),
  });

  // Fetch gyms for filter dropdown
  const { data: gymsData } = useQuery({
    queryKey: ['platform-gyms-for-filter'],
    queryFn: async () => {
      const res = await api.getAdminGyms();
      return res.gyms ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: RoleFormData) => api.createPlatformRole(payload),
    onSuccess: () => {
      toast('success', 'Role created');
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      setFormOpen(false);
    },
    onError: () => toast('error', 'Failed to create role'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RoleFormData> }) =>
      api.updatePlatformRole(id, data),
    onSuccess: () => {
      toast('success', 'Role updated');
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      setFormOpen(false);
    },
    onError: () => toast('error', 'Failed to update role'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePlatformRole(id),
    onSuccess: () => {
      toast('success', 'Role deleted');
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      setDeleteTarget(null);
    },
    onError: () => toast('error', 'Failed to delete role'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.restorePlatformRole(id),
    onSuccess: () => {
      toast('success', 'Role restored');
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      setRestoreTarget(null);
    },
    onError: () => toast('error', 'Failed to restore role'),
  });

  const roles: RoleRow[] = data?.roles ?? [];

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      if (!showDeleted && r.deletedAt) return false;
      if (showDeleted && !r.deletedAt) return false;
      if (filterGymId && r.gymId !== filterGymId) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [roles, showDeleted, filterGymId, search]);

  const openCreate = () => {
    setEditingRole(null);
    setForm({ gymId: filterGymId ?? 1, name: '', permissions: [], isDefault: false });
    setFormOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setEditingRole(role);
    setForm({
      gymId: role.gymId,
      name: role.name,
      permissions: role.permissions,
      isDefault: role.isDefault,
    });
    setFormOpen(true);
  };

  const togglePerm = (perm: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast('error', 'Role name is required');
      return;
    }
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const gymName = (id: number) => gymsData?.find((g) => g.id === id)?.name ?? `Gym #${id}`;

  return (
    <AdminShell title="Roles Management">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select
            value={filterGymId ? String(filterGymId) : 'all'}
            onValueChange={(v) => setFilterGymId(v === 'all' ? undefined : Number(v))}
          >
            <SelectTrigger className="w48">
              <SelectValue placeholder="All gyms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gyms</SelectItem>
              {gymsData?.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs cursor-pointer select-none" htmlFor="show-deleted">Show deleted</Label>
            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Role
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Gym</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No roles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((role) => (
                      <TableRow key={role.id} className={cn(role.deletedAt && 'opacity-50')}>
                        <TableCell className="font-mono text-xs">{role.id}</TableCell>
                        <TableCell className="text-xs">{gymName(role.gymId)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium text-sm">{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.slice(0, 4).map((p) => (
                              <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {p}
                              </Badge>
                            ))}
                            {role.permissions.length > 4 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                +{role.permissions.length - 4}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {role.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          {role.deletedAt ? (
                            <Badge variant="destructive" className="text-[10px]">Deleted</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!role.deletedAt ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(role)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => setRestoreTarget(role)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'New Platform Role'}</DialogTitle>
            <DialogDescription>
              {editingRole ? `Editing "${editingRole.name}"` : 'Create a new gym role. Assign it to staff members from the Users tab.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Gym *</Label>
                <Select
                  value={String(form.gymId)}
                  onValueChange={(v) => setForm((f) => ({ ...f, gymId: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gymsData?.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Receptionist"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-default"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="accent-primary"
              />
              <Label htmlFor="is-default" className="text-sm cursor-pointer">Set as default role for new staff</Label>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map((perm) => (
                  <div key={perm} className="flex items-center gap-2 p-2 rounded border border-border">
                    <input
                      type="checkbox"
                      id={`perm-${perm}`}
                      checked={form.permissions.includes(perm)}
                      onChange={() => togglePerm(perm)}
                      className="accent-primary"
                    />
                    <Label htmlFor={`perm-${perm}`} className="text-xs cursor-pointer flex-1">
                      {PERM_LABELS[perm]}
                    </Label>
                    <code className="text-[9px] text-muted-foreground">{perm}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Role"
        description={`Soft-delete "${deleteTarget?.name}"? It will be hidden from gym users but can be restored.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        destructive
      />

      {/* Restore Confirm */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={() => setRestoreTarget(null)}
        title="Restore Role"
        description={`Restore "${restoreTarget?.name}"? It will become active again.`}
        confirmLabel="Restore"
        onConfirm={() => { if (restoreTarget) restoreMutation.mutate(restoreTarget.id); }}
      />
    </AdminShell>
  );
};
