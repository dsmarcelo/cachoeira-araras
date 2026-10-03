# ADR 0001: Direct Convex access

Status: accepted. Authentication is defined separately by [ADR 0002](0002-use-better-auth-with-convex.md).

## Context

Gate and administrator screens need to reflect payment changes made asynchronously by Mercado Pago. Keeping tRPC between the browser and Convex would retain another RPC layer without delivering direct reactive subscriptions.

## Decision

Use direct Convex access for application data and Convex actions for provider integration. Remove tRPC and the runtime Prisma data access layer. Retain the Next.js Mercado Pago webhook adapter because existing checkout preferences embed its notification URL.

## Consequences

Convex enforces application authorization. External callbacks enter through authenticated server adapters. Prisma remains only for legacy tooling until its remaining consumers are retired.
