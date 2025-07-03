import { DashboardLayout } from "@/components/dashboard/layout"
import { CardManager } from "@/components/dashboard/card-manager"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="px-4 sm:px-0">
        <CardManager />
      </div>
    </DashboardLayout>
  )
}