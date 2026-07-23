import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Bus, UserCheck, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { cn, maskCpf } from '@/lib/utils'
import { verificarIdentidade, redefinirSenha } from '@/services/esqueci-senha'

export default function EsqueciSenha() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'verificacao' | 'senha'>('verificacao')
  const [cpf, setCpf] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const exists = await verificarIdentidade(cpf, nomeCompleto)
      if (exists) {
        setStep('senha')
      } else {
        setError('Informações não conferem')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar identidade')
    }
    setIsLoading(false)
  }

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (novaSenha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    try {
      await redefinirSenha(cpf, nomeCompleto, novaSenha)
      navigate('/?reset=success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f5132] to-[#06422b] p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lines-es" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M0 100 L100 0 M0 0 L100 100" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lines-es)" />
        </svg>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-[0_0_30px_rgba(22,163,74,0.25)] z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
            {step === 'verificacao' ? (
              <UserCheck className="w-8 h-8" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {step === 'verificacao' ? 'Recuperar Senha' : 'Nova Senha'}
          </h1>
          <p className="text-green-100/80">
            {step === 'verificacao'
              ? 'Verifique sua identidade'
              : 'Defina sua nova senha de acesso'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
            {error}
          </div>
        )}

        {step === 'verificacao' ? (
          <form onSubmit={handleVerificar} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">CPF</label>
              <Input
                required
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="Digite seu CPF"
                className="bg-white/90 border-0 focus-visible:ring-primary h-12 text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Nome Completo</label>
              <Input
                required
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Digite seu nome completo"
                className="bg-white/90 border-0 focus-visible:ring-primary h-12 text-slate-900"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-12 text-lg font-semibold bg-primary hover:bg-green-700 transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]',
              )}
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verificar'}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-green-100 hover:text-white hover:underline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRedefinir} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Nova Senha</label>
              <div className="relative">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Confirmar Nova Senha</label>
              <div className="relative">
                <Input
                  required
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="bg-white/90 border-0 focus-visible:ring-primary h-12 pr-10 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Salvar nova senha'}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-green-100 hover:text-white hover:underline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
