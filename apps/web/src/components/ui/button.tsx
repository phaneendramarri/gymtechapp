import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-10 rounded-md px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** When true, swaps leading children for a spinner and disables the button. */
  loading?: boolean
  /** Optional left-side icon (rendered before children unless loading). */
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, icon, children, disabled, ...props }, ref) => {
    // Radix's `Slot` only accepts a SINGLE React element child and merges
    // its own props onto it. Two failure modes to avoid:
    //   1. Rendering our own leading element (icon/spinner) AND the
    //      caller's children — that's two siblings inside the Slot.
    //   2. Even rendering `null` (no leading element) PLUS the caller's
    //      children — React still passes both as the children prop and
    //      Slot sees 2 children and throws.
    //
    // Rule: when asChild is on, render ONLY the caller's children and
    // nothing else. To enforce that, we fall back to a plain `<button>`
    // whenever we need a leading element.
    const needsLeadingElement = loading || !!icon
    const useAsChild = asChild && !needsLeadingElement
    const Comp = useAsChild ? Slot : "button"

    const leading = loading ? (
      <Loader2 className="size-4 animate-spin" aria-hidden />
    ) : icon ? (
      <span aria-hidden className="inline-flex shrink-0">
        {icon}
      </span>
    ) : null

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {useAsChild
          ? children
          : (
            <>
              {leading}
              {children}
            </>
          )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
