import React from 'react';
import { UserCog, Save, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface GymUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymName?: string;
  users: any[];
  loading: boolean;
  saving: boolean;
  editingUser?: any;
  formData: {
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    passwordPlain: string;
    showPassword?: boolean;
  };
  onStartEdit: (user: any) => void;
  onCancelEdit: () => void;
  onChangeField: (field: string, value: any) => void;
  onSave: () => void;
}

export const GymUsersDialog: React.FC<GymUsersDialogProps> = ({
  open,
  onOpenChange,
  gymName,
  users,
  loading,
  saving,
  editingUser,
  formData,
  onStartEdit,
  onCancelEdit,
  onChangeField,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Manage Gym Users &amp; Credentials
          </DialogTitle>
          <DialogDescription className="text-xs">
            View and manage accounts for <strong className="text-foreground">{gymName}</strong>. Reset passwords or deactivate access.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-muted-foreground">Loading users...</div>
        ) : editingUser ? (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-secondary/30 rounded-lg text-xs">
              Editing account: <strong className="text-foreground">{editingUser.email}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Full Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => onChangeField('name', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => onChangeField('phone', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => onChangeField('role', val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">OWNER</SelectItem>
                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                    <SelectItem value="STAFF">STAFF</SelectItem>
                    <SelectItem value="TRAINER">TRAINER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => onChangeField('status', val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="DISABLED">DISABLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reset Password (leave empty to keep unchanged)</Label>
              <div className="relative">
                <Input
                  type={formData.showPassword ? 'text' : 'password'}
                  placeholder="New password..."
                  value={formData.passwordPlain}
                  onChange={(e) => onChangeField('passwordPlain', e.target.value)}
                  className="text-xs font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => onChangeField('showPassword', !formData.showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={formData.showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {formData.showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelEdit}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gt-btn-primary gap-1.5"
                onClick={onSave}
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-secondary/20">
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Email / Contact</TableHead>
                  <TableHead className="text-xs font-semibold">Role</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id} className="border-b border-border/60">
                    <TableCell className="text-xs font-medium">{u.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${u.status === 'ACTIVE' ? 'bg-ok/10 text-ok' : 'bg-destructive/10 text-destructive'}`}>
                        {u.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStartEdit(u)}
                        className="h-7 text-xs"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
