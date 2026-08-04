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

  var startTime = Date.now()
  var GLOBAL_TIMEOUT_MS = 90000
  var globalDeadline = Date.now() + GLOBAL_TIMEOUT_MS
  var MAX_TRIPS = 5
  var MAX_PAGES = 50
  var API_TIMEOUT = 15
  var SCORE_TIMEOUT = 25

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
  var pagesTraversed = 0
  var totalTripsScanned = 0

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
      var preview = ''
      if (parsed) {
        try {
          preview = JSON.stringify(parsed).substring(0, 300)
        } catch (_) {}
      }
      if (!preview) preview = String(res.body || '').substring(0, 300)
      debugCalls.push({ endpoint: url, statusCode: res.statusCode, responsePreview: preview })
      return { statusCode: res.statusCode, json: parsed, body: String(res.body || '') }
    } catch (err) {
      debugCalls.push({
        endpoint: url,
        statusCode: 0,
        responsePreview: 'Transport error: ' + (err.message || ''),
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
        debugErrors.push({ endpoint: url, error: 'Re-auth failed after 401' })
        authFailed = true
        return res
      }
      res = apiGet(url, currentToken, timeout)
      if (res.statusCode === 401) {
        debugErrors.push({ endpoint: url, error: 'Second attempt also 401' })
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

  function tripMatchesWorkerId(trip) {
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips)) return false
    for (var s = 0; s < subtrips.length; s++) {
      var subWorkerId = subtrips[s].worker_id
      if (subWorkerId !== undefined && subWorkerId !== null && subWorkerId !== '') {
        var subWorkerNum = parseInt(String(subWorkerId), 10)
        if (!isNaN(subWorkerNum) && subWorkerNum === workerId) return true
      }
    }
    return false
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

  function fetchEventsForTrip(trip) {
    var tripId = getTripId(trip)
    var tripDate = getTripDate(trip)
    if (!tripId) return { events: [], error: 'No trip ID' }
    var baseUrl =
      'https://datalbus.com.br:8000/api/v2/trips/' + encodeURIComponent(String(tripId)) + '/events'
    var separator = '?'
    if (tripDate) {
      baseUrl += '?date=' + encodeURIComponent(tripDate)
      separator = '&'
    }
    var url = baseUrl + separator + 'per_page=100&page=1'
    var res = apiGetWithRetry(url, API_TIMEOUT)
    if (res.statusCode !== 200 || !res.json)
      return { events: [], error: 'API error: ' + res.statusCode }
    return { events: extractArray(res.json), error: null }
  }

  function testFilterVariations(firstDate) {
    var variations = [
      {
        name: 'workerId[]',
        url:
          'https://datalbus.com.br:8000/api/v2/trips?workerId[]=' +
          workerId +
          '&date=' +
          encodeURIComponent(firstDate),
      },
      {
        name: 'worker_id',
        url:
          'https://datalbus.com.br:8000/api/v2/trips?worker_id=' +
          workerId +
          '&date=' +
          encodeURIComponent(firstDate),
      },
      {
        name: 'driver',
        url:
          'https://datalbus.com.br:8000/api/v2/trips?driver=' +
          workerId +
          '&date=' +
          encodeURIComponent(firstDate),
      },
      {
        name: 'workerId',
        url:
          'https://datalbus.com.br:8000/api/v2/trips?workerId=' +
          workerId +
          '&date=' +
          encodeURIComponent(firstDate),
      },
      {
        name: 'by-driver',
        url:
          'https://datalbus.com.br:8000/api/v2/trips/by-driver/' +
          workerId +
          '?date=' +
          encodeURIComponent(firstDate),
      },
    ]
    var results = []
    for (var i = 0; i < variations.length; i++) {
      if (Date.now() > globalDeadline) {
        results.push({
          name: variations[i].name,
          url: variations[i].url,
          statusCode: 0,
          tripsReturned: 0,
          matchedTrips: 0,
          worked: false,
          error: 'Global timeout',
        })
        continue
      }
      pagesTraversed++
      var res = apiGetWithRetry(variations[i].url, API_TIMEOUT)
      var trips = []
      var matchedCount = 0
      if (res.statusCode === 200 && res.json) {
        trips = extractArray(res.json)
        totalTripsScanned += trips.length
        for (var t = 0; t < trips.length; t++) {
          if (tripMatchesWorkerId(trips[t])) matchedCount++
        }
      }
      results.push({
        name: variations[i].name,
        url: variations[i].url,
        statusCode: res.statusCode,
        tripsReturned: trips.length,
        matchedTrips: matchedCount,
        worked: matchedCount > 0,
      })
    }
    return results
  }

  function buildFilterUrl(vName, dateStr, page) {
    var base = 'https://datalbus.com.br:8000/api/v2/trips'
    var dp = 'date=' + encodeURIComponent(dateStr)
    var pp = 'per_page=100&page=' + page
    if (vName === 'workerId[]') return base + '?workerId[]=' + workerId + '&' + dp + '&' + pp
    if (vName === 'worker_id') return base + '?worker_id=' + workerId + '&' + dp + '&' + pp
    if (vName === 'driver') return base + '?driver=' + workerId + '&' + dp + '&' + pp
    if (vName === 'workerId') return base + '?workerId=' + workerId + '&' + dp + '&' + pp
    if (vName === 'by-driver') return base + '/by-driver/' + workerId + '?' + dp + '&' + pp
    return base + '?' + dp + '&' + pp
  }

  function fetchTripsAndEvents(dates, variationName) {
    var matchedTrips = []
    var allRawEvents = []
    var errors = []
    var partialData = false

    for (var d = 0; d < dates.length; d++) {
      if (Date.now() > globalDeadline) {
        partialData = true
        errors.push({ error: 'Timeout', detail: 'Date ' + dates[d] + ' skipped' })
        break
      }
      if (matchedTrips.length >= MAX_TRIPS) break

      var dateStr = dates[d]
      var page = 1

      while (page <= MAX_PAGES && matchedTrips.length < MAX_TRIPS) {
        if (Date.now() > globalDeadline) {
          partialData = true
          break
        }

        var url
        if (variationName && variationName !== 'none') {
          url = buildFilterUrl(variationName, dateStr, page)
        } else {
          url =
            'https://datalbus.com.br:8000/api/v2/trips?date=' +
            encodeURIComponent(dateStr) +
            '&per_page=100&page=' +
            page
        }

        pagesTraversed++
        var res = apiGetWithRetry(url, API_TIMEOUT)
        if (res.statusCode !== 200 || !res.json) {
          debugErrors.push({
            endpoint: url,
            error: 'page ' + page + ' returned status ' + res.statusCode,
          })
          break
        }

        var trips = extractArray(res.json)
        totalTripsScanned += trips.length

        for (var i = 0; i < trips.length; i++) {
          if (matchedTrips.length >= MAX_TRIPS) break
          if (Date.now() > globalDeadline) {
            partialData = true
            break
          }
          trips[i]._queryDate = dateStr
          if (tripMatchesWorkerId(trips[i])) {
            matchedTrips.push(trips[i])
            var evResult = fetchEventsForTrip(trips[i])
            if (evResult.events && evResult.events.length > 0) {
              for (var p = 0; p < evResult.events.length; p++) allRawEvents.push(evResult.events[p])
            }
            if (evResult.error) errors.push({ tripId: getTripId(trips[i]), error: evResult.error })
          }
        }

        if (trips.length === 0 || trips.length < 100) break
        page++
      }
    }

    return { trips: matchedTrips, events: allRawEvents, errors: errors, partialData: partialData }
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

  function buildDebug(filterTests, variationUsed, tripsFound) {
    return {
      calls: debugCalls,
      errors: debugErrors,
      filter_tests: filterTests,
      variation_used: variationUsed,
      total_trips_scanned: totalTripsScanned,
      trips_found: tripsFound,
      pages_processed: pagesTraversed,
      data_source: 'api',
      processing_time_seconds: (Date.now() - startTime) / 1000,
      worker_id: workerId,
    }
  }

  try {
    currentToken = getCachedToken()
    if (!currentToken) {
      currentToken = authenticate()
      if (!currentToken) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
    }

    var dates = getDatesInRange(dataInicial, dataFinal)

    var filterTests = testFilterVariations(dates[0])
    var workingVariation = null
    for (var ft = 0; ft < filterTests.length; ft++) {
      if (filterTests[ft].worked) {
        workingVariation = filterTests[ft].name
        break
      }
    }
    var variationUsed = workingVariation || 'none'

    var fetchResult = fetchTripsAndEvents(dates, workingVariation)

    if (authFailed) {
      return e.json(502, {
        error: 'Falha na autenticação com a DataBus após re-tentativa.',
        debug: buildDebug(filterTests, variationUsed, fetchResult.trips.length),
      })
    }

    var trips = fetchResult.trips
    var allRawEvents = fetchResult.events
    var errors = fetchResult.errors
    var partialData = fetchResult.partialData

    if (trips.length === 0) {
      return e.json(200, {
        message:
          'Nenhuma viagem encontrada para este colaborador no período. Worker ID: ' + workerId,
        pontuacao: null,
        eventos: [],
        resumo: {},
        total_viagens: 0,
        metricas: { distancia_total: 0, duracao_total: 0 },
        partialData: partialData,
        errors: errors,
        debug: buildDebug(filterTests, variationUsed, 0),
      })
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

    var scoreRes = null
    if (Date.now() < globalDeadline - 5000) scoreRes = fetchScore()

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
      debug: buildDebug(filterTests, variationUsed, trips.length),
    })
  } catch (err) {
    $app.logger().error('Datalbus telemetry unexpected error', 'message', String(err))
    return e.json(502, {
      error: 'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.',
      debug: {
        calls: debugCalls,
        errors: debugErrors,
        filter_tests: [],
        variation_used: 'none',
        total_trips_scanned: totalTripsScanned,
        trips_found: 0,
        pages_processed: pagesTraversed,
        data_source: 'api',
        processing_time_seconds: (Date.now() - startTime) / 1000,
        worker_id: workerId,
      },
    })
  }
})
