import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        gold: "border-gold-400/25 bg-gold-400/10 text-gold-300",
        outline: "border-border-strong text-muted-foreground",
        open: "border-transparent bg-state-open/15 text-state-open",
        full: "border-transparent bg-state-full/15 text-state-full",
        playing: "border-transparent bg-state-playing/15 text-state-playing",
        revealing: "border-transparent bg-state-revealing/15 text-state-revealing",
        settled: "border-transparent bg-state-settled/15 text-state-settled",
        cancelled: "border-transparent bg-state-cancelled/15 text-state-cancelled",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a small status dot in the current text color. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
