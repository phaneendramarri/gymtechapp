import React from 'react';
import { Sliders, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export interface FeatureItem {
  key: string;
  label: string;
  desc: string;
}

interface FeaturePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymName?: string;
  loading: boolean;
  saving: boolean;
  features: Record<string, boolean>;
  featureList: FeatureItem[];
  onToggleFeature: (key: string, enabled: boolean) => void;
  onSave: () => void;
}

export const FeaturePermissionsDialog: React.FC<FeaturePermissionsDialogProps> = ({
  open,
  onOpenChange,
  gymName,
  loading,
  saving,
  features,
  featureList,
  onToggleFeature,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Menu &amp; Feature Access Control
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure which application modules are enabled for <strong className="text-foreground">{gymName}</strong>. Disabled features are hidden from the UI and blocked at the API layer.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-muted-foreground">Loading features...</div>
        ) : (
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {featureList.map((feat) => {
              const isChecked = features[feat.key] ?? true;
              return (
                <div
                  key={feat.key}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                      {feat.label}
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                        {feat.key}
                      </code>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{feat.desc}</p>
                  </div>
                  <Switch
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggleFeature(feat.key, checked)}
                  />
                </div>
              );
            })}
          </div>
        )}

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
            className="gap-1.5"
            onClick={onSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
