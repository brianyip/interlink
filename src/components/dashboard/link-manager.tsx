"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Edit2, Trash2 } from "lucide-react"
import { Link as LinkType, LinkCreateInput, LinkUpdateInput } from "@/lib/types"

export function LinkManager() {
  const [links, setLinks] = useState<LinkType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingLink, setEditingLink] = useState<LinkType | null>(null)
  const [showForm, setShowForm] = useState(false)
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
      }
    } catch (error) {
      console.error("Failed to fetch links:", error)
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
        fetchLinks()
        resetForm()
      }
    } catch (error) {
      console.error("Failed to create link:", error)
    }
  }

  // Update link
  const updateLink = async (id: string, data: LinkUpdateInput) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (response.ok) {
        fetchLinks()
        setEditingLink(null)
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
        fetchLinks()
      }
    } catch (error) {
      console.error("Failed to delete link:", error)
    }
  }

  // Toggle link status
  const toggleStatus = async (link: LinkType) => {
    const newStatus = link.status === "active" ? "inactive" : "active"
    await updateLink(link.id, { status: newStatus })
  }

  const resetForm = () => {
    setFormData({ key: "", displayName: "", url: "", status: "active" })
    setShowForm(false)
    setEditingLink(null)
  }

  const startEdit = (link: LinkType) => {
    setEditingLink(link)
    setFormData({
      key: link.key,
      displayName: link.displayName,
      url: link.url,
      status: link.status
    })
    setShowForm(true)
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Links</h2>
        <Button onClick={() => setShowForm(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Link
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingLink ? "Edit Link" : "Add New Link"}</CardTitle>
            <CardDescription>
              {editingLink ? "Update link information" : "Create a new link reference"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., chasesapphirepreferred"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Chase Sapphire Preferred"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="url">URL (optional)</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://chase.com/terms/sapphire-preferred"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <Button onClick={editingLink ? () => updateLink(editingLink.id, formData) : createLink}>
                {editingLink ? "Update" : "Create"} Link
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      <div className="grid gap-4">
        {links.map((link) => (
          <Card key={link.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">{link.displayName}</h3>
                <p className="text-sm text-gray-600">Key: {link.key}</p>
                <p className="text-sm text-gray-600">URL: {link.url || "No URL"}</p>
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  link.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {link.status}
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(link)}
                >
                  {link.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(link)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteLink(link.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {links.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No links found. Create your first link to get started.</p>
        </div>
      )}
    </div>
  )
}