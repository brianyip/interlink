"use client"

import { useRouter, usePathname } from "next/navigation"
import {
  Link,
  Home,
  MessageSquare,
  Settings,
  LucideIcon,
} from "lucide-react"
import { WebflowStatus } from "@/components/webflow"

interface NavigationItem {
  id: string
  label: string
  icon: LucideIcon
  route: string
}

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  const navigationItems = [
    { id: "home", label: "Home", icon: Home, route: "/dashboard" },
    { id: "links", label: "Links", icon: Link, route: "/links" },
    { id: "content-chat", label: "Content Chat", icon: MessageSquare, route: "/content-chat" },
    { id: "settings", label: "Settings", icon: Settings, route: "/settings/webflow" },
  ]


  const NavItem = ({
    item,
  }: {
    item: NavigationItem
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

        {/* Webflow Connection Status */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="px-3 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Integrations
          </h3>
          <WebflowStatus compact={true} showActions={false} />
        </div>
      </nav>
    </div>
  )
}