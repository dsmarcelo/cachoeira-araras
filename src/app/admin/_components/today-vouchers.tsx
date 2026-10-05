"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { GateVoucherInfoCard } from "../gate-voucher-info-card";
import { TodayVoucherList } from "./today-voucher-list";
import { api } from "../../../../convex/_generated/api";

/** Admin gate list: today's vouchers with payment details in the drawer. */
export default function TodayVouchers() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const vouchers = useQuery(api.vouchers.listTodayAdmin, {});

  return (
    <>
      <TodayVoucherList vouchers={vouchers} onSelect={(voucher) => setSelectedCode(voucher.code)} />
      {selectedCode ? (
        <GateVoucherInfoCard code={selectedCode} open onClose={() => setSelectedCode(null)} />
      ) : null}
    </>
  );
}
