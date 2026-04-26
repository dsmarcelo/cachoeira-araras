import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons"
import { type Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export function DataTablePagination<TData>({
  table,
  total,
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const isServerPagination =
    page !== undefined &&
    pageSize !== undefined &&
    pageCount !== undefined &&
    onPageChange !== undefined &&
    onPageSizeChange !== undefined

  const currentPage = isServerPagination
    ? page
    : table.getState().pagination.pageIndex + 1
  const currentPageSize = isServerPagination
    ? pageSize
    : table.getState().pagination.pageSize
  const totalPages = isServerPagination ? pageCount : table.getPageCount()
  const canPreviousPage = currentPage > 1
  const canNextPage = currentPage < totalPages

  const goToPage = (nextPage: number) => {
    if (isServerPagination) {
      onPageChange(Math.min(Math.max(nextPage, 1), totalPages))
      return
    }

    table.setPageIndex(nextPage - 1)
  }

  return (
    <div className="flex items-center justify-between px-2 w-full">
      <div className="flex-1 hidden sm:block text-sm text-muted-foreground">
        {isServerPagination
          ? `${total ?? 0} item(ns) encontrado(s).`
          : `${table.getFilteredSelectedRowModel().rows.length} de ${table.getFilteredRowModel().rows.length} items(s) selecionado(s).`}
      </div>
      <div className="flex items-center justify-between space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm hidden sm:block font-medium">Items por página</p>
          <Select
            value={`${currentPageSize}`}
            onValueChange={(value) => {
              if (isServerPagination) {
                onPageSizeChange(Number(value))
                return
              }

              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={currentPageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Página {currentPage} de {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => goToPage(1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Primeira página</span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Página anterior</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">Próxima página</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => goToPage(totalPages)}
            disabled={!canNextPage}
          >
            <span className="sr-only">Última página</span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
