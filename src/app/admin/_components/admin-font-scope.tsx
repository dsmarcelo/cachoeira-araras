"use client";

import { useEffect } from "react";

/**
 * Mirrors the admin font classes onto <body> while an /admin page is mounted,
 * so content portaled outside the layout (drawers, dialogs, toasts) matches.
 */
export default function AdminFontScope({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(" ").filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [className]);

  return null;
}
