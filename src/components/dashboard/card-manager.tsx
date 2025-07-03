"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Edit2, Trash2 } from "lucide-react"
import { Card as CardType, CardCreateInput, CardUpdateInput } from "@/lib/types"

export function CardManager() {
  const [cards, setCards] = useState<CardType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingCard, setEditingCard] = useState<CardType | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CardCreateInput>({
    key: "",
    display_name: "",
    terms_url: "",
    status: "active"
  })

  // Fetch cards
  const fetchCards = async () => {
    try {
      const response = await fetch("/api/cards")
      if (response.ok) {
        const data = await response.json()
        setCards(data)
      }
    } catch (error) {
      console.error("Failed to fetch cards:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Create card
  const createCard = async () => {
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      if (response.ok) {
        fetchCards()
        resetForm()
      }
    } catch (error) {
      console.error("Failed to create card:", error)
    }
  }

  // Update card
  const updateCard = async (id: string, data: CardUpdateInput) => {
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (response.ok) {
        fetchCards()
        setEditingCard(null)
      }
    } catch (error) {
      console.error("Failed to update card:", error)
    }
  }

  // Delete card
  const deleteCard = async (id: string) => {
    if (!confirm("Are you sure you want to delete this card?")) return
    
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "DELETE"
      })
      if (response.ok) {
        fetchCards()
      }
    } catch (error) {
      console.error("Failed to delete card:", error)
    }
  }

  // Toggle card status
  const toggleStatus = async (card: CardType) => {
    const newStatus = card.status === "active" ? "inactive" : "active"
    await updateCard(card.id, { status: newStatus })
  }

  const resetForm = () => {
    setFormData({ key: "", display_name: "", terms_url: "", status: "active" })
    setShowForm(false)
    setEditingCard(null)
  }

  const startEdit = (card: CardType) => {
    setEditingCard(card)
    setFormData({
      key: card.key,
      display_name: card.display_name,
      terms_url: card.terms_url,
      status: card.status
    })
    setShowForm(true)
  }

  useEffect(() => {
    fetchCards()
  }, [])

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Card Management</h2>
        <Button onClick={() => setShowForm(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCard ? "Edit Card" : "Add New Card"}</CardTitle>
            <CardDescription>
              {editingCard ? "Update card information" : "Create a new card reference"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., ChaseSapphirePreferred"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                placeholder="e.g., Chase Sapphire Preferred"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="terms_url">Terms URL</Label>
              <Input
                id="terms_url"
                type="url"
                placeholder="https://chase.com/terms/sapphire-preferred"
                value={formData.terms_url}
                onChange={(e) => setFormData({ ...formData, terms_url: e.target.value })}
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
              <Button onClick={editingCard ? () => updateCard(editingCard.id, formData) : createCard}>
                {editingCard ? "Update" : "Create"} Card
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards List */}
      <div className="grid gap-4">
        {cards.map((card) => (
          <Card key={card.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">{card.display_name}</h3>
                <p className="text-sm text-gray-600">Key: {card.key}</p>
                <p className="text-sm text-gray-600">URL: {card.terms_url}</p>
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  card.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {card.status}
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(card)}
                >
                  {card.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(card)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteCard(card.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {cards.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No cards found. Create your first card to get started.</p>
        </div>
      )}
    </div>
  )
}