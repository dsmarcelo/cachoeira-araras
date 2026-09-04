"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api as convexApi } from "../../convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export async function isLoggedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

export async function getCurrentUserRole() {
  return (await getCurrentUser())?.role ?? null;
}

async function getCurrentUser() {
  return await fetchAuthQuery(convexApi.auth.currentUser);
}

export async function requireStaff() {
  return await getCurrentUser();
}

export async function requireAdmin() {
  const user = await requireStaff();

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    redirect("/admin");
  }

  return user;
}

const VOUCHER_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 40;

/**
 * Persists the voucher a visitor just started paying for, plus the Mercado
 * Pago checkout link for it, so a page reload (or returning the next day)
 * can resume the same in-progress checkout without a server round trip.
 * Payment status itself is never cached here — the voucher form reads that
 * live from Convex (`vouchers.getByCode`) instead.
 */
export async function addCookieVoucher(code: string, initPoint: string) {
  // Next.js 16 exposes request cookies asynchronously. Resolve the store once
  // per server action so future cookie option changes stay centralized here.
  const cookieStore = await cookies();

  const expires = new Date(Date.now() + VOUCHER_COOKIE_MAX_AGE_MS);
  cookieStore.set("voucher", code, { expires });
  cookieStore.set("voucher_init_point", initPoint, { expires });
}

export async function getCookieVoucher(): Promise<{
  code: string;
  initPoint: string;
} | null> {
  // Awaiting `cookies()` is required in Next.js 16 and keeps this helper safe
  // to call from Server Components, Server Actions, and Route Handlers.
  const cookieStore = await cookies();
  const code = cookieStore.get("voucher")?.value;
  if (!code) {
    return null;
  }
  const initPoint = cookieStore.get("voucher_init_point")?.value ?? "";
  return { code, initPoint };
}

export async function deleteCookieVoucher() {
  const cookieStore = await cookies();
  cookieStore.delete("voucher");
  cookieStore.delete("voucher_init_point");
}

export async function getReferrer() {
  // Resolve the async cookie store before reading the marketing attribution
  // cookie; synchronous access was removed in Next.js 16.
  const cookieStore = await cookies();
  const referrer = cookieStore.get("referrer")?.value;
  if (referrer) {
    return referrer;
  }
  return null;
}
