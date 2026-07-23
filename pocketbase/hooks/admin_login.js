routerAdd('POST', '/backend/v1/admin/login', (e) => {
  const body = e.requestInfo().body || {}
  const cpf = (body.cpf || '').trim()
  const senha = body.senha || ''

  if (!cpf || !senha) {
    return e.json(400, { error: 'CPF e senha são obrigatórios.' })
  }

  let usuario
  try {
    usuario = $app.findFirstRecordByData('usuarios', 'cpf', cpf)
  } catch (_) {
    return e.json(401, { error: 'CPF ou senha inválidos.' })
  }

  const perfil = usuario.getString('perfil')
  if (!perfil || perfil.trim() === '') {
    return e.json(403, { error: 'Acesso negado. Seu perfil não possui permissão administrativa.' })
  }

  const storedSenha = usuario.getString('senha')
  let valid = false
  const sepIdx = storedSenha.indexOf('$')
  if (sepIdx !== -1) {
    const salt = storedSenha.substring(0, sepIdx)
    const hash = storedSenha.substring(sepIdx + 1)
    valid = $security.sha256(salt + senha) === hash
  } else {
    valid = storedSenha === senha
  }

  if (!valid) {
    return e.json(401, { error: 'CPF ou senha inválidos.' })
  }

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
  const token = $security.createJWT(
    { id: usuario.id, cpf: usuario.getString('cpf'), admin: true },
    jwtSecret,
    604800,
  )

  return e.json(200, {
    token,
    user: {
      id: usuario.id,
      nome_completo: usuario.getString('nome_completo'),
      perfil: perfil,
      departamento: usuario.getString('departamento'),
    },
  })
})
