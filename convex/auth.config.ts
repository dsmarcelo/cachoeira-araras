import { type AuthConfig } from "convex/server";

// Verifies the RS256 token minted by src/app/api/auth/convex-token/route.ts
// from a NextAuth session (see src/server/convex-auth-bridge.ts for issuer/
// audience/algorithm — must match exactly). JWKS is served at
// /.well-known/jwks.json by the same Next.js app.
const authConfig: AuthConfig = {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: process.env.CONVEX_AUTH_ISSUER_URL ?? "http://localhost:3000",
      jwks: `${process.env.CONVEX_AUTH_ISSUER_URL ?? "http://localhost:3000"}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};

export default authConfig;
