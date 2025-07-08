import { SidebarLayout } from "@/components/dashboard/sidebar-layout"
import { WebflowSettingsPanel } from "@/components/webflow"

export default function WebflowSettingsPage() {
  return (
    <SidebarLayout>
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl mb-2">Webflow Settings</h1>
          <p className="text-gray-600">
            Manage your Webflow integration and content synchronization settings.
          </p>
        </div>
        
        <WebflowSettingsPanel showAdvanced={true} />
      </div>
    </SidebarLayout>
  )
}