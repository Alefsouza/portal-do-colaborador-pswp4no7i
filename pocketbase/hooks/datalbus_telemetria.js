routerAdd('POST', '/backend/v1/datalbus/telemetria', (e) => {
  var authHeader = e.requestInfo().headers['authorization'] || ''
  if (!authHeader.replace(/^Bearer\s+/i, '').trim()) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  var body = e.requestInfo().body || {}
  var dataInicial = (body.data_inicial || '').trim()
  var dataFinal = (body.data_final || '').trim()
  var workerIdRaw = (body.worker_id || '').trim()

  if (!dataInicial || !dataFinal || !workerIdRaw) {
    return e.json(400, { error: 'Parâmetros obrigatórios: data_inicial, data_final e worker_id.' })
  }

  var workerId = parseInt(workerIdRaw, 10)
  if (isNaN(workerId) || workerId <= 0) {
    return e.json(400, { error: 'worker_id inválido' })
  }

  var dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dataInicial) || !dateRegex.test(dataFinal)) {
    return e.json(400, { error: 'Datas inválidas. Use o formato YYYY-MM-DD.' })
  }

  var parsedInicial = new Date(dataInicial + 'T00:00:00')
  var parsedFinal = new Date(dataFinal + 'T23:59:59')
  if (isNaN(parsedInicial.getTime()) || isNaN(parsedFinal.getTime())) {
    return e.json(400, { error: 'Datas inválidas. Use o formato YYYY-MM-DD.' })
  }

  if (parsedInicial > parsedFinal) {
    return e.json(400, { error: 'Data inicial deve ser anterior ou igual à data final.' })
  }

  var diffMs = parsedFinal.getTime() - parsedInicial.getTime()
  var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 31) {
    return e.json(400, {
      error: 'O período máximo permitido é de 31 dias. Selecione um intervalo menor.',
    })
  }

  var datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''
  var datalbusTenancy = $secrets.get('DATALBUS_TENANCY') || ''

  if (!datalbusEmail || !datalbusPassword || !datalbusTenancy) {
    $app
      .logger()
      .error(
        'Datalbus credentials not configured',
        'email_present',
        !!datalbusEmail,
        'password_present',
        !!datalbusPassword,
        'tenancy_present',
        !!datalbusTenancy,
      )
    return e.json(500, {
      error:
        'Credenciais do DataBus não configuradas. Verifique DATALBUS_EMAIL, DATALBUS_PASSWORD e DATALBUS_TENANCY.',
    })
  }

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_cache (id TEXT PRIMARY KEY, token TEXT, expires INTEGER)',
      )
      .execute()
  } catch (_) {}

  function getCachedToken() {
    try {
      var row = new DynamicModel({ token: '', expires: 0 })
      $app
        .db()
        .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
        .one(row)
      if (row.token && Date.now() < row.expires) return row.token
    } catch (_) {}
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
    } catch (_) {}
  }

  function clearCachedToken() {
    try {
      $app.db().newQuery("DELETE FROM _datalbus_cache WHERE id = 'session'").execute()
    } catch (_) {}
  }

  function authenticateDatalbus() {
    var authRes
    try {
      authRes = $http.send({
        url: 'https://datalbus.com.br:8000/api/v2/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenancy': datalbusTenancy },
        body: JSON.stringify({ email: datalbusEmail, password: datalbusPassword }),
        timeout: 15,
      })
    } catch (err) {
      $app.logger().error('Datalbus auth transport error', 'message', err.message)
      return ''
    }
    if (authRes.statusCode !== 200) {
      $app.logger().error('Datalbus auth failed', 'statusCode', authRes.statusCode)
      return ''
    }
    var token = ''
    try {
      var j = authRes.json
      if (j) {
        if (typeof j.token === 'string') token = j.token
        else if (typeof j.access_token === 'string') token = j.access_token
        else if (typeof j.jwt === 'string') token = j.jwt
        else if (j.data && typeof j.data.token === 'string') token = j.data.token
        else if (j.data && typeof j.data.access_token === 'string') token = j.data.access_token
      }
    } catch (_) {}
    if (token) saveCachedToken(token)
    return token
  }

  function fetchScore(token) {
    var url =
      'https://datalbus.com.br:8000/api/v2/drivers/score?dtIni=' +
      encodeURIComponent(dataInicial) +
      '&dtFin=' +
      encodeURIComponent(dataFinal) +
      '&workerId[]=' +
      workerId
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenancy': datalbusTenancy,
          Accept: 'application/json',
        },
        timeout: 30,
      })
      var parsed = null
      if (res.statusCode === 200 && res.body) {
        try {
          parsed = res.json
        } catch (_) {}
      }
      return { statusCode: res.statusCode, json: parsed, body: String(res.body || '') }
    } catch (err) {
      $app.logger().error('Datalbus score fetch transport error', 'message', err.message)
      return { statusCode: 0, json: null, body: '' }
    }
  }

  var datalbusToken = getCachedToken()
  if (!datalbusToken) {
    datalbusToken = authenticateDatalbus()
    if (!datalbusToken) {
      return e.json(502, {
        error: 'Erro de autenticação com a API DataBus. Tente novamente em instantes.',
      })
    }
  }

  var scoreRes = fetchScore(datalbusToken)

  if (scoreRes.statusCode === 401) {
    clearCachedToken()
    datalbusToken = authenticateDatalbus()
    if (!datalbusToken) {
      return e.json(502, {
        error: 'Erro de autenticação com a API DataBus. Tente novamente em instantes.',
      })
    }
    scoreRes = fetchScore(datalbusToken)
    if (scoreRes.statusCode === 401) {
      return e.json(502, {
        error: 'Erro de autenticação com a API DataBus. Tente novamente em instantes.',
      })
    }
  }

  if (scoreRes.statusCode === 0) {
    return e.json(502, { error: 'Falha de comunicação com a API DataBus.' })
  }
  if (scoreRes.statusCode !== 200) {
    var errMsg = 'Falha ao buscar dados do DataBus.'
    var errBody = scoreRes.body || ''
    var errJson = null
    try {
      errJson = scoreRes.json || (errBody ? JSON.parse(errBody) : null)
    } catch (_) {}
    $app
      .logger()
      .error(
        'Datalbus API error response',
        'dataBusStatus',
        scoreRes.statusCode,
        'dataBusBody',
        errBody,
        'dataBusJson',
        errJson ? JSON.stringify(errJson) : 'null',
      )
    return e.json(502, {
      error: errMsg,
      details: {
        dataBusStatus: scoreRes.statusCode,
        dataBusBody: errBody,
      },
    })
  }

  var rawData = scoreRes.json || {}
  var eventList = []
  if (Array.isArray(rawData)) {
    eventList = rawData
  } else if (rawData) {
    if (Array.isArray(rawData.events)) eventList = rawData.events
    else if (Array.isArray(rawData.eventos)) eventList = rawData.eventos
    else if (Array.isArray(rawData.data)) eventList = rawData.data
    else if (Array.isArray(rawData.items)) eventList = rawData.items
    else if (rawData.results && Array.isArray(rawData.results)) eventList = rawData.results
    else if (rawData.score_events && Array.isArray(rawData.score_events))
      eventList = rawData.score_events
  }

  var eventos = []
  for (var i = 0; i < eventList.length; i++) {
    var ev = eventList[i]
    eventos.push({
      data: String(
        ev.data ||
          ev.date_time ||
          ev.timestamp ||
          ev.created_at ||
          ev.datetime ||
          ev.data_hora ||
          '',
      ),
      tipo: String(
        ev.tipo ||
          ev.type ||
          ev.event_type ||
          ev.event ||
          ev.event_name ||
          ev.descricao_evento ||
          '',
      ),
      veiculo: String(
        ev.veiculo ||
          ev.vehicle ||
          ev.plate ||
          ev.placa ||
          ev.bus ||
          ev.vehicle_plate ||
          ev.prefixo ||
          '',
      ),
      descricao: String(
        ev.descricao ||
          ev.description ||
          ev.localizacao ||
          ev.location ||
          ev.address ||
          ev.local ||
          ev.place ||
          '',
      ),
    })
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
      'Datalbus: telemetry success',
      'eventosCount',
      eventos.length,
      'resumoKeys',
      Object.keys(resumo).length,
    )

  return e.json(200, {
    pontuacao: rawData,
    eventos: eventos,
    resumo: resumo,
  })
})
