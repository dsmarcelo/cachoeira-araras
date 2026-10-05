import React from "react";

import ValidateVoucher from "../_components/validate-voucher";
import EmployeeTodayVouchers from "./_components/employee-today-vouchers";
import TodayVouchers from "./_components/today-vouchers";
import { PageShell } from "./_components/admin-ui";
import { requireStaff } from "../lib";

export default async function AdminPage() {
  const user = await requireStaff();

  if (!user) {
    return null;
  }

  return (
    <PageShell className="md:grid md:max-w-5xl md:grid-cols-2 md:items-start">
      <ValidateVoucher role={user.role} />
      {user.role === "admin" ? <TodayVouchers /> : <EmployeeTodayVouchers />}
    </PageShell>
  );
}
