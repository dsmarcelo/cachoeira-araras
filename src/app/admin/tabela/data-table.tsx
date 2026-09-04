'use client'
import * as React from "react"
import { useQuery } from "convex/react"

import { VoucherTable, type VoucherView } from "./voucher-table"
import { columns } from "./columns"
import { api } from "../../../../convex/_generated/api"
import type { AdminVoucher } from "../voucher-info-card"

/** A calendar date input ("YYYY-MM-DD") read as Sao Paulo local time, matching the fixed
 * UTC-3 offset assumption used throughout the voucher backend. */
function startOfSaoPauloDayMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00-03:00`).getTime()
}
function endOfSaoPauloDayMs(dateKey: string): number {
  return new Date(`${dateKey}T23:59:59.999-03:00`).getTime()
}

function matchesSearch(voucher: AdminVoucher, needle: string): boolean {
  if (!needle) return true
  const haystack = `${voucher.code} ${voucher.name} ${voucher.phone}`.toLowerCase()
  return haystack.includes(needle)
}

type StatusFilter = "all" | AdminVoucher["status"]

export default function DataTable() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')
  const [view, setView] = React.useState<VoucherView>('active')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')

  const activeVouchers = useQuery(
    api.vouchers.listAdmin,
    view === 'active'
      ? {
        status: status === 'all' ? undefined : status,
        createdAfter: dateFrom ? startOfSaoPauloDayMs(dateFrom) : undefined,
        createdBefore: dateTo ? endOfSaoPauloDayMs(dateTo) : undefined,
      }
      : 'skip',
  )
  const deletedVouchers = useQuery(
    api.vouchers.listDeleted,
    view === 'deleted' ? {} : 'skip',
  )

  const allRows = view === 'active' ? activeVouchers : deletedVouchers
  const isLoading = allRows === undefined

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (allRows ?? []).filter((voucher) => matchesSearch(voucher, needle))
  }, [allRows, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, pageCount)
  const pageRows = filtered.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  )

  function resetToFirstPage() {
    setPage(1)
  }

  return (
    <div className='w-full'>
      <VoucherTable
        columns={columns}
        data={pageRows}
        total={filtered.length}
        page={clampedPage}
        pageSize={pageSize}
        pageCount={pageCount}
        status={status}
        search={search}
        view={view}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize)
          resetToFirstPage()
        }}
        onStatusChange={(nextStatus) => {
          setStatus(nextStatus as StatusFilter)
          resetToFirstPage()
        }}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          resetToFirstPage()
        }}
        onViewChange={(nextView) => {
          setView(nextView)
          resetToFirstPage()
        }}
        onDateFromChange={(value) => {
          setDateFrom(value)
          resetToFirstPage()
        }}
        onDateToChange={(value) => {
          setDateTo(value)
          resetToFirstPage()
        }}
      />
    </div>
  )
}
