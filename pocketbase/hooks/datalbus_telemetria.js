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
  var data = (body.data || '').trim()
  var workerIdRaw = (body.worker_id || '').trim()

  if (!data || !workerIdRaw)
    return e.json(400, { error: 'Parâmetros obrigatórios: data e worker_id.' })
  var workerId = parseInt(workerIdRaw, 10)
  if (isNaN(workerId) || workerId <= 0) return e.json(400, { error: 'worker_id inválido' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    return e.json(400, { error: 'Data inválida. Use o formato YYYY-MM-DD.' })

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_cache (id TEXT PRIMARY KEY, token TEXT, expires INTEGER)',
      )
      .execute()
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_trips_cache (id TEXT PRIMARY KEY, date TEXT, trip_id TEXT, trip_json TEXT)',
      )
      .execute()
  } catch (_) {}

  var syncCompleted = false
  try {
    var syncRecords = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: data,
    })
    if (syncRecords.length > 0 && syncRecords[0].getString('status') === 'completed') {
      syncCompleted = true
    }
  } catch (_) {}

  if (!syncCompleted) {
    return e.json(200, {
      needs_sync: true,
      message: 'Esta data ainda não foi sincronizada. Iniciando sincronização...',
    })
  }

  var dbEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var dbPass = $secrets.get('DATALBUS_PASSWORD') || ''
  var dbTenancy = $secrets.get('DATALBUS_X_TENANCY') || $secrets.get('DATALBUS_TENANCY') || ''
  if (!dbEmail || !dbPass || !dbTenancy)
    return e.json(500, { error: 'Credenciais do DataBus não configuradas.' })

  var currentToken = ''

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

  function authenticate() {
    var res
    try {
      res = $http.send({
        url: 'https://datalbus.com.br:8000/api/v2/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenancy': dbTenancy },
        body: JSON.stringify({ email: dbEmail, password: dbPass }),
        timeout: 30,
      })
    } catch (_) {
      return ''
    }
    if (res.statusCode !== 200) return ''
    var token = ''
    try {
      var j = res.json
      if (j) {
        token =
          j.token ||
          j.access_token ||
          j.jwt ||
          (j.data && (j.data.token || j.data.access_token)) ||
          ''
      }
    } catch (_) {}
    if (token) saveCachedToken(token)
    return token
  }

  function apiGetWithRetry(url, timeout) {
    var res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + currentToken,
          'X-Tenancy': dbTenancy,
          Accept: 'application/json',
        },
        timeout: timeout || 30,
      })
    } catch (_) {
      return { statusCode: 0, json: null, timedOut: true }
    }
    if (res.statusCode === 401) {
      currentToken = authenticate()
      if (!currentToken) return { statusCode: 401, json: null, timedOut: false }
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + currentToken,
            'X-Tenancy': dbTenancy,
            Accept: 'application/json',
          },
          timeout: timeout || 30,
        })
      } catch (_) {
        return { statusCode: 0, json: null, timedOut: true }
      }
    }
    var parsed = null
    try {
      parsed = res.json
    } catch (_) {}
    return { statusCode: res.statusCode, json: parsed, timedOut: false }
  }

  function extractArray(resp) {
    if (!resp) return []
    if (Array.isArray(resp)) return resp
    if (Array.isArray(resp.data)) return resp.data
    if (Array.isArray(resp.events)) return resp.events
    if (Array.isArray(resp.items)) return resp.items
    if (Array.isArray(resp.results)) return resp.results
    if (Array.isArray(resp.trips)) return resp.trips
    return []
  }

  var DRIVING_EVENT_TYPES = {
    'excesso de velocidade': true,
    'freada brusca': true,
    'aceleração brusca': true,
    'desconforto em curva': true,
    'aceleração lateral à esquerda': true,
    'aceleração lateral à direita': true,
    'pontuação do motorista na viagem': true,
    'limite de marcha lenta excedido com porta aberta': true,
    'ponto de força': true,
  }

  function isDrivingEvent(tipo) {
    return (
      DRIVING_EVENT_TYPES[
        String(tipo || '')
          .trim()
          .toLowerCase()
      ] === true
    )
  }

  function tripMatchesWorkerId(trip) {
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips)) return false
    for (var s = 0; s < subtrips.length; s++) {
      var sw = subtrips[s].worker_id
      if (sw !== undefined && sw !== null && sw !== '') {
        var swNum = parseInt(String(sw), 10)
        if (!isNaN(swNum) && swNum === workerId) return true
      }
    }
    return false
  }

  function getTripId(trip) {
    return trip.id || trip.trip_id || trip.tripId || ''
  }

  function buildEvent(ev) {
    return {
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
      quantidade:
        ev.amount !== undefined ? ev.amount : ev.quantidade !== undefined ? ev.quantidade : 0,
    }
  }

  function formatDurationStr(totalSecs) {
    var hrs = Math.floor(totalSecs / 3600)
    var mins = Math.floor((totalSecs % 3600) / 60)
    var secs = Math.floor(totalSecs % 60)
    function p2(n) {
      return n < 10 ? '0' + n : String(n)
    }
    return p2(hrs) + ':' + p2(mins) + ':' + p2(secs)
  }

  try {
    var cachedTrips = []
    var rowModel = new DynamicModel({ trip_json: '' })
    $app
      .db()
      .newQuery('SELECT trip_json FROM _datalbus_trips_cache WHERE date = {:d}')
      .bind({ d: data })
      .all(rowModel, function (row) {
        try {
          cachedTrips.push(JSON.parse(row.trip_json))
        } catch (_) {}
      })

    var matchedTrips = []
    for (var i = 0; i < cachedTrips.length; i++) {
      if (tripMatchesWorkerId(cachedTrips[i])) matchedTrips.push(cachedTrips[i])
    }

    currentToken = getCachedToken()
    if (!currentToken) {
      currentToken = authenticate()
      if (!currentToken) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
    }

    var scoreUrl =
      'https://datalbus.com.br:8000/api/v2/drivers/score?dtIni=' +
      encodeURIComponent(data) +
      '&dtFin=' +
      encodeURIComponent(data) +
      '&workerId[]=' +
      workerId
    var scoreRes = apiGetWithRetry(scoreUrl, 30)
    var pontuacao = scoreRes.statusCode === 200 && scoreRes.json ? scoreRes.json : null

    var eventosDirecao = []
    var eventosTecnicos = []

    if (matchedTrips.length > 0) {
      var BATCH_SIZE = 20
      var allEventResults = []

      for (var bStart = 0; bStart < matchedTrips.length; bStart += BATCH_SIZE) {
        var bEnd = Math.min(bStart + BATCH_SIZE, matchedTrips.length)
        var batchPromises = []

        for (var bi = bStart; bi < bEnd; bi++) {
          ;(function (trip) {
            var tripId = getTripId(trip)
            if (!tripId) {
              batchPromises.push(Promise.resolve(null))
              return
            }
            var eventsUrl =
              'https://datalbus.com.br:8000/api/v2/trips/' +
              encodeURIComponent(String(tripId)) +
              '/events?date=' +
              encodeURIComponent(data) +
              '&per_page=100'
            batchPromises.push(
              fetch(eventsUrl, {
                method: 'GET',
                headers: {
                  Authorization: 'Bearer ' + currentToken,
                  'X-Tenancy': dbTenancy,
                  Accept: 'application/json',
                },
                idleTimeout: 30,
              })
                .then(function (res) {
                  return res.ok ? res.json() : null
                })
                .catch(function () {
                  return null
                }),
            )
          })(matchedTrips[bi])
        }

        var batchResults = await Promise.all(batchPromises)
        allEventResults = allEventResults.concat(batchResults)
      }

      for (var r = 0; r < allEventResults.length; r++) {
        if (!allEventResults[r]) continue
        var rawEvents = extractArray(allEventResults[r])
        for (var e2 = 0; e2 < rawEvents.length; e2++) {
          var ev = rawEvents[e2]
          var tipoStr = String(
            ev.event_type_description ||
              ev.event_type ||
              ev.tipo ||
              ev.type ||
              ev.event_name ||
              ev.descricao_evento ||
              '',
          )
          if (isDrivingEvent(tipoStr)) eventosDirecao.push(buildEvent(ev))
          else eventosTecnicos.push(buildEvent(ev))
        }
      }
    }

    var resumoPorTipo = {}
    var totalEventos = 0
    for (var d2 = 0; d2 < eventosDirecao.length; d2++) {
      var t2 = eventosDirecao[d2].tipo
      if (t2) {
        if (!resumoPorTipo[t2]) resumoPorTipo[t2] = 0
        resumoPorTipo[t2]++
        totalEventos++
      }
    }

    var distanciaTotal = 0
    var duracaoTotalSegundos = 0
    for (var k = 0; k < matchedTrips.length; k++) {
      var mileageNum = parseFloat(
        String(matchedTrips[k].mileage || matchedTrips[k].distancia || matchedTrips[k].km || 0),
      )
      if (!isNaN(mileageNum)) distanciaTotal += mileageNum
      var driveDurNum = parseFloat(
        String(
          matchedTrips[k].drive_duration ||
            matchedTrips[k].duracao_direcao ||
            matchedTrips[k].driving_duration ||
            0,
        ),
      )
      if (!isNaN(driveDurNum)) duracaoTotalSegundos += driveDurNum
    }

    return e.json(200, {
      pontuacao: pontuacao,
      eventos_direcao: eventosDirecao,
      eventos_tecnicos: eventosTecnicos,
      resumo: { total_eventos: totalEventos, por_tipo: resumoPorTipo },
      metricas: {
        total_viagens: matchedTrips.length,
        distancia_total: String(distanciaTotal.toFixed(3)),
        duracao_total: formatDurationStr(duracaoTotalSegundos),
      },
      debug: {
        worker_id: workerId,
        data: data,
        completo: true,
        paginas_processadas: 0,
        paginas_total: 0,
        paginas_restantes: 0,
        trips_total_dia: 0,
        trips_varridas: cachedTrips.length,
        trips_encontradas: matchedTrips.length,
        tempo_segundos: 0,
      },
    })
  } catch (err) {
    $app.logger().error('Datalbus telemetry error', 'message', String(err))
    return e.json(502, {
      error: 'Não foi possível carregar os dados de telemetria. Tente novamente.',
    })
  }
})
