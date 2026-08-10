import { Eye, Target, Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const sections = [
  {
    title: 'Visão',
    icon: Eye,
    content: [
      'Buscar excelência em transporte de passageiros, com inovação e melhoria contínua, ampliando o mercado de atuação respeitando o meio ambiente.',
    ],
  },
  {
    title: 'Missão',
    icon: Target,
    content: [
      'Oferecer um serviço de transporte coletivo de passageiros seguro e pontual;',
      'Atuar com produtividade e remuneração do capital investido;',
      'Gerar oportunidades para crescimento profissional dos colaboradores, respeitar o meio ambiente e a sociedade prevenindo a poluição através do gerenciamento dos resíduos da organização;',
      'Monitoramento das emissões atmosféricas, economia de recursos naturais e cumprimento dos requisitos legais aplicáveis e outros requisitos; Comprometimento com a segurança viária, através da capacitação de seus condutores e correta manutenção preventiva dos seus veículos com foco em zerar incidentes e sinistros com vítimas ou lesões graves, de sua responsabilidade.',
    ],
  },
  {
    title: 'Valores',
    icon: Heart,
    content: [
      'Atuação com base em valores como:',
      'Comprometimento, Criatividade, Honestidade, Humildade e União.',
    ],
  },
]

export function PoliticaPrivacidade() {
  return (
    <div className="mt-10 animate-fade-in-up">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">Política de Privacidade</h2>
      <div className="flex flex-col gap-4 md:gap-6">
        {sections.map((section) => (
          <Card
            key={section.title}
            className="group border-slate-200 hover:border-primary/40 hover:shadow-elevation hover:-translate-y-1 transition-all duration-300"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900">{section.title}</h3>
              </div>
              <div className="space-y-2">
                {section.content.map((line, idx) => (
                  <p key={idx} className="text-sm text-slate-600 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
