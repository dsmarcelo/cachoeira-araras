# ADR 0002: Better Auth on Convex

Status: accepted.

## Context

Staff need named accounts, account administration and role changes that work locally and in production. The previous NextAuth/JWKS bridge coupled local authentication to a deployed frontend and shared credentials.

## Decision

Store identity, credentials and sessions in Better Auth's Convex component. Use username login and the admin plugin, with public signup disabled. Map the ordinary user role to employee and authorize against the current stored account.

## Consequences

Each deployment has its own signing secret and trusted origins. Local Next.js can use a remote development backend. Internal placeholder emails satisfy the identity provider without requiring staff email addresses. First-account provisioning is internal and refuses to run once any user exists.
