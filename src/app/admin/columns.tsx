'use client'
import { formateDateDayMonthYear, formatPhone } from "@/lib/utils"
import { formatVoucherStatus, formatVoucherStatusIcons } from "@/lib/voucher"
import { type VoucherSchema } from "@/lib/voucher/types"
import type { ColumnDef } from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { activateVoucher, deleteVoucher, redeemVoucher } from "../lib"
import { toast } from "@/components/ui/use-toast"

async function handleDelete(code: string) {
  await deleteVoucher(code)
  toast({
    title: "Voucher deletado com sucesso",
  });
}

async function handleUseVoucher(code: string) {
  await redeemVoucher(code)
  toast({
    title: "Voucher resgatado com sucesso",
  });
}
async function handleActivateVoucher(code: string) {
  await activateVoucher(code)
  toast({
    title: "Voucher ativado com sucesso",
  });
}

export const columns: ColumnDef<VoucherSchema>[] = [
  {
    accessorKey: "code",
    header: "Codigo",
    cell: (row) => {
      if (row.getValue()) {
        return <div className="w-fit mx-auto">{row.getValue() as string}</div>
      }
      return <div>-</div>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs sm:text-base px-1"
        >
          Status
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      )
    },
    cell: (row) => {
      if (row.getValue()) {
        return <div className="w-fit mx-auto">{formatVoucherStatusIcons(row.getValue() as string)}</div>
      }
      return <div>-</div>

    },
  },
  {
    accessorKey: "name",
    header: "Nome",
  },
  // {
  //   accessorKey: "phone",
  //   header: "Telefone",
  //   cell: (row) => {
  //     if (row.getValue() === null) {
  //       return <div>-</div>
  //     }
  //     return <div>{formatPhone(row.getValue() as string)}</div>
  //   },
  // },
  {
    accessorKey: "expires_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs sm:text-base px-1"
        >
          Expira em
          <ArrowUpDown className="ml-1 size-3" />
        </Button>
      )
    },
    cell: (row) => {
      if (row.getValue() === null) {
        return <div>-</div>
      }
      return <div>{formateDateDayMonthYear(row.getValue() as string)}</div>
    },
  },
  {
    id: "Ações",
    cell: ({ row }) => {
      const voucher = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            {voucher.valid &&
              <DropdownMenuItem
                className='text-green-500'
                onClick={() => handleUseVoucher(voucher.code)}
              >
                Usar voucher
              </DropdownMenuItem>
            }
            {!voucher.valid &&
              <DropdownMenuItem
                className='text-bg-blue'
                onClick={() => handleActivateVoucher(voucher.code)}
              >
                Ativar voucher
              </DropdownMenuItem>
            }
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-red-500'
              onClick={() => handleDelete(voucher.code)}
            >
              Deletar voucher
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
