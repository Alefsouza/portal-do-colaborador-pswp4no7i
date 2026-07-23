import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'

import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import Dashboard from './pages/Dashboard'
import ChangePassword from './pages/ChangePassword'
import Telemetria from './pages/Telemetria'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

function ProtectedRoute() {
  const { isAuthenticated, needsPasswordChange } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (needsPasswordChange) return <Navigate to="/trocar-senha" replace />
  return <Outlet />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/trocar-senha" element={<ChangePassword />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/telemetria" element={<Telemetria />} />
              <Route path="/recibos" element={<Placeholder title="Recibos" />} />
              <Route path="/solicitacoes" element={<Placeholder title="Solicitações" />} />
              <Route path="/agendamentos" element={<Placeholder title="Agendamentos" />} />
              <Route path="/servicos" element={<Placeholder title="Serviços" />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
