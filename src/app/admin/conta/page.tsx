import { getCurrentAuthUser } from "@/lib/auth-server";

import AccountSettings from "./account-settings";
import { PageShell } from "../_components/admin-ui";

export default async function AccountPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return null;
  }

  return (
    <PageShell className="max-w-xl">
      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="flex size-11 items-center justify-center rounded-full border border-border bg-white text-[17px] font-semibold uppercase">
          {user.username.charAt(0)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">{user.username}</span>
          <span className="text-[13px] text-muted-foreground">
            {user.role === "admin" ? "Administrador" : "Funcionário"}
          </span>
        </div>
      </div>
      <AccountSettings username={user.username} />
    </PageShell>
  );
}
