"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle } from "lucide-react"
import { signIn } from "@/lib/auth-client"

interface LandingPageProps {
  onGetStarted?: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [loading, setLoading] = useState(false)

  const handleGetStarted = async () => {
    if (onGetStarted) {
      onGetStarted()
      return
    }

    setLoading(true)
    try {
      await signIn.social({
        provider: "google"
      })
    } catch (error) {
      console.error("Google sign-in error:", error)
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    try {
      await signIn.social({
        provider: "google"
      })
    } catch (error) {
      console.error("Google sign-in error:", error)
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen bg-white" 
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)`,
        backgroundSize: '20px 20px'
      }}
    >
      {/* Header */}
      <header className="pt-4 px-6">
        <div className="max-w-7xl mx-auto">
          <nav className="bg-white rounded-2xl border border-gray-200 shadow-lg px-6 py-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg shadow-sm">
                IL
              </div>
              <span className="text-2xl text-gray-900 font-medium">Interlink</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm">How it works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm">Pricing</a>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={handleLogin}
                disabled={loading}
              >
                Login
              </Button>
              <Button 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700 text-white" 
                onClick={handleGetStarted}
                disabled={loading}
              >
                {loading ? "Loading..." : "Start for free"}
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl mb-6 text-black leading-tight font-bold">
              The Simplest Way to Keep{" "}
              <span className="text-black">Card References Compliant</span>
            </h1>
            
            <p className="text-gray-600 text-xl max-w-3xl mx-auto leading-relaxed">
              Stop manually updating card names, terms, or links. Interlink keeps your content compliant — automatically.
            </p>
          </div>

          {/* Demo Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-sm text-gray-600">📝</span>
              </div>
              <span className="text-sm text-gray-500">Your Blog Post</span>
            </div>
            
            <h3 className="text-2xl mb-4 text-gray-900">
              Best Travel Credit Cards for 2024
            </h3>
            
            <div className="space-y-4 text-gray-700">
              <p>
                For premium travel rewards, the{" "}
                <span className="line-through text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {'{{card:531}}'}
                </span>
                {" "}
                <span className="inline-flex items-center mx-2">
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                  <a href="#" className="hover:underline">Citizens Credit Card (terms)</a>
                </span>
                {" "}offers exceptional value with transfer partners and travel protections.
              </p>
              
              <p className="text-sm text-gray-500 italic">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Content automatically updated based on issuer changes
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}