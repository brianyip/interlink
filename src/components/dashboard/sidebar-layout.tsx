"use client"

import { useEffect } from "react"
import { useSession, signOut } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/ui/sidebar"
import { useRouter } from "next/navigation"

interface SidebarLayoutProps {
  children: React.ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      // Better Auth handles the redirect automatically
    } catch (error) {
      console.error("Sign out failed:", error)
      // Fallback redirect on error
      router.push("/login")
    }
  }

  // Handle authentication redirect safely after render
  useEffect(() => {
    if (!session) {
      router.push("/login")
    }
  }, [session, router])

  // Show loading state while checking session
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-end items-center">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}