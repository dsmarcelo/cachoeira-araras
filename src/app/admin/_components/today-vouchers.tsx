"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { GateVoucherInfoCard } from "../gate-voucher-info-card";
import { TodayVoucherList } from "./today-voucher-list";
import { api } from "../../../../convex/_generated/api";

type AdminGateVoucher = FunctionReturnType<typeof api.vouchers.listTodayAdmin>[number];

/** Admin gate list: today's vouchers with payment details in the drawer. */
export default function TodayVouchers() {
  const [selected, setSelected] = useState<AdminGateVoucher | null>(null);
  const vouchers = useQuery(api.vouchers.listTodayAdmin, {});

  return (
    <>
      <TodayVoucherList vouchers={vouchers} onSelect={setSelected} />
      {selected ? (
        <GateVoucherInfoCard data={selected} open onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
