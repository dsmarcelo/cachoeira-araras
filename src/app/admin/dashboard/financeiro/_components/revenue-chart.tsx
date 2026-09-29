"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  bucketLabel,
  bucketTitle,
  formatCents,
  type FinancialReport,
} from "../format";

// At most this many axis labels; the rest are skipped so they don't collide on a phone.
const MAX_LABELS = 8;

/**
 * Net revenue per bucket as tappable bars. The busiest bucket is selected
 * until the viewer picks another; the readout above shows the selected one.
 * Remount (via `key`) when the period changes to reset the selection.
 */
export function RevenueChart({
  buckets,
  granularity,
}: Pick<FinancialReport, "buckets" | "granularity">) {
  const max = Math.max(0, ...buckets.map((b) => b.netCents));
  const busiest = buckets.findIndex((b) => b.netCents === max);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = buckets[picked ?? busiest];
  const labelStep = Math.ceil(buckets.length / MAX_LABELS);

  if (max === 0 || !selected) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhuma venda no período
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-10 items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[13px] text-muted-foreground first-letter:uppercase">
            {bucketTitle(selected, granularity)}
          </span>
          <span className="text-base font-semibold">{formatCents(selected.netCents)}</span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {selected.voucherCount} {selected.voucherCount === 1 ? "voucher" : "vouchers"}
        </span>
      </div>

      <div className="flex h-40 items-end gap-[3px] border-b sm:gap-1.5">
        {buckets.map((bucket, index) => {
          const isSelected = bucket === selected;
          return (
            <button
              key={`${bucket.from}-${bucket.hour}`}
              type="button"
              onClick={() => setPicked(index)}
              aria-pressed={isSelected}
              aria-label={`${bucketTitle(bucket, granularity)}: ${formatCents(bucket.netCents)}, ${bucket.voucherCount} vouchers`}
              className="flex h-full min-w-0 flex-1 items-end rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "block w-full rounded-t bg-teal-700 transition-opacity",
                  isSelected ? "opacity-100" : "opacity-40 hover:opacity-70",
                )}
                style={{ height: `${Math.max(2, (bucket.netCents / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex gap-[3px] sm:gap-1.5" aria-hidden="true">
        {buckets.map((bucket, index) => (
          <span
            key={`${bucket.from}-${bucket.hour}`}
            className={cn(
              "min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs",
              bucket === selected ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {index % labelStep === 0 ? bucketLabel(bucket, granularity, buckets.length) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
