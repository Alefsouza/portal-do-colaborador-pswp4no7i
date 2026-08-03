routerAdd('POST', '/backend/v1/datalbus/telemetria', async (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

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
    return e.json(400, { error: 'O período máximo permitido é de 31 dias.' })
  }

  var API_TIMEOUT = 15
  var TRIPS_TIMEOUT = 25
  var SCORE_TIMEOUT = 25
  var GLOBAL_TIMEOUT_MS = 55000
  var MAX_TRIPS = 40
  var globalDeadline = Date.now() + GLOBAL_TIMEOUT_MS

  var datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''
  var datalbusTenancy = $secrets.get('DATALBUS_TENANCY') || ''
  var datalbusXTenancy = $secrets.get('DATALBUS_X_TENANCY') || datalbusTenancy

  if (!datalbusEmail || !datalbusPassword || !datalbusTenancy) {
    $app.logger().error('Datalbus credentials not configured')
    return e.json(500, { error: 'Credenciais do DataBus não configuradas.' })
  }

  var debugCalls = []
  var debugErrors = []
  var authFailed = false
  var currentToken = ''

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
        headers: { 'Content-Type': 'application/json', 'X-Tenancy': datalbusXTenancy },
        body: JSON.stringify({ email: datalbusEmail, password: datalbusPassword }),
        timeout: API_TIMEOUT,
      })
    } catch (err) {
      $app.logger().error('Datalbus auth error', 'message', err.message)
      return ''
    }
    if (authRes.statusCode !== 200) return ''
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

  function extractParams(url) {
    var params = {}
    var qIdx = url.indexOf('?')
    if (qIdx >= 0) {
      var pairs = url.substring(qIdx + 1).split('&')
      for (var i = 0; i < pairs.length; i++) {
        var eqIdx = pairs[i].indexOf('=')
        if (eqIdx >= 0) {
          params[decodeURIComponent(pairs[i].substring(0, eqIdx))] = decodeURIComponent(
            pairs[i].substring(eqIdx + 1),
          )
        }
      }
    }
    return params
  }

  function getResponsePreview(json, body) {
    var s = ''
    if (json) {
      try {
        s = JSON.stringify(json)
      } catch (_) {
        s = ''
      }
    }
    if (!s && body) {
      s = String(body)
    }
    return s ? s.substring(0, 300) : ''
  }

  function apiGet(url, token, timeout) {
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenancy': datalbusXTenancy,
          Accept: 'application/json',
        },
        timeout: timeout || API_TIMEOUT,
      })
      var parsed = null
      if (res.body) {
        try {
          parsed = res.json
        } catch (_) {}
      }
      debugCalls.push({
        endpoint: url,
        params: extractParams(url),
        statusCode: res.statusCode,
        responseFirstLine: getResponsePreview(parsed, res.body),
      })
      return { statusCode: res.statusCode, json: parsed, body: String(res.body || '') }
    } catch (err) {
      debugCalls.push({
        endpoint: url,
        params: extractParams(url),
        statusCode: 0,
        responseFirstLine: 'Transport error: ' + (err.message || ''),
      })
      return { statusCode: 0, json: null, body: '' }
    }
  }

  function apiGetWithRetry(url, timeout) {
    var res = apiGet(url, currentToken, timeout)
    if (res.statusCode === 401) {
      clearCachedToken()
      currentToken = authenticate()
      if (!currentToken) {
        debugErrors.push({ endpoint: url, error: 'Re-autenticação falhou após 401' })
        authFailed = true
        return res
      }
      res = apiGet(url, currentToken, timeout)
      if (res.statusCode === 401) {
        debugErrors.push({ endpoint: url, error: 'Segunda tentativa também retornou 401' })
        authFailed = true
      }
    }
    return res
  }

  function extractArray(data) {
    if (Array.isArray(data)) return data
    if (!data) return []
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.events)) return data.events
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.results)) return data.results
    if (Array.isArray(data.eventos)) return data.eventos
    if (Array.isArray(data.trips)) return data.trips
    if (data.score_events && Array.isArray(data.score_events)) return data.score_events
    return []
  }

  function isTechnicalEvent(tipo) {
    var l = String(tipo).toLowerCase()
    if (l.indexOf('histograma') === 0) return true
    if (l.indexOf('sumario') >= 0 && l.indexOf('retarder') >= 0) return true
    if (l.indexOf('neutro') >= 0) return true
    return false
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n)
  }

  function getDatesInRange(start, end) {
    var dates = []
    var current = new Date(start + 'T00:00:00')
    var endDate = new Date(end + 'T00:00:00')
    while (current <= endDate) {
      dates.push(
        current.getFullYear() + '-' + pad2(current.getMonth() + 1) + '-' + pad2(current.getDate()),
      )
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  function getTripId(trip) {
    return trip.id || trip.trip_id || trip.tripId || ''
  }

  function getTripDate(trip) {
    var d = trip._queryDate || trip.date || trip.data || trip.data_viagem || trip.start_date || ''
    if (!d) return ''
    var s = String(d)
    var tIdx = s.indexOf('T')
    if (tIdx >= 0) return s.substring(0, tIdx)
    var spIdx = s.indexOf(' ')
    if (spIdx >= 0) return s.substring(0, spIdx)
    return s
  }

  function tripMatchesWorkerId(trip) {
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips)) return false
    for (var s = 0; s < subtrips.length; s++) {
      var subWorkerNum = parseInt(
        String(subtrips[s].worker_id || subtrips[s].workerId || subtrips[s].worker_id_int || ''),
        10,
      )
      if (!isNaN(subWorkerNum) && subWorkerNum === workerId) return true
    }
    return false
  }

  function fetchEventsForTrip(trip) {
    var tripId = getTripId(trip)
    var tripDate = getTripDate(trip)
    if (!tripId) return { events: [], error: 'No trip ID', tripId: tripId }
    var events = []
    var page = 1
    var hasMore = true
    var MAX_PAGES = 5
    var baseUrl =
      'https://datalbus.com.br:8000/api/v2/trips/' + encodeURIComponent(String(tripId)) + '/events'
    var separator = '?'
    if (tripDate) {
      baseUrl += '?date=' + encodeURIComponent(tripDate)
      separator = '&'
    }
    while (hasMore) {
      if (Date.now() > globalDeadline)
        return { events: events, error: 'Global timeout reached', tripId: tripId }
      var url = baseUrl + separator + 'per_page=100&page=' + page
      var res = apiGetWithRetry(url, TRIPS_TIMEOUT)
      if (res.statusCode !== 200 || !res.json)
        return { events: events, error: 'API error: ' + res.statusCode, tripId: tripId }
      var pageEvents = extractArray(res.json)
      for (var j = 0; j < pageEvents.length; j++) events.push(pageEvents[j])
      if (pageEvents.length < 100 || pageEvents.length === 0 || page >= MAX_PAGES) hasMore = false
      else page++
    }
    return { events: events, error: null, tripId: tripId }
  }

  function fetchTripsPrimary() {
    var allTrips = []
    var dates = getDatesInRange(dataInicial, dataFinal)
    for (var d = 0; d < dates.length; d++) {
      if (Date.now() > globalDeadline) break
      var dateStr = dates[d]
      var page = 1
      var MAX_PAGES = 10
      while (page <= MAX_PAGES) {
        if (Date.now() > globalDeadline) break
        var url =
          'https://datalbus.com.br:8000/api/v2/trips?date=' +
          encodeURIComponent(dateStr) +
          '&per_page=100&page=' +
          page
        var res = apiGetWithRetry(url, TRIPS_TIMEOUT)
        if (res.statusCode !== 200 || !res.json) break
        var pageTrips = extractArray(res.json)
        for (var i = 0; i < pageTrips.length; i++) {
          pageTrips[i]._queryDate = dateStr
          allTrips.push(pageTrips[i])
        }
        if (pageTrips.length < 100 || pageTrips.length === 0) break
        page++
      }
    }
    var matched = []
    for (var m = 0; m < allTrips.length; m++) {
      if (tripMatchesWorkerId(allTrips[m])) matched.push(allTrips[m])
    }
    return matched
  }

  function fetchTripsFallback() {
    var allTrips = []
    var dates = getDatesInRange(dataInicial, dataFinal)
    for (var d = 0; d < dates.length; d++) {
      if (Date.now() > globalDeadline) break
      var dateStr = dates[d]
      var page = 1
      var MAX_PAGES = 10
      while (page <= MAX_PAGES) {
        if (Date.now() > globalDeadline) break
        var url =
          'https://datalbus.com.br:8000/api/v2/trips?date=' +
          encodeURIComponent(dateStr) +
          '&per_page=100&page=' +
          page
        var res = apiGetWithRetry(url, TRIPS_TIMEOUT)
        if (res.statusCode !== 200 || !res.json) break
        var pageTrips = extractArray(res.json)
        for (var i = 0; i < pageTrips.length; i++) {
          pageTrips[i]._queryDate = dateStr
          allTrips.push(pageTrips[i])
        }
        if (pageTrips.length < 100 || pageTrips.length === 0) break
        page++
      }
    }
    var matched = []
    for (var m = 0; m < allTrips.length; m++) {
      if (tripMatchesWorkerId(allTrips[m])) matched.push(allTrips[m])
    }
    return matched
  }

  function fetchScore() {
    var url =
      'https://datalbus.com.br:8000/api/v2/drivers/score?dtIni=' +
      encodeURIComponent(dataInicial) +
      '&dtFin=' +
      encodeURIComponent(dataFinal) +
      '&workerId[]=' +
      workerId
    var res = apiGetWithRetry(url, SCORE_TIMEOUT)
    if (res.statusCode !== 200 || !res.json) {
      debugErrors.push({
        endpoint: url,
        error: 'Score request failed with status ' + res.statusCode,
      })
      return null
    }
    return res
  }

  try {
    currentToken = getCachedToken()
    if (!currentToken) {
      currentToken = authenticate()
      if (!currentToken) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
    }

    var scoreRes = fetchScore()
    authFailed = false

    var trips = fetchTripsPrimary()
    if (authFailed) {
      return e.json(502, {
        error: 'Falha na autenticação com a DataBus após re-tentativa.',
        debug: { calls: debugCalls, errors: debugErrors },
      })
    }
    if (!trips) trips = []

    if (trips.length === 0) {
      return e.json(200, {
        pontuacao: null,
        eventos: [],
        resumo: {},
        total_viagens: 0,
        metricas: { distancia_total: 0, duracao_total: 0, total_viagens: 0 },
        partialData: false,
        errors: [],
        debug: { calls: debugCalls, errors: debugErrors },
      })
    }

    trips.sort(function (a, b) {
      return getTripDate(b).localeCompare(getTripDate(a))
    })

    var partialData = false
    if (trips.length > MAX_TRIPS) {
      partialData = true
      trips = trips.slice(0, MAX_TRIPS)
    }

    var allRawEvents = []
    var errors = []

    for (var i = 0; i < trips.length; i++) {
      if (Date.now() > globalDeadline) {
        partialData = true
        for (var j = i; j < trips.length; j++) {
          var skipId = getTripId(trips[j])
          errors.push({ tripId: skipId, error: 'Skipped due to global timeout' })
          debugErrors.push({ tripId: skipId, error: 'Skipped due to global timeout' })
        }
        break
      }
      var result = fetchEventsForTrip(trips[i])
      if (result.error) {
        errors.push({ tripId: result.tripId || getTripId(trips[i]), error: result.error })
        debugErrors.push({ tripId: result.tripId || getTripId(trips[i]), error: result.error })
      }
      if (result.events && result.events.length > 0) {
        for (var p = 0; p < result.events.length; p++) allRawEvents.push(result.events[p])
      }
    }

    if (Date.now() > globalDeadline) partialData = true

    var eventos = []
    var pontuacao = null
    for (var n = 0; n < allRawEvents.length; n++) {
      var ev = allRawEvents[n]
      var tipo = String(
        ev.event_type_description ||
          ev.event_type ||
          ev.tipo ||
          ev.type ||
          ev.event_name ||
          ev.descricao_evento ||
          '',
      )

      if (isTechnicalEvent(tipo)) continue

      var tipoLower = tipo.toLowerCase()
      if (tipoLower.indexOf('pontuacao') >= 0 || tipoLower.indexOf('pontuação') >= 0) {
        var scoreVal = ev.score || ev.pontuacao || ev.valor || ev.amount || ev.value
        if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
          pontuacao = parseFloat(String(scoreVal))
          if (isNaN(pontuacao)) pontuacao = null
        }
        continue
      }

      eventos.push({
        data: String(
          ev.time ||
            ev.event_date ||
            ev.data ||
            ev.date_time ||
            ev.timestamp ||
            ev.created_at ||
            ev.datetime ||
            ev.data_hora ||
            '',
        ),
        tipo: tipo,
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
        quantidade:
          ev.amount !== undefined ? ev.amount : ev.quantidade !== undefined ? ev.quantidade : 0,
      })
    }

    var resumo = {}
    for (var j2 = 0; j2 < eventos.length; j2++) {
      var t = eventos[j2].tipo
      if (t) {
        if (!resumo[t]) resumo[t] = 0
        resumo[t]++
      }
    }

    var distanciaTotal = 0
    var duracaoTotal = 0
    for (var k2 = 0; k2 < trips.length; k2++) {
      var mileageNum = parseFloat(
        String(trips[k2].mileage || trips[k2].distancia || trips[k2].km || 0),
      )
      if (!isNaN(mileageNum)) distanciaTotal += mileageNum
      var driveDurNum = parseFloat(
        String(
          trips[k2].drive_duration || trips[k2].duracao_direcao || trips[k2].driving_duration || 0,
        ),
      )
      if (!isNaN(driveDurNum)) duracaoTotal += driveDurNum
    }

    var finalPontuacao =
      pontuacao !== null ? pontuacao : scoreRes && scoreRes.json ? scoreRes.json : null

    return e.json(200, {
      pontuacao: finalPontuacao,
      eventos: eventos,
      resumo: resumo,
      total_viagens: trips.length,
      metricas: { distancia_total: distanciaTotal, duracao_total: duracaoTotal },
      partialData: partialData,
      errors: errors,
      debug: { calls: debugCalls, errors: debugErrors },
    })
  } catch (err) {
    $app.logger().error('Datalbus telemetry unexpected error', 'message', String(err))
    return e.json(502, {
      error: 'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.',
      debug: { calls: debugCalls, errors: debugErrors },
    })
  }
})
