routerAdd('POST', '/backend/v1/upload-avatar', (e) => {
  const authHeader = e.request.header.get('Authorization')
  if (!authHeader) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'

  let payload
  try {
    payload = $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }

  if (!payload || !payload.id) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }

  let usuario
  try {
    usuario = $app.findRecordById('usuarios', payload.id)
  } catch (_) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }

  const files = e.findUploadedFiles('avatar')
  if (!files || files.length === 0) {
    return e.badRequestError('Nenhum arquivo enviado')
  }

  const file = files[0]
  const fileName = (file.name || '').toLowerCase()
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  let hasValidExt = false
  for (let i = 0; i < validExtensions.length; i++) {
    if (fileName.endsWith(validExtensions[i])) {
      hasValidExt = true
      break
    }
  }
  if (!hasValidExt) {
    return e.badRequestError('Formato inválido. Use JPG, PNG ou WEBP.')
  }
  if (file.size > 5 * 1024 * 1024) {
    return e.badRequestError('Arquivo muito grande. Máximo 5MB.')
  }

  usuario.set('avatar', file)
  $app.save(usuario)

  const avatarFilename = usuario.getString('avatar')
  return e.json(200, { avatar: avatarFilename, userId: usuario.id })
})
