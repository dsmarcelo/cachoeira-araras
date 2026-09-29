'use client'

import * as React from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formateDateDayMonthYear, formatPhone, formatReferrer } from "@/lib/utils"
import { VoucherInfoCard, type AdminVoucher } from "../voucher-info-card"
import { DateRangeFilter, type DateRangeValue } from "./date-range-filter"
import {
  ChipGroup,
  EmptyState,
  Pager,
  Panel,
  SearchInput,
  Segmented,
  VoucherStatusBadge,
} from "../_components/admin-ui"

export type VoucherView = "active" | "deleted"

const viewOptions = [
  { value: "active", label: "Vouchers" },
  { value: "deleted", label: "Excluídos" },
] as const

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "valid", label: "Válidos" },
  { value: "redeemed", label: "Usados" },
  { value: "pending", label: "Pendentes" },
  { value: "expired", label: "Expirados" },
  { value: "refunded", label: "Estornados" },
] as const

type StatusValue = (typeof statusOptions)[number]["value"]

interface VoucherTableProps {
  columns: ColumnDef<AdminVoucher>[]
  data: AdminVoucher[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  status: string
  search: string
  view: VoucherView
  created: DateRangeValue
  expires: DateRangeValue
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
  onViewChange: (view: VoucherView) => void
  onCreatedChange: (value: DateRangeValue) => void
  onExpiresChange: (value: DateRangeValue) => void
}

/**
 * Filters + results for /admin/tabela. Phones get a card list; wider screens
 * get the table. Both open the same `VoucherInfoCard` drawer.
 */
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
  created,
  expires,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onSearchChange,
  onViewChange,
  onCreatedChange,
  onExpiresChange,
}: VoucherTableProps) {
  const [selected, setSelected] = React.useState<AdminVoucher>()
  const isDeletedView = view === "deleted"

  // TanStack Table exposes mutable APIs that React Compiler cannot safely memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  })

  const emptyMessage = isLoading ? "Carregando vouchers..." : "Nenhum voucher encontrado."

  return (
    <div className="flex flex-col gap-3">
      <Segmented value={view} options={viewOptions} onChange={onViewChange} label="Visualização" />
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar por nome, telefone ou código"
        maxLength={60}
      />
      <ChipGroup
        value={status as StatusValue}
        options={statusOptions}
        onChange={onStatusChange}
        label="Status"
        disabled={isDeletedView}
      />
      <div className="grid grid-cols-2 gap-2">
        <DateRangeFilter label="Criado" value={created} disabled={isDeletedView} onChange={onCreatedChange} />
        <DateRangeFilter label="Expira" value={expires} disabled={isDeletedView} onChange={onExpiresChange} />
      </div>

      <p className="px-1 pt-1 text-[13px] text-muted-foreground">
        {total} {total === 1 ? "voucher encontrado" : "vouchers encontrados"}
      </p>

      {/* Phones: cards */}
      <Panel className="overflow-hidden md:hidden">
        {data.length === 0 ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          <ul>
            {data.map((voucher, index) => (
              <li key={voucher.code} className={index > 0 ? "border-t border-border" : undefined}>
                <button
                  type="button"
                  onClick={() => setSelected(voucher)}
                  className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{voucher.name}</span>
                    <VoucherStatusBadge status={voucher.status} />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="font-mono font-medium uppercase tracking-wide text-zinc-700">{voucher.code}</span>
                    <span aria-hidden>·</span>
                    <span>{formatPhone(voucher.phone)}</span>
                    {voucher.referrer ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formatReferrer(voucher.referrer.source)}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Expira {formateDateDayMonthYear(new Date(voucher.expiresAt))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Tablet and up: table */}
      <Panel className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row.original)}
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>

      <Pager page={page} pageCount={pageCount} onPageChange={onPageChange}>
        <Select value={`${pageSize}`} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger aria-label="Itens por página" className="hidden h-9 w-[76px] sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 30, 50].map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Pager>

      {selected ? (
        <VoucherInfoCard
          data={selected}
          isDeleted={isDeletedView}
          open
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </div>
  )
}
