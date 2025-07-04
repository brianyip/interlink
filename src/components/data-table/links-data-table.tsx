"use client"

import { useState, useEffect, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EditableCell } from "./editable-cell"
import { Link as LinkType, LinkUpdateInput } from "@/lib/types"
import { PlusCircle, Trash2 } from "lucide-react"

interface LinksDataTableProps {
  data: LinkType[]
  onUpdate: (id: string, updates: LinkUpdateInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdd: () => void
}

export function LinksDataTable({ data, onUpdate, onDelete, onAdd }: LinksDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const columns = useMemo<ColumnDef<LinkType>[]>(
    () => [
      {
        accessorKey: "key",
        header: "Key",
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue() as string}
            onSave={(value) => onUpdate(row.original.id, { key: value })}
            placeholder="Enter key"
          />
        ),
      },
      {
        accessorKey: "displayName",
        header: "Display Name",
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue() as string}
            onSave={(value) => onUpdate(row.original.id, { displayName: value })}
            placeholder="Enter display name"
          />
        ),
      },
      {
        accessorKey: "url",
        header: "URL",
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue() as string || ""}
            onSave={(value) => onUpdate(row.original.id, { url: value || null })}
            placeholder="Enter URL (optional)"
            type="url"
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row, getValue }) => {
          const status = getValue() as string
          const toggleStatus = () => {
            const newStatus = status === "active" ? "inactive" : "active"
            onUpdate(row.original.id, { status: newStatus })
          }
          
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleStatus}
              className="h-8 p-0"
            >
              <Badge variant={status === "active" ? "default" : "secondary"}>
                {status}
              </Badge>
            </Button>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row.original.id)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [onUpdate, onDelete]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search links..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="max-w-sm"
          />
        </div>
        <Button onClick={onAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Link
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          {table.getRowModel().rows.length} of {data.length} row(s)
        </div>
      </div>
    </div>
  )
}