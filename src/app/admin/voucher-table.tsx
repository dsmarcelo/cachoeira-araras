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
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { ListFilter } from "lucide-react"
import { VoucherInfoCard } from "./voucher-info-card"
import { DataTablePagination } from "./table-pagination"
import { type CompleteVoucherSchema } from "@/lib/voucher/types"
import { api } from "@/trpc/react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[],
  data: TData[]
}

export function VoucherTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: 'id',
    desc: true,
  }])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [selectedRow, setSelectedRow] = React.useState<Row<TData>>()
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )

  const handleClick = (row: Row<TData>) => {
    setSelectedRow(row)
  }

  const useWindowWidth = (): number => {
    const [windowWidth, setWindowWidth] = React.useState<number>(window.innerWidth);

    React.useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };

      window.addEventListener('resize', handleResize);

      // Cleanup the event listener on component unmount
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, []);

    return windowWidth;
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
    // initialState: {
  })

  const windowwidth = useWindowWidth();

  function setColumnsVisibility() {
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
  }

  React.useEffect(() => { setColumnsVisibility() }, []);
  window.onresize = () => setColumnsVisibility();
  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-4 sm:px-8 rounded-lg shadow-md border space-y-4">
      <div className="flex justify-between px-4 sm:px-0">
        <Select onValueChange={(value) => {
          value === 'all' ? table.resetColumnFilters() : table.getColumn("status")?.setFilterValue(value)
        }}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="valid">Validos</SelectItem>
              <SelectItem value="redeemed">Usados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
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
            {table.getRowModel().rows?.length ? (
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
                  Sem resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
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
