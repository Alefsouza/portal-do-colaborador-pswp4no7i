routerAdd('POST', '/backend/v1/datalbus/telemetria', (e) => {
  const authHeader = e.requestInfo().headers['authorization'] || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!authToken) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  const body = e.requestInfo().body || {}
  const dataInicial = (body.data_inicial || '').trim()
  const dataFinal = (body.data_final || '').trim()
  const driverId = (body.driver_id || '').trim()

  if (!dataInicial || !dataFinal) {
    var fieldErrors = {}
    if (!dataInicial) fieldErrors['data_inicial'] = 'Data inicial é obrigatória'
    if (!dataFinal) fieldErrors['data_final'] = 'Data final é obrigatória'
    return e.json(400, { error: 'Campos obrigatórios não fornecidos', details: fieldErrors })
  }

  if (!driverId) {
    return e.json(400, { error: 'driver_id é obrigatório' })
  }

  const driverField = $secrets.get('DATALBUS_DRIVER_FIELD') || 'registro'

  const datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  const datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''

  if (!datalbusEmail || !datalbusPassword) {
    return e.json(503, { error: 'Credenciais do DataBus não configuradas.' })
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
      const row = new DynamicModel({ token: '', expires: 0 })
      $app
        .db()
        .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
        .one(row)
      if (row.token && Date.now() < row.expires) {
        return row.token
      }
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
        headers: { 'Content-Type': 'application/json' },
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
      var jsonData = authRes.json
      if (jsonData) {
        if (typeof jsonData.token === 'string') token = jsonData.token
        else if (typeof jsonData.access_token === 'string') token = jsonData.access_token
        else if (typeof jsonData.jwt === 'string') token = jsonData.jwt
        else if (jsonData.data && typeof jsonData.data.token === 'string')
          token = jsonData.data.token
      }
    } catch (_) {}

    if (!token) {
      $app.logger().error('Datalbus auth: no token in response')
      return ''
    }

    saveCachedToken(token)
    return token
  }

  function datalbusGet(url, token) {
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        timeout: 30,
      })
      return { statusCode: res.statusCode, json: res.json }
    } catch (err) {
      $app.logger().error('Datalbus GET error', 'message', err.message, 'url', url)
      return { statusCode: 0, json: null }
    }
  }

  var datalbusToken = getCachedToken()
  if (!datalbusToken) {
    datalbusToken = authenticateDatalbus()
    if (!datalbusToken) {
      return e.json(502, { error: 'Falha na autenticação com o DataBus.' })
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

  var tripEventsRes = datalbusGet(tripEventsUrl, datalbusToken)

  if (tripEventsRes.statusCode === 401) {
    clearCachedToken()
    datalbusToken = authenticateDatalbus()
    if (datalbusToken) {
      tripEventsRes = datalbusGet(tripEventsUrl, datalbusToken)
    } else {
      return e.json(502, { error: 'Falha na reautenticação com o DataBus.' })
    }
  }

  var scoreRes = datalbusGet(scoreUrl, datalbusToken)

  if (scoreRes.statusCode === 401) {
    clearCachedToken()
    datalbusToken = authenticateDatalbus()
    if (datalbusToken) {
      scoreRes = datalbusGet(scoreUrl, datalbusToken)
    } else {
      return e.json(502, { error: 'Falha na reautenticação com o DataBus.' })
    }
  }

  if (tripEventsRes.statusCode !== 200 && scoreRes.statusCode !== 200) {
    clearCachedToken()
    return e.json(502, { error: 'Falha ao buscar dados do DataBus.' })
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
    }

    for (var i = 0; i < eventList.length; i++) {
      var ev = eventList[i]
      eventos.push({
        data: String(ev.data || ev.date_time || ev.timestamp || ev.created_at || ev.datetime || ''),
        tipo: String(ev.tipo || ev.type || ev.event_type || ev.event || ''),
        localizacao: String(ev.localizacao || ev.location || ev.address || ev.local || ''),
        veiculo: String(ev.veiculo || ev.vehicle || ev.plate || ev.placa || ev.bus || ''),
        gravidade: String(ev.gravidade || ev.severity || ev.gravity || ev.level || ''),
      })
    }
  }

  var pontuacao = {}
  if (scoreRes.statusCode === 200 && scoreRes.json) {
    pontuacao = scoreRes.json
  }

  var resumo = {}
  for (var j = 0; j < eventos.length; j++) {
    var tipo = eventos[j].tipo
    if (tipo) {
      if (!resumo[tipo]) resumo[tipo] = 0
      resumo[tipo]++
    }
  }

  return e.json(200, {
    pontuacao: pontuacao,
    eventos: eventos,
    resumo: resumo,
  })
})
