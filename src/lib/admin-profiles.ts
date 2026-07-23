const ADMIN_PROFILES = ['Administrador', 'RH', 'TI', 'Financeiro', 'Gerente']

export function isAdminProfile(perfil: string | undefined | null): boolean {
  if (!perfil) return false
  return ADMIN_PROFILES.some((p) => perfil.toLowerCase() === p.toLowerCase())
}
