routerAdd('POST', '/backend/v1/esqueci-senha/redefinir', (e) => {
  const body = e.requestInfo().body || {}
  const cpf = (body.cpf || '').trim()
  const nomeCompleto = (body.nome_completo || '').trim()
  const novaSenha = body.nova_senha || ''

  if (!cpf || !nomeCompleto || !novaSenha) {
    return e.json(400, { error: 'Todos os campos são obrigatórios.' })
  }

  if (novaSenha.length < 6) {
    return e.json(400, { error: 'A senha deve ter no mínimo 6 caracteres.' })
  }

  let usuario
  try {
    usuario = $app.findFirstRecordByData('usuarios', 'cpf', cpf)
  } catch (_) {
    return e.json(404, { error: 'Informações não conferem.' })
  }

  if (usuario.getString('nome_completo') !== nomeCompleto) {
    return e.json(404, { error: 'Informações não conferem.' })
  }

  const salt = $security.randomString(16)
  const hash = $security.sha256(salt + novaSenha)
  usuario.set('senha', salt + '$' + hash)
  usuario.set('primeiro_acesso', false)
  $app.save(usuario)

  return e.json(200, { success: true })
})
