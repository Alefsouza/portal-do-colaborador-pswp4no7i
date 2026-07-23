routerAdd('POST', '/backend/v1/usuarios', (e) => {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return e.json(401, { error: 'Token não fornecido.' })
  try {
    const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
    $security.parseJWT(token, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Sessão expirada ou inválida.' })
  }

  const body = e.requestInfo().body || {}
  const errors = {}

  if (!body.cpf) errors.cpf = { code: 'validation_required', message: 'Missing required value.' }
  if (!body.nome_completo)
    errors.nome_completo = { code: 'validation_required', message: 'Missing required value.' }
  if (!body.registro)
    errors.registro = { code: 'validation_required', message: 'Missing required value.' }
  if (!body.senha || String(body.senha).length < 8)
    errors.senha = {
      code: 'validation_min_text_constraint',
      message: 'Must be at least 8 characters.',
    }
  if (!body.perfil)
    errors.perfil = { code: 'validation_required', message: 'Missing required value.' }
  if (!body.departamento)
    errors.departamento = { code: 'validation_required', message: 'Missing required value.' }

  try {
    $app.findFirstRecordByData('usuarios', 'cpf', body.cpf)
    errors.cpf = { code: 'validation_not_unique', message: 'CPF já cadastrado.' }
  } catch (_) {}
  try {
    $app.findFirstRecordByData('usuarios', 'registro', body.registro)
    errors.registro = { code: 'validation_not_unique', message: 'Registro já cadastrado.' }
  } catch (_) {}

  if (Object.keys(errors).length > 0) {
    return e.json(400, { data: errors })
  }

  const salt = $security.randomString(16)
  const hash = $security.sha256(salt + body.senha)

  const col = $app.findCollectionByNameOrId('usuarios')
  const record = new Record(col)
  record.set('cpf', body.cpf)
  record.set('nome_completo', body.nome_completo)
  record.set('registro', body.registro)
  record.set('senha', salt + '$' + hash)
  record.set('perfil', body.perfil)
  record.set('departamento', body.departamento)
  record.set('primeiro_acesso', body.primeiro_acesso !== undefined ? body.primeiro_acesso : true)

  try {
    $app.save(record)
  } catch (err) {
    return e.json(400, { data: { _: { message: err.message || 'Erro ao criar usuário.' } } })
  }

  return e.json(201, {
    id: record.id,
    cpf: record.getString('cpf'),
    nome_completo: record.getString('nome_completo'),
    registro: record.getString('registro'),
    perfil: record.getString('perfil'),
    departamento: record.getString('departamento'),
    primeiro_acesso: record.get('primeiro_acesso') === true,
    data_criacao: record.getString('data_criacao'),
    created: record.getString('created'),
    updated: record.getString('updated'),
  })
})
