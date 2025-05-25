"use client";

import { type z } from "zod";
import {
  type VoucherSchema,
  type initialVoucherSchema,
} from "../voucher/types";

type initialVoucherSchema = z.infer<typeof initialVoucherSchema>;

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
  return Number(process.env.NEXT_PUBLIC_VOUCHER_PRICE ?? 50);
}

/**
 * Get the current voucher price for elderly people.
 * @returns The current voucher price for elderly (half of adult price)
 */
export function getElderlyVoucherPrice(): number {
  return getVoucherPrice() / 2;
}

/**
 * Calculate the total price for a voucher based on number of adults and elderly.
 */
export function calculatePrice(adults: number, elderly: number) {
  const total = adults * getVoucherPrice() + elderly * getElderlyVoucherPrice();
  return total;
}

export function formatVoucher(data: initialVoucherSchema): VoucherSchema {
  const completeData = {
    name: data.name,
    phone: data.phone,
    adults: data.adults,
    elderly: data.elderly,
    status: "pending" as const,
    valid: false,
    code: data.code,
    preference_id: data.preference_id,
    price: calculatePrice(data.adults, data.elderly),
    expires_at: data.intendedDate,
  };
  return completeData;
}

export function formatVoucherUrl(code: string, payment_id: string) {
  return `${process.env.NEXT_PUBLIC_VERCEL_URL}/voucher?code=${code}&pid=${payment_id}`;
}

export function formatPhone(phone: string) {
  return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}
