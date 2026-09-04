# 15: Contract — delete tRPC, the Prisma runtime, and superseded code

**What to build:** The app runs entirely on Convex, with the RPC layer and the ORM removed
rather than left dormant. A future reader finds a T3 app with no tRPC in it and, thanks to
ADR-0001, knows that was deliberate.

Removed: the tRPC routers, client and route handler; the Prisma client wiring used at runtime;
the `@auth/prisma-adapter` dependency, which was installed but never imported; and the intake
test suite superseded by function-boundary tests once its injection seam collapsed.
`docs/04-data-model-and-settings.md` is deleted rather than rewritten — the schema and its
validators are the source of truth, per the repository's rule against documenting what code
already states.

`schema.prisma` itself is untouched, and the import script (ticket 14) keeps whatever Prisma
access it needs to read the old database at cutover.

**Blocked by:** 09, 10, 11, 12, 13, 14

**Status:** done

- [x] No tRPC router, client, provider or route handler remains; nothing imports one.
      The last remaining procedure (`/admin/dashboard/pagamentos` Mercado Pago payment listing
      and voucher enrichment) has been ported to Convex actions (`convex/mercadopago.ts`
      `listAdminPaymentsByMonth` and `getAdminPaymentsMonthSummary`) using `findForPaymentEnrichment`
      in `convex/vouchers.ts`. All tRPC code (`src/server/api/`, `src/trpc/`, `src/app/api/trpc/`),
      the `TRPCReactProvider` in `src/app/layout.tsx`, and the runtime Prisma client
      (`src/server/db.ts`) have been completely deleted. `@trpc/*`, `@tanstack/react-query`,
      and `superjson` dependencies are removed. `@prisma/client` is moved to `devDependencies`
      for the import script and Prisma CLI only.
- [x] The app builds, typechecks, and every screen works with the tRPC route deleted where a
      Convex equivalent exists. `pnpm test:convex`, `pnpm test:webhook`, `pnpm test:import`,
      `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass.
- [x] `@auth/prisma-adapter` is gone from dependencies (was already gone before this ticket,
      per the Better Auth merge — verified absent from `package.json` and `pnpm-lock.yaml`).
- [x] The superseded intake test suite is deleted; the webhook suite is retained.
      `voucher-purchase-intake.test.ts` no longer exists in the repo (removed in an earlier
      ticket, per `git log`). `src/server/mercadopago-webhook.test.ts` is untouched and its
      22 tests pass (`pnpm test:webhook`).
- [x] `docs/04-data-model-and-settings.md` is deleted.
- [x] The Voucher Purchase Intake entry in `CONTEXT.md` no longer refers to server-owned
      `valid`. It already didn't before this ticket — verified, no edit needed.
- [x] `schema.prisma` and the production Postgres database are unchanged. No diff on
      `prisma/schema.prisma`; no database commands were run.
- [x] The ticket 14 import script still runs with its tooling-only Prisma access after the
      application runtime wiring is removed. `pnpm test:import` passes (21 tests); the
      script has its own `PrismaClient` and never imported `src/server/db.ts`.
