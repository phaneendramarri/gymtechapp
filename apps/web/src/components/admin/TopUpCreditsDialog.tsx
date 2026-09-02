import React from 'react';
import { Coins, Smartphone, MessageCircle } from 'lucide-react';
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

interface TopUpCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymName?: string;
  channel: 'sms' | 'whatsapp';
  credits: number;
  isPending: boolean;
  onChangeChannel: (channel: 'sms' | 'whatsapp') => void;
  onChangeCredits: (credits: number) => void;
  onSubmit: () => void;
}

export const TopUpCreditsDialog: React.FC<TopUpCreditsDialogProps> = ({
  open,
  onOpenChange,
  gymName,
  channel,
  credits,
  isPending,
  onChangeChannel,
  onChangeCredits,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Recharge Message Credits
          </DialogTitle>
          <DialogDescription className="text-xs">
            Add SMS or WhatsApp message credits to <strong className="text-foreground">{gymName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Delivery Channel</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeChannel('sms')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                  channel === 'sms'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smartphone className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs">SMS Credits</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Standard Carrier</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeChannel('whatsapp')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                  channel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs">WhatsApp Credits</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Interactive Nudges</p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Credits to Add</Label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[100, 250, 500, 1000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={credits === preset ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs font-mono h-8"
                  onClick={() => onChangeCredits(preset)}
                >
                  +{preset}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => onChangeCredits(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="text-xs font-mono"
              placeholder="Or enter custom amount"
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
            onClick={onSubmit}
            disabled={isPending}
          >
            <Coins className="h-4 w-4" />
            {isPending ? 'Adding...' : `Recharge ${credits} Credits`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
