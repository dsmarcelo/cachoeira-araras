import React from "react";

import { requireAdmin } from "@/app/lib";

import DataTable from "./data-table";

export default async function TablePage() {
  const user = await requireAdmin();

  if (!user) {
    return null;
  }

  return (
    <main className="flex w-full flex-col items-center px-4 py-4 md:py-8">
      <DataTable />
    </main>
  );
}
