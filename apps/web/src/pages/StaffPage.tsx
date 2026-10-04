import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, UserCog, KeyRound, Shield } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CreateStaffRequestSchema, GYM_FEATURES, GYM_FEATURE_LABELS, MenuItem } from '@gymtech/shared';
import { StaffInviteDialog } from '@/components/staff/StaffInviteDialog';
import { StaffEditDialog } from '@/components/staff/StaffEditDialog';
import { RoleCreateEditDialog } from '@/components/staff/RoleCreateEditDialog';
import { StaffTable, type StaffMember } from '@/components/staff/StaffTable';
import { RoleTable } from '@/components/staff/RoleTable';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isOwner = user?.role === 'OWNER' || Boolean(user?.isOwner);
  const canManage = user?.permissions?.includes('staff') || isOwner;

  const [activeTab, setActiveTab] = useState<string>('members');

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

  const staff: StaffMember[] = staffData?.staff || [];
  const roles: GymRole[] = rolesData?.roles || [];
  const menus: MenuItem[] = menusData?.items || [];

  // Staff dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<GymRole | null>(null);

  const createStaffMutation = useMutation({
    mutationFn: (data: any) => api.createStaff(data),
    onSuccess: () => {
      toast('success', 'Staff member invited');
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to invite staff');
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; permissions: string[]; menuItemIds: number[] }) => api.createGymRole(data),
    onSuccess: () => {
      toast('success', 'Role created');
      setRoleDialogOpen(false);
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: number; name?: string; permissions?: string[]; menuItemIds?: number[] }) =>
      api.updateGymRole(data.id, { name: data.name, permissions: data.permissions, menuItemIds: data.menuItemIds }),
    onSuccess: () => {
      toast('success', 'Role updated');
      setRoleDialogOpen(false);
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to update role');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => api.deleteGymRole(id),
    onSuccess: () => {
      toast('success', 'Role deleted');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to delete role');
    },
  });

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleDialogOpen(true);
  };

  const handleOpenEditRole = (role: GymRole) => {
    setEditingRole(role);
    setRoleDialogOpen(true);
  };

  const handleDeleteRole = (id: number) => {
    if (confirm('Delete this role? This action cannot be undone.')) {
      deleteRoleMutation.mutate(id);
    }
  };

  return (
    <AppShell title="Staff Management" description="Manage team members, roles, and permissions">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="members" className="flex-1 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            <span>Team Members</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{staff.length}</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex-1 flex items-center justify-center gap-2">
            <UserCog className="h-4 w-4" />
            <span>Roles & Menus</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{roles.filter(r => !r.isOwner).length}</span>
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  All Staff
                </CardTitle>
                {canManage && (
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Invite User
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <StaffTable
                  staff={staff}
                  roles={roles.filter(r => !r.isOwner).map(r => ({ id: r.id, name: r.name, isOwner: r.isOwner }))}
                  onEdit={setEditingStaff}
                  isLoading={isStaffLoading}
                />
              </CardContent>
            </Card>

            {canManage && (
              <StaffInviteDialog
                open={inviteOpen}
                onOpenChange={setInviteOpen}
                roles={roles.filter(r => !r.isOwner).map(r => ({ id: r.id, name: r.name, isOwner: r.isOwner }))}
              />
            )}

            <StaffEditDialog
              open={!!editingStaff}
              onOpenChange={(open) => { if (!open) setEditingStaff(null); }}
              staff={editingStaff}
              roles={roles.filter(r => !r.isOwner).map(r => ({ id: r.id, name: r.name, isOwner: r.isOwner }))}
            />
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Custom Roles
                </h3>
                <p className="text-sm text-muted-foreground">
                  Define granular permissions for different staff positions.
                  Owner and Default roles cannot be deleted.
                </p>
              </div>
              {canManage && (
                <Button onClick={handleOpenCreateRole}>
                  <Plus className="mr-2 h-4 w-4" /> Create Role
                </Button>
              )}
            </div>

            <Card>
              <CardContent>
                <RoleTable
                  roles={roles}
                  onEdit={handleOpenEditRole}
                  onDelete={handleDeleteRole}
                  isLoading={isRolesLoading}
                />
              </CardContent>
            </Card>

            <RoleCreateEditDialog
              open={roleDialogOpen}
              onOpenChange={setRoleDialogOpen}
              editingRole={editingRole}
              allRoles={roles}
              menus={menus}
            />
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};