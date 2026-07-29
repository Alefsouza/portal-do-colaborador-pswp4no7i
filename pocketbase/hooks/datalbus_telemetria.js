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

  var diffDays = Math.ceil((parsedFinal.getTime() - parsedInicial.getTime()) / 86400000)
  if (diffDays > 31) {
    return e.json(400, {
      error: 'O período máximo permitido é de 31 dias. Selecione um intervalo menor.',
    })
  }

  var datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''
  var datalbusTenancy = $secrets.get('DATALBUS_TENANCY') || ''

  if (!datalbusEmail || !datalbusPassword || !datalbusTenancy) {
    $app.logger().error('Datalbus credentials not configured')
    return e.json(500, { error: 'Credenciais do DataBus não configuradas.' })
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

  function saveCachedToken(t) {
    try {
      $app
        .db()
        .newQuery(
          "INSERT OR REPLACE INTO _datalbus_cache (id, token, expires) VALUES ('session', {:t}, {:e})",
        )
        .bind({ t: t, e: Date.now() + 3600000 })
        .execute()
    } catch (_) {}
  }

  function clearCachedToken() {
    try {
      $app.db().newQuery("DELETE FROM _datalbus_cache WHERE id = 'session'").execute()
    } catch (_) {}
  }

  function authenticate() {
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
      $app.logger().error('Datalbus auth error', 'message', err.message)
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

  function apiGet(url, token) {
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
      if (res.body) {
        try {
          parsed = res.json
        } catch (_) {}
      }
      return { statusCode: res.statusCode, json: parsed, body: String(res.body || '') }
    } catch (err) {
      $app.logger().error('Datalbus GET error', 'message', err.message, 'url', url)
      return { statusCode: 0, json: null, body: '' }
    }
  }

  function extractArray(data) {
    if (Array.isArray(data)) return data
    if (!data) return []
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.events)) return data.events
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.results)) return data.results
    if (Array.isArray(data.eventos)) return data.eventos
    if (data.score_events && Array.isArray(data.score_events)) return data.score_events
    return []
  }

  function fetchScore(token) {
    var url =
      'https://datalbus.com.br:8000/api/v2/drivers/score?dtIni=' +
      encodeURIComponent(dataInicial) +
      '&dtFin=' +
      encodeURIComponent(dataFinal) +
      '&workerId[]=' +
      workerId
    return apiGet(url, token)
  }

  function fetchEvents(token) {
    var primaryUrl =
      'https://datalbus.com.br:8000/api/v2/trips/events/filtered?driver_id=' +
      workerId +
      '&start_date=' +
      encodeURIComponent(dataInicial) +
      '&end_date=' +
      encodeURIComponent(dataFinal) +
      '&per_page=100'
    var res = apiGet(primaryUrl, token)
    if (res.statusCode === 200 && res.json) {
      var list = extractArray(res.json)
      if (list.length > 0) return list
    }

    $app
      .logger()
      .info(
        'Datalbus: events/filtered failed or empty, trying fallback',
        'statusCode',
        res.statusCode,
      )
    var tripsUrl =
      'https://datalbus.com.br:8000/api/v2/trips?driver_id=' +
      workerId +
      '&start_date=' +
      encodeURIComponent(dataInicial) +
      '&end_date=' +
      encodeURIComponent(dataFinal)
    var tripsRes = apiGet(tripsUrl, token)
    if (tripsRes.statusCode !== 200 || !tripsRes.json) return []

    var tripList = extractArray(tripsRes.json)
    var allEvents = []
    for (var i = 0; i < tripList.length; i++) {
      var tripId = tripList[i].id || tripList[i].trip_id || tripList[i].tripId || ''
      if (!tripId) continue
      var teUrl =
        'https://datalbus.com.br:8000/api/v2/trip-events?trip_id=' +
        encodeURIComponent(String(tripId))
      var teRes = apiGet(teUrl, token)
      if (teRes.statusCode === 200 && teRes.json) {
        var tl = extractArray(teRes.json)
        for (var j = 0; j < tl.length; j++) allEvents.push(tl[j])
      }
    }
    return allEvents
  }

  var datalbusToken = getCachedToken()
  if (!datalbusToken) {
    datalbusToken = authenticate()
    if (!datalbusToken)
      return e.json(502, {
        error: 'Erro de autenticação com a API DataBus. Tente novamente em instantes.',
      })
  }

  var scoreRes = fetchScore(datalbusToken)

  if (scoreRes.statusCode === 401) {
    clearCachedToken()
    datalbusToken = authenticate()
    if (!datalbusToken) return e.json(502, { error: 'Falha na autenticação com a DataBus' })
    scoreRes = fetchScore(datalbusToken)
    if (scoreRes.statusCode === 401)
      return e.json(502, { error: 'Falha na autenticação com a DataBus' })
  }

  var eventsList = fetchEvents(datalbusToken)

  var rawData = scoreRes.json || {}

  var eventos = []
  for (var i = 0; i < eventsList.length; i++) {
    var ev = eventsList[i]
    eventos.push({
      data: String(
        ev.event_date ||
          ev.data ||
          ev.date_time ||
          ev.timestamp ||
          ev.created_at ||
          ev.datetime ||
          ev.data_hora ||
          '',
      ),
      tipo: String(
        ev.event_type_description ||
          ev.event_type ||
          ev.tipo ||
          ev.type ||
          ev.event_name ||
          ev.descricao_evento ||
          '',
      ),
      veiculo: String(
        ev.asset_id ||
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
        ev.description ||
          ev.descricao ||
          ev.localizacao ||
          ev.location ||
          ev.address ||
          ev.local ||
          ev.place ||
          '',
      ),
      duracao: ev.duration || ev.duracao || ev.duration_seconds || 0,
      latitude: ev.latitude || ev.lat || 0,
      longitude: ev.longitude || ev.lng || ev.lon || 0,
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
      'eventos',
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
