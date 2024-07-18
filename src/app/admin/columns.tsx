"use client"

import { formatPhone } from "@/lib/utils"
import { formatVoucherStatus } from "@/lib/voucher"
import { type VoucherSchema } from "@/lib/voucher/types"
import type { ColumnDef } from "@tanstack/react-table"

export const columns: ColumnDef<VoucherSchema>[] = [
  {
    accessorKey: "code",
    header: "Codigo",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (row) => {
      if (row.getValue()) {
        return <div>{formatVoucherStatus(row.getValue() as string)}</div>
      }
      return <div>-</div>
    },
  },
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "phone",
    header: "Telefone",
    cell: (row) => {
      if (row.getValue() === null) {
        return <div>-</div>
      }
      return <div>{formatPhone(row.getValue() as string)}</div>
    },
  },
]
