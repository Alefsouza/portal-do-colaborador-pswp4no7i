routerAdd('POST', '/backend/v1/auth/login', (e) => {
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

  const storedSenha = usuario.getString('senha')
  let valid = false
  const sepIdx = storedSenha.indexOf('$')
  if (sepIdx !== -1) {
    const salt = storedSenha.substring(0, sepIdx)
    const hash = storedSenha.substring(sepIdx + 1)
    valid = $security.sha256(salt + senha) === hash
  } else {
    valid = storedSenha === senha
    if (valid) {
      const salt = $security.randomString(16)
      const newHash = $security.sha256(salt + senha)
      usuario.set('senha', salt + '$' + newHash)
      $app.saveNoValidate(usuario)
    }
  }

  if (!valid) {
    return e.json(401, { error: 'CPF ou senha inválidos.' })
  }

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
  const token = $security.createJWT(
    { id: usuario.id, cpf: usuario.getString('cpf') },
    jwtSecret,
    604800,
  )

  return e.json(200, {
    token,
    user: {
      id: usuario.id,
      nome_completo: usuario.getString('nome_completo'),
      primeiro_acesso: usuario.getBool('primeiro_acesso'),
      departamento: usuario.getString('departamento'),
      perfil: usuario.getString('perfil'),
    },
  })
})
