"use client"

import * as React from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  getSortedRowModel,
  type VisibilityState,
  type Row,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListFilter, Search } from "lucide-react"
import { VoucherInfoCard } from "../voucher-info-card"
import { DataTablePagination } from "./table-pagination"
import { type CompleteVoucherSchema } from "@/lib/voucher/types"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  status: string
  search: string
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
}

export function VoucherTable<TData, TValue>({
  columns,
  data,
  total,
  page,
  pageSize,
  pageCount,
  status,
  search,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onSearchChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: 'id',
    desc: true,
  }])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [selectedRow, setSelectedRow] = React.useState<Row<TData>>()

  const handleClick = (row: Row<TData>) => {
    setSelectedRow(row)
  }

  const useWindowWidth = (): number => {
    const [windowWidth, setWindowWidth] = React.useState<number>(1024)

    React.useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth)
      }

      handleResize()
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }, [])

    return windowWidth
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount,
    state: {
      columnVisibility,
      sorting,
      pagination: {
        pageIndex: page - 1,
        pageSize,
      },
    },
  })

  const windowwidth = useWindowWidth()

  React.useEffect(() => {
    if (windowwidth < 768) {
      table.getColumn("id")?.toggleVisibility(false)
      table.getColumn("name")?.toggleVisibility(true)
      table.getColumn("phone")?.toggleVisibility(false)
      table.getColumn("expires_at")?.toggleVisibility(true)
      table.getColumn("actions")?.toggleVisibility(false)
    } else {
      table.getColumn("id")?.toggleVisibility(false)
      table.getColumn("name")?.toggleVisibility(true)
      table.getColumn("phone")?.toggleVisibility(true)
      table.getColumn("expires_at")?.toggleVisibility(true)
      table.getColumn("actions")?.toggleVisibility(true)
    }
  }, [table, windowwidth])

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-4 sm:px-8 rounded-lg shadow-md border space-y-4">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={status} onValueChange={onStatusChange}>
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
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 gap-1 text-sm font-normal"
              size="sm"
            >
              <ListFilter className="h-3.5 w-3.5" />
              Filtrar Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            {table
              .getAllColumns()
              .filter(
                (column) => column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="px-4 text-sm text-muted-foreground sm:px-0">
        {total} voucher(s) encontrado(s).
      </div>
      <div className="border-y sm:border sm:rounded-lg w-full">
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
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => handleClick(row)}
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
          data={selectedRow.original as CompleteVoucherSchema}
          open={!!selectedRow}
          onClose={() => setSelectedRow(undefined)}
        />
      )}
    </div>
  )
}
