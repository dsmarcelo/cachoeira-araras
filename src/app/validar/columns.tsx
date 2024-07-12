"use client"

import { formatPhone } from "@/lib/utils/utils"
import { type Voucher } from "@/lib/voucher/types"
import type { ColumnDef } from "@tanstack/react-table"

export const columns: ColumnDef<Voucher>[] = [
  {
    accessorKey: "code",
    header: "Codigo",
  },
  {
    accessorKey: "valid",
    header: "Status",
    cell: (row) => {
      if (row.getValue() === null) {
        return <div>-</div>
      }
      return <div>{row.getValue() ? "Valido" : "Não valido"}</div>
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
