routerAdd('POST', '/backend/v1/upload-avatar', (e) => {
  const authHeader = e.request.header.get('Authorization')
  if (!authHeader) {
    return e.unauthorizedError('Token não fornecido')
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  let userRecord
  try {
    userRecord = $app.findAuthRecordByToken(token)
  } catch (_) {
    let payload
    try {
      payload = $security.parseUnverifiedJWT(token)
    } catch (_) {
      return e.unauthorizedError('Token inválido')
    }
    if (payload.id) {
      try {
        userRecord = $app.findRecordById('users', payload.id)
      } catch (_) {
        return e.unauthorizedError('Usuário não encontrado')
      }
    } else if (payload.email) {
      try {
        userRecord = $app.findAuthRecordByEmail('users', payload.email)
      } catch (_) {
        return e.unauthorizedError('Usuário não encontrado')
      }
    } else {
      return e.unauthorizedError('Usuário não encontrado')
    }
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

  userRecord.set('avatar', file)
  $app.save(userRecord)

  const avatarFilename = userRecord.getString('avatar')
  return e.json(200, { avatar: avatarFilename, userId: userRecord.id })
})
