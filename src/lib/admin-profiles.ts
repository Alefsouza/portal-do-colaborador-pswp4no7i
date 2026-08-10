const ADMIN_PROFILES = ['Administrador', 'DP', 'Financeiro', 'Operacional', 'RH', 'TI']

export function isAdminProfile(perfil: string | undefined | null): boolean {
  if (!perfil) return false
  return ADMIN_PROFILES.some((p) => perfil.toLowerCase() === p.toLowerCase())
}

const INFORMATIVOS_PROFILES = ['TI', 'Administrador', 'Admin']

export function canAccessInformativos(perfil: string | undefined | null): boolean {
  if (!perfil) return false
  return INFORMATIVOS_PROFILES.some((p) => perfil.toLowerCase() === p.toLowerCase())
}
