routerAdd('POST', '/backend/v1/auth/login', (e) => {
  const body = e.requestInfo().body || {}
  const rawCpf = (body.cpf || '').trim()
  const senha = body.senha || ''

  if (!rawCpf || !senha) {
    return e.json(400, { error: 'CPF e senha são obrigatórios.' })
  }

  const cpfDigits = rawCpf.replace(/\D/g, '')

  const secretRaw = $secrets.get('SECRETARIA_VIEW')
  if (!secretRaw || secretRaw.trim() === '') {
    console.log('auth_login: SECRETARIA_VIEW secret is missing or empty')
    return e.json(401, { error: 'Acesso não autorizado.' })
  }

  var secretTrimmed = secretRaw.trim()
  var isUrl = secretTrimmed.indexOf('http://') === 0 || secretTrimmed.indexOf('https://') === 0

  var secretariaData
  try {
    if (isUrl) {
      var httpRes = $http.send({
        url: secretTrimmed,
        method: 'GET',
        timeout: 10,
      })
      if (httpRes.statusCode !== 200) {
        console.log(
          'auth_login: SECRETARIA_VIEW URL fetch failed with status ' + httpRes.statusCode,
        )
        return e.json(400, { error: 'Erro ao carregar dados da secretaria.' })
      }
      if (httpRes.json !== undefined && httpRes.json !== null) {
        secretariaData = httpRes.json
      } else if (typeof httpRes.body === 'string' && httpRes.body !== '') {
        secretariaData = JSON.parse(httpRes.body)
      } else if (httpRes.body) {
        var decoder = new TextDecoder()
        var bodyText = decoder.decode(httpRes.body)
        if (!bodyText || bodyText.trim() === '') {
          console.log('auth_login: SECRETARIA_VIEW URL returned empty body')
          return e.json(400, { error: 'Erro ao carregar dados da secretaria.' })
        }
        secretariaData = JSON.parse(bodyText)
      } else {
        console.log('auth_login: SECRETARIA_VIEW URL returned empty body')
        return e.json(400, { error: 'Erro ao carregar dados da secretaria.' })
      }
    } else {
      secretariaData = JSON.parse(secretRaw)
    }
  } catch (err) {
    console.log('auth_login: SECRETARIA_VIEW error - ' + (err.message || ''))
    return e.json(400, { error: 'Erro ao carregar dados da secretaria.' })
  }

  // Accept multiple JSON shapes: plain array, { items: [...] }, { data: [...] }, etc.
  let items = null
  if (Array.isArray(secretariaData)) {
    items = secretariaData
  } else if (secretariaData && typeof secretariaData === 'object') {
    if (Array.isArray(secretariaData.items)) {
      items = secretariaData.items
    } else if (Array.isArray(secretariaData.data)) {
      items = secretariaData.data
    } else if (Array.isArray(secretariaData.usuarios)) {
      items = secretariaData.usuarios
    } else if (Array.isArray(secretariaData.colaboradores)) {
      items = secretariaData.colaboradores
    } else if (Array.isArray(secretariaData.records)) {
      items = secretariaData.records
    } else if (Array.isArray(secretariaData.results)) {
      items = secretariaData.results
    }
  }

  if (!items || !Array.isArray(items)) {
    console.log('auth_login: SECRETARIA_VIEW parsed JSON has no usable items array')
    return e.json(401, { error: 'Acesso não autorizado.' })
  }

  if (items.length === 0) {
    console.log('auth_login: SECRETARIA_VIEW items array is empty')
    return e.json(401, { error: 'Acesso não autorizado.' })
  }

  let secretItem = null
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || !item.cpf) continue
    const itemCpfDigits = String(item.cpf).replace(/\D/g, '')
    if (itemCpfDigits === cpfDigits) {
      secretItem = item
      break
    }
  }

  if (!secretItem) {
    return e.json(401, { error: 'Colaborador não encontrado. Acesso não autorizado.' })
  }

  let usuario = null
  try {
    usuario = $app.findFirstRecordByData('usuarios', 'cpf', secretItem.cpf)
  } catch (_) {}
  if (!usuario) {
    try {
      usuario = $app.findFirstRecordByData('usuarios', 'cpf', cpfDigits)
    } catch (_) {}
  }

  if (!usuario) {
    const registroOriginal = String(secretItem.registro || '')
    const registroStripped = registroOriginal.replace(/^0+/, '')

    if (senha !== registroStripped) {
      return e.json(401, { error: 'Senha incorreta.' })
    }

    const salt = $security.randomString(16)
    const hash = $security.sha256(salt + senha)

    const col = $app.findCollectionByNameOrId('usuarios')
    const newRecord = new Record(col)
    newRecord.set('cpf', secretItem.cpf)
    newRecord.set('nome_completo', secretItem.nome || '')
    newRecord.set('registro', registroOriginal)
    newRecord.set('senha', salt + '$' + hash)
    newRecord.set('perfil', 'Colaborador')
    newRecord.set('departamento', 'Operacional')
    newRecord.set('primeiro_acesso', true)

    try {
      $app.save(newRecord)
    } catch (err) {
      console.log('auth_login: error creating new usuario record - ' + (err.message || ''))
      return e.json(500, { error: 'Erro ao processar login. Tente novamente.' })
    }

    const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
    const token = $security.createJWT(
      { id: newRecord.id, cpf: newRecord.getString('cpf') },
      jwtSecret,
      604800,
    )

    return e.json(200, {
      token,
      user: {
        id: newRecord.id,
        nome_completo: newRecord.getString('nome_completo'),
        primeiro_acesso: true,
        departamento: newRecord.getString('departamento'),
        perfil: newRecord.getString('perfil'),
      },
    })
  }

  const storedSenha = usuario.getString('senha')
  let valid = false
  const sepIdx = storedSenha.indexOf('$')
  if (sepIdx !== -1) {
    const storedSalt = storedSenha.substring(0, sepIdx)
    const storedHash = storedSenha.substring(sepIdx + 1)
    valid = $security.sha256(storedSalt + senha) === storedHash
  } else {
    valid = storedSenha === senha
    if (valid) {
      const newSalt = $security.randomString(16)
      const newHash = $security.sha256(newSalt + senha)
      usuario.set('senha', newSalt + '$' + newHash)
      $app.saveNoValidate(usuario)
    }
  }

  if (!valid) {
    return e.json(401, { error: 'Senha incorreta.' })
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
