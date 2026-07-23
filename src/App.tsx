import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Authenticated Routes wrapped in Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/telemetria" element={<Placeholder title="Telemetria" />} />
          <Route path="/recibos" element={<Placeholder title="Recibos" />} />
          <Route path="/solicitacoes" element={<Placeholder title="Solicitações" />} />
          <Route path="/agendamentos" element={<Placeholder title="Agendamentos" />} />
          <Route path="/servicos" element={<Placeholder title="Serviços" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
