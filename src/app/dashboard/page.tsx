import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { LinkManager } from "@/components/dashboard/link-manager"

export default function DashboardPage() {
  return (
    <SidebarLayout>
      <div className="px-4 sm:px-0">
        <LinkManager />
      </div>
    </SidebarLayout>
  )
}