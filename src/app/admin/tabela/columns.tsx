'use client'
import { formateDateDayMonthYear, formatPhone, formatReferrer } from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"

import type { AdminVoucher } from "../voucher-info-card"
import { VoucherStatusBadge } from "../_components/admin-ui"
import { PaymentBadges } from "./payment-badges"

export const columns: ColumnDef<AdminVoucher>[] = [
  {
    accessorKey: "code",
    header: "Código",
    cell: ({ getValue }) => (
      <span className="font-mono font-medium uppercase tracking-wide">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  {
    accessorKey: "phone",
    header: "Telefone",
    cell: ({ getValue }) => formatPhone(getValue<string>()),
  },
  {
    accessorKey: "referrer",
    header: "Origem",
    cell: ({ getValue }) => {
      const referrer = getValue<AdminVoucher["referrer"]>()
      return referrer ? formatReferrer(referrer.source) : "—"
    },
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    cell: ({ getValue }) => formateDateDayMonthYear(new Date(getValue<number>())),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1">
        <VoucherStatusBadge status={row.original.status} />
        <PaymentBadges voucher={row.original} />
      </span>
    ),
  },
]
