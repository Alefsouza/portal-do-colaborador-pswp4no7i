onRecordUpdateRequest((e) => {
  const oldDept = e.record.original().getString('departamento')
  const newDept = e.record.getString('departamento')

  if (oldDept === newDept) {
    e.next()
    return
  }

  let userId = ''

  if (e.auth && e.auth.id) {
    userId = e.auth.id
  }

  if (!userId) {
    const headers = e.requestInfo().headers || {}
    const authHeader = headers['authorization'] || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (token) {
      try {
        const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
        try {
          const payload = $security.parseJWT(token, jwtSecret)
          userId = payload.id || ''
        } catch (_) {
          try {
            const payload = $security.parseUnverifiedJWT(token)
            userId = payload.id || ''
          } catch (__) {}
        }
      } catch (_) {}
    }
  }

  e.next()

  if (!userId) return

  try {
    const msgCol = $app.findCollectionByNameOrId('solicitacao_mensagens')
    const msg = new Record(msgCol)
    msg.set('id_solicitacao', e.record.id)
    msg.set('id_usuario', userId)
    msg.set('tipo_remetente', 'Admin')
    msg.set(
      'mensagem',
      'Solicitação transferida para o Departamento ' +
        newDept +
        '. Aguardo um colaborador entrar em contato.',
    )
    $app.save(msg)
  } catch (err) {
    $app.logger().error('Failed to create transfer message', 'error', String(err))
  }
}, 'solicitacoes')
