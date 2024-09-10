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

export function calculatePrice(adults: number, elderly: number) {
  const total = adults * 40 + elderly * 20;
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
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  };
  return completeData;
}

export function formatVoucherUrl(code: string, payment_id: string) {
  return `${process.env.NEXT_PUBLIC_VERCEL_URL}/voucher?code=${code}&pid=${payment_id}`;
}
