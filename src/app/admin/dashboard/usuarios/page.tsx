import { getCurrentAuthUser } from "@/lib/auth-server";

import UserManager from "./user-manager";

export default async function UsersPage() {
  const currentUser = await getCurrentAuthUser();

  if (!currentUser) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie acessos individuais e controle quem pode administrar o sistema.
        </p>
      </div>
      <UserManager currentUserId={currentUser.id} />
    </div>
  );
}
