onRecordUpdateRequest((e) => {
  try {
    const headers = e.requestInfo().headers || {}
    const authHeader = headers['authorization'] || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return e.forbiddenError('Acesso negado. Autenticação necessária.')
    }

    let payload
    try {
      const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
      payload = $security.parseJWT(token, jwtSecret)
    } catch (_) {
      try {
        payload = $security.parseUnverifiedJWT(token)
      } catch (__) {
        return e.forbiddenError('Sessão inválida ou expirada.')
      }
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
      return e.forbiddenError('Apenas usuários do perfil TI podem editar informativos.')
    }

    const body = e.requestInfo().body || {}
    const recipientType = body.recipient_type || 'Todos'
    const destinatarios = body.destinatarios || []

    if (recipientType === 'Especificos') {
      if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
        return e.badRequestError(
          'Selecione ao menos um colaborador quando o destinatário é específico.',
        )
      }
    }

    e.next()
  } catch (err) {
    return e.forbiddenError('Erro de autenticação.')
  }
}, 'informativos')
