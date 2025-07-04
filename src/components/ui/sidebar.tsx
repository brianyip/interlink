"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Link,
  Home,
} from "lucide-react"
import { Separator } from "./separator"

interface SidebarProps {}

export function Sidebar({}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const navigationItems = [
    { id: "home", label: "Home", icon: Home, route: "/dashboard" },
    { id: "links", label: "Links", icon: Link, route: "/links" },
  ]


  const NavItem = ({
    item,
  }: {
    item: any
  }) => {
    const Icon = item.icon
    const isActive = item.route ? pathname === item.route : false

    const handleClick = () => {
      if (item.route) {
        router.push(item.route)
      }
    }

    return (
      <button
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${
          isActive
            ? "bg-gray-100 text-gray-900"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
        onMouseEnter={() => setHoveredItem(item.id)}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={handleClick}
      >
        <Icon className="w-4 h-4" />
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <div className="w-64 min-h-screen bg-white border-r border-gray-200 p-4">
      <div className="mb-8">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-6 h-6 bg-gray-900 rounded text-white flex items-center justify-center text-xs font-medium">
            IL
          </div>
          <span className="text-sm text-gray-600">Interlink</span>
        </div>
      </div>

      <nav className="space-y-6">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
            />
          ))}
        </div>

      </nav>
    </div>
  )
}