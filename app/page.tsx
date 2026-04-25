"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { SolarLogo } from "@/components/solar-logo"
import { Users, FileText, Shield, Zap, ArrowRight, CheckCircle, Menu } from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default function HomePage() {
  const { isAuthenticated, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      if (role === "account-management") {
        router.push("/dashboard/account-management")
      } else if (role === "hr") {
        router.push("/dashboard/hr")
      } else if (role === "installer") {
        router.push("/dashboard/installer")
      } else if (role === "metering") {
        router.push("/dashboard/metering")
      } else if (role === "baldev") {
        router.push("/dashboard/baldev")
      } else if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else if (role === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard")
      }
    }
  }, [isAuthenticated, role, router])

  const loginLinks = [
    { label: "Login", path: "/login" },
    { label: "Account Mgmt Login", path: "/account-management-login" },
    { label: "Visitor Login", path: "/visitor-login" },
    { label: "HR Login", path: "/hr-login" },
    { label: "Installer Login", path: "/installer-login" },
    { label: "Metering Login", path: "/metering-login" },
    { label: "Baldev Login", path: "/baldev-login" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <SolarLogo size="md" />
          <div className="hidden md:flex items-center gap-3">
            {loginLinks.map((item) => (
              <Button key={item.path} variant="ghost" onClick={() => router.push(item.path)}>
                {item.label}
              </Button>
            ))}
            <Button onClick={() => router.push("/register")} className="shadow-lg shadow-primary/25">
              Register
            </Button>
          </div>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>Select login type or create account.</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4 space-y-2">
                  {loginLinks.map((item) => (
                    <SheetClose asChild key={item.path}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => router.push(item.path)}
                      >
                        {item.label}
                      </Button>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Button
                      className="w-full mt-2 shadow-lg shadow-primary/25"
                      onClick={() => router.push("/register")}
                    >
                      Register
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="container mx-auto px-4 py-10 sm:py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Streamline Your Solar Business
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 text-balance leading-tight">
              Professional Solar
              <span className="text-primary"> Quotation System</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 text-pretty max-w-2xl mx-auto">
              Generate accurate quotes for DCR, Non-DCR, and Hybrid systems. Manage customers, calculate subsidies, and
              download professional quotations instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button size="lg" onClick={() => router.push("/register")} className="shadow-lg shadow-primary/25 gap-2">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/login")}>
                Dealer Login
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                DCR Compliant
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Subsidy Calculator
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                PDF Export
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-12 sm:py-16 border-t border-border">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Everything You Need</h2>
            <p className="text-muted-foreground">Powerful tools to manage your solar business efficiently</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Customer Management</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Track and manage all your customers in one place with detailed profiles and quotation history.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Quick Quotations</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Generate professional quotations with DCR, Non-DCR, Hybrid, and fully customizable configurations.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Subsidy Calculation</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automatic central and state subsidy calculations for DCR compliant solar installations.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl p-8 md:p-12 text-center border border-primary/20">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Ready to Grow Your Solar Business?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Join dealers who are already using SolarQuote to streamline their quotation process.
            </p>
            <Button size="lg" onClick={() => router.push("/register")} className="shadow-lg shadow-primary/25">
              Start Creating Quotations
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} SolarQuote. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
