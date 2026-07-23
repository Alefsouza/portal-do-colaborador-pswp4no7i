export type DocumentoTipo =
  | 'Holerite'
  | 'Holerite Complementar'
  | 'Holerite PLR'
  | 'Ponto'
  | 'Programação de Férias'
  | 'Décimo Terceiro'
  | 'Informe de Rendimentos'

export interface DocumentoItem {
  label: string
  valor: string
}

export interface DocumentoSecao {
  titulo: string
  itens: DocumentoItem[]
}

export interface DocumentoData {
  tipo: string
  mes: number
  ano: number
  colaborador: {
    nome: string
    cpf: string
    departamento: string
    registro: string
  }
  secoes: DocumentoSecao[]
  dataEmissao: string
  totalLabel?: string
  totalValor?: string
}

export const TIPOS_DOCUMENTO: DocumentoTipo[] = [
  'Holerite',
  'Holerite Complementar',
  'Holerite PLR',
  'Ponto',
  'Programação de Férias',
  'Décimo Terceiro',
  'Informe de Rendimentos',
]

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function buildSecoes(
  tipo: string,
  mes: number,
  ano: number,
): {
  secoes: DocumentoSecao[]
  totalLabel: string
  totalValor: string
} {
  let secoes: DocumentoSecao[] = []
  let totalLabel = ''
  let totalValor = ''
  const mm = String(mes).padStart(2, '0')

  switch (tipo) {
    case 'Holerite': {
      secoes = [
        {
          titulo: 'Vencimentos',
          itens: [
            { label: 'Salário Base', valor: formatBRL(4500) },
            { label: 'Vale Transporte', valor: formatBRL(350) },
            { label: 'Vale Refeição', valor: formatBRL(500) },
          ],
        },
        {
          titulo: 'Descontos',
          itens: [
            { label: 'INSS', valor: formatBRL(495) },
            { label: 'IRRF', valor: formatBRL(267.5) },
            { label: 'FGTS', valor: formatBRL(360) },
          ],
        },
      ]
      totalLabel = 'Salário Líquido'
      totalValor = formatBRL(3227.5)
      break
    }
    case 'Holerite Complementar': {
      secoes = [
        {
          titulo: 'Vencimentos',
          itens: [
            { label: 'Salário Base', valor: formatBRL(4500) },
            { label: 'Horas Extras (10h)', valor: formatBRL(272.7) },
            { label: 'Adicional Noturno', valor: formatBRL(180) },
          ],
        },
        {
          titulo: 'Descontos',
          itens: [
            { label: 'INSS', valor: formatBRL(510) },
            { label: 'IRRF', valor: formatBRL(290) },
          ],
        },
      ]
      totalLabel = 'Líquido Complementar'
      totalValor = formatBRL(4152.7)
      break
    }
    case 'Holerite PLR': {
      secoes = [
        {
          titulo: 'Participação nos Lucros',
          itens: [
            { label: 'Valor Base PLR', valor: formatBRL(3000) },
            { label: 'Performance Individual', valor: formatBRL(500) },
            { label: 'Performance Empresa', valor: formatBRL(300) },
          ],
        },
        { titulo: 'Descontos', itens: [{ label: 'IR Retido', valor: formatBRL(266.25) }] },
      ]
      totalLabel = 'PLR Líquido'
      totalValor = formatBRL(3533.75)
      break
    }
    case 'Ponto': {
      secoes = [
        {
          titulo: 'Controle de Ponto',
          itens: [
            { label: 'Horas Trabalhadas', valor: '176h' },
            { label: 'Horas Esperadas', valor: '168h' },
            { label: 'Horas Extras', valor: '+8h' },
          ],
        },
        {
          titulo: 'Ocorrências',
          itens: [
            { label: 'Banco de Horas', valor: '+8h' },
            { label: 'Faltas', valor: '0' },
            { label: 'Atrasos', valor: '2 (15 min)' },
          ],
        },
      ]
      totalLabel = 'Saldo de Horas'
      totalValor = '+8h'
      break
    }
    case 'Programação de Férias': {
      secoes = [
        {
          titulo: 'Período de Férias',
          itens: [
            { label: 'Início', valor: `01/${mm}/${ano}` },
            { label: 'Fim', valor: `30/${mm}/${ano}` },
            { label: 'Dias de Descanso', valor: '30 dias' },
            { label: 'Abono Pecuniário', valor: '10 dias' },
          ],
        },
        {
          titulo: 'Valores',
          itens: [
            { label: 'Valor Férias', valor: formatBRL(4500) },
            { label: '1/3 Constitucional', valor: formatBRL(1500) },
            { label: '1ª Parcela 13º', valor: formatBRL(2250) },
          ],
        },
      ]
      totalLabel = 'Total a Receber'
      totalValor = formatBRL(8250)
      break
    }
    case 'Décimo Terceiro': {
      secoes = [
        {
          titulo: 'Décimo Terceiro Salário',
          itens: [
            { label: '1ª Parcela', valor: formatBRL(2250) },
            { label: '2ª Parcela', valor: formatBRL(2250) },
            { label: 'Valor Total Bruto', valor: formatBRL(4500) },
          ],
        },
        {
          titulo: 'Descontos',
          itens: [
            { label: 'INSS', valor: formatBRL(495) },
            { label: 'IRRF', valor: formatBRL(267.5) },
          ],
        },
      ]
      totalLabel = 'Líquido a Receber'
      totalValor = formatBRL(3737.5)
      break
    }
    case 'Informe de Rendimentos': {
      secoes = [
        {
          titulo: `Rendimentos Anuais ${ano}`,
          itens: [
            { label: 'Rendimentos Tributáveis', valor: formatBRL(54000) },
            { label: 'Rendimentos Isentos', valor: formatBRL(10200) },
            { label: '13º Salário', valor: formatBRL(4500) },
          ],
        },
        {
          titulo: 'Contribuições e Impostos',
          itens: [
            { label: 'Contribuição INSS', valor: formatBRL(5940) },
            { label: 'IRRF Retido', valor: formatBRL(3210) },
          ],
        },
      ]
      totalLabel = 'Rendimento Líquido'
      totalValor = formatBRL(50550)
      break
    }
  }

  return { secoes, totalLabel, totalValor }
}

export async function getDocumento(
  tipo: string,
  mes: number,
  ano: number,
  colaboradorId: string,
): Promise<DocumentoData> {
  // TODO: Replace mock with real PocketBase call once the backend views are ready.
  // Example:
  //   return await pb.collection('recibos').getFirstListItem(
  //     `tipo = "${tipo}" && mes = ${mes} && ano = ${ano} && id_usuario = "${colaboradorId}"`,
  //   )
  await new Promise((r) => setTimeout(r, 800))
  const { secoes, totalLabel, totalValor } = buildSecoes(tipo, mes, ano)
  return {
    tipo,
    mes,
    ano,
    colaborador: {
      nome: 'Carlos Silva',
      cpf: '123.456.789-00',
      departamento: 'Operações',
      registro: 'REG-00123',
    },
    secoes,
    dataEmissao: new Date().toLocaleDateString('pt-BR'),
    totalLabel,
    totalValor,
  }
}
