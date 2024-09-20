import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import axios from "axios";

//TODO: notify when voucher is used?

function removeExtra9(phoneNumber: string): string {
  return "55" + phoneNumber;
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
      if (!process.env.ZAPI_INSTANCE_ID || !process.env.ZAPI_TOKEN) {
        return { success: false, error: "Z-API not configured" };
      }
      try {
        const ZAPI_BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}`;
        await axios.post(
          `${ZAPI_BASE_URL}/token/${process.env.ZAPI_TOKEN}/send-text`,
          {
            phone: removeExtra9(input.phone),
            message: input.body,
          },
        );

        return { success: true };
      } catch (error) {
        console.error("Error sending message:", error);
        throw { succsess: false, error: error };
      }
    }),
});
