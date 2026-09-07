import "server-only";

import { callConvexService } from "./convex-service";

export type VoucherImageData = {
  code: string;
  name: string;
  phone: string;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  priceCents: number;
  status: "pending" | "valid" | "redeemed" | "expired" | "refunded";
  visitDate: string;
  expiresAt: number;
} | null;

/**
 * Looks up the real voucher data (name, phone, price, status...) by code for
 * the OG image route — never from client-supplied query params, which is
 * what let anyone forge a voucher-shaped image before this existed.
 */
export async function getVoucherImageData(
  code: string,
): Promise<VoucherImageData> {
  return callConvexService<VoucherImageData>("/services/voucher-image-data", {
    code,
  });
}
