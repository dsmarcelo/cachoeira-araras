import { env } from "@/env";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import twilio from "twilio";

//TODO: notify when voucher is bought?
//TODO: notify when voucher is used?

function removeExtra9(phoneNumber: string): string {
  if (phoneNumber.startsWith("62") && phoneNumber.length >= 5) {
    return phoneNumber.slice(0, 2) + phoneNumber.slice(3);
  } else {
    return phoneNumber;
  }
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

export const notificationRouter = createTRPCRouter({
  sendWhatsAppMessage: adminProcedure
    .input(
      z.object({
        body: z.string(),
        phone: z.string().min(11),
      }),
    )
    .mutation(async ({ input }) => {
      const from = "whatsapp:+14155238886";
      const client = getTwilioClient();

      if (!client) {
        return {
          success: false,
          skipped: true,
          reason: "TWILIO_NOT_CONFIGURED",
        };
      }

      try {
        await client.messages.create({
          body: input.body,
          from,
          to: `whatsapp:+55${removeExtra9(input.phone)}`,
        });
        console.log(
          "🚀 ~ .mutation ~ `whatsapp:+55${removeExtra9(input.phone)}`:",
          `whatsapp:+55${removeExtra9(input.phone)}`,
        );
        return { success: true };
      } catch (error) {
        console.error("Error sending message:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao enviar mensagem WhatsApp.",
          cause: error,
        });
      }
    }),
});
