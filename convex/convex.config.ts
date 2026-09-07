import { defineApp } from "convex/server";
import { v } from "convex/values";

import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    ADMIN_USERNAME: v.optional(v.string()),
    ADMIN_PASSWORD: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    AUTH_TRUSTED_ORIGINS: v.optional(v.string()),
  },
});

app.use(betterAuth);

export default app;
