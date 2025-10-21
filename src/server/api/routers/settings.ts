import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getAllSettings } from "@/lib/settings";

export const settingsRouter = createTRPCRouter({
  // Single query to fetch all settings at once
  // Returns an object with all app settings using defaults for missing values
  getAll: publicProcedure.query(async () => {
    return await getAllSettings();
  }),
});
