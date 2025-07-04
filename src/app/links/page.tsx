"use client"

import { useState, useEffect } from "react"
import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { LinksDataTableNew } from "@/components/data-table/links-data-table-new"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Link as LinkType, LinkCreateInput, LinkUpdateInput } from "@/lib/types"

export default function LinksPage() {
  const [links, setLinks] = useState<LinkType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formData, setFormData] = useState<LinkCreateInput>({
    key: "",
    displayName: "",
    url: "",
    status: "active"
  })


  // Fetch links
  const fetchLinks = async () => {
    try {
      const response = await fetch("/api/links")
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
      } else {
        console.error("Failed to fetch links:", response.status)
        setLinks([])
      }
    } catch (error) {
      console.error("Failed to fetch links:", error)
      setLinks([])
    } finally {
      setIsLoading(false)
    }
  }

  // Create link
  const createLink = async () => {
    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      if (response.ok) {
        await fetchLinks()
        setShowAddDialog(false)
        setFormData({ key: "", displayName: "", url: "", status: "active" })
      } else {
        console.error("Failed to create link:", response.status)
      }
    } catch (error) {
      console.error("Failed to create link:", error)
    }
  }

  // Update link
  const updateLink = async (id: string, updates: LinkUpdateInput) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
      if (response.ok) {
        await fetchLinks()
      } else {
        console.error("Failed to update link:", response.status)
      }
    } catch (error) {
      console.error("Failed to update link:", error)
    }
  }

  // Delete link
  const deleteLink = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return
    
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: "DELETE"
      })
      if (response.ok) {
        await fetchLinks()
      } else {
        console.error("Failed to delete link:", response.status)
      }
    } catch (error) {
      console.error("Failed to delete link:", error)
    }
  }

  const handleAddLink = () => {
    setShowAddDialog(true)
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex justify-center items-center h-64">Loading...</div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <LinksDataTableNew
        data={links}
        onUpdate={updateLink}
        onDelete={deleteLink}
        onAdd={handleAddLink}
      />

      {/* Add Link Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Link</DialogTitle>
            <DialogDescription>
              Create a new link entry with a key, display name, URL, and status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., chasesapphirepreferred"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-500 focus:bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Chase Sapphire Preferred"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-500 focus:bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL (optional)</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-500 focus:bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "active" | "inactive") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="bg-gray-100 border-gray-200 text-gray-900 focus:bg-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createLink}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  )
}