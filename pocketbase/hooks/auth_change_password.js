routerAdd('POST', '/backend/v1/auth/change-password', (e) => {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  let payload
  try {
    const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
    payload = $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Sessão expirada ou inválida.' })
  }

  const userId = payload.id
  const body = e.requestInfo().body || {}
  const novaSenha = body.nova_senha || ''
  const senhaAtual = body.senha_atual || ''

  if (!novaSenha || novaSenha.length < 8) {
    return e.json(400, { error: 'A senha deve ter no mínimo 8 caracteres.' })
  }

  let usuario
  try {
    usuario = $app.findRecordById('usuarios', userId)
  } catch (_) {
    return e.json(404, { error: 'Usuário não encontrado.' })
  }

  if (senhaAtual) {
    const storedSenha = usuario.getString('senha')
    const parts = storedSenha.split('$')
    if (parts.length === 2) {
      const saltStored = parts[0]
      const storedHash = parts[1]
      const inputHash = $security.sha256(saltStored + senhaAtual)
      if (inputHash !== storedHash) {
        return e.json(400, { error: 'Senha atual incorreta.' })
      }
    }
  }

  const salt = $security.randomString(16)
  const hash = $security.sha256(salt + novaSenha)
  usuario.set('senha', salt + '$' + hash)
  usuario.set('primeiro_acesso', false)
  $app.save(usuario)

  return e.json(200, { success: true })
})
