import { useState } from 'react'
import { Wrench, CalendarClock, Bus, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { EscalaView } from '@/components/servicos/EscalaView'
import { BuscarVeiculoView } from '@/components/servicos/BuscarVeiculoView'

type View = 'cards' | 'escala' | 'buscar-veiculo'

export default function Servicos() {
  const { user } = useAuth()
  const [view, setView] = useState<View>('cards')

  if (view === 'escala') {
    return (
      <EscalaView userName={user?.nome_completo || 'Colaborador'} onBack={() => setView('cards')} />
    )
  }

  if (view === 'buscar-veiculo') {
    return <BuscarVeiculoView onBack={() => setView('cards')} />
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wrench className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Serviços</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Escolha um serviço para começar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className="cursor-pointer border-slate-200 hover:border-green-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          onClick={() => setView('escala')}
        >
          <CardContent className="p-8 flex flex-col items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center">
              <CalendarClock className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Escala</h3>
            <p className="text-sm text-slate-500">Ver seus próximos dias de trabalho</p>
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium mt-2">
              Acessar <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-slate-200 hover:border-green-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          onClick={() => setView('buscar-veiculo')}
        >
          <CardContent className="p-8 flex flex-col items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center">
              <Bus className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Buscar Veículo</h3>
            <p className="text-sm text-slate-500">Localizar um veículo pela frota</p>
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium mt-2">
              Acessar <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
