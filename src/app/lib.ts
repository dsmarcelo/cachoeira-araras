"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/trpc/server";

export async function isLoggedIn(): Promise<boolean> {
  const session = cookies().get("session")?.value;
  if (session === "admin") {
    return true;
  }
  return false;
}

export async function logout() {
  cookies().set("session", "", { expires: new Date(0) });
  redirect("/");
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
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
  });
}

export async function getCookieVoucher(): Promise<string | null> {
  const code = cookies().get("voucher")?.value;
  if (code) {
    return code;
  }
  return null;
}

export async function deleteCookieVoucher() {
  cookies().delete("voucher");
}

export async function deleteVoucher(code: string) {
  const res = api.voucher.delete({ code });
  // if (!res) return console.error("Voucher não encontrado");
  return res;
}

export async function redeemVoucher(voucherCode: string) {
  if (!voucherCode) return console.error("Erro ao usar voucher");
  const res = await api.voucher.updateVoucherStatus({
    code: voucherCode,
    data: {
      status: "redeemed",
      valid: false,
    },
  });
  return res;
}

export async function activateVoucher(code: string) {
  const oldVoucher = await api.voucher.findByCode({ code });
  if (!oldVoucher) return console.error("Voucher não encontrado");

  try {
    const voucher = await api.voucher.update({
      where: { code },
      data: {
        status: "valid",
        valid: true,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31),
      },
    });
    if (!voucher) console.error("Failed to update voucher");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw error;
  }
}

export async function getReferrer() {
  const referrer = cookies().get("referrer")?.value;
  if (referrer) {
    return referrer;
  }
  return null;
}

export async function createReferrer(voucherCode: string, referrerURL: string) {
  let referrer: string;

  switch (true) {
    case referrerURL.includes("fbclid"):
      referrer = "Facebook";
      break;
    case referrerURL.includes("gclid"):
      referrer = "Google";
      break;
    case referrerURL.includes("igshid"):
      referrer = "Instagram";
      break;
    case referrerURL.includes("mail.google"):
      referrer = "Gmail";
      break;
    default:
      referrer = "";
      break;
  }

  const referrerResponse = api.referrer.create({
    referrer,
    voucherCode,
    url: referrerURL,
  });

  return referrerResponse;
}

export async function createVoucherUrl(code: string, payment_id: string) {
  const url = `/api/voucher?code=${code}&pid=${payment_id}`;
  return url;
}
