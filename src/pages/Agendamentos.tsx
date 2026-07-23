import { CalendarClock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { AgendamentosForm } from '@/components/agendamentos/AgendamentosForm'
import { AgendamentosList } from '@/components/agendamentos/AgendamentosList'

export default function Agendamentos() {
  const { user } = useAuth()

  if (!user?.id) return null

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

      <Tabs defaultValue="novo" className="w-full">
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
