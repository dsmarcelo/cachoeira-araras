# Replace tRPC with direct Convex access

Status: superseded by ADR 0002

This app was scaffolded from the T3 stack, so tRPC sits between the browser and the
server for every read and write. Moving the backend to Convex, we removed tRPC
entirely and let clients call Convex queries, mutations, and actions directly,
because the screens that matter most — the gate list and the admin voucher table —
are stale views of rows a Mercado Pago webhook mutates out of band, and Convex's
reactivity fixes that only if the browser subscribes to it.

## Considered options

**Keep tRPC and swap Prisma for Convex inside the procedures.** No client code
changes. Rejected: it keeps two network hops and delivers none of the reactivity
that motivated the move, which is the worst of both platforms.

**Split — Convex for data, tRPC retained for procedures wrapping external APIs**
(Twilio, Mercado Pago search). Rejected: Convex actions already call external APIs,
so the split preserves an entire RPC layer to host a handful of procedures.

## Consequences

Authorisation moves to Convex, which required a bridge: the app keeps NextAuth for
login, then mints a short-lived RS256 token that Convex verifies through a JWKS
endpoint. Convex's custom JWT provider accepts only RS256 or ES256, and NextAuth's
session token is a symmetrically encrypted JWE, so it cannot be handed over
directly. This bridge exists solely because tRPC no longer terminates every
privileged request server-side.

The Mercado Pago webhook stays a Next.js route rather than becoming a Convex HTTP
action. Checkout preferences carry their notification URL baked in and live for ten
days, so relocating the endpoint would require both URLs to work at once on a
payment path.

A future reader will find a T3 app with no tRPC in it and may assume this was an
oversight. It was not.

## Update: one router remains

The teardown (ticket 15) found one screen tRPC still had to serve:
`/admin/dashboard/pagamentos` enriches Mercado Pago's payments API with a
Prisma voucher lookup by code, and nothing ports that lookup to Convex yet.
Rather than delete a working admin feature to close out a teardown ticket,
`src/server/api/routers/mercadopago.ts`, its tRPC/Prisma wiring, and
`@prisma/client` at runtime stay in place for that one screen. Every other
router, and the Prisma-backed screens and helpers that had no live Convex
equivalent to redirect to, are gone.
