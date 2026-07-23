import { Wrench, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface ServicoItem {
  titulo: string
  descricao: string
}

interface DepartamentoServicos {
  departamento: string
  servicos: ServicoItem[]
}

// TODO: Replace with real API integration
// const API_URL = 'https://api.viasudeste.com.br/servicos'
// const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const SERVICOS_POR_DEPARTAMENTO: DepartamentoServicos[] = [
  {
    departamento: 'Recursos Humanos',
    servicos: [
      {
        titulo: 'Solicitação de Férias',
        descricao: 'Programe suas férias e acompanhe o status da solicitação.',
      },
      { titulo: 'Holerite', descricao: 'Emissão e consulta de holerites mensais.' },
      {
        titulo: 'Alteração de Dados Cadastrais',
        descricao: 'Atualize seus dados pessoais e de contato.',
      },
    ],
  },
  {
    departamento: 'Financeiro',
    servicos: [
      {
        titulo: 'Reembolso de Despesas',
        descricao: 'Solicite reembolso de despesas realizadas a trabalho.',
      },
      {
        titulo: 'Adiantamento Salarial',
        descricao: 'Solicite adiantamento de salário conforme política interna.',
      },
    ],
  },
  {
    departamento: 'Operações',
    servicos: [
      { titulo: 'Troca de Rota', descricao: 'Solicite alteração de rota ou linha de operação.' },
      { titulo: 'Escala de Trabalho', descricao: 'Consulte e solicite alterações na sua escala.' },
    ],
  },
  {
    departamento: 'Manutenção',
    servicos: [
      { titulo: 'Manutenção Preventiva', descricao: 'Solicite manutenção preventiva de veículos.' },
      {
        titulo: 'Manutenção Corretiva',
        descricao: 'Reporte e solicite correção de falhas em veículos.',
      },
    ],
  },
  {
    departamento: 'TI',
    servicos: [
      { titulo: 'Suporte Técnico', descricao: 'Solicite suporte para sistemas e equipamentos.' },
      { titulo: 'Solicitação de Acesso', descricao: 'Solicite acesso a sistemas e plataformas.' },
    ],
  },
]

export default function Servicos() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wrench className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Serviços</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Serviços disponíveis por departamento.</p>
        </div>
      </div>

      {SERVICOS_POR_DEPARTAMENTO.map((dep) => (
        <div key={dep.departamento}>
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            {dep.departamento}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dep.servicos.map((servico) => (
              <Card
                key={servico.titulo}
                className="border-slate-200 hover:border-primary/40 hover:shadow-elevation transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-5">
                  <h3 className="font-semibold text-slate-900 mb-1">{servico.titulo}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{servico.descricao}</p>
                  <div className="flex items-center gap-1 text-primary text-sm font-medium mt-3 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    Acessar <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
