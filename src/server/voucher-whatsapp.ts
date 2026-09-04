import "server-only";

import twilio from "twilio";

import { env } from "@/env";
import { formatToBRL } from "@/lib/utils";

/**
 * The voucher fields the payment-confirmation WhatsApp message needs, as
 * returned by the Convex `vouchers.confirmPayment` mutation. Deliberately
 * narrower than a full voucher: this message never needs a buyer's internal
 * identifiers, only what the customer should see.
 */
export interface VoucherWhatsAppSummary {
  code: string;
  phone: string;
  visitDate: string;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  priceCents: number;
}

// Brazilian numbers stored with a redundant leading 9 on some area codes
// (mirrors the same normalization the tRPC notification router used to do).
function removeExtra9(phoneNumber: string): string {
  if (phoneNumber.startsWith("62") && phoneNumber.length >= 5) {
    return phoneNumber.slice(0, 2) + phoneNumber.slice(3);
  }
  return phoneNumber;
}

function getTwilioClient() {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;

  if (!accountSid?.startsWith("AC") || !authToken) {
    console.warn("Twilio is not configured. Skipping WhatsApp notification.");
    return null;
  }

  return twilio(accountSid, authToken);
}

function formatVisitDate(visitDate: string): string {
  // visitDate is already a Sao Paulo "YYYY-MM-DD" calendar key; reformat it
  // directly rather than round-tripping through `Date`, which would need a
  // timezone-aware parse to avoid shifting the day.
  const [year, month, day] = visitDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatEntriesSummary(voucher: VoucherWhatsAppSummary): string {
  const parts: string[] = [];
  if (voucher.adults > 0 || voucher.elderly > 0) {
    parts.push(
      [
        voucher.adults > 0 ? `${voucher.adults} inteira(s)` : null,
        voucher.elderly > 0 ? `${voucher.elderly} meia(s)` : null,
      ]
        .filter(Boolean)
        .join(" e "),
    );
  }
  if (voucher.adultsPool > 0 || voucher.elderlyPool > 0) {
    parts.push(
      [
        voucher.adultsPool > 0
          ? `${voucher.adultsPool} acesso(s) à piscina (inteira)`
          : null,
        voucher.elderlyPool > 0
          ? `${voucher.elderlyPool} acesso(s) à piscina (meia)`
          : null,
      ]
        .filter(Boolean)
        .join(" e "),
    );
  }
  return parts.join(", ");
}

/**
 * Sends the one WhatsApp message a confirmed payment produces: the voucher
 * code, visit date, entry counts, and amount. Called once, right after a
 * voucher transitions to `valid` (see `becameValid` on the Convex mutation's
 * result) — never on a repeated webhook delivery for an already-confirmed
 * voucher. Sent for a Test Voucher too; only ad conversion events are
 * suppressed for those.
 *
 * Errors are logged, not thrown: a WhatsApp delivery failure must not fail
 * the webhook response Mercado Pago is waiting on.
 */
export async function sendVoucherConfirmationWhatsApp(
  voucher: VoucherWhatsAppSummary,
): Promise<void> {
  const client = getTwilioClient();
  if (!client) return;

  const body = `Olá 👋, obrigado por comprar seu voucher 🎫 na Cachoeira das Araras!

Código: *${voucher.code}*
Data da visita: ${formatVisitDate(voucher.visitDate)}
Entradas: ${formatEntriesSummary(voucher)}
Valor: ${formatToBRL(voucher.priceCents / 100)}

Entrada permitida entre 07h e 17h.

Aproveite esse paraíso natural!`;

  try {
    await client.messages.create({
      body,
      from: "whatsapp:+14155238886",
      to: `whatsapp:+55${removeExtra9(voucher.phone)}`,
    });
  } catch (error) {
    console.error(
      `Erro ao enviar mensagem WhatsApp para o voucher ${voucher.code}:`,
      error,
    );
  }
}
