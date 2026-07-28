import pb from '@/lib/pocketbase/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

export function validateAvatarFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  if (!VALID_TYPES.includes(file.type) && !VALID_EXTENSIONS.includes(ext)) {
    return 'Formato inválido. Use JPG, PNG ou WEBP.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Arquivo muito grande. Máximo 5MB.'
  }
  return null
}

export async function uploadAvatar(token: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('avatar', file)

  const result = await pb.send<{ avatar: string; userId: string }>('/backend/v1/upload-avatar', {
    method: 'POST',
    body: formData,
    headers: { Authorization: token },
  })

  return `${pb.baseURL}/api/files/usuarios/${result.userId}/${result.avatar}?t=${Date.now()}`
}
