import { Menu, Bell, Bus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900">Via Sudeste</span>
        </div>
        <p className="hidden md:block text-sm text-slate-500">Portal do Colaborador</p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </Button>
        <div className="flex items-center gap-2.5">
          <Avatar className="w-9 h-9">
            <AvatarImage src="https://img.usecurling.com/ppl/thumbnail?gender=male&seed=joao" />
            <AvatarFallback>JS</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-none">João Silva</p>
            <p className="text-xs text-slate-500 mt-0.5">Colaborador</p>
          </div>
        </div>
      </div>
    </header>
  )
}
