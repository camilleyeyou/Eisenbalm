/**
 * Dashboard route-group shell layout.
 * Renders: <AppSidebar /> (persistent left nav) + <main> (content area).
 * All routes under (dashboard)/ are automatically wrapped in this shell.
 * Clerk middleware (middleware.ts) ensures every route here requires auth.
 */
import AppSidebar from '@/components/AppSidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
