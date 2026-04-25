import { scryptSync, timingSafeEqual } from "node:crypto";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { env } from "@/env.js";

export const USER_ROLES = ["admin", "employee"] as const;

export type UserRole = (typeof USER_ROLES)[number];

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      isAdmin: boolean;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin: boolean;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
    role?: UserRole;
  }
}

function verifyPasswordHash(
  password: string,
  storedHash: string | undefined,
  envName: string,
): boolean {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, derivedKeyHex] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !derivedKeyHex) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(derivedKeyHex, "hex");

    if (expectedKey.length === 0) {
      return false;
    }

    const derivedKey = scryptSync(password, salt, expectedKey.length);

    return timingSafeEqual(derivedKey, expectedKey);
  } catch (error) {
    console.error(`Invalid ${envName} configuration`, error);
    return false;
  }
}

function resolveUserRole(password: string): UserRole | null {
  if (verifyPasswordHash(password, env.ADMIN_PASSWORD_HASH, "ADMIN_PASSWORD_HASH")) {
    return "admin";
  }

  if (
    verifyPasswordHash(
      password,
      env.EMPLOYEE_PASSWORD_HASH,
      "EMPLOYEE_PASSWORD_HASH",
    )
  ) {
    return "employee";
  }

  return null;
}

const isProduction = env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.isAdmin = user.isAdmin;
        token.role = user.role;
      }

      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub ?? "staff",
        isAdmin: token.isAdmin === true,
        role: token.role === "employee" ? "employee" : "admin",
      },
    }),
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: isProduction,
      },
    },
  },
  providers: [
    CredentialsProvider({
      credentials: {
        password: {
          label: "Senha de acesso",
          type: "password",
        },
      },
      name: "Acesso interno",
      authorize(credentials) {
        const password = credentials?.password;

        if (typeof password !== "string" || password.length === 0) {
          return null;
        }

        const role = resolveUserRole(password);

        if (!role) {
          return null;
        }

        return {
          email: `${role}@cachoeira-araras.local`,
          id: role,
          isAdmin: role === "admin",
          name: role === "admin" ? "Administrador" : "Funcionário",
          role,
        };
      },
    }),
  ],
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await getServerAuthSession();
  const role = session?.user?.role;

  return role === "admin" || role === "employee" ? role : null;
}
