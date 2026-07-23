import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all duration-300">
        <Header onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
