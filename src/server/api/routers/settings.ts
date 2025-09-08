import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getSetting } from "@/lib/settings";

export const settingsRouter = createTRPCRouter({
  getDisabledDays: publicProcedure.query(async () => {
    const disabledDays = await getSetting("disabled.days");
    return disabledDays || [];
  }),

  getMaxIntendedDays: publicProcedure.query(async () => {
    const maxDays = await getSetting("max.intended.days");
    return maxDays || 60;
  }),

  getTopMessage: publicProcedure.query(async () => {
    const topMessage = await getSetting("top.message");
    return topMessage || "";
  }),
});
