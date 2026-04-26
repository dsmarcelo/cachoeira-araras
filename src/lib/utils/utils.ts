"use client";

import { env } from "@/env";
import { type z } from "zod";
import {
  type VoucherSchema,
  type initialVoucherSchema,
} from "../voucher/types";

type initialVoucherSchema = z.infer<typeof initialVoucherSchema>;

const voucherPrice = env.NEXT_PUBLIC_VOUCHER_PRICE;
const poolVoucherPrice = env.NEXT_PUBLIC_POOL_VOUCHER_PRICE;
const elderlyVoucherPrice = voucherPrice / 2;
const poolElderlyVoucherPrice = poolVoucherPrice / 2;

export function randomCode(): string {
  let result = "";
  const randomString = Math.random().toString(36).slice(2, 15);
  result += randomString.replace(/[^a-z0-9]/gi, "").substring(0, 4);

  return result;
}

/**
 * Get the current voucher price from environment variables.
 * This function will be updated later to fetch from database.
 * @returns The current voucher price for adults
 */
export function getVoucherPrice(): number {
  return env.NEXT_PUBLIC_VOUCHER_PRICE;
}

export function getPoolVoucherPrice(): number {
  return env.NEXT_PUBLIC_POOL_VOUCHER_PRICE;
}

/**
 * Get the current voucher price for elderly people.
 * @returns The current voucher price for elderly (half of adult price)
 */
export function getElderlyVoucherPrice(): number {
  return getVoucherPrice() / 2;
}

export function getPoolElderlyVoucherPrice(): number {
  return getPoolVoucherPrice() / 2;
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
) {
  const defaultTotal = adults * voucherPrice + elderly * elderlyVoucherPrice;
  const poolTotal =
    adults_pool * poolVoucherPrice + elderly_pool * poolElderlyVoucherPrice;

  return defaultTotal + poolTotal;
}

export function formatVoucher(data: initialVoucherSchema): VoucherSchema {
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
    ),
    expires_at: data.intendedDate,
  };
  return completeData;
}

export function formatVoucherUrl(code: string, payment_id: string) {
  return `${env.NEXT_PUBLIC_VERCEL_URL ?? env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3000"}/voucher?code=${code}&pid=${payment_id}`;
}

export function formatPhone(phone: string) {
  return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}
