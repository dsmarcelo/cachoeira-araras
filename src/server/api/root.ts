import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { voucherRouter } from "./routers/voucher";
import { mercadopagoRouter } from "./routers/mercadopago";
import { referrerRouter } from "./routers/referrer";
import { notificationRouter } from "./routers/notification";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  voucher: voucherRouter,
  mercadopago: mercadopagoRouter,
  notification: notificationRouter,
  referrer: referrerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
