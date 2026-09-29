import React from "react";

import { requireAdmin } from "@/app/lib";

import DataTable from "./data-table";
import { PageShell } from "../_components/admin-ui";

export default async function TablePage() {
  const user = await requireAdmin();

  if (!user) {
    return null;
  }

  return (
    <PageShell className="md:max-w-6xl">
      <DataTable />
    </PageShell>
  );
}
