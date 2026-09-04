import { getCurrentAuthUser } from "@/lib/auth-server";

import AccountSettings from "./account-settings";

export default async function AccountPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize seus dados de acesso. Seu perfil é{" "}
          {user.role === "admin" ? "administrador" : "funcionário"}.
        </p>
      </div>
      <AccountSettings username={user.username ?? ""} />
    </div>
  );
}
