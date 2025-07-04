"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface EditableCellProps {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  type?: "text" | "url"
}

export function EditableCell({ value, onSave, placeholder, type = "text" }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleDoubleClick = () => {
    setIsEditing(true)
  }

  const handleSave = () => {
    onSave(editValue)
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

  const handleBlur = () => {
    handleSave()
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-8 min-w-0"
      />
    )
  }

  return (
    <div
      className="min-h-8 flex items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded text-sm"
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {value || <span className="text-gray-400">{placeholder || "Click to edit"}</span>}
    </div>
  )
}