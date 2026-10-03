'use client'

import * as React from "react"
import type { PaginationStatus } from "convex/react"
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
import { formateDateDayMonthYear, formatPhone, formatReferrer } from "@/lib/utils"
import { VoucherInfoCard, type AdminVoucher } from "../voucher-info-card"
import { DateRangeFilter, type DateRangeValue } from "./date-range-filter"
import {
  ChipGroup,
  EmptyState,
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
  loadStatus: PaginationStatus
  status: string
  search: string
  view: VoucherView
  created: DateRangeValue
  expires: DateRangeValue
  onLoadMore: () => void
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
  loadStatus,
  status,
  search,
  view,
  created,
  expires,
  onLoadMore,
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
  })

  const isLoading = loadStatus === "LoadingFirstPage"
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
        <DateRangeFilter label="Data da compra" value={created} disabled={isDeletedView} onChange={onCreatedChange} />
        <DateRangeFilter label="Expira" value={expires} disabled={isDeletedView} onChange={onExpiresChange} />
      </div>

      <p className="px-1 pt-1 text-[13px] text-muted-foreground">
        {data.length} {data.length === 1 ? "carregado" : "carregados"}
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
                    {voucher.referrer?.source ? (
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

      {loadStatus === "CanLoadMore" || loadStatus === "LoadingMore" ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadStatus === "LoadingMore"}
          className="h-11 rounded-lg border border-border bg-white text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60"
        >
          {loadStatus === "LoadingMore" ? "Carregando..." : "Carregar mais"}
        </button>
      ) : null}

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
