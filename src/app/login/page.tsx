"use client"

import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { useEffect } from "react"

export default function LoginPage() {
  const router = useRouter()
  const { data: session } = useSession()

  useEffect(() => {
    // Always redirect to home page since we only use Google OAuth
    router.push("/")
  }, [router])

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  return null
}