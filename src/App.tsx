import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { AdminAuthProvider, useAdminAuth } from '@/hooks/use-admin-auth'

import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import Dashboard from './pages/Dashboard'
import ChangePassword from './pages/ChangePassword'
import Telemetria from './pages/Telemetria'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import Recibos from './pages/Recibos'
import Solicitacoes from './pages/Solicitacoes'
import Agendamentos from './pages/Agendamentos'
import Servicos from './pages/Servicos'
import Perfil from './pages/Perfil'
import Configuracoes from './pages/Configuracoes'

import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSolicitacoes from './pages/admin/AdminSolicitacoes'
import AdminAgendamentos from './pages/admin/AdminAgendamentos'
import AdminInformativos from './pages/admin/AdminInformativos'
import AdminPopups from './pages/admin/AdminPopups'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminTelemetriaSync from './pages/admin/AdminTelemetriaSync'

function ProtectedRoute() {
  const { isAuthenticated, needsPasswordChange } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (needsPasswordChange) return <Navigate to="/trocar-senha" replace />
  return <Outlet />
}

function AdminProtectedRoute() {
  const { isAuthenticated } = useAdminAuth()
  if (!isAuthenticated) return <Navigate to="/admin" replace />
  return <Outlet />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AdminAuthProvider>
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
                <Route path="/recibos" element={<Recibos />} />
                <Route path="/solicitacoes" element={<Solicitacoes />} />
                <Route path="/agendamentos" element={<Agendamentos />} />
                <Route path="/servicos" element={<Servicos />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
            <Route path="/admin" element={<AdminLogin />} />
            <Route element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/solicitacoes" element={<AdminSolicitacoes />} />
                <Route path="/admin/agendamentos" element={<AdminAgendamentos />} />
                <Route path="/admin/informativos" element={<AdminInformativos />} />
                <Route path="/admin/popups" element={<AdminPopups />} />
                <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                <Route path="/admin/telemetria/sincronizacao" element={<AdminTelemetriaSync />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
