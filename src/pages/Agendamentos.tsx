import { CalendarClock } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { AgendamentosForm } from '@/components/agendamentos/AgendamentosForm'
import { AgendamentosList } from '@/components/agendamentos/AgendamentosList'

export default function Agendamentos() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'novo'

  if (!user?.id) return null

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', value)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarClock className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Agendamentos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Solicite e acompanhe seus agendamentos.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger
            value="novo"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Novo Agendamento
          </TabsTrigger>
          <TabsTrigger
            value="meus"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Meus Agendamentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="novo" className="mt-6">
          <AgendamentosForm userId={user.id} />
        </TabsContent>
        <TabsContent value="meus" className="mt-6">
          <AgendamentosList userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
