import type { Doc } from "../_generated/dataModel";

/**
 * Vouchers bought through the embedded (Bricks) checkout carry no Checkout Pro
 * data. Everything specific to embedded purchases is gated on this predicate so
 * Pro Vouchers keep their original behavior.
 */
export function isEmbeddedVoucher(
  voucher: Pick<Doc<"vouchers">, "preferenceId" | "initPoint">,
) {
  return voucher.preferenceId === undefined && voucher.initPoint === undefined;
}
