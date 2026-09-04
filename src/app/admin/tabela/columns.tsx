'use client'
import { formateDateDayMonthYear, formatPhone, formatReferrer } from "@/lib/utils"
import { formatVoucherStatusIcons } from "@/lib/voucher"
import type { ColumnDef } from "@tanstack/react-table"

import type { AdminVoucher } from "../voucher-info-card"

export const columns: ColumnDef<AdminVoucher>[] = [
  {
    accessorKey: "code",
    header: "Código",
    cell: ({ getValue }) => <div className="w-fit mx-auto">{getValue<string>()}</div>,
  },
  {
    accessorKey: "name",
    header: "Nome",
    minSize: 300,
  },
  {
    accessorKey: "phone",
    header: "Telefone",
    minSize: 200,
    cell: ({ getValue }) => <div>{formatPhone(getValue<string>())}</div>,
  },
  {
    accessorKey: "referrer",
    header: "Origem",
    cell: ({ getValue }) => {
      const referrer = getValue<AdminVoucher["referrer"]>()
      return <div>{referrer ? formatReferrer(referrer.source) : "-"}</div>
    },
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    cell: ({ getValue }) => <div>{formateDateDayMonthYear(new Date(getValue<number>()))}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <div className="w-fit mx-auto">{formatVoucherStatusIcons(getValue<string>())}</div>,
  },
]
