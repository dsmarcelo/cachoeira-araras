"use client";

import type { VoucherSchema, InitialVoucher } from "../voucher/types";

export interface VoucherPricing {
  voucherPrice: number;
  poolVoucherPrice: number;
}

export function randomCode(): string {
  let result = "";
  const randomString = Math.random().toString(36).slice(2, 15);
  result += randomString.replace(/[^a-z0-9]/gi, "").substring(0, 4);

  return result;
}

export function getVoucherPrice(pricing: VoucherPricing): number {
  return pricing.voucherPrice;
}

export function getPoolVoucherPrice(pricing: VoucherPricing): number {
  return pricing.poolVoucherPrice;
}

export function getElderlyVoucherPrice(pricing: VoucherPricing): number {
  return pricing.voucherPrice / 2;
}

export function getPoolElderlyVoucherPrice(pricing: VoucherPricing): number {
  return pricing.poolVoucherPrice / 2;
}

/**
 * Calculate the total price for a voucher based on number of adults and elderly.
 * Now supports separate pool access counts.
 */
export function calculatePrice(
  adults: number,
  elderly: number,
  adults_pool = 0,
  elderly_pool = 0,
  pricing: VoucherPricing,
): number {
  const elderlyPrice = pricing.voucherPrice / 2;
  const poolElderlyPrice = pricing.poolVoucherPrice / 2;
  const defaultTotal = adults * pricing.voucherPrice + elderly * elderlyPrice;
  const poolTotal =
    adults_pool * pricing.poolVoucherPrice + elderly_pool * poolElderlyPrice;

  return defaultTotal + poolTotal;
}

export function formatVoucher(
  data: InitialVoucher,
  pricing: VoucherPricing,
): VoucherSchema {
  const completeData = {
    name: data.name,
    phone: data.phone,
    adults: data.adults,
    elderly: data.elderly,
    adults_pool: data.adults_pool,
    elderly_pool: data.elderly_pool,
    status: "pending" as const,
    valid: false,
    code: data.code,
    preference_id: data.preference_id,
    price: calculatePrice(
      data.adults,
      data.elderly,
      data.adults_pool,
      data.elderly_pool,
      pricing,
    ),
    expires_at: data.intendedDate,
  } as const;
  return completeData;
}

export function formatVoucherUrl(code: string, payment_id: string) {
  return `${process.env.NEXT_PUBLIC_VERCEL_URL}/voucher?code=${code}&pid=${payment_id}`;
}

export function formatPhone(phone: string) {
  return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}
