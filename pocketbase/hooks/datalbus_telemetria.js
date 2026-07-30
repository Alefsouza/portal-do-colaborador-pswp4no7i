routerAdd('POST', '/backend/v1/datalbus/telemetria', (e) => {
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
    return e.json(400, {
      error: 'O período máximo permitido é de 31 dias. Selecione um intervalo menor.',
    })
  }

  var datalbusEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var datalbusPassword = $secrets.get('DATALBUS_PASSWORD') || ''
  var datalbusTenancy = $secrets.get('DATALBUS_TENANCY') || ''
  var datalbusXTenancy = $secrets.get('DATALBUS_X_TENANCY') || datalbusTenancy

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
        headers: { 'Content-Type': 'application/json', 'X-Tenancy': datalbusXTenancy },
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
    $app.logger().info('Datalbus API request', 'url', url, 'method', 'GET')
    try {
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenancy': datalbusXTenancy,
          Accept: 'application/json',
        },
        timeout: 30,
      })
      var rawBody = String(res.body || '')
      $app
        .logger()
        .info(
          'Datalbus API response',
          'url',
          url,
          'statusCode',
          res.statusCode,
          'body',
          rawBody.substring(0, 2000),
        )
      var parsed = null
      if (res.body) {
        try {
          parsed = res.json
        } catch (_) {}
      }
      return { statusCode: res.statusCode, json: parsed, body: rawBody }
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
    if (Array.isArray(data.trips)) return data.trips
    if (data.score_events && Array.isArray(data.score_events)) return data.score_events
    return []
  }

  var TECHNICAL_EVENTS = {
    'Histograma Acelerômetro': true,
    'Histograma de tensão do alternador': true,
    'Histograma do acelerador': true,
    'Histograma de uso do freio motor': true,
    'Sumario de uso do Retarder': true,
    'Utilização do Neutro Automático': true,
  }

  function isTechnicalEvent(tipo) {
    return !!TECHNICAL_EVENTS[tipo]
  }

  function getTripId(trip) {
    return trip.id || trip.trip_id || trip.tripId || ''
  }

  function getTripDate(trip) {
    var d = trip.date || trip.data || trip.data_viagem || trip.start_date || ''
    if (!d) return ''
    var parts = String(d).split('T')
    return parts[0] || ''
  }

  function tripMatchesWorkerId(trip) {
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips)) return false
    for (var s = 0; s < subtrips.length; s++) {
      var sub = subtrips[s]
      var subWorkerRaw = sub.worker_id || sub.workerId || sub.worker_id_int || ''
      var subWorkerNum = parseInt(String(subWorkerRaw), 10)
      if (!isNaN(subWorkerNum) && subWorkerNum === workerId) {
        return true
      }
    }
    return false
  }

  function fetchEventsForTrip(tripId, tripDate, token) {
    var events = []
    var page = 1
    var hasMore = true

    var baseUrl =
      'https://datalbus.com.br:8000/api/v2/trips/' + encodeURIComponent(String(tripId)) + '/events'
    if (tripDate) {
      baseUrl += '?date=' + encodeURIComponent(tripDate)
    }

    while (hasMore) {
      var separator = baseUrl.indexOf('?') >= 0 ? '&' : '?'
      var url = baseUrl + separator + 'per_page=100&page=' + page
      var res = apiGet(url, token)
      if (res.statusCode === 200 && res.json) {
        var pageEvents = extractArray(res.json)
        for (var j = 0; j < pageEvents.length; j++) events.push(pageEvents[j])
        if (pageEvents.length < 100 || pageEvents.length === 0) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }

    return events
  }

  function fetchTripsPrimary(token) {
    var allTrips = []
    var page = 1
    var hasMore = true

    while (hasMore) {
      var url =
        'https://datalbus.com.br:8000/api/v2/trips?worker_id=' +
        encodeURIComponent(String(workerId)) +
        '&start_date=' +
        encodeURIComponent(dataInicial) +
        '&end_date=' +
        encodeURIComponent(dataFinal) +
        '&per_page=100&page=' +
        page
      var res = apiGet(url, token)
      if (res.statusCode !== 200 || !res.json) {
        $app
          .logger()
          .info(
            'Datalbus: primary trips endpoint failed or empty',
            'statusCode',
            res.statusCode,
            'page',
            page,
          )
        return null
      }
      var pageTrips = extractArray(res.json)
      $app
        .logger()
        .info('Datalbus: primary trips page', 'page', page, 'tripsInPage', pageTrips.length)
      for (var i = 0; i < pageTrips.length; i++) allTrips.push(pageTrips[i])
      if (pageTrips.length < 100 || pageTrips.length === 0) {
        hasMore = false
      } else {
        page++
      }
    }

    $app.logger().info('Datalbus: primary trips fetched', 'totalTrips', allTrips.length)
    return allTrips
  }

  function fetchTripsFallback(token) {
    var allTrips = []
    var page = 1
    var hasMore = true

    while (hasMore) {
      var url =
        'https://datalbus.com.br:8000/api/v2/trips?date=' +
        encodeURIComponent(dataInicial) +
        '&per_page=100&page=' +
        page
      var res = apiGet(url, token)
      if (res.statusCode !== 200 || !res.json) {
        $app
          .logger()
          .error('Datalbus: fallback trips failed', 'statusCode', res.statusCode, 'page', page)
        hasMore = false
        break
      }
      var pageTrips = extractArray(res.json)
      $app
        .logger()
        .info('Datalbus: fallback trips page', 'page', page, 'tripsInPage', pageTrips.length)
      for (var i = 0; i < pageTrips.length; i++) allTrips.push(pageTrips[i])
      if (pageTrips.length < 100 || pageTrips.length === 0) {
        hasMore = false
      } else {
        page++
      }
    }

    var matched = []
    for (var m = 0; m < allTrips.length; m++) {
      if (tripMatchesWorkerId(allTrips[m])) matched.push(allTrips[m])
    }

    $app
      .logger()
      .info(
        'Datalbus: fallback trips matched by worker_id',
        'matchedTrips',
        matched.length,
        'workerId',
        workerId,
      )
    return matched
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

  try {
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

    var trips = fetchTripsPrimary(datalbusToken)
    if (!trips || trips.length === 0) {
      $app.logger().info('Datalbus: primary endpoint returned no trips, falling back')
      trips = fetchTripsFallback(datalbusToken)
    }

    $app.logger().info('Datalbus: total trips to process', 'totalTrips', trips.length)

    var allEvents = []
    var pontuacao = null

    for (var n = 0; n < trips.length; n++) {
      var tripId = getTripId(trips[n])
      if (!tripId) continue
      var tripDate = getTripDate(trips[n])
      var tripEvents = fetchEventsForTrip(tripId, tripDate, datalbusToken)
      for (var p = 0; p < tripEvents.length; p++) {
        var ev = tripEvents[p]
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

        if (tipo === 'Pontuação do Motorista na Viagem') {
          var scoreVal = ev.score || ev.pontuacao || ev.valor || ev.amount || ev.value
          if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
            pontuacao = parseFloat(String(scoreVal))
            if (isNaN(pontuacao)) pontuacao = null
          }
          continue
        }

        allEvents.push({
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
    }

    $app
      .logger()
      .info('Datalbus: events collected', 'totalEvents', allEvents.length, 'pontuacao', pontuacao)

    var eventos = allEvents

    var resumo = {}
    for (var j = 0; j < eventos.length; j++) {
      var t = eventos[j].tipo
      if (t) {
        if (!resumo[t]) resumo[t] = 0
        resumo[t]++
      }
    }

    var distanciaTotal = 0
    var duracaoTotal = 0
    for (var k = 0; k < trips.length; k++) {
      var mileage = trips[k].mileage || trips[k].distancia || trips[k].km || 0
      var driveDur =
        trips[k].drive_duration || trips[k].duracao_direcao || trips[k].driving_duration || 0
      var mileageNum = parseFloat(String(mileage))
      if (!isNaN(mileageNum)) distanciaTotal += mileageNum
      var driveDurNum = parseFloat(String(driveDur))
      if (!isNaN(driveDurNum)) duracaoTotal += driveDurNum
    }

    var scoreData = scoreRes.json || {}
    var finalPontuacao = pontuacao !== null ? pontuacao : scoreData

    $app
      .logger()
      .info(
        'Datalbus: telemetry success',
        'eventos',
        eventos.length,
        'totalViagens',
        trips.length,
        'distanciaTotal',
        distanciaTotal,
        'duracaoTotal',
        duracaoTotal,
        'resumoKeys',
        Object.keys(resumo).length,
      )

    return e.json(200, {
      pontuacao: finalPontuacao,
      eventos: eventos,
      resumo: resumo,
      total_viagens: trips.length,
      metricas: {
        distancia_total: distanciaTotal,
        duracao_total: duracaoTotal,
      },
    })
  } catch (err) {
    $app.logger().error('Datalbus telemetry unexpected error', 'message', String(err))
    return e.json(502, {
      error: 'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.',
    })
  }
})
