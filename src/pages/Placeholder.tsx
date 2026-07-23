import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
      <Card className="max-w-md w-full border-slate-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Construction className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-500 mb-6">
            Esta seção está em desenvolvimento. Em breve, novidades por aqui.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
