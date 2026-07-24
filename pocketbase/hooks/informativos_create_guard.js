onRecordCreateRequest((e) => {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return e.forbiddenError('Acesso negado. Autenticação necessária.')
  }

  let payload
  try {
    const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
    payload = $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.forbiddenError('Sessão inválida ou expirada.')
  }

  const userId = payload.id
  if (!userId) {
    return e.forbiddenError('Acesso negado.')
  }

  let usuario
  try {
    usuario = $app.findRecordById('usuarios', userId)
  } catch (_) {
    return e.forbiddenError('Usuário não encontrado.')
  }

  if (usuario.getString('perfil') !== 'TI') {
    return e.forbiddenError('Apenas usuários do perfil TI podem criar informativos.')
  }

  e.next()
}, 'informativos')
