"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import EmployeeVoucherInfoCard from "../employee-voucher-info-card";
import { TodayVoucherList } from "./today-voucher-list";
import { api } from "../../../../convex/_generated/api";

/** Employee gate list: same view as admins, without payment identifiers. */
export default function EmployeeTodayVouchers() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const vouchers = useQuery(api.vouchers.listToday, {});

  return (
    <>
      <TodayVoucherList vouchers={vouchers} onSelect={(voucher) => setSelectedCode(voucher.code)} />
      {selectedCode ? (
        <EmployeeVoucherInfoCard code={selectedCode} open onClose={() => setSelectedCode(null)} />
      ) : null}
    </>
  );
}
