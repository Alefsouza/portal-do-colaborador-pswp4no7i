routerAdd('POST', '/backend/v1/usuarios/{id}/reset-senha', (e) => {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return e.json(401, { error: 'Token não fornecido.' })
  try {
    const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
    $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Sessão expirada ou inválida.' })
  }

  const id = e.request.pathValue('id')

  let usuario
  try {
    usuario = $app.findRecordById('usuarios', id)
  } catch (_) {
    return e.json(404, { error: 'Usuário não encontrado.' })
  }

  const registro = usuario.getString('registro')
  if (!registro) {
    return e.json(400, { error: 'Usuário não possui registro cadastrado.' })
  }

  const salt = $security.randomString(16)
  const hash = $security.sha256(salt + registro)
  usuario.set('senha', salt + '$' + hash)
  usuario.set('primeiro_acesso', true)

  try {
    $app.save(usuario)
  } catch (err) {
    return e.json(500, { error: 'Erro ao redefinir senha.' })
  }

  return e.json(200, { success: true })
})
