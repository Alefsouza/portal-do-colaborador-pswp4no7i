import { useState } from 'react'
import { ArrowLeft, CalendarDays, Clock, Route } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EscalaViewProps {
  userName: string
  onBack: () => void
}

// Placeholder schedule data — replace with a real database view fetch:
//   SELECT * FROM escala_view WHERE usuario_id = ? AND data = ?
const MOCK_ESCALA = {
  horario: '07:00 – 15:00',
  linha: '1234-10 (Terminal A – Bairro B)',
}

interface DayInfo {
  label: string
  date: Date
}

function buildDays(): DayInfo[] {
  const today = new Date()
  return Array.from({ length: 4 }, (_, i) => {
    const date = addDays(today, i)
    return {
      label: format(date, 'EEE dd/MM', { locale: ptBR }),
      date,
    }
  })
}

export function EscalaView({ userName, onBack }: EscalaViewProps) {
  const [selectedDay, setSelectedDay] = useState(0)
  const days = buildDays()

  return (
    <div className="space-y-6 animate-fade-in">
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-slate-600 hover:text-slate-900 -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <div>
        <h2 className="text-xl font-bold text-slate-900">Escala</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Olá, {userName}. Selecione um dia para ver sua escala.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {days.map((day, idx) => (
          <Card
            key={idx}
            onClick={() => setSelectedDay(idx)}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:-translate-y-0.5',
              selectedDay === idx
                ? 'border-green-600 ring-2 ring-green-600/20 bg-green-50/50'
                : 'border-slate-200 hover:border-green-400',
            )}
          >
            <CardContent className="p-4 flex flex-col items-center gap-1.5">
              <CalendarDays className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-slate-900 capitalize">{day.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedDay !== null && (
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CalendarDays className="w-5 h-5" />
              <h3 className="font-bold capitalize">
                Escala do dia {format(days[selectedDay].date, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    Horário
                  </p>
                  <p className="text-slate-800 font-semibold">{MOCK_ESCALA.horario}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Route className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    Linha
                  </p>
                  <p className="text-slate-800 font-semibold">{MOCK_ESCALA.linha}</p>
                </div>
              </div>
            </div>
            {/* Placeholder data — replace with fetch from database view:
                SELECT * FROM escala_view WHERE usuario_id = ? AND data = ? */}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
