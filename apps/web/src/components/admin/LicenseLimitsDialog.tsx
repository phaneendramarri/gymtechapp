import React from 'react';
import { Shield, Save } from 'lucide-react';
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

interface LicenseLimitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymName?: string;
  maxMembers: number;
  maxStaffTotal: number;
  maxManagers: number;
  maxOwners: number;
  expiresAtStr: string;
  saving: boolean;
  onChangeMaxMembers: (val: number) => void;
  onChangeMaxStaffTotal: (val: number) => void;
  onChangeMaxManagers: (val: number) => void;
  onChangeMaxOwners: (val: number) => void;
  onChangeExpiresAtStr: (val: string) => void;
  onSave: () => void;
}

export const LicenseLimitsDialog: React.FC<LicenseLimitsDialogProps> = ({
  open,
  onOpenChange,
  gymName,
  maxMembers,
  maxStaffTotal,
  maxManagers,
  maxOwners,
  expiresAtStr,
  saving,
  onChangeMaxMembers,
  onChangeMaxStaffTotal,
  onChangeMaxManagers,
  onChangeMaxOwners,
  onChangeExpiresAtStr,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            License Caps &amp; Quotas
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update capacity limits and subscription period for <strong className="text-foreground">{gymName}</strong>. Enter -1 for unlimited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Max Members</Label>
              <Input
                type="number"
                value={maxMembers}
                onChange={(e) => onChangeMaxMembers(parseInt(e.target.value, 10) || 0)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Max Staff / Trainers</Label>
              <Input
                type="number"
                value={maxStaffTotal}
                onChange={(e) => onChangeMaxStaffTotal(parseInt(e.target.value, 10) || 0)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Max Managers</Label>
              <Input
                type="number"
                value={maxManagers}
                onChange={(e) => onChangeMaxManagers(parseInt(e.target.value, 10) || 0)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Max Owners</Label>
              <Input
                type="number"
                value={maxOwners}
                onChange={(e) => onChangeMaxOwners(parseInt(e.target.value, 10) || 0)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Subscription Expiration Date</Label>
            <Input
              type="date"
              value={expiresAtStr}
              onChange={(e) => onChangeExpiresAtStr(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
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
            {saving ? 'Updating...' : 'Save Limits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
