routerAdd('POST', '/backend/v1/olho-vivo/buscar-veiculo', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

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

  function getCachedCookie() {
    try {
      const row = new DynamicModel({ cookie: '', expires: 0 })
      $app
        .db()
        .newQuery("SELECT cookie, expires FROM _olho_vivo_cache WHERE id = 'session' LIMIT 1")
        .one(row)
      if (row.cookie && Date.now() < row.expires) {
        return row.cookie
      }
    } catch (_) {}
    return ''
  }

  function clearCachedCookie() {
    try {
      $app.db().newQuery("DELETE FROM _olho_vivo_cache WHERE id = 'session'").execute()
    } catch (_) {}
  }

  function saveCachedCookie(cookieStr) {
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

  function extractCookiesFromResponse(authRes) {
    var cookieStr = ''

    if (authRes.cookies) {
      var parts = []
      for (var key in authRes.cookies) {
        var c = authRes.cookies[key]
        if (typeof c === 'string') {
          parts.push(key + '=' + c)
        } else if (c && c.value) {
          parts.push(key + '=' + c.value)
        }
      }
      cookieStr = parts.join('; ')
    }

    if (!cookieStr && authRes.headers) {
      var setCookie = authRes.headers['set-cookie'] || authRes.headers['Set-Cookie']
      if (setCookie) {
        if (Array.isArray(setCookie)) {
          var pairs = []
          for (var i = 0; i < setCookie.length; i++) {
            var raw = String(setCookie[i])
            var nameValue = raw.split(';')[0].trim()
            if (nameValue) pairs.push(nameValue)
          }
          cookieStr = pairs.join('; ')
        } else {
          cookieStr = String(setCookie).split(';')[0].trim()
        }
      }
    }

    $app.logger().info('SPTrans login response', {
      statusCode: authRes.statusCode,
      hasCookies: !!authRes.cookies,
      cookieKeys: authRes.cookies ? Object.keys(authRes.cookies).join(',') : '',
      setCookieHeader: authRes.headers
        ? authRes.headers['set-cookie'] || authRes.headers['Set-Cookie'] || ''
        : '',
      extractedCookie: cookieStr ? cookieStr.substring(0, 80) + '...' : '(empty)',
    })

    return cookieStr
  }

  function authenticateSPTrans() {
    var authRes
    try {
      authRes = $http.send({
        url:
          'https://api.olhovivo.sptrans.com.br/v2.1/Login/Autenticar?token=' +
          encodeURIComponent(sptransToken),
        method: 'POST',
        timeout: 15,
      })
    } catch (err) {
      $app.logger().error('SPTrans auth transport error', 'message', err.message)
      return ''
    }

    if (authRes.statusCode !== 200 || authRes.json !== true) {
      $app
        .logger()
        .error(
          'SPTrans auth failed',
          'statusCode',
          authRes.statusCode,
          'body',
          JSON.stringify(authRes.json),
        )
      return ''
    }

    var cookieStr = extractCookiesFromResponse(authRes)

    if (!cookieStr) {
      $app
        .logger()
        .error(
          'SPTrans auth: no cookie extracted',
          'headers',
          JSON.stringify(authRes.headers || {}),
        )
      return ''
    }

    saveCachedCookie(cookieStr)
    $app.logger().info('SPTrans auth success, cookie cached', 'cookieLength', cookieStr.length)
    return cookieStr
  }

  function sptransGet(url, cookieStr) {
    var result = { statusCode: 0, json: null, error: null }
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: { Cookie: cookieStr },
        timeout: 15,
      })
      result.statusCode = res.statusCode
      result.json = res.json
    } catch (err) {
      result.error = err.message
    }
    return result
  }

  function sptransGetWithReauth(url, cookieStr) {
    var result = sptransGet(url, cookieStr)

    if (result.statusCode === 401) {
      $app.logger().info('SPTrans 401 received, reauthenticating', 'url', url)
      clearCachedCookie()
      var newCookie = authenticateSPTrans()
      if (newCookie) {
        $app.logger().info('SPTrans reauth success, retrying request', 'url', url)
        result = sptransGet(url, newCookie)
      } else {
        $app.logger().error('SPTrans reauth failed, cannot retry', 'url', url)
        result.error = 'Reautenticação falhou'
      }
    }

    return result
  }

  var cookieStr = getCachedCookie()
  if (!cookieStr) {
    cookieStr = authenticateSPTrans()
    if (!cookieStr) {
      return e.json(502, { error: 'Falha na autenticação com SPTrans. Token inválido.' })
    }
  } else {
    $app.logger().info('SPTrans: using cached cookie', 'cookieLength', cookieStr.length)
  }

  var circulacaoResult = null
  var garagemResults = []
  var errors = []

  var posicaoUrl = 'https://api.olhovivo.sptrans.com.br/v2.1/Posicao'
  var circResp = sptransGetWithReauth(posicaoUrl, cookieStr)
  if (circResp.error) {
    errors.push('Posicao: ' + circResp.error)
  } else if (circResp.statusCode === 200) {
    circulacaoResult = circResp
  } else {
    errors.push('Posicao: HTTP ' + circResp.statusCode)
  }

  if (circResp.statusCode === 401) {
    cookieStr = getCachedCookie() || cookieStr
  }

  for (var i = 0; i < empresaCodigos.length; i++) {
    var garagemUrl =
      'https://api.olhovivo.sptrans.com.br/v2.1/Posicao/Garagem?codigoEmpresa=' +
      encodeURIComponent(empresaCodigos[i])
    var garResp = sptransGetWithReauth(garagemUrl, cookieStr)
    if (garResp.error) {
      errors.push('Garagem ' + empresaCodigos[i] + ': ' + garResp.error)
    } else if (garResp.statusCode === 200) {
      garagemResults.push(garResp.json)
    } else {
      errors.push('Garagem ' + empresaCodigos[i] + ': HTTP ' + garResp.statusCode)
    }
  }

  if (!circulacaoResult && garagemResults.length === 0) {
    clearCachedCookie()
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
