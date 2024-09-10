import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

//TODO: notify when voucher is bought?
//TODO: notify when voucher is used?

function removeExtra9(phoneNumber: string): string {
  if (phoneNumber.startsWith("62") && phoneNumber.length >= 5) {
    return phoneNumber.slice(0, 2) + phoneNumber.slice(3);
  } else {
    return phoneNumber;
  }
}

export const notificationRouter = createTRPCRouter({
  sendWhatsAppMessage: publicProcedure
    .input(
      z.object({
        body: z.string(),
        phone: z.string().min(11),
      }),
    )
    .mutation(async ({ input }) => {
      const from = "whatsapp:+14155238886";

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
        throw { succsess: false, error: error };
      }
    }),
});
