import { useState, type ElementType } from 'react'
import {
  CalendarDays,
  Clock,
  Route,
  Bus,
  Hash,
  Loader2,
  AlertCircle,
  MapPin,
  MapPinned,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchEscala, type EscalaItem } from '@/services/escala'

interface EscalaViewProps {
  userName: string
  onBack: () => void
}

interface DateCard {
  dateStr: string
  weekday: string
  dayMonth: string
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ElementType
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg bg-white/60 p-3 transition-colors hover:bg-white',
        className,
      )}
    >
      <Icon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-slate-800 font-semibold truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function generateDateCards(): DateCard[] {
  const weekdays = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ]
  const result: DateCard[] = []
  const today = new Date()
  for (let i = 0; i < 4; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = String(date.getFullYear())
    result.push({
      dateStr: `${dd}-${mm}-${yyyy}`,
      weekday: weekdays[date.getDay()],
      dayMonth: `${dd}/${mm}`,
    })
  }
  return result
}

export function EscalaView({ userName }: EscalaViewProps) {
  const [items, setItems] = useState<EscalaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const dateCards = generateDateCards()

  const handleCardClick = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setLoading(true)
    setError(null)
    setItems([])
    try {
      const data = await fetchEscala(dateStr)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar escala')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Escala</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Olá, {userName}. Selecione um dia para ver sua escala.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-green-600" />
          Próximos dias
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dateCards.map((card) => {
            const isSelected = selectedDate === card.dateStr
            return (
              <Card
                key={card.dateStr}
                onClick={() => handleCardClick(card.dateStr)}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-500/20'
                    : 'border-slate-200 hover:border-green-400',
                )}
              >
                <CardContent className="p-4 flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      'text-xs font-medium uppercase tracking-wide',
                      isSelected ? 'text-green-700' : 'text-green-600',
                    )}
                  >
                    {card.weekday}
                  </span>
                  <span
                    className={cn(
                      'text-base font-bold',
                      isSelected ? 'text-green-800' : 'text-slate-900',
                    )}
                  >
                    {card.dayMonth}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="space-y-4 animate-fade-in-up">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              <span className="text-slate-500 text-sm">Carregando escala...</span>
            </div>
          )}

          {error && !loading && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-700 font-medium">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-red-300 text-red-600 hover:bg-red-100"
                    onClick={() => handleCardClick(selectedDate)}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && items.length === 0 && (
            <Card className="border-slate-200">
              <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
                <CalendarDays className="w-10 h-10 text-slate-300" />
                <p className="text-slate-500 font-medium">
                  Nenhuma escala encontrada. <br />
                  Verifique novamente mais tarde.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-4">
              {items.map((item, idx) => (
                <Card
                  key={idx}
                  className="border-green-200 bg-gradient-to-br from-green-50/60 to-white overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-6 py-3 bg-green-600/5 border-b border-green-100">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">
                        Escala {idx + 1} de {items.length}
                      </span>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-2 md:gap-3">
                      <DetailItem icon={CalendarDays} label="Data" value={item.data} />
                      <DetailItem icon={Bus} label="Veículo" value={item.veiculo} />
                      <DetailItem icon={Route} label="Linha" value={item.linha} />
                      <DetailItem icon={Hash} label="Tabela" value={item.tabela} />
                      <DetailItem icon={Clock} label="Início" value={item.inicio} />
                      <DetailItem icon={Clock} label="Fim" value={item.fim} />
                      <DetailItem
                        icon={MapPinned}
                        label="Pegada"
                        value={item.pegada}
                        className="col-span-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
