import { useState, useEffect, useRef, type ElementType } from 'react'
import {
  ArrowLeft,
  Search,
  MapPin,
  Loader2,
  AlertCircle,
  Bus,
  Route,
  Clock,
  Accessibility,
  Navigation,
  Warehouse,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { fetchVehiclePosition, type VehiclePosition } from '@/lib/olho-vivo'
import { formatBrazilianDateTime } from '@/lib/utils'

interface BuscarVeiculoViewProps {
  onBack: () => void
}

declare global {
  interface Window {
    L: typeof import('leaflet')
  }
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 text-green-600 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-slate-800 font-semibold">{value}</p>
      </div>
    </div>
  )
}

export function BuscarVeiculoView({ onBack }: BuscarVeiculoViewProps) {
  const [prefixo, setPrefixo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<VehiclePosition | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<ReturnType<Window['L']['map']> | null>(null)

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!position || !mapRef.current || !window.L) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const L = window.L
    const map = L.map(mapRef.current).setView([position.latitude, position.longitude], 16)
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([position.latitude, position.longitude]).addTo(map)
    marker.bindPopup(`<strong>Veículo ${position.prefixo}</strong>`).openPopup()

    setTimeout(() => map.invalidateSize(), 100)
  }, [position])

  const handleSearch = async () => {
    if (!prefixo.trim()) return
    setLoading(true)
    setError(null)
    setPosition(null)
    try {
      const pos = await fetchVehiclePosition(prefixo.trim())
      setPosition(pos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar veículo')
    } finally {
      setLoading(false)
    }
  }

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
        <h2 className="text-xl font-bold text-slate-900">Buscar Veículo</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Localize um veículo da frota pelo prefixo, em circulação ou na garagem.
        </p>
      </div>
      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prefixo">Prefixo do Veículo</Label>
            <div className="flex gap-3">
              <Input
                id="prefixo"
                placeholder="Ex: 12345"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !prefixo.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-1" />
                )}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          <span className="ml-2 text-slate-500">Buscando veículo...</span>
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 font-medium">{error}</p>
          </CardContent>
        </Card>
      )}

      {position && (
        <>
          <Card className="border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Veículo localizado</span>
                </div>
                <Badge
                  className={
                    position.status === 'circulacao'
                      ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                      : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }
                >
                  {position.status === 'circulacao' ? (
                    <>
                      <Navigation className="w-3 h-3 mr-1" /> Em Circulação
                    </>
                  ) : (
                    <>
                      <Warehouse className="w-3 h-3 mr-1" /> Na Garagem
                    </>
                  )}
                </Badge>
              </div>
              <div ref={mapRef} className="w-full h-[400px]" />
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Detalhes do Veículo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem icon={Bus} label="Prefixo" value={position.prefixo} />
                <DetailItem icon={Route} label="Linha/Letreiro" value={position.letreiro} />
                <DetailItem
                  icon={MapPin}
                  label="Sentido"
                  value={position.sentido === 1 ? 'Ida' : position.sentido === 2 ? 'Volta' : '—'}
                />
                <DetailItem
                  icon={Clock}
                  label="Horário da localização"
                  value={formatBrazilianDateTime(position.horario)}
                />
                <DetailItem
                  icon={Accessibility}
                  label="Acessível"
                  value={position.acessivel ? 'Sim' : 'Não'}
                />
                <DetailItem
                  icon={position.status === 'circulacao' ? Navigation : Warehouse}
                  label="Status"
                  value={position.status === 'circulacao' ? 'Em Circulação' : 'Na Garagem'}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
