import { useState } from 'react'
import { ArrowLeft, Search, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchVehiclePosition, type VehiclePosition } from '@/lib/olho-vivo'

interface BuscarVeiculoViewProps {
  onBack: () => void
}

export function BuscarVeiculoView({ onBack }: BuscarVeiculoViewProps) {
  const [prefixo, setPrefixo] = useState('')
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState<VehiclePosition | null>(null)

  const handleSearch = async () => {
    if (!prefixo.trim()) return
    setLoading(true)
    try {
      const pos = await fetchVehiclePosition(prefixo.trim())
      setPosition(pos)
    } finally {
      setLoading(false)
    }
  }

  const delta = 0.01
  const bbox = position
    ? `${position.lng - delta},${position.lat - delta},${position.lng + delta},${position.lat + delta}`
    : ''
  const mapUrl = position
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${position.lat},${position.lng}`
    : ''

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
        <p className="text-sm text-slate-500 mt-0.5">Localize um veículo da frota pelo prefixo.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prefixo">Prefixo do Veículo</Label>
            <div className="flex gap-3">
              <Input
                id="prefixo"
                placeholder="Ex: AB123"
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
                <Search className="w-4 h-4 mr-1" />
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {position && (
        <Card className="border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border-b border-green-100">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Veículo localizado: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
              </span>
            </div>
            <iframe
              title="Mapa do veículo"
              src={mapUrl}
              className="w-full h-[400px] border-0"
              loading="lazy"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
