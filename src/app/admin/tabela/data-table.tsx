'use client'
import React from 'react'
import { VoucherTable } from './voucher-table'
import { columns } from "./columns"
import { useAdminVoucherPage } from '@/hooks/use-vouchers'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { Button } from '@/components/ui/button'

export default function DataTable() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [status, setStatus] = React.useState('all')
  const [search, setSearch] = React.useState('')

  const debouncedSearch = useDebouncedValue(search)
  const { data, isLoading, isError, isFetching, refresh } = useAdminVoucherPage({
    page,
    pageSize,
    status,
    search: debouncedSearch,
    sortBy: 'id',
    sortDirection: 'desc',
  })

  if (isError) {
    return <div className="text-center">Erro ao carregar os dados.</div>
  }

  return (
    <div className='w-full'>
      {data?.syncWarning && <p role="alert">{data.syncWarning} <Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></p>}
      <VoucherTable
        columns={columns}
        data={(data?.items ?? [])}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? pageSize}
        pageCount={data?.pageCount ?? 1}
        status={status}
        search={search}
        isLoading={isLoading || isFetching}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize)
          setPage(1)
        }}
        onStatusChange={(nextStatus) => {
          setStatus(nextStatus)
          setPage(1)
        }}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          setPage(1)
        }}
      />
    </div>
  )
}
