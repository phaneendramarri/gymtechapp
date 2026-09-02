import * as React from "react"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** When true, the confirm button is rendered with the destructive variant. */
  destructive?: boolean
  /** Optional async handler — shows a loading spinner on the confirm button while it runs. */
  onConfirm: () => void | Promise<void>
  /** Optional icon override; defaults to AlertTriangle for destructive, none otherwise. */
  icon?: React.ReactNode
}

/**
 * A minimal, shadcn-style confirmation dialog.
 *
 * Replaces `window.confirm()` / `window.alert()` with a proper, accessible,
 * theme-aware dialog. Use `destructive` for any action that removes data,
 * revokes access, or is otherwise hard to reverse.
 *
 * @example
 *   <ConfirmDialog
 *     open={!!pendingGymId}
 *     onOpenChange={(o) => !o && setPendingGymId(null)}
 *     title="Suspend gym?"
 *     description="Members will lose access immediately. You can re-activate later."
 *     destructive
 *     confirmLabel="Suspend"
 *     onConfirm={async () => {
 *       await api.toggleGymStatus(pendingGymId!, 'SUSPENDED');
 *       setPendingGymId(null);
 *     }}
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = React.useState(false)

  const handleConfirm = async () => {
    if (isPending) return
    try {
      setIsPending(true)
      await onConfirm()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {(icon || destructive) && (
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  destructive
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-foreground"
                )}
                aria-hidden
              >
                {icon ?? <AlertTriangle className="size-4" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-h3">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5 text-sm-app text-muted-foreground">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            loading={isPending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
