'use client'

import * as React from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
  type VisibilityState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useWindowWidth } from "@/lib/utils"
import { VoucherInfoCard, type AdminVoucher } from "../voucher-info-card"
import { DataTablePagination } from "./table-pagination"

export type VoucherView = "active" | "deleted"

interface DataTableProps {
  columns: ColumnDef<AdminVoucher>[]
  data: AdminVoucher[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  status: string
  search: string
  view: VoucherView
  dateFrom: string
  dateTo: string
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
  onViewChange: (view: VoucherView) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

export function VoucherTable({
  columns,
  data,
  total,
  page,
  pageSize,
  pageCount,
  status,
  search,
  view,
  dateFrom,
  dateTo,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onSearchChange,
  onViewChange,
  onDateFromChange,
  onDateToChange,
}: DataTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [selectedRow, setSelectedRow] = React.useState<Row<AdminVoucher>>()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount,
    state: {
      columnVisibility,
      pagination: {
        pageIndex: page - 1,
        pageSize,
      },
    },
  })

  const windowWidth = useWindowWidth()

  React.useEffect(() => {
    const narrow = windowWidth < 768
    table.getColumn("phone")?.toggleVisibility(!narrow)
    table.getColumn("referrer")?.toggleVisibility(!narrow)
  }, [table, windowWidth])

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-4 sm:px-8 rounded-lg shadow-md border border-border bg-card text-card-foreground space-y-4">
      <div className="flex flex-col gap-3 px-4 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={view} onValueChange={(value) => onViewChange(value as VoucherView)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">Vouchers</SelectItem>
                <SelectItem value="deleted">Excluídos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={onStatusChange} disabled={view === "deleted"}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="valid">Válidos</SelectItem>
                <SelectItem value="redeemed">Usados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 sm:w-72"
              placeholder="Buscar por nome, telefone ou código"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Criado de</span>
            <Input
              type="date"
              className="h-8 w-36"
              value={dateFrom}
              disabled={view === "deleted"}
              onChange={(event) => onDateFromChange(event.target.value)}
            />
            <span>até</span>
            <Input
              type="date"
              className="h-8 w-36"
              value={dateTo}
              disabled={view === "deleted"}
              onChange={(event) => onDateToChange(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="px-4 text-sm text-muted-foreground sm:px-0">
        {total} voucher(s) encontrado(s).
      </div>
      <div className="border-y border-border sm:border sm:rounded-lg w-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Carregando vouchers...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Nenhum voucher encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        table={table}
        total={total}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      {selectedRow && (
        <VoucherInfoCard
          data={selectedRow.original}
          isDeleted={view === "deleted"}
          open={!!selectedRow}
          onClose={() => setSelectedRow(undefined)}
        />
      )}
    </div>
  )
}
