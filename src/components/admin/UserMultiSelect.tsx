import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { UsuarioSelect } from '@/services/admin-usuarios'

interface Props {
  users: UsuarioSelect[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function UserMultiSelect({ users, selected, onChange }: Props) {
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filtered = users.filter(
    (u) =>
      u.nome_completo.toLowerCase().includes(q) ||
      u.cpf.includes(search) ||
      u.registro.includes(search),
  )
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar por nome, CPF ou registro..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {filtered.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50"
          >
            <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{u.nome_completo}</p>
              <p className="text-xs text-slate-500">
                {u.cpf} • Reg: {u.registro}
              </p>
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-slate-400">Nenhum usuário encontrado.</p>
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-sm text-slate-500">{selected.length} selecionado(s)</p>
      )}
    </div>
  )
}
