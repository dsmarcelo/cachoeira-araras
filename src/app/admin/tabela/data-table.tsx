'use client'
import * as React from "react"
import { useAction, usePaginatedQuery, useQuery } from "convex/react"

import { VoucherTable, type VoucherView } from "./voucher-table"
import { columns } from "./columns"
import { api } from "../../../../convex/_generated/api"
import { paidVoucherStatuses } from "../../../../convex/lib/paymentReversal"
import type { AdminVoucher } from "../voucher-info-card"
import type { DateRangeValue } from "./date-range-filter"

/** A calendar date input ("YYYY-MM-DD") read as Sao Paulo local time, matching the fixed
 * UTC-3 offset assumption used throughout the voucher backend. */
function startOfSaoPauloDayMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00-03:00`).getTime()
}
function endOfSaoPauloDayMs(dateKey: string): number {
  return new Date(`${dateKey}T23:59:59.999-03:00`).getTime()
}

type StatusFilter = "all" | AdminVoucher["status"]

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

/** Lags `value` behind by `delayMs` so typing does not fire a query per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function DataTable() {
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')
  const [view, setView] = React.useState<VoucherView>('active')
  const [created, setCreated] = React.useState<DateRangeValue>({ from: '', to: '' })
  const [expires, setExpires] = React.useState<DateRangeValue>({ from: '', to: '' })
  const [paymentDisputed, setPaymentDisputed] = React.useState(false)
  const [reconciliationError, setReconciliationError] = React.useState('')
  const checkedCodes = React.useRef(new Set<string>())
  const reconcilePayments = useAction(api.voucherReconciliation.reconcileAdmin)
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const searchArg = debouncedSearch || undefined

  const active = usePaginatedQuery(
    api.vouchers.listAdmin,
    view === 'active'
      ? {
        status: status === 'all' ? undefined : status,
        purchasedFrom: created.from ? startOfSaoPauloDayMs(created.from) : undefined,
        purchasedTo: created.to ? endOfSaoPauloDayMs(created.to) : undefined,
        expiresAfter: expires.from ? startOfSaoPauloDayMs(expires.from) : undefined,
        expiresBefore: expires.to ? endOfSaoPauloDayMs(expires.to) : undefined,
        search: searchArg,
        paymentDisputed: paymentDisputed || undefined,
      }
      : 'skip',
    { initialNumItems: PAGE_SIZE },
  )
  const deleted = usePaginatedQuery(
    api.vouchers.listDeleted,
    view === 'deleted' ? { search: searchArg } : 'skip',
    { initialNumItems: PAGE_SIZE },
  )
  // Pending vouchers are reconciled regardless of which page of the table is loaded.
  const pendingCodes = useQuery(
    api.vouchers.listPendingCodes,
    view === 'active' ? {} : 'skip',
  )

  // Paid vouchers in the loaded rows: their payment may have been refunded or
  // disputed since the last check, so they are re-checked once per mount too.
  const paidCodes = React.useMemo(
    () =>
      active.results
        .filter((voucher) => voucher.paymentId && paidVoucherStatuses.has(voucher.status))
        .map((voucher) => voucher.code),
    [active.results],
  )

  React.useEffect(() => {
    if (view !== 'active') return
    const codes = [...(pendingCodes ?? []), ...paidCodes].filter(
      (code) => !checkedCodes.current.has(code),
    )
    if (codes.length === 0) return
    codes.forEach((code) => checkedCodes.current.add(code))

    async function checkPayments() {
      for (let i = 0; i < codes.length; i += 50) {
        try {
          const result = await reconcilePayments({ codes: codes.slice(i, i + 50) })
          if (result.failed > 0) {
            setReconciliationError('Não foi possível conferir todos os pagamentos. Recarregue a página em instantes.')
          }
        } catch {
          setReconciliationError('Não foi possível conferir os pagamentos. Recarregue a página em instantes.')
        }
      }
    }
    void checkPayments()
  }, [view, pendingCodes, paidCodes, reconcilePayments])

  const { results, status: loadStatus, loadMore } = view === 'active' ? active : deleted

  return (
    <div className='w-full'>
      {reconciliationError && <p role='alert' className='mb-4 text-destructive'>{reconciliationError}</p>}
      <VoucherTable
        columns={columns}
        data={results}
        loadStatus={loadStatus}
        onLoadMore={() => loadMore(PAGE_SIZE)}
        status={status}
        search={search}
        view={view}
        created={created}
        expires={expires}
        paymentDisputed={paymentDisputed}
        onStatusChange={(nextStatus) => setStatus(nextStatus as StatusFilter)}
        onSearchChange={setSearch}
        onViewChange={setView}
        onCreatedChange={setCreated}
        onExpiresChange={setExpires}
        onPaymentDisputedChange={setPaymentDisputed}
      />
    </div>
  )
}
