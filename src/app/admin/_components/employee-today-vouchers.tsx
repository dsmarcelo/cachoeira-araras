"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import EmployeeVoucherInfoCard from "../employee-voucher-info-card";
import { TodayVoucherList } from "./today-voucher-list";
import { api } from "../../../../convex/_generated/api";

type EmployeeVoucher = FunctionReturnType<typeof api.vouchers.listToday>[number];

/** Employee gate list: same view as admins, without payment identifiers. */
export default function EmployeeTodayVouchers() {
  const [selected, setSelected] = useState<EmployeeVoucher | null>(null);
  const vouchers = useQuery(api.vouchers.listToday, {});

  return (
    <>
      <TodayVoucherList vouchers={vouchers} onSelect={setSelected} />
      {selected ? (
        <EmployeeVoucherInfoCard data={selected} open onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
