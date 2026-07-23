routerAdd('POST', '/backend/v1/popups/send', (e) => {
  const authHeader = e.requestInfo().headers['authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
  let payload
  try {
    payload = $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Token inválido.' })
  }

  if (!payload || !payload.admin) {
    return e.json(403, { error: 'Acesso negado. Apenas administradores.' })
  }

  let adminUser
  try {
    adminUser = $app.findRecordById('usuarios', payload.id)
  } catch (_) {
    return e.json(403, { error: 'Usuário não encontrado.' })
  }

  const perfil = adminUser.getString('perfil')
  if (!perfil || perfil.trim() === '') {
    return e.json(403, { error: 'Usuário não autorizado.' })
  }

  const body = e.requestInfo().body || {}
  const titulo = (body.titulo || '').trim()
  const conteudo = (body.conteudo || '').trim()
  const recipientType = body.recipientType || 'all'
  const departamento = body.departamento || ''
  const userIds = body.userIds || []

  if (!titulo || !conteudo) {
    return e.json(400, { error: 'Título e conteúdo são obrigatórios.' })
  }

  let informativoId = ''
  let recipientCount = 0

  try {
    $app.runInTransaction((txApp) => {
      const informativosCol = txApp.findCollectionByNameOrId('informativos')
      const informativo = new Record(informativosCol)
      informativo.set('titulo', titulo)
      informativo.set('conteudo', conteudo)
      informativo.set('departamento', recipientType === 'department' ? departamento : '')
      informativo.set('status_ativo', true)
      txApp.save(informativo)
      informativoId = informativo.id

      let targetUsers = []
      if (recipientType === 'all') {
        targetUsers = txApp.findRecordsByFilter('usuarios', "id != ''", '', 0, 0)
      } else if (recipientType === 'department') {
        targetUsers = txApp.findRecordsByFilter(
          'usuarios',
          'departamento = "' + departamento + '"',
          '',
          0,
          0,
        )
      } else if (recipientType === 'specific') {
        for (const uid of userIds) {
          try {
            targetUsers.push(txApp.findRecordById('usuarios', uid))
          } catch (_) {}
        }
      }

      const popupCol = txApp.findCollectionByNameOrId('popup_envios')
      for (const user of targetUsers) {
        const popup = new Record(popupCol)
        popup.set('id_informativo', informativo.id)
        popup.set('id_usuario', user.id)
        popup.set('status_lido', false)
        txApp.save(popup)
      }
      recipientCount = targetUsers.length
    })

    return e.json(200, {
      success: true,
      informativoId: informativoId,
      recipients: recipientCount,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao criar pop-up.' })
  }
})
