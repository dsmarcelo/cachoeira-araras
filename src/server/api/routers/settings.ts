import { getSetting, type SettingKey } from "@/lib/settings";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const settingsRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    const keys: SettingKey[] = [
      "voucher.price",
      "voucher.pool.price",
      "voucher.max.quantity.adults",
      "voucher.max.quantity.elderly",
      "voucher.max.quantity.adults.pool",
      "voucher.max.quantity.elderly.pool",
      "top.message",
      "form.message",
      "max.intended.days",
      "disabled.days",
      "enable.voucher.buy",
      "enable.voucher.pool.buy",
    ];

    const entries = await Promise.all(
      keys.map(async (key) => [key, await getSetting(key)] as const),
    );

    return Object.fromEntries(entries) as Record<SettingKey, unknown>;
  }),

  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return getSetting(input.key as SettingKey);
    }),
});
