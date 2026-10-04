import React from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pencil, UserX, UserCheck, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  roleId: number | null;
  roleName?: string | null;
  role: string;
  status: 'ACTIVE' | 'DISABLED';
  isOwner: boolean;
  lastLoginAt: number | null;
  createdAt: number;
}

interface StaffTableProps {
  staff: StaffMember[];
  roles: { id: number; name: string; isOwner?: boolean }[];
  onEdit: (staff: StaffMember) => void;
  isLoading: boolean;
}

export const StaffTable: React.FC<StaffTableProps> = ({
  staff,
  roles,
  onEdit,
  isLoading,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<number | null>(null);

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'DISABLED' }) =>
      api.updateStaff(id, { status }),
    onSuccess: (_, vars) => {
      toast('success', vars.status === 'DISABLED' ? 'Staff member deactivated' : 'Staff member activated');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to update staff status');
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: number) => api.deleteStaff(id),
    onSuccess: () => {
      toast('success', 'Staff member removed');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => {
      toast('error', err.message || 'Failed to remove staff');
    },
  });

  const handleDelete = (id: number) => {
    setStaffToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (staffToDelete) {
      deleteStaffMutation.mutate(staffToDelete);
    }
    setDeleteConfirmOpen(false);
    setStaffToDelete(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="animate-pulse h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-6 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No staff members yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Invite Staff" to add your first team member.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={s.isOwner ? 'default' : 'secondary'}>{s.roleName || s.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {s.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {s.status === 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        disabled={s.isOwner || toggleStatusMutation.isPending}
                        onClick={() => toggleStatusMutation.mutate({ id: s.id, status: 'DISABLED' })}
                      >
                        <UserX className="mr-1 h-3.5 w-3.5" /> Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-positive hover:bg-positive/10"
                        disabled={s.isOwner || toggleStatusMutation.isPending}
                        onClick={() => toggleStatusMutation.mutate({ id: s.id, status: 'ACTIVE' })}
                      >
                        <UserCheck className="mr-1 h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onEdit(s)}
                      title="Edit staff details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!s.isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s.id)}
                        title="Delete staff"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Staff Member"
        description="This action cannot be undone. The staff member will be permanently removed."
        onConfirm={confirmDelete}
      />
    </>
  );
};