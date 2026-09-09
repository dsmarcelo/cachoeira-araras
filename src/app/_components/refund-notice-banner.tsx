"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api as convexApi } from "../../../convex/_generated/api";
import { useSavedVouchers } from "./saved-vouchers-provider";
import { CheckCircle2, Clock, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_REFUNDS_KEY = "dismissed_refund_notices";

export default function RefundNoticeBanner() {
  const { vouchers, ready } = useSavedVouchers();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(DISMISSED_REFUNDS_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(parsed) ? (parsed as string[]) : [];
      return new Set(ids);
    } catch {
      return new Set();
    }
  });

  const voucherAccess = vouchers.flatMap((voucher) =>
    voucher.managementToken
      ? [{ code: voucher.code, managementToken: voucher.managementToken }]
      : [],
  );

  const notices = useQuery(
    convexApi.refunds.getRefundNoticesForVouchers,
    ready && voucherAccess.length > 0
      ? { vouchers: voucherAccess.slice(0, 50) }
      : "skip",
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_REFUNDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setDismissedIds(new Set(parsed as string[]));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (!ready || !notices || notices.length === 0) {
    return null;
  }

  // Filter out dismissed completed refunds
  const visibleNotices = notices.filter(
    (n) => !(n.isDismissible && dismissedIds.has(n.refundId)),
  );

  if (visibleNotices.length === 0) {
    return null;
  }

  function handleDismiss(refundId: string) {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(refundId);
      try {
        localStorage.setItem(DISMISSED_REFUNDS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="w-full max-w-5xl space-y-3 px-4 pt-4">
      {visibleNotices.map((notice) => {
        const isCompleted = notice.status === "completed";
        const isNeedsRetry = notice.status === "needs_retry";

        return (
          <div
            key={notice.refundId}
            role="alert"
            className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${
              isCompleted
                ? "border-green-500/40 bg-green-950/40 text-green-200"
                : isNeedsRetry
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                  : "border-blue-500/40 bg-blue-950/40 text-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {isCompleted ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              ) : isNeedsRetry ? (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              ) : (
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              )}
              <div className="text-sm">
                <span className="mr-1.5 font-semibold text-white">
                  Voucher {notice.voucherCode}:
                </span>
                <span>{notice.message}</span>
              </div>
            </div>

            {notice.isDismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(notice.refundId)}
                className="h-7 shrink-0 px-2 text-xs text-green-300 hover:bg-green-900/40 hover:text-white"
                aria-label="Dispensar aviso"
              >
                <X className="mr-1 h-4 w-4" />
                Dispensar
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
