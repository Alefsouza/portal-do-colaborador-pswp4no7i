routerAdd('POST', '/backend/v1/admin/login', (e) => {
  const body = e.requestInfo().body || {}
  const rawCpf = (body.cpf || '').trim()
  const senha = body.senha || ''

  if (!rawCpf || !senha) {
    return e.json(400, { error: 'CPF e senha são obrigatórios.' })
  }

  const cpf = rawCpf.replace(/\D/g, '')

  let usuario
  try {
    usuario = $app.findFirstRecordByData('usuarios', 'cpf', cpf)
  } catch (_) {
    return e.json(401, { error: 'CPF ou senha inválidos.' })
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

  const perfil = usuario.getString('perfil')
  if (!perfil || perfil.trim() === '') {
    return e.json(401, { error: 'Usuário não autorizado.' })
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
