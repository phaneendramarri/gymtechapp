import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Loader2, Search, Shield, UserX, UserCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

interface PlatformUser {
  id: number;
  gymId: number;
  gymName: string | null;
  name: string;
  email: string;
  phone: string | null;
  roleId: number | null;
  roleName: string | null;
  role: string;
  status: 'ACTIVE' | 'DISABLED';
  isOwner: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
  disabledAt: number | null;
}

const PAGE_SIZE = 20;

export const PlatformUsersPage: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [filterGymId, setFilterGymId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Dialogs
  const [roleDialogUser, setRoleDialogUser] = useState<PlatformUser | null>(null);
  const [disableTarget, setDisableTarget] = useState<PlatformUser | null>(null);
  const [enableTarget, setEnableTarget] = useState<PlatformUser | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createGymId, setCreateGymId] = useState<number | undefined>(undefined);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  // Role assignment
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Fetch users
  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', filterGymId, search, page],
    queryFn: () =>
      api.getPlatformUsers({
        gymId: filterGymId,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  // Fetch gyms for filter
  const { data: gymsData } = useQuery({
    queryKey: ['platform-gyms-for-filter'],
    queryFn: async () => {
      const res = await api.getAdminGyms();
      return res.gyms ?? [];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: { gymId: number; name: string; email: string; phone?: string; password?: string }) =>
      api.createPlatformUser(data),
    onSuccess: () => {
      toast('success', 'User created');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      setCreateDialogOpen(false);
      setCreateGymId(undefined);
      setCreateName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreatePassword('');
    },
    onError: (err: any) => toast('error', err?.message ?? 'Failed to create user'),
  });

  // Fetch available roles for the gym of the selected user
  const { data: availableRolesData } = useQuery({
    queryKey: ['available-roles', roleDialogUser?.gymId],
    queryFn: () => api.getAvailableRolesForUser(roleDialogUser!.id),
    enabled: !!roleDialogUser,
  });

  const users: PlatformUser[] = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number | null }) =>
      api.updatePlatformUserRole(userId, roleId),
    onSuccess: () => {
      toast('success', 'Role updated');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      setRoleDialogUser(null);
    },
    onError: () => toast('error', 'Failed to update role'),
  });

  // Disable mutation
  const disableMutation = useMutation({
    mutationFn: (id: number) => api.disablePlatformUser(id),
    onSuccess: () => {
      toast('success', 'User disabled');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      setDisableTarget(null);
    },
    onError: () => toast('error', 'Failed to disable user'),
  });

  // Enable mutation
  const enableMutation = useMutation({
    mutationFn: (id: number) => api.enablePlatformUser(id),
    onSuccess: () => {
      toast('success', 'User enabled');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      setEnableTarget(null);
    },
    onError: () => toast('error', 'Failed to enable user'),
  });

  const openRoleDialog = (user: PlatformUser) => {
    setRoleDialogUser(user);
    setSelectedRoleId(user.roleId);
  };

  const handleRoleSave = () => {
    if (!roleDialogUser) return;
    updateRoleMutation.mutate({ userId: roleDialogUser.id, roleId: selectedRoleId });
  };

  const gymName = (id: number) => gymsData?.find((g) => g.id === id)?.name ?? `Gym #${id}`;

  const formatDate = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <AdminShell title="Platform Users">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select
            value={filterGymId ? String(filterGymId) : 'all'}
            onValueChange={(v) => { setFilterGymId(v === 'all' ? undefined : Number(v)); setPage(1); }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All gyms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gyms</SelectItem>
              {gymsData?.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {total.toLocaleString()} user{total !== 1 ? 's' : ''}
          </div>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New User
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Gym</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id} className={cn(user.status === 'DISABLED' && 'opacity-60')}>
                        <TableCell className="font-mono text-xs">{user.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              {user.isOwner && <Badge variant="outline" className="text-[9px] mt-0.5 border-amber-500 text-amber-600">Owner</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="text-xs">{gymName(user.gymId)}</TableCell>
                        <TableCell>
                          {user.roleName ? (
                            <Badge variant="secondary" className="text-[10px]">
                              <Shield className="h-3 w-3 mr-0.5" />
                              {user.roleName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.status === 'ACTIVE' ? (
                            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Active</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Change role" onClick={() => openRoleDialog(user)}>
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                            {user.status === 'ACTIVE' ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Disable user" onClick={() => setDisableTarget(user)}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Enable user" onClick={() => setEnableTarget(user)}>
                                <UserCheck className="h-3.5 w-3.5" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Role Assignment Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={() => setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Assign a role for <strong>{roleDialogUser?.name}</strong> at {gymName(roleDialogUser?.gymId ?? 0)}. Leave blank to remove the custom role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={selectedRoleId ? String(selectedRoleId) : 'none'} onValueChange={(v) => setSelectedRoleId(v === 'none' ? null : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No custom role —</SelectItem>
                  {availableRolesData?.roles?.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>Cancel</Button>
            <Button onClick={handleRoleSave} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirm */}
      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={() => setDisableTarget(null)}
        title="Disable User"
        description={`Disable ${disableTarget?.name}? They will not be able to log in.`}
        confirmLabel="Disable"
        onConfirm={() => { if (disableTarget) disableMutation.mutate(disableTarget.id); }}
        destructive
      />

      {/* Enable Confirm */}
      <ConfirmDialog
        open={!!enableTarget}
        onOpenChange={() => setEnableTarget(null)}
        title="Enable User"
        description={`Enable ${enableTarget?.name}? They will regain access.`}
        confirmLabel="Enable"
        onConfirm={() => { if (enableTarget) enableMutation.mutate(enableTarget.id); }}
      />

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Platform User</DialogTitle>
            <DialogDescription>Create a new staff user in a specific gym.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Gym *</Label>
              <Select value={createGymId ? String(createGymId) : 'none'} onValueChange={(v) => setCreateGymId(v === 'none' ? undefined : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gym..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a gym...</SelectItem>
                  {gymsData?.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="Leave blank for default: ChangeMe123!" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!createGymId) { toast('error', 'Please select a gym'); return; }
                if (!createName.trim()) { toast('error', 'Name is required'); return; }
                if (!createEmail.trim()) { toast('error', 'Email is required'); return; }
                createUserMutation.mutate({ gymId: createGymId, name: createName.trim(), email: createEmail.trim(), phone: createPhone || undefined, password: createPassword || undefined });
              }}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};
