import { v } from "convex/values";

import { endOfSaoPauloDayMs } from "../../src/lib/utils/date";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Who made a voucher's most recent reschedule: the customer or a named admin. */
export const rescheduledByValidator = v.union(
  v.object({ kind: v.literal("customer") }),
  v.object({ kind: v.literal("admin"), username: v.string() }),
);

/**
 * Whether an admin may reschedule a voucher in `status` (Expired returns to
 * Valid). Shared by `rescheduleByAdmin` and the admin drawer.
 */
export function isAdminReschedulable(status: Doc<"vouchers">["status"]) {
  return status === "pending" || status === "valid" || status === "expired";
}

/**
 * Applies a Reschedule: moves `visitDate` and recomputes `expiresAt` as the end
 * of the new Sao Paulo day, always together, and records the last change.
 * `revive` also turns an Expired voucher back into Valid (admin only).
 * Callers own authorization and eligibility checks.
 */
export async function applyReschedule(
  ctx: MutationCtx,
  voucher: Doc<"vouchers">,
  options: {
    visitDate: string;
    by: Doc<"vouchers">["rescheduledBy"];
    revive?: boolean;
  },
) {
  await ctx.db.patch("vouchers", voucher._id, {
    visitDate: options.visitDate,
    expiresAt: endOfSaoPauloDayMs(options.visitDate),
    status:
      options.revive === true && voucher.status === "expired"
        ? "valid"
        : voucher.status,
    rescheduledAt: Date.now(),
    rescheduledBy: options.by,
  });
}
