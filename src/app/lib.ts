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

/** Reads the fallback cookie left by Checkout Pro purchases; new purchases no longer set it. */
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
