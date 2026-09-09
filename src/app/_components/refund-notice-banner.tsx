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

  const voucherCodes = vouchers.map((v) => v.code);

  const notices = useQuery(
    convexApi.refunds.getRefundNoticesForVouchers,
    ready && voucherCodes.length > 0 ? { voucherCodes } : "skip",
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
        localStorage.setItem(
          DISMISSED_REFUNDS_KEY,
          JSON.stringify([...next]),
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="w-full max-w-5xl px-4 pt-4 space-y-3">
      {visibleNotices.map((notice) => {
        const isCompleted = notice.status === "completed";
        const isNeedsRetry = notice.status === "needs_retry";

        return (
          <div
            key={notice.refundId}
            role="alert"
            className={`flex items-start justify-between gap-3 p-4 rounded-xl border ${
              isCompleted
                ? "bg-green-950/40 border-green-500/40 text-green-200"
                : isNeedsRetry
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                  : "bg-blue-950/40 border-blue-500/40 text-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
              ) : isNeedsRetry ? (
                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-semibold text-white mr-1.5">
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
                className="h-7 px-2 text-xs text-green-300 hover:text-white hover:bg-green-900/40 shrink-0"
                aria-label="Dispensar aviso"
              >
                <X className="h-4 w-4 mr-1" />
                Dispensar
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
