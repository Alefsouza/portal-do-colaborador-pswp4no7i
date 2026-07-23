routerAdd('POST', '/backend/v1/esqueci-senha/verificar', (e) => {
  const body = e.requestInfo().body || {}
  const cpf = (body.cpf || '').trim()
  const nomeCompleto = (body.nome_completo || '').trim()

  if (!cpf || !nomeCompleto) {
    return e.json(400, { error: 'CPF e nome completo são obrigatórios.' })
  }

  let usuario
  try {
    usuario = $app.findFirstRecordByData('usuarios', 'cpf', cpf)
  } catch (_) {
    return e.json(200, { exists: false })
  }

  if (usuario.getString('nome_completo') !== nomeCompleto) {
    return e.json(200, { exists: false })
  }

  return e.json(200, { exists: true })
})
