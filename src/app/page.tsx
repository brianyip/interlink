"use client"

import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { CTA } from "@/components/ui/call-to-action"

export default function Home() {
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  // Show landing page if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-white">
        <CTA />
      </div>
    )
  }

  // Show loading if authenticated (while redirecting)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  )
}
