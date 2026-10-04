import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pencil, Shield, CheckSquare, Square, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { GYM_FEATURE_LABELS } from '@gymtech/shared';

interface GymRole {
  id: number;
  name: string;
  permissions: string[];
  menuItemIds?: number[];
  isOwner?: boolean;
  isDefault?: boolean;
}

interface RoleTableProps {
  roles: GymRole[];
  onEdit: (role: GymRole) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}

export const RoleTable: React.FC<RoleTableProps> = ({
  roles,
  onEdit,
  onDelete,
  isLoading,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [roleToDelete, setRoleToDelete] = React.useState<number | null>(null);

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

  const handleDelete = (id: number) => {
    setRoleToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (roleToDelete) {
      deleteRoleMutation.mutate(roleToDelete);
    }
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
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
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No custom roles yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Create Role" to define a custom role with specific permissions.</p>
        </CardContent>
      </Card>
    );
  }

  const getPermissionLabels = (perms: string[]) => {
    return perms.map((p) => GYM_FEATURE_LABELS[p as keyof typeof GYM_FEATURE_LABELS]?.name || p).join(', ') || 'None';
  };

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="max-w-xs">Permissions</TableHead>
              <TableHead className="w-28">Default?</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                <TableCell className="font-medium">{r.name}{r.isOwner ? ' (Owner)' : r.isDefault ? ' (Default)' : ''}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {r.permissions.slice(0, 3).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {GYM_FEATURE_LABELS[p as keyof typeof GYM_FEATURE_LABELS]?.name || p}
                      </Badge>
                    ))}
                    {r.permissions.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{r.permissions.length - 3} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={r.isDefault ? 'default' : 'secondary'}>
                    {r.isDefault ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(r)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!r.isOwner && !r.isDefault && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(r.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Role"
        description="This action cannot be undone. The role and its permissions will be permanently removed."
        onConfirm={confirmDelete}
      />
    </>
  );
};