import { createAuth } from "../auth";

// Better Auth's schema generator evaluates this with a placeholder context.
export const auth = createAuth({} as never);
