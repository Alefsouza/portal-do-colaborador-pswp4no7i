routerAdd('POST', '/backend/v1/datalbus/telemetria', (e) => {
  const authHeader = e.requestInfo().headers['authorization'] || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!authToken) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  const body = e.requestInfo().body || {}
  const dataInicial = (body.data_inicial || '').trim()
  const dataFinal = (body.data_final || '').trim()
  let driverId = (body.driver_id || '').trim()

  if (!dataInicial || !dataFinal) {
    var fieldErrors = {}
    if (!dataInicial) fieldErrors['data_inicial'] = 'Data inicial é obrigatória'
    if (!dataFinal) fieldErrors['data_final'] = 'Data final é obrigatória'
    return e.json(400, { error: 'Campos obrigatórios não fornecidos', details: fieldErrors })
  }

  if (!driverId) {
    return e.json(400, { error: 'driver_id é obrigatório' })
  }

  driverId = driverId.replace(/^0+/, '')
  if (!driverId) {
    return e.json(400, { error: 'driver_id inválido após normalização' })
  }

  var dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dataInicial) || !dateRegex.test(dataFinal)) {
    return e.json(400, { error: 'Formato de data inválido. Use YYYY-MM-DD.' })
  }

  var initDate = new Date(dataInicial + 'T00:00:00')
  var finDate = new Date(dataFinal + 'T23:59:59')
  if (isNaN(initDate.getTime()) || isNaN(finDate.getTime())) {
    return e.json(400, { error: 'Data inválida.' })
  }
  if (initDate > finDate) {
    return e.json(400, { error: 'Data inicial deve ser anterior ou igual à data final.' })
  }

  var driverField = $secrets.get('DATALBUS_DRIVER_FIELD') || 'registro'

  if (driverField === 'cpf') {
    var cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
    if (!cpfRegex.test(driverId)) {
      return e.json(400, {
        error:
          'driver_id inválido para o campo CPF. Esperado formato 000.000.000-00 ou apenas dígitos.',
      })
    }
  } else if (driverField === 'registro') {
    if (driverId.length < 1) {
      return e.json(400, {
        error: 'driver_id inválido para o campo registro.',
      })
    }
  }

  var datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''

  if (!datalbusEmail || !datalbusPassword) {
    $app.logger().error('Datalbus credentials not configured', 'email_present', !!datalbusEmail)
    return e.json(503, { error: 'Credenciais do DataBus não configuradas.' })
  }

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_cache (id TEXT PRIMARY KEY, token TEXT, expires INTEGER)',
      )
      .execute()
  } catch (cacheErr) {
    $app.logger().warn('Datalbus cache table creation failed', 'message', String(cacheErr))
  }

  function getCachedToken() {
    try {
      var row = new DynamicModel({ token: '', expires: 0 })
      $app
        .db()
        .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
        .one(row)
      if (row.token && Date.now() < row.expires) {
        $app
          .logger()
          .info('Datalbus: using cached token', 'expires_in_ms', row.expires - Date.now())
        return row.token
      }
      if (row.token) {
        $app.logger().info('Datalbus: cached token expired, will re-authenticate')
      }
    } catch (cacheErr) {
      $app.logger().warn('Datalbus: failed to read cached token', 'message', String(cacheErr))
    }
    return ''
  }

  function saveCachedToken(tokenStr) {
    try {
      $app
        .db()
        .newQuery(
          "INSERT OR REPLACE INTO _datalbus_cache (id, token, expires) VALUES ('session', {:token}, {:expires})",
        )
        .bind({ token: tokenStr, expires: Date.now() + 3600000 })
        .execute()
    } catch (cacheErr) {
      $app.logger().warn('Datalbus: failed to save cached token', 'message', String(cacheErr))
    }
  }

  function clearCachedToken() {
    try {
      $app.db().newQuery("DELETE FROM _datalbus_cache WHERE id = 'session'").execute()
    } catch (cacheErr) {
      $app.logger().warn('Datalbus: failed to clear cached token', 'message', String(cacheErr))
    }
  }

  function authenticateDatalbus() {
    var authRes
    try {
      authRes = $http.send({
        url: 'https://datalbus.com.br:8000/api/v2/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: datalbusEmail, password: datalbusPassword }),
        timeout: 15,
      })
    } catch (err) {
      $app
        .logger()
        .error('Datalbus auth transport error', 'message', err.message, 'stack', String(err))
      return ''
    }

    if (authRes.statusCode !== 200) {
      var authBody = ''
      try {
        authBody = JSON.stringify(authRes.json)
      } catch (_) {
        authBody = String(authRes.body || '')
      }
      $app
        .logger()
        .error('Datalbus auth failed', 'statusCode', authRes.statusCode, 'body', authBody)
      return ''
    }

    var token = ''
    try {
      var jsonData = authRes.json
      if (jsonData) {
        if (typeof jsonData.token === 'string') token = jsonData.token
        else if (typeof jsonData.access_token === 'string') token = jsonData.access_token
        else if (typeof jsonData.jwt === 'string') token = jsonData.jwt
        else if (jsonData.data && typeof jsonData.data.token === 'string')
          token = jsonData.data.token
        else if (jsonData.data && typeof jsonData.data.access_token === 'string')
          token = jsonData.data.access_token
      }
    } catch (parseErr) {
      $app
        .logger()
        .error(
          'Datalbus auth: failed to parse response JSON',
          'message',
          String(parseErr),
          'body',
          String(authRes.body || ''),
        )
      return ''
    }

    if (!token) {
      $app
        .logger()
        .error('Datalbus auth: no token found in response', 'body', String(authRes.body || ''))
      return ''
    }

    saveCachedToken(token)
    $app.logger().info('Datalbus auth success, token cached', 'tokenLength', token.length)
    return token
  }

  function datalbusGet(url, token, label) {
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        timeout: 30,
      })

      if (res.statusCode !== 200) {
        var errBody = ''
        try {
          errBody = JSON.stringify(res.json)
        } catch (_) {
          errBody = String(res.body || '')
        }
        $app
          .logger()
          .error(
            'Datalbus GET failed',
            'label',
            label,
            'url',
            url,
            'statusCode',
            res.statusCode,
            'body',
            errBody,
          )
      }

      var parsedJson = null
      if (res.statusCode === 200 && res.body) {
        try {
          parsedJson = res.json
        } catch (parseErr) {
          $app
            .logger()
            .error(
              'Datalbus GET: failed to parse JSON response',
              'label',
              label,
              'url',
              url,
              'message',
              String(parseErr),
              'bodyPreview',
              String(res.body || '').substring(0, 500),
            )
          return { statusCode: res.statusCode, json: null, parseError: true }
        }
      }

      return { statusCode: res.statusCode, json: parsedJson, parseError: false }
    } catch (err) {
      $app
        .logger()
        .error('Datalbus GET transport error', 'label', label, 'url', url, 'message', err.message)
      return { statusCode: 0, json: null, parseError: false }
    }
  }

  function datalbusGetWithReauth(url, token, label) {
    var result = datalbusGet(url, token, label)

    if (result.statusCode === 401) {
      $app.logger().info('Datalbus: 401 received, reauthenticating', 'label', label)
      clearCachedToken()
      var newToken = authenticateDatalbus()
      if (newToken) {
        $app.logger().info('Datalbus: reauth success, retrying request', 'label', label)
        result = datalbusGet(url, newToken, label + ' (retry)')
        if (result.statusCode === 401) {
          $app.logger().error('Datalbus: still 401 after reauth', 'label', label)
        }
      } else {
        $app.logger().error('Datalbus: reauth failed, cannot retry', 'label', label)
        return { statusCode: 0, json: null, parseError: false, reauthFailed: true }
      }
    }

    return result
  }

  var datalbusToken = getCachedToken()
  if (!datalbusToken) {
    datalbusToken = authenticateDatalbus()
    if (!datalbusToken) {
      return e.json(502, {
        error: 'Falha ao autenticar na API DataBus. Verifique as credenciais configuradas.',
      })
    }
  }

  var startTime = dataInicial + 'T00:00:00'
  var endTime = dataFinal + 'T23:59:59'
  var driverParam = encodeURIComponent(driverField) + '=' + encodeURIComponent(driverId)

  var tripEventsUrl =
    'https://datalbus.com.br:8000/api/v2/trip-events-filtered?start_time=' +
    encodeURIComponent(startTime) +
    '&end_time=' +
    encodeURIComponent(endTime) +
    '&' +
    driverParam
  var scoreUrl =
    'https://datalbus.com.br:8000/api/v2/drivers-score?start_time=' +
    encodeURIComponent(startTime) +
    '&end_time=' +
    encodeURIComponent(endTime) +
    '&' +
    driverParam

  $app
    .logger()
    .info(
      'Datalbus: querying telemetry',
      'driverField',
      driverField,
      'driverId',
      driverId,
      'dataInicial',
      dataInicial,
      'dataFinal',
      dataFinal,
    )

  var tripEventsRes = datalbusGetWithReauth(tripEventsUrl, datalbusToken, 'trip-events-filtered')

  if (tripEventsRes.reauthFailed) {
    return e.json(502, { error: 'Falha ao autenticar na API DataBus durante consulta de eventos.' })
  }

  if (tripEventsRes.parseError) {
    return e.json(502, {
      error:
        'Falha ao processar resposta de eventos da API DataBus. Resposta não é um JSON válido.',
    })
  }

  var scoreRes = datalbusGetWithReauth(scoreUrl, datalbusToken, 'drivers-score')

  if (scoreRes.reauthFailed) {
    return e.json(502, {
      error: 'Falha ao autenticar na API DataBus durante consulta de pontuação.',
    })
  }

  if (scoreRes.parseError) {
    return e.json(502, {
      error:
        'Falha ao processar resposta de pontuação da API DataBus. Resposta não é um JSON válido.',
    })
  }

  if (tripEventsRes.statusCode === 0 && scoreRes.statusCode === 0) {
    clearCachedToken()
    return e.json(502, {
      error: 'Falha de comunicação com a API DataBus. Nenhuma resposta recebida dos endpoints.',
    })
  }

  if (tripEventsRes.statusCode !== 200 && scoreRes.statusCode !== 200) {
    clearCachedToken()
    var failMsg = 'Falha ao buscar dados do DataBus. '
    if (tripEventsRes.statusCode !== 0) {
      failMsg += 'Eventos: HTTP ' + tripEventsRes.statusCode + '. '
    }
    if (scoreRes.statusCode !== 0) {
      failMsg += 'Pontuação: HTTP ' + scoreRes.statusCode + '.'
    }
    return e.json(502, { error: failMsg.trim() })
  }

  var eventos = []
  if (tripEventsRes.statusCode === 200 && tripEventsRes.json) {
    var tripData = tripEventsRes.json
    var eventList = []
    if (Array.isArray(tripData)) {
      eventList = tripData
    } else if (tripData) {
      if (Array.isArray(tripData.events)) eventList = tripData.events
      else if (Array.isArray(tripData.data)) eventList = tripData.data
      else if (Array.isArray(tripData.items)) eventList = tripData.items
      else if (tripData.results && Array.isArray(tripData.results)) eventList = tripData.results
      else if (tripData.trip_events && Array.isArray(tripData.trip_events))
        eventList = tripData.trip_events
    }

    for (var i = 0; i < eventList.length; i++) {
      var ev = eventList[i]
      eventos.push({
        data: String(
          ev.data ||
            ev.date_time ||
            ev.timestamp ||
            ev.created_at ||
            ev.datetime ||
            ev.start_time ||
            '',
        ),
        tipo: String(ev.tipo || ev.type || ev.event_type || ev.event || ev.event_name || ''),
        localizacao: String(
          ev.localizacao || ev.location || ev.address || ev.local || ev.place || '',
        ),
        veiculo: String(
          ev.veiculo || ev.vehicle || ev.plate || ev.placa || ev.bus || ev.vehicle_plate || '',
        ),
        gravidade: String(
          ev.gravidade || ev.severity || ev.gravity || ev.level || ev.priority || '',
        ),
      })
    }
  }

  var pontuacao = {}
  if (scoreRes.statusCode === 200 && scoreRes.json) {
    if (Array.isArray(scoreRes.json) && scoreRes.json.length > 0) {
      pontuacao = scoreRes.json[0]
    } else if (!Array.isArray(scoreRes.json)) {
      pontuacao = scoreRes.json
    } else {
      pontuacao = { items: scoreRes.json }
    }
  }

  var resumo = {}
  for (var j = 0; j < eventos.length; j++) {
    var tipo = eventos[j].tipo
    if (tipo) {
      if (!resumo[tipo]) resumo[tipo] = 0
      resumo[tipo]++
    }
  }

  $app
    .logger()
    .info(
      'Datalbus: telemetry query success',
      'eventosCount',
      eventos.length,
      'resumoKeys',
      Object.keys(resumo).length,
      'hasScore',
      Object.keys(pontuacao).length > 0,
    )

  return e.json(200, {
    pontuacao: pontuacao,
    eventos: eventos,
    resumo: resumo,
  })
})
