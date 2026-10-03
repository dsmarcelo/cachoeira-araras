import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const noticeVariants = cva("rounded-lg p-3 text-sm", {
  variants: {
    tone: {
      success: "border border-success/40 bg-success-soft/40 text-success-text",
      danger: "border border-danger/40 bg-danger-soft/40 text-danger-text",
      neutral: "bg-fg/5 text-fg-muted",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
})

/**
 * Boxed message for the dark public site (refund confirmed, payment error,
 * voucher state). Pass `role="alert"` or `role="status"` where it announces a
 * change to the user.
 */
function Notice({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof noticeVariants>) {
  return <div className={cn(noticeVariants({ tone }), className)} {...props} />
}

export { Notice }
