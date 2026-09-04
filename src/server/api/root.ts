import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { mercadopagoRouter } from "./routers/mercadopago";

/**
 * This is the primary router for your server.
 *
 * The rest of the app runs on Convex directly. This router is what remains
 * of tRPC: the Mercado Pago admin payments screen (`/admin/dashboard/pagamentos`)
 * enriches Mercado Pago API results with a Prisma voucher lookup, which has
 * no Convex equivalent yet — see docs/adr/0001-replace-trpc-with-direct-convex-access.md
 * and ticket 15 for why this one router (and the Prisma client it uses) is
 * deliberately still here.
 */
export const appRouter = createTRPCRouter({
  mercadopago: mercadopagoRouter,
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
