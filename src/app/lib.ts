"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/trpc/server";
import { type VoucherSchema } from "@/lib/voucher/types";
import { formateDateDayMonthYear, formatPhone, formatToBRL } from "@/lib/utils";
import { formatVoucherUrl } from "@/lib/utils/utils";
import {
  getCurrentUserRole as getCurrentSessionRole,
  getServerAuthSession,
  type UserRole,
} from "@/server/auth";
import { findVoucherByCode } from "@/server/voucher";

export async function isLoggedIn(): Promise<boolean> {
  const role = await getCurrentSessionRole();
  return role !== null;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  return await getCurrentSessionRole();
}

export async function requireStaff() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireStaff();

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    redirect("/admin/hoje");
  }

  return user;
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
  const res = await api.voucher.redeemTodayVoucher({
    code: voucherCode,
  });
  return res;
}

export async function activateVoucher(code: string) {
  const oldVoucher = await findVoucherByCode(code);
  if (!oldVoucher) return console.error("Voucher não encontrado");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentExpiry = oldVoucher.expires_at;

    // Only update if expires_at is less than today or null
    const shouldUpdateExpiry = !currentExpiry || currentExpiry < today;

    const voucher = await api.voucher.activateTodayVoucher({
      code,
      refreshExpiry: shouldUpdateExpiry,
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

export async function sendWhatsappMessage(voucher: VoucherSchema) {
  console.log("🚀 ~ sendWhatsappMessage ~ sendWhatsappMessage:");
  const maxRetries = 3;
  const retryDelay = 10000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const body = `Olá 👋, obrigado por comprar seu voucher 🎫 na Cachoeira das Araras!

Aqui estão algumas informações sobre o seu voucher:

      Código: *${voucher.code}*
      Nome: ${voucher.name}
      Telefone: ${formatPhone(voucher.phone)}
      Validade: ${voucher.expires_at ? formateDateDayMonthYear(voucher.expires_at) : "-"}
      Entradas: ${voucher.adults} inteiras e ${voucher.elderly} meias
      Valor: ${formatToBRL(voucher.price)}

      ${voucher.payment_id ? `🌐 ${formatVoucherUrl(voucher.code, voucher.payment_id)}` : "-"}

Entrada permitida entre 07h e 17h.

Aproveite esse paraíso natural!`;

      const res = await api.notification.sendWhatsAppMessage({
        body,
        phone: voucher.phone,
      });

      if (!res) {
        throw new Error("Erro ao enviar mensagem WhatsApp");
      }

      return res;
    } catch (error) {
      console.error(
        `Erro ao enviar mensagem WhatsApp (tentativa ${attempt}):`,
        error,
      );

      if (attempt < maxRetries) {
        console.log(`Tentando novamente em ${retryDelay / 1000} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error("Falha ao enviar mensagem após várias tentativas.");
        throw error;
      }
    }
  }
}
