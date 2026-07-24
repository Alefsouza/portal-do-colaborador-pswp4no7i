routerAdd('POST', '/backend/v1/olho-vivo/buscar-veiculo', (e) => {
  const authHeader = e.requestInfo().headers['authorization'] || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!authToken) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
  let payload
  try {
    payload = $security.parseJWT(authToken, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Token inválido.' })
  }

  if (!payload || !payload.id) {
    return e.json(401, { error: 'Token inválido.' })
  }

  try {
    $app.findRecordById('usuarios', payload.id)
  } catch (_) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }

  const body = e.requestInfo().body || {}
  const prefixo = (body.prefixo || '').trim()

  if (!prefixo) {
    return e.json(400, { error: 'Prefixo é obrigatório.' })
  }

  const sptransToken = $secrets.get('OLHO_VIVO_TOKEN') || ''
  if (!sptransToken) {
    return e.json(503, { error: 'Token da API Olho Vivo não configurado.' })
  }

  const codigoEmpresaRaw = $secrets.get('OLHO_VIVO_CODIGO_EMPRESA') || ''
  const empresaCodigos = codigoEmpresaRaw
    .split(',')
    .map(function (c) {
      return c.trim()
    })
    .filter(function (c) {
      return c.length > 0
    })

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _olho_vivo_cache (id TEXT PRIMARY KEY, cookie TEXT, expires INTEGER)',
      )
      .execute()
  } catch (_) {}

  let cookieStr = ''

  try {
    const row = new DynamicModel({ cookie: '', expires: 0 })
    $app
      .db()
      .newQuery("SELECT cookie, expires FROM _olho_vivo_cache WHERE id = 'session' LIMIT 1")
      .one(row)
    if (row.cookie && Date.now() < row.expires) {
      cookieStr = row.cookie
    }
  } catch (_) {}

  if (!cookieStr) {
    let authRes
    try {
      authRes = $http.send({
        url:
          'https://api.olhovivo.sptrans.com.br/v2.1/Login/Autenticar?token=' +
          encodeURIComponent(sptransToken),
        method: 'POST',
        timeout: 15,
      })
    } catch (err) {
      return e.json(502, { error: 'Falha ao conectar com a API SPTrans.' })
    }

    if (authRes.statusCode !== 200 || authRes.json !== true) {
      return e.json(502, { error: 'Falha na autenticação com SPTrans. Token inválido.' })
    }

    if (authRes.cookies) {
      const parts = []
      for (const key in authRes.cookies) {
        const c = authRes.cookies[key]
        if (typeof c === 'string') {
          parts.push(key + '=' + c)
        } else if (c && c.value) {
          parts.push(key + '=' + c.value)
        }
      }
      cookieStr = parts.join('; ')
    }

    if (!cookieStr && authRes.headers) {
      const setCookie = authRes.headers['set-cookie'] || authRes.headers['Set-Cookie']
      if (setCookie) {
        if (Array.isArray(setCookie)) {
          cookieStr = setCookie
            .map(function (c) {
              return c.split(';')[0]
            })
            .join('; ')
        } else {
          cookieStr = String(setCookie).split(';')[0]
        }
      }
    }

    if (!cookieStr) {
      return e.json(502, { error: 'Falha ao obter cookie de sessão SPTrans.' })
    }

    try {
      $app
        .db()
        .newQuery(
          "INSERT OR REPLACE INTO _olho_vivo_cache (id, cookie, expires) VALUES ('session', {:cookie}, {:expires})",
        )
        .bind({ cookie: cookieStr, expires: Date.now() + 3600000 })
        .execute()
    } catch (_) {}
  }

  var circulacaoResult = null
  var garagemResults = []
  var errors = []

  try {
    circulacaoResult = $http.send({
      url: 'https://api.olhovivo.sptrans.com.br/v2.1/Posicao',
      method: 'GET',
      headers: { Cookie: cookieStr },
      timeout: 15,
    })
    if (circulacaoResult.statusCode !== 200) {
      errors.push('Posicao: HTTP ' + circulacaoResult.statusCode)
      circulacaoResult = null
    }
  } catch (err) {
    errors.push('Posicao: ' + err.message)
    circulacaoResult = null
  }

  for (var i = 0; i < empresaCodigos.length; i++) {
    try {
      var garagemRes = $http.send({
        url:
          'https://api.olhovivo.sptrans.com.br/v2.1/Posicao/Garagem?codigoEmpresa=' +
          encodeURIComponent(empresaCodigos[i]),
        method: 'GET',
        headers: { Cookie: cookieStr },
        timeout: 15,
      })
      if (garagemRes.statusCode === 200) {
        garagemResults.push(garagemRes.json)
      } else {
        errors.push('Garagem ' + empresaCodigos[i] + ': HTTP ' + garagemRes.statusCode)
      }
    } catch (err) {
      errors.push('Garagem ' + empresaCodigos[i] + ': ' + err.message)
    }
  }

  if (!circulacaoResult && garagemResults.length === 0) {
    try {
      $app.db().newQuery("DELETE FROM _olho_vivo_cache WHERE id = 'session'").execute()
    } catch (_) {}
    return e.json(502, {
      error: 'Falha ao buscar posição dos veículos. ' + errors.join('; '),
    })
  }

  if (circulacaoResult && circulacaoResult.json && circulacaoResult.json.l) {
    for (var li = 0; li < circulacaoResult.json.l.length; li++) {
      var line = circulacaoResult.json.l[li]
      if (!line.vs) continue
      for (var vi = 0; vi < line.vs.length; vi++) {
        var vehicle = line.vs[vi]
        if (String(vehicle.p) === String(prefixo)) {
          return e.json(200, {
            prefixo: String(vehicle.p),
            latitude: vehicle.py,
            longitude: vehicle.px,
            acessivel: !!vehicle.a,
            horario: vehicle.ta || '',
            letreiro: line.c || '',
            sentido: line.sl || 0,
            status: 'circulacao',
          })
        }
      }
    }
  }

  for (var gi = 0; gi < garagemResults.length; gi++) {
    var garagemData = garagemResults[gi]
    if (!garagemData || !garagemData.l) continue
    for (var gli = 0; gli < garagemData.l.length; gli++) {
      var gline = garagemData.l[gli]
      if (!gline.vs) continue
      for (var gvi = 0; gvi < gline.vs.length; gvi++) {
        var gvehicle = gline.vs[gvi]
        if (String(gvehicle.p) === String(prefixo)) {
          return e.json(200, {
            prefixo: String(gvehicle.p),
            latitude: gvehicle.py,
            longitude: gvehicle.px,
            acessivel: !!gvehicle.a,
            horario: gvehicle.ta || '',
            letreiro: gline.c || '',
            sentido: gline.sl || 0,
            status: 'garagem',
          })
        }
      }
    }
  }

  return e.json(404, {
    error:
      'Veículo não está transmitindo no momento. Pode estar desligado, em manutenção ou com o GPS inativo.',
  })
})
