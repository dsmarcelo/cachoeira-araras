import React from "react";

import { requireStaff } from "@/app/lib";

import EmployeeTodayVouchers from "../_components/employee-today-vouchers";
import TodayVouchers from "../_components/today-vouchers";

export default async function TodayPage() {
  const user = await requireStaff();

  if (!user) {
    return null;
  }

  return (
    <main className="flex w-full flex-col items-center px-4">
      <div className="mt-8 w-full max-w-3xl">
        {user.role === "admin" ? <TodayVouchers /> : <EmployeeTodayVouchers />}
      </div>
    </main>
  );
}
