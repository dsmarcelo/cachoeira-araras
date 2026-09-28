import * as React from "react"

import { cn } from "@/lib/utils"

/** Validation message shown under a form field on the dark public site. Renders nothing without a message. */
function FieldError({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null
  return (
    <p
      role="alert"
      className={cn("text-base font-medium text-danger-text", className)}
      {...props}
    >
      {children}
    </p>
  )
}

export { FieldError }
