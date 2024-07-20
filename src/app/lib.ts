"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function isLoggedIn(): Promise<boolean> {
  const session = cookies().get("session")?.value;
  if (session === "admin") {
    return true;
  }
  return false;
}

export async function logout() {
  cookies().set("session", "", { expires: new Date(0) });
  redirect("/admin");
}

export async function login(password: string) {
  if (password === "Cachoeira.24") {
    cookies().set("session", "admin");
    redirect("/admin");
  }
  return false;
}

export async function addCookieVoucher(code: string) {
  cookies().set("voucher", code, {
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });
}

export async function getCookieVoucher(): Promise<string | null> {
  const code = cookies().get("voucher")?.value;
  if (code) {
    return code;
  }
  return null;
}
