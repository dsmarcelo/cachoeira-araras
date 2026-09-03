# 16: Contract — delete tRPC, the Prisma runtime, and superseded code

**What to build:** The app runs entirely on Convex, with the RPC layer and the ORM removed
rather than left dormant. A future reader finds a T3 app with no tRPC in it and, thanks to
ADR-0001, knows that was deliberate.

Removed: the tRPC routers, client and route handler; the Prisma client wiring used at runtime;
the `@auth/prisma-adapter` dependency, which was installed but never imported; and the intake
test suite superseded by function-boundary tests once its injection seam collapsed.
`docs/04-data-model-and-settings.md` is deleted rather than rewritten — the schema and its
validators are the source of truth, per the repository's rule against documenting what code
already states.

`schema.prisma` itself is untouched, and the import script (ticket 15) keeps whatever Prisma
access it needs to read the old database at cutover.

**Blocked by:** 09, 10, 11, 12, 13, 14

**Status:** ready-for-agent

- [ ] No tRPC router, client, provider or route handler remains; nothing imports one.
- [ ] The app builds, typechecks, and every screen works with the tRPC route deleted.
- [ ] `@auth/prisma-adapter` is gone from dependencies.
- [ ] The superseded intake test suite is deleted; the webhook suite is retained.
- [ ] `docs/04-data-model-and-settings.md` is deleted.
- [ ] The Voucher Purchase Intake entry in `CONTEXT.md` no longer refers to server-owned
      `valid`.
- [ ] `schema.prisma` and the production Postgres database are unchanged.
