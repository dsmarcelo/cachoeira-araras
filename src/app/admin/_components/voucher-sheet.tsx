"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatDateWeekDay, formatPhone } from "@/lib/utils";
import { VoucherStatusBadge, type VoucherStatus } from "./admin-ui";

/**
 * Bottom-sheet frame shared by the voucher detail drawers: code + status
 * header, a scrollable body and a pinned actions area.
 */
export function VoucherSheet({
  code,
  status,
  open,
  onClose,
  children,
  actions,
}: {
  code: string;
  status: VoucherStatus;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Drawer open={open} onClose={onClose} preventScrollRestoration shouldScaleBackground>
      <DrawerContent className="max-h-[92dvh] border-border">
        <div className="flex items-start justify-between gap-2 px-4 pt-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted-foreground">Voucher</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <DrawerTitle className="font-mono text-[26px] font-semibold uppercase tracking-[0.08em]">
                {code}
              </DrawerTitle>
              <VoucherStatusBadge status={status} className="px-2.5 py-1 text-xs font-semibold" />
            </div>
            <DrawerDescription className="sr-only">Detalhes do voucher {code}</DrawerDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="-mr-2 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">{children}</div>
        {actions ? (
          <div className="flex flex-col gap-2.5 border-t border-border px-4 pb-5 pt-3">{actions}</div>
        ) : null}
      </DrawerContent>
      <DrawerOverlay onClick={onClose} />
    </Drawer>
  );
}

/** "Expira hoje · ter, 29 set"-style validity line. */
export function describeValidity(expiresAtMs: number) {
  const expiresAt = new Date(expiresAtMs);
  const now = new Date();
  const prefix =
    expiresAt.toDateString() === now.toDateString()
      ? "Expira hoje"
      : expiresAt > now
        ? "Expira em"
        : "Expirou em";
  return `${prefix} · ${formatDateWeekDay(expiresAt)}`;
}

/** Customer phone as a WhatsApp link (opens their chat; the app sends nothing). */
export function WhatsAppLink({ phone }: { phone: string }) {
  return (
    <Link href={`https://wa.me/${phone}`} target="_blank" className="underline-offset-4 hover:underline">
      {formatPhone(phone)}
    </Link>
  );
}

export const primaryActionClass =
  "flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-teal-700 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50";
export const secondaryActionClass =
  "h-11 rounded-lg border border-border bg-white text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50";
