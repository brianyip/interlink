"use client"

import { useState, useRef, useEffect, useMemo } from "react"
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
import { Search, Plus, MoreHorizontal, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link as LinkType, LinkUpdateInput } from "@/lib/types"

interface LinksDataTableProps {
  data: LinkType[]
  onUpdate: (id: string, updates: LinkUpdateInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdd: () => void
}

interface EditableCellProps {
  link: LinkType
  field: string
  value: string
  onUpdate: (id: string, updates: LinkUpdateInput) => Promise<void>
  onStartEdit?: () => void
}

// Self-contained EditableCell component
function EditableCell({ link, field, value, onUpdate, onStartEdit }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editValue !== value) {
      await onUpdate(link.id, { [field]: editValue })
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Check if focus is moving to another editable cell
    const relatedTarget = e.relatedTarget as HTMLElement
    if (relatedTarget?.hasAttribute('data-editable-trigger')) {
      // Save current cell and let the other cell handle its own edit
      handleSave()
    } else {
      // Focus is leaving to somewhere else, save
      handleSave()
    }
  }

  const handleDoubleClick = () => {
    if (onStartEdit) onStartEdit()
    setIsEditing(true)
    setEditValue(value)
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 text-sm"
      />
    )
  }

  return (
    <div
      className="cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded min-h-8 flex items-center"
      onDoubleClick={handleDoubleClick}
      data-editable-trigger
      data-link-id={link.id}
      data-field={field}
      tabIndex={0}
    >
      <span className="truncate">{value || ""}</span>
    </div>
  )
}

export function LinksDataTable({ data, onUpdate, onDelete, onAdd }: LinksDataTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState<{
    column: keyof LinkType | null
    direction: 'asc' | 'desc'
  }>({ column: null, direction: 'asc' })

  // Filter links based on search query
  const filteredLinks = useMemo(() => {
    return data.filter(
      (link) =>
        link.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.url && link.url.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [data, searchQuery])

  // Sort filtered links
  const sortedLinks = useMemo(() => {
    if (!sortConfig.column) return filteredLinks

    return [...filteredLinks].sort((a, b) => {
      const aValue = a[sortConfig.column!]
      const bValue = b[sortConfig.column!]

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      // Convert to string for comparison
      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()

      if (aStr < bStr) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aStr > bStr) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [filteredLinks, sortConfig])

  const handleSort = (column: keyof LinkType) => {
    if (sortConfig.column === column) {
      // If clicking the same column, toggle direction
      setSortConfig({
        column,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      })
    } else {
      // If clicking a new column, start with ascending
      setSortConfig({ column, direction: 'asc' })
    }
  }

  const getSortIcon = (column: keyof LinkType) => {
    if (sortConfig.column !== column) return null
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active"
    await onUpdate(id, { status: newStatus })
  }

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl">Links</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by short link or URL..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={onAdd} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" />
            Create link
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/80 border-b border-gray-200">
            <TableRow>
              <TableHead 
                className="p-4 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('key')}
              >
                <div className="flex items-center gap-2">
                  Key
                  {getSortIcon('key')}
                </div>
              </TableHead>
              <TableHead 
                className="p-4 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('displayName')}
              >
                <div className="flex items-center gap-2">
                  Display Text
                  {getSortIcon('displayName')}
                </div>
              </TableHead>
              <TableHead 
                className="p-4 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('url')}
              >
                <div className="flex items-center gap-2">
                  Link
                  {getSortIcon('url')}
                </div>
              </TableHead>
              <TableHead 
                className="p-4 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  Status
                  {getSortIcon('status')}
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLinks.map((link, index) => (
              <TableRow
                key={link.id}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50/20"
                }`}
              >
                <TableCell className="p-4">
                  <div className="flex items-center gap-2">
                    <EditableCell 
                      link={link} 
                      field="key" 
                      value={link.key} 
                      onUpdate={onUpdate}
                    />
                  </div>
                </TableCell>
                <TableCell className="p-4">
                  <EditableCell
                    link={link}
                    field="displayName"
                    value={link.displayName}
                    onUpdate={onUpdate}
                  />
                </TableCell>
                <TableCell className="p-4 max-w-md">
                  <EditableCell 
                    link={link} 
                    field="url" 
                    value={link.url || ""} 
                    onUpdate={onUpdate}
                  />
                </TableCell>
                <TableCell className="p-4">
                  <button
                    onClick={() => toggleStatus(link.id, link.status)}
                    className="cursor-pointer"
                  >
                    <Badge
                      variant={link.status === "active" ? "active" : "inactive"}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          link.status === "active" ? "bg-green-600" : "bg-gray-400"
                        }`}
                      />
                      {link.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete(link.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Viewing 1-{sortedLinks.length} of {sortedLinks.length} links
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-500">
        💡 Double-click any cell to edit • Press Enter to save • Press Escape to
        cancel
      </div>
    </div>
  )
}