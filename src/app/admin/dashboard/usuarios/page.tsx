import { getCurrentAuthUser } from "@/lib/auth-server";

import UserManager from "./user-manager";
import { PageShell } from "../../_components/admin-ui";

export default async function UsersPage() {
  const currentUser = await getCurrentAuthUser();

  if (!currentUser) {
    return null;
  }

  return (
    <PageShell>
      <UserManager currentUserId={currentUser.id} />
    </PageShell>
  );
}
