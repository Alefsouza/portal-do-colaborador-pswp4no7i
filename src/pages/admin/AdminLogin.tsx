import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Bus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { cn } from '@/lib/utils'

export default function AdminLogin() {
  const { isAuthenticated, login } = useAdminAuth()
  const navigate = useNavigate()
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await login(cpf, password)
    setIsLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-[#0f5132] to-[#06422b]">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="admin-lines" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M0 100 L100 0 M0 0 L100 100" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#admin-lines)" />
        </svg>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-[0_0_30px_rgba(22,163,74,0.25)]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Bus className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Área Administrativa</h1>
            <p className="text-green-100/80">Via Sudeste — Portal do Colaborador</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">CPF</label>
              <Input
                required
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Digite seu CPF"
                className="bg-white/90 border-0 focus-visible:ring-primary h-12 text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Senha</label>
              <div className="relative">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="bg-white/90 border-0 focus-visible:ring-primary h-12 pr-10 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-12 text-lg font-semibold bg-primary hover:bg-green-700 transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]',
              )}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Entrar
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 z-10">
        <div className="w-full max-w-lg aspect-square relative opacity-90">
          <svg
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-primary drop-shadow-2xl"
          >
            <path
              fill="currentColor"
              d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.1,-2.4C97.4,13.2,92.1,29,82.8,42C73.4,55,60.1,65.2,46.1,73.1C32.1,81,17.5,86.6,2.2,83.1C-13.1,79.5,-27.7,66.8,-41.8,55.9C-55.9,45,-69.5,35.9,-78.2,23.3C-86.9,10.7,-90.7,-5.4,-87.3,-20.1C-83.9,-34.8,-73.4,-48.1,-60.5,-55.8C-47.6,-63.5,-32.4,-65.6,-18.6,-68.9C-4.8,-72.2,7.7,-76.7,21.5,-80C35.3,-83.3,50.4,-85.4,44.7,-76.4Z"
              transform="translate(100 100)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <ShieldCheck className="w-24 h-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
