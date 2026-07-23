import { ClipboardList } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { SolicitacoesForm } from '@/components/solicitacoes/SolicitacoesForm'
import { SolicitacoesList } from '@/components/solicitacoes/SolicitacoesList'

export default function Solicitacoes() {
  const { user } = useAuth()

  if (!user?.id) return null

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Solicitações</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Crie e acompanhe suas solicitações.</p>
        </div>
      </div>

      <Tabs defaultValue="nova" className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger
            value="nova"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Nova Solicitação
          </TabsTrigger>
          <TabsTrigger
            value="minhas"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Minhas Solicitações
          </TabsTrigger>
        </TabsList>
        <TabsContent value="nova" className="mt-6">
          <SolicitacoesForm userId={user.id} />
        </TabsContent>
        <TabsContent value="minhas" className="mt-6">
          <SolicitacoesList userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
