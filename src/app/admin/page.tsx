import React from "react";
import ValidateVoucher from "../_components/validate-voucher";
import EmployeeTodayVouchers from "./_components/employee-today-vouchers";
import TodayVouchers from "./_components/today-vouchers";
import { requireStaff } from "../lib";

export default async function AdminPage() {
  const user = await requireStaff();

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-12">
      <ValidateVoucher />
      {user.role === "admin" ? <TodayVouchers /> : <EmployeeTodayVouchers />}
    </main>
  );
}
