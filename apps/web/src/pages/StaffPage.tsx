import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  AlertCircle,
  Users,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Shield,
  ShieldCheck,
  Check,
  CheckSquare,
  Square,
  KeyRound,
  LayoutDashboard,
  CalendarCheck,
  CreditCard,
  Trophy,
  Tag,
  BarChart3,
  UserCog,
  Settings,
  Sliders,
} from 'lucide-react';

const MENU_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  members: Users,
  attendance: CalendarCheck,
  payments: CreditCard,
  pt_collections: Trophy,
  plans: Tag,
  reports: BarChart3,
  staff: UserCog,
  settings: Settings,
  audit_logs: Sliders,
};
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { CreateStaffRequestSchema, GYM_FEATURES, GYM_FEATURE_LABELS, MenuItem } from '@gymtech/shared';
import { Skeleton } from '@/components/ui/skeleton';

/** All available menu permission keys for gym staff (single source of truth). */
const ALL_PERMISSION_KEYS = [...GYM_FEATURES];

interface GymRole {
  id: number;
  gymId?: number;
  name: string;
  permissions: string[];
  menuItemIds?: number[];
  isOwner?: boolean;
  isDefault?: boolean;
  createdAt?: number;
}

export const StaffPage: React.FC = () => {
  const { user, gym } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isOwner = user?.role === 'OWNER' || Boolean(user?.isOwner);
  const canManage = user?.permissions?.includes('staff') || isOwner;

  const [activeTab, setActiveTab] = useState<'members' | 'roles'>('members');

  // Queries
  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.getStaff(),
  });

  const { data: rolesData, isLoading: isRolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.getGymRoles(),
  });

  const { data: menusData, isLoading: isMenusLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api.getMenuItems(),
  });

  const staff = staffData?.staff || [];
  const roles: GymRole[] = rolesData?.roles || [];
  const dbMenus: MenuItem[] = menusData?.items || [];

  // Invite Staff State
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Edit Staff State
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');

  // Role Create/Edit Dialog State
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<GymRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [roleMenuItemIds, setRoleMenuItemIds] = useState<number[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role selection sync for Invite
  const handleSelectRoleForInvite = (roleIdStr: string) => {
    if (!roleIdStr) {
      setSelectedRoleId(null);
      return;
    }
    const rId = Number(roleIdStr);
    setSelectedRoleId(rId);
  };

  // Role selection sync for Edit Staff
  const handleSelectRoleForEdit = (roleIdStr: string) => {
    if (!roleIdStr) {
      setEditRoleId(null);
      return;
    }
    const rId = Number(roleIdStr);
    setEditRoleId(rId);
  };

  const toggleRoleMenuItem = (menu: MenuItem) => {
    setRoleMenuItemIds((prev) =>
      prev.includes(menu.id) ? prev.filter((id) => id !== menu.id) : [...prev, menu.id]
    );
    setRolePerms((prev) =>
      prev.includes(menu.key) ? prev.filter((p) => p !== menu.key) : [...prev, menu.key]
    );
  };

  const handleOpenEditStaff = (s: any) => {
    setEditingStaff(s);
    setEditName(s.name || '');
    setEditPhone(s.phone || '');
    setEditRoleId(s.roleId ? Number(s.roleId) : null);
    setEditStatus(s.status || 'ACTIVE');
    setError(null);
  };

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName('');
    // Start with no menus checked — the owner explicitly opts into each
    // menu so new roles follow least-privilege (a members-only desk role
    // must not silently gain attendance/payments access).
    setRoleMenuItemIds([]);
    setRolePerms([]);
    setError(null);
    setRoleDialogOpen(true);
  };

  const handleOpenEditRole = (role: GymRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    const perms = Array.isArray(role.permissions) ? [...role.permissions] : [];
    setRolePerms(perms);
    if (Array.isArray(role.menuItemIds) && role.menuItemIds.length > 0) {
      setRoleMenuItemIds([...role.menuItemIds]);
    } else {
      const matched = dbMenus.filter((m) => perms.includes(m.key)).map((m) => m.id);
      setRoleMenuItemIds(matched);
    }
    setError(null);
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }
    if (roleMenuItemIds.length === 0 && rolePerms.length === 0) {
      setError('Select at least one menu for this role');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingRole) {
        await api.updateGymRole(editingRole.id, {
          name: roleName.trim(),
          menuItemIds: roleMenuItemIds,
          permissions: rolePerms,
        });
        toast('success', 'Role updated', `Role "${roleName.trim()}" updated successfully.`);
      } else {
        await api.createGymRole({
          name: roleName.trim(),
          menuItemIds: roleMenuItemIds,
          permissions: rolePerms,
        });
        toast('success', 'Role created', `Custom role "${roleName.trim()}" created successfully.`);
      }
      setRoleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    } catch (err: any) {
      setError(err.message || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: GymRole) => {
    if (role.isOwner) {
      toast('error', 'Cannot delete owner role', 'The primary owner role cannot be deleted.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete role "${role.name}"? Team members assigned to this role will need to be reassigned.`
    );
    if (!confirmed) return;

    try {
      await api.deleteGymRole(role.id);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast('success', 'Role removed', `Role "${role.name}" has been deleted.`);
    } catch (err: any) {
      toast('error', 'Failed to delete role', err.message || 'Error occurred');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // Permissions are role-scoped: the chosen role determines access, so
      // neither a role name nor a per-user permission list is sent.
      const parsed = CreateStaffRequestSchema.safeParse({
        name,
        email,
        phone,
        password,
        roleId: selectedRoleId,
      });

      if (!parsed.success) {
        setError(parsed.error.errors.map((e) => e.message).join(', '));
        setIsSubmitting(false);
        return;
      }

      await api.createStaff({
        name,
        email,
        phone,
        password,
        roleId: selectedRoleId,
      });

      setInviteOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setSelectedRoleId(null);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast('success', 'User invited', `${name} has been invited and can now sign in.`);
    } catch (err: any) {
      setError(err.message || 'Failed to add user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.updateStaff(editingStaff.id, {
        name: editName,
        phone: editPhone,
        roleId: editRoleId,
        status: editStatus,
      });

      setEditingStaff(null);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast('success', 'Staff updated', 'Team member profile and role permissions updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (s: any) => {
    if (s.id === user?.id) {
      toast('error', 'Action not allowed', 'You cannot deactivate your own account.');
      return;
    }
    const newStatus = s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.updateStaff(s.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast(
        'success',
        `Staff ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`,
        `${s.name} is now ${newStatus.toLowerCase()}.`
      );
    } catch (err: any) {
      toast('error', 'Action failed', err.message || 'Could not update staff status.');
    }
  };

  return (
    <AppShell
      title="Staff & Roles"
      description="Manage your gym's team members, customize menu-level roles, and enforce granular access control."
      actions={
        canManage && (
          <div className="flex items-center gap-2">
            {activeTab === 'roles' ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenCreateRole}
                className="gap-1.5 font-semibold text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Create Role
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setInviteOpen(true);
                  setError(null);
                }}
                className="gap-1.5 font-semibold text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Invite User
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-5">
          <TabsList className="bg-card border border-border p-1 rounded-xl h-10 flex items-center gap-1 shadow-2xs max-w-sm">
            <TabsTrigger value="members" className="gap-2 text-xs font-medium flex-1 h-8 rounded-lg">
              <Users className="h-3.5 w-3.5" />
              <span>Team Members ({staff.length})</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 text-xs font-medium flex-1 h-8 rounded-lg">
              <Shield className="h-3.5 w-3.5" />
              <span>Roles & Menus ({roles.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TEAM MEMBERS */}
          <TabsContent value="members" className="space-y-4">
            {isStaffLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members yet."
                description="Invite your first staff member and select their role and menu permissions."
                action={
                  canManage ? (
                    <Button variant="default" onClick={() => setInviteOpen(true)}>
                      <Plus className="h-3.5 w-3.5" /> Invite first user
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {staff.map((s: any) => {
                  const assignedRole = roles.find((r) => r.id === s.roleId);
                  const roleDisplayName = s.isOwner === 1
                    ? 'Owner'
                    : (assignedRole ? assignedRole.name : s.role || 'Staff');

                  return (
                    <li key={s.id}>
                      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-primary/40 hover:shadow-xs transition-all bg-card">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
                            {(s.name?.[0] || '·').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                              {s.isOwner === 1 ? (
                                <Badge variant="secondary" className="text-[10px] font-bold">Owner</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                  {roleDisplayName}
                                </Badge>
                              )}
                              <Badge
                                variant={s.status === 'ACTIVE' ? 'default' : 'destructive'}
                                className="text-[10px]"
                              >
                                {s.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                              {s.email} {s.phone ? `· ${s.phone}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                          <div className="hidden md:flex flex-wrap gap-1 max-w-xs justify-end">
                            {(s.permissions as string[] || []).slice(0, 3).map((perm: string) => (
                              <span
                                key={perm}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                              >
                                {GYM_FEATURE_LABELS[perm as keyof typeof GYM_FEATURE_LABELS]?.name || perm}
                              </span>
                            ))}
                            {(s.permissions as string[] || []).length > 3 && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                +{(s.permissions as string[] || []).length - 3} more
                              </span>
                            )}
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleOpenEditStaff(s)}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              {!s.isOwner && s.id !== user?.id && (
                                <Button
                                  variant={s.status === 'ACTIVE' ? 'ghost' : 'outline'}
                                  size="sm"
                                  className={cn(
                                    'h-8 text-xs gap-1',
                                    s.status === 'ACTIVE'
                                      ? 'text-destructive hover:bg-destructive/10'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  )}
                                  onClick={() => handleToggleStatus(s)}
                                >
                                  {s.status === 'ACTIVE' ? (
                                    <>
                                      <UserX className="h-3 w-3" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3 w-3" /> Reactivate
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          {/* TAB 2: ROLES & MENU PERMISSIONS */}
          <TabsContent value="roles" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Gym Roles & Permissions</h3>
                <p className="text-xs text-muted-foreground">
                  Create roles based on your gym operations and define the exact menus each role can access.
                </p>
              </div>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCreateRole}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Role
                </Button>
              )}
            </div>

            {isRolesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No custom roles created"
                description="Create custom roles like 'Front Desk' or 'Trainer' to control which menus your staff can access."
                action={
                  canManage ? (
                    <Button variant="default" onClick={handleOpenCreateRole}>
                      <Plus className="h-3.5 w-3.5" /> Create first role
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map((role) => {
                  const assignedCount = staff.filter((s: any) => s.roleId === role.id).length;
                  const perms = Array.isArray(role.permissions) ? role.permissions : [];

                  return (
                    <Card key={role.id} className="p-4 border-border bg-card flex flex-col justify-between hover:border-primary/40 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">{role.name}</h4>
                              {role.isOwner ? (
                                <Badge variant="secondary" className="text-[10px]">Owner</Badge>
                              ) : role.isDefault ? (
                                <Badge variant="outline" className="text-[10px]">Default</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Custom</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {assignedCount} {assignedCount === 1 ? 'member' : 'members'} assigned
                            </p>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleOpenEditRole(role)}
                                title="Edit Role"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {!role.isOwner && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteRole(role)}
                                  title="Delete Role"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Perm Badges */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">Accessible Menus & Routes:</p>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const accessibleMenus = dbMenus.filter((m) =>
                                (role.menuItemIds && role.menuItemIds.includes(m.id)) || perms.includes(m.key)
                              );
                              if (accessibleMenus.length === 0 && perms.length === 0) {
                                return <span className="text-xs text-muted-foreground italic">No menus assigned</span>;
                              }
                              const listToRender = accessibleMenus.length > 0
                                ? accessibleMenus.map((m) => ({ key: m.key, label: m.label }))
                                : perms.map((p) => ({
                                    key: p,
                                    label: GYM_FEATURE_LABELS[p as keyof typeof GYM_FEATURE_LABELS]?.name || p,
                                  }));

                              return listToRender.map((item) => {
                                const Icon = MENU_ICONS[item.key] || Shield;
                                return (
                                  <Badge key={item.key} variant="secondary" className="text-[10px] font-medium px-2 py-0.5 flex items-center gap-1">
                                    <Icon className="h-2.5 w-2.5 text-primary" />
                                    <span>{item.label}</span>
                                  </Badge>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG: INVITE USER */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
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

            <Field label="Assign Role">
              <p className="text-[11px] text-muted-foreground mb-1.5">
                Assign a role to grant sidebar navigation and API access.
              </p>
              <select
                value={selectedRoleId || ''}
                onChange={(e) => handleSelectRoleForInvite(e.target.value)}
                className="gt-input font-medium"
              >
                <option value="">-- Select a Role --</option>
                {roles.filter((r) => !r.isOwner).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Array.isArray(r.permissions) ? r.permissions.length : 0} menus)
                  </option>
                ))}
              </select>
            </Field>

            {(() => {
              const assigned = roles.find((r) => r.id === selectedRoleId);
              if (!assigned) return null;
              const perms = Array.isArray(assigned?.permissions) ? assigned.permissions : [];
              const accessibleMenus = dbMenus.filter((m) =>
                (assigned.menuItemIds && assigned.menuItemIds.includes(m.id)) || perms.includes(m.key)
              );
              return (
                <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Unlocked Sidebar Menus & Routes:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{accessibleMenus.length || perms.length} accessible</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {accessibleMenus.length > 0 ? (
                      accessibleMenus.map((m) => {
                        const Icon = MENU_ICONS[m.key] || Shield;
                        return (
                          <span key={m.id} className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-background border px-2 py-0.5 rounded text-foreground">
                            <Icon className="h-3 w-3 text-primary" />
                            <span>{m.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({m.href || `/${m.key}`})</span>
                          </span>
                        );
                      })
                    ) : (
                      perms.map((p) => {
                        const Icon = MENU_ICONS[p] || Shield;
                        const label = GYM_FEATURE_LABELS[p as keyof typeof GYM_FEATURE_LABELS]?.name || p;
                        return (
                          <span key={p} className="inline-flex items-center gap-1 text-[11px] font-medium bg-background border px-2 py-0.5 rounded text-foreground">
                            <Icon className="h-3 w-3 text-primary" />
                            {label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Inviting…' : 'Invite User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT STAFF */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUpdateStaff} className="flex flex-col gap-4">
            <Field label="Full name *">
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="gt-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="gt-input font-mono"
                />
              </Field>

              <Field label="Status">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="gt-input font-mono"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </Field>
            </div>

            <Field label="Assign Role">
              <p className="text-[11px] text-muted-foreground mb-1.5">
                Changing role instantly updates this user's accessible menus and permissions.
              </p>
              <select
                value={editRoleId || ''}
                onChange={(e) => handleSelectRoleForEdit(e.target.value)}
                className="gt-input font-medium"
              >
                <option value="">-- Select a Role --</option>
                {roles.filter((r) => !r.isOwner).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Array.isArray(r.permissions) ? r.permissions.length : 0} menus)
                  </option>
                ))}
              </select>
            </Field>

            {(() => {
              const assigned = roles.find((r) => r.id === editRoleId);
              if (!assigned) return null;
              const perms = Array.isArray(assigned?.permissions) ? assigned.permissions : [];
              const accessibleMenus = dbMenus.filter((m) =>
                (assigned.menuItemIds && assigned.menuItemIds.includes(m.id)) || perms.includes(m.key)
              );
              return (
                <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Unlocked Sidebar Menus & Routes:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{accessibleMenus.length || perms.length} accessible</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {accessibleMenus.length > 0 ? (
                      accessibleMenus.map((m) => {
                        const Icon = MENU_ICONS[m.key] || Shield;
                        return (
                          <span key={m.id} className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-background border px-2 py-0.5 rounded text-foreground">
                            <Icon className="h-3 w-3 text-primary" />
                            <span>{m.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({m.href || `/${m.key}`})</span>
                          </span>
                        );
                      })
                    ) : (
                      perms.map((p) => {
                        const Icon = MENU_ICONS[p] || Shield;
                        const label = GYM_FEATURE_LABELS[p as keyof typeof GYM_FEATURE_LABELS]?.name || p;
                        return (
                          <span key={p} className="inline-flex items-center gap-1 text-[11px] font-medium bg-background border px-2 py-0.5 rounded text-foreground">
                            <Icon className="h-3 w-3 text-primary" />
                            {label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingStaff(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CREATE OR EDIT ROLE */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{editingRole ? 'Edit Gym Role' : 'Create Custom Gym Role'}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure this role and select which navigation menus and features it unlocks for assigned staff.
            </p>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSaveRole} className="flex flex-col gap-4">
            <Field label="Role Name *">
              <input
                required
                placeholder="e.g. Front Desk, Floor Trainer, Supervisor, Accountant"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="gt-input"
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Accessible Sidebar Menus & Features *</label>
                  <p className="text-[11px] text-muted-foreground">Staff assigned this role will only access the checked routes and menus from the database.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMenuItemIds(dbMenus.map((m) => m.id));
                      setRolePerms(dbMenus.map((m) => m.key));
                    }}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMenuItemIds([]);
                      setRolePerms([]);
                    }}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1.5 border rounded-lg bg-card/50">
                {dbMenus.map((menu) => {
                  const Icon = MENU_ICONS[menu.key] || Shield;
                  const isChecked = roleMenuItemIds.includes(menu.id) || rolePerms.includes(menu.key);
                  return (
                    <label
                      key={menu.id}
                      className={cn(
                        'flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-xs select-none',
                        isChecked
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border/70 bg-background/50 hover:border-border text-muted-foreground'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRoleMenuItem(menu)}
                        className="accent-primary h-4 w-4 mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', isChecked ? 'text-primary' : 'text-muted-foreground')} />
                          <span className={cn('font-semibold truncate', isChecked ? 'text-foreground' : 'text-foreground/80')}>{menu.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">{menu.href || `/${menu.key}`}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="mt-2 pt-2 border-t border-border flex items-center justify-between sm:justify-between">
              <span className="text-[11px] text-muted-foreground font-mono">
                {roleMenuItemIds.length} of {dbMenus.length} menus enabled
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRoleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isSubmitting || !roleName.trim() || (roleMenuItemIds.length === 0 && rolePerms.length === 0)}
                >
                  {isSubmitting ? 'Saving…' : (editingRole ? 'Save Changes' : 'Create Role')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className={cn('text-xs font-medium text-foreground', label.endsWith(' *') && 'gt-label-required')}>
      {label.replace(' *', '')}
    </label>
    {children}
  </div>
);
