import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { HomeDashboard } from "@/components/dashboard/home-dashboard"

export default function DashboardPage() {
  return (
    <SidebarLayout>
      <HomeDashboard />
    </SidebarLayout>
  )
}