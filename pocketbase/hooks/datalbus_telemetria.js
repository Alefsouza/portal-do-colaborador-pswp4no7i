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
  var TRIPS_TIMEOUT = 15
  var SCORE_TIMEOUT = 25
  var GLOBAL_TIMEOUT_MS = 90000
  var MAX_TRIPS = 5
  var MAX_PAGES = 50
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
  var pagesTraversed = 0

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

  function logTripFields(trips, context) {
    if (!trips || trips.length === 0) return
    var firstTrip = trips[0]
    var fieldKeys = []
    for (var k in firstTrip) {
      if (Object.prototype.hasOwnProperty.call(firstTrip, k)) fieldKeys.push(k)
    }
    $app.logger().info('Datalbus trip fields', 'context', context, 'fields', fieldKeys.join(', '))
    $app
      .logger()
      .info(
        'Datalbus trip worker values',
        'context',
        context,
        'worker_id',
        String(firstTrip.worker_id || ''),
        'workerId',
        String(firstTrip.workerId || ''),
        'worker_id_int',
        String(firstTrip.worker_id_int || ''),
        'driver_id',
        String(firstTrip.driver_id || ''),
        'driverId',
        String(firstTrip.driverId || ''),
        'driver_worker_id',
        String(firstTrip.driver_worker_id || ''),
        'worker',
        String(firstTrip.worker || ''),
        'driver',
        String(firstTrip.driver || ''),
        'operador_id',
        String(firstTrip.operador_id || ''),
        'employee_id',
        String(firstTrip.employee_id || ''),
        'operador',
        String(firstTrip.operador || ''),
        'employee',
        String(firstTrip.employee || ''),
        'motorista_id',
        String(firstTrip.motorista_id || ''),
        'motorista',
        String(firstTrip.motorista || ''),
        'user_id',
        String(firstTrip.user_id || ''),
        'userId',
        String(firstTrip.userId || ''),
        'colaborador_id',
        String(firstTrip.colaborador_id || ''),
        'funcionario_id',
        String(firstTrip.funcionario_id || ''),
      )
    if (firstTrip.subtrips && Array.isArray(firstTrip.subtrips) && firstTrip.subtrips.length > 0) {
      var subKeys = []
      for (var sk in firstTrip.subtrips[0]) {
        if (Object.prototype.hasOwnProperty.call(firstTrip.subtrips[0], sk)) subKeys.push(sk)
      }
      $app
        .logger()
        .info('Datalbus subtrip fields', 'context', context, 'subFields', subKeys.join(', '))
      $app
        .logger()
        .info(
          'Datalbus subtrip worker values',
          'context',
          context,
          'worker_id',
          String(firstTrip.subtrips[0].worker_id || ''),
          'workerId',
          String(firstTrip.subtrips[0].workerId || ''),
          'driver_id',
          String(firstTrip.subtrips[0].driver_id || ''),
        )
    }
  }

  function tripMatchesWorkerId(trip) {
    var tripWorkerStr = String(
      trip.worker_id ||
        trip.workerId ||
        trip.worker_id_int ||
        trip.driver_id ||
        trip.driverId ||
        trip.driver_worker_id ||
        trip.worker ||
        trip.driver ||
        trip.operador_id ||
        trip.employee_id ||
        trip.operador ||
        trip.employee ||
        trip.motorista_id ||
        trip.motorista ||
        trip.user_id ||
        trip.userId ||
        trip.colaborador_id ||
        trip.funcionario_id ||
        '',
    )
    var tripWorkerNum = parseInt(tripWorkerStr, 10)
    if (!isNaN(tripWorkerNum) && tripWorkerNum === workerId) return true

    if (tripWorkerStr && tripWorkerStr === String(workerId)) return true

    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips)) return false
    for (var s = 0; s < subtrips.length; s++) {
      var subWorkerStr = String(
        subtrips[s].worker_id ||
          subtrips[s].workerId ||
          subtrips[s].worker_id_int ||
          subtrips[s].driver_id ||
          subtrips[s].driverId ||
          subtrips[s].worker ||
          subtrips[s].driver ||
          subtrips[s].operador_id ||
          subtrips[s].employee_id ||
          subtrips[s].operador ||
          subtrips[s].employee ||
          subtrips[s].motorista_id ||
          subtrips[s].motorista ||
          '',
      )
      var subWorkerNum = parseInt(subWorkerStr, 10)
      if (!isNaN(subWorkerNum) && subWorkerNum === workerId) return true
      if (subWorkerStr && subWorkerStr === String(workerId)) return true
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
    var MAX_EVENT_PAGES = 1
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
      if (pageEvents.length < 100 || pageEvents.length === 0 || page >= MAX_EVENT_PAGES)
        hasMore = false
      else page++
    }
    return { events: events, error: null, tripId: tripId }
  }

  function processTripEvents(trip, matchedTrips, allRawEvents, errors) {
    var result = fetchEventsForTrip(trip)
    if (result.error) {
      errors.push({ tripId: result.tripId || getTripId(trip), error: result.error })
      debugErrors.push({ tripId: result.tripId || getTripId(trip), error: result.error })
    }
    if (result.events && result.events.length > 0) {
      for (var p = 0; p < result.events.length; p++) allRawEvents.push(result.events[p])
    }
  }

  function tryWorkerIdFilter(dateStr) {
    var url =
      'https://datalbus.com.br:8000/api/v2/trips?worker_id=' +
      encodeURIComponent(String(workerId)) +
      '&date=' +
      encodeURIComponent(dateStr) +
      '&per_page=100&page=1'
    pagesTraversed++
    var res = apiGetWithRetry(url, TRIPS_TIMEOUT)
    if (res.statusCode !== 200 || !res.json) {
      return { supported: false, trips: [] }
    }
    var trips = extractArray(res.json)
    if (trips.length > 0) logTripFields(trips, 'tryWorkerIdFilter')
    if (trips.length > 0) {
      var anyMatch = false
      for (var ti = 0; ti < trips.length; ti++) {
        if (tripMatchesWorkerId(trips[ti])) {
          anyMatch = true
          break
        }
      }
      if (!anyMatch) return { supported: false, trips: trips }
    }
    return { supported: true, trips: trips }
  }

  function fetchTripsAndEvents() {
    var matchedTrips = []
    var allRawEvents = []
    var errors = []
    var partialData = false
    var workerIdFilterTested = false
    var workerIdFilterSupported = false

    var dates = getDatesInRange(dataInicial, dataFinal)

    for (var d = 0; d < dates.length; d++) {
      if (Date.now() > globalDeadline) {
        partialData = true
        errors.push({
          error: 'Skipped due to global timeout',
          detail: 'Date ' + dates[d] + ' and remaining dates not processed',
        })
        debugErrors.push({
          error: 'Skipped due to global timeout',
          detail: 'Date ' + dates[d] + ' and remaining dates not processed',
        })
        break
      }
      if (matchedTrips.length >= MAX_TRIPS) break

      var dateStr = dates[d]

      if (!workerIdFilterTested) {
        var filterResult = tryWorkerIdFilter(dateStr)
        workerIdFilterTested = true
        workerIdFilterSupported = filterResult.supported
        if (workerIdFilterSupported) {
          for (var t = 0; t < filterResult.trips.length; t++) {
            if (matchedTrips.length >= MAX_TRIPS) break
            if (Date.now() > globalDeadline) {
              partialData = true
              break
            }
            var trip = filterResult.trips[t]
            trip._queryDate = dateStr
            matchedTrips.push(trip)
            processTripEvents(trip, matchedTrips, allRawEvents, errors)
          }
          if (matchedTrips.length < MAX_TRIPS && !partialData) {
            var wPage = 2
            while (wPage <= MAX_PAGES && matchedTrips.length < MAX_TRIPS) {
              if (Date.now() > globalDeadline) {
                partialData = true
                break
              }
              var wUrl =
                'https://datalbus.com.br:8000/api/v2/trips?worker_id=' +
                encodeURIComponent(String(workerId)) +
                '&date=' +
                encodeURIComponent(dateStr) +
                '&per_page=100&page=' +
                wPage
              pagesTraversed++
              var wRes = apiGetWithRetry(wUrl, TRIPS_TIMEOUT)
              if (wRes.statusCode !== 200 || !wRes.json) {
                debugErrors.push({
                  endpoint: wUrl,
                  error: 'wPage ' + wPage + ' returned status ' + wRes.statusCode,
                })
                wPage++
                continue
              }
              var wTrips = extractArray(wRes.json)
              if (wTrips.length > 0) logTripFields(wTrips, 'workerIdFilter-wPage-' + wPage)
              for (var wt = 0; wt < wTrips.length; wt++) {
                if (matchedTrips.length >= MAX_TRIPS) break
                if (Date.now() > globalDeadline) {
                  partialData = true
                  break
                }
                wTrips[wt]._queryDate = dateStr
                matchedTrips.push(wTrips[wt])
                processTripEvents(wTrips[wt], matchedTrips, allRawEvents, errors)
              }
              if (wTrips.length === 0) break
              wPage++
            }
          }
          continue
        }
      }

      if (workerIdFilterSupported) {
        var fPage = 1
        while (fPage <= MAX_PAGES && matchedTrips.length < MAX_TRIPS) {
          if (Date.now() > globalDeadline) {
            partialData = true
            break
          }
          var fUrl =
            'https://datalbus.com.br:8000/api/v2/trips?worker_id=' +
            encodeURIComponent(String(workerId)) +
            '&date=' +
            encodeURIComponent(dateStr) +
            '&per_page=100&page=' +
            fPage
          pagesTraversed++
          var fRes = apiGetWithRetry(fUrl, TRIPS_TIMEOUT)
          if (fRes.statusCode !== 200 || !fRes.json) {
            debugErrors.push({
              endpoint: fUrl,
              error: 'fPage ' + fPage + ' returned status ' + fRes.statusCode,
            })
            fPage++
            continue
          }
          var fTrips = extractArray(fRes.json)
          if (fTrips.length > 0) logTripFields(fTrips, 'workerIdFilter-fPage-' + fPage)
          for (var ft = 0; ft < fTrips.length; ft++) {
            if (matchedTrips.length >= MAX_TRIPS) break
            if (Date.now() > globalDeadline) {
              partialData = true
              break
            }
            fTrips[ft]._queryDate = dateStr
            matchedTrips.push(fTrips[ft])
            processTripEvents(fTrips[ft], matchedTrips, allRawEvents, errors)
          }
          if (fTrips.length === 0) break
          fPage++
        }
      } else {
        var page = 1
        while (page <= MAX_PAGES) {
          if (Date.now() > globalDeadline) {
            partialData = true
            break
          }
          if (matchedTrips.length >= MAX_TRIPS) break

          var url =
            'https://datalbus.com.br:8000/api/v2/trips?date=' +
            encodeURIComponent(dateStr) +
            '&per_page=100&page=' +
            page
          pagesTraversed++
          var res = apiGetWithRetry(url, TRIPS_TIMEOUT)
          if (res.statusCode !== 200 || !res.json) {
            debugErrors.push({
              endpoint: url,
              error: 'page ' + page + ' returned status ' + res.statusCode + ' for date ' + dateStr,
            })
            page++
            continue
          }
          var pageTrips = extractArray(res.json)
          if (page === 1 && pageTrips.length > 0)
            logTripFields(pageTrips, 'dateSearch-page1-' + dateStr)

          for (var i = 0; i < pageTrips.length; i++) {
            if (matchedTrips.length >= MAX_TRIPS) break
            if (Date.now() > globalDeadline) {
              partialData = true
              break
            }
            pageTrips[i]._queryDate = dateStr
            if (tripMatchesWorkerId(pageTrips[i])) {
              matchedTrips.push(pageTrips[i])
              processTripEvents(pageTrips[i], matchedTrips, allRawEvents, errors)
            }
          }

          if (matchedTrips.length >= MAX_TRIPS) break
          if (pageTrips.length === 0) break
          page++
        }
      }
    }

    return {
      trips: matchedTrips,
      events: allRawEvents,
      errors: errors,
      partialData: partialData,
    }
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

    var fetchResult = fetchTripsAndEvents()

    if (authFailed) {
      return e.json(502, {
        error: 'Falha na autenticação com a DataBus após re-tentativa.',
        debug: { calls: debugCalls, errors: debugErrors },
      })
    }

    var trips = fetchResult.trips
    var allRawEvents = fetchResult.events
    var errors = fetchResult.errors
    var partialData = fetchResult.partialData

    if (!trips) trips = []

    if (trips.length === 0) {
      return e.json(200, {
        message:
          'Nenhuma viagem encontrada para este colaborador no período. Worker ID: ' +
          workerId +
          ' | Páginas consultadas: ' +
          pagesTraversed,
        pontuacao: null,
        eventos: [],
        resumo: {},
        total_viagens: 0,
        metricas: { distancia_total: 0, duracao_total: 0, total_viagens: 0 },
        partialData: partialData,
        errors: errors,
        debug: {
          calls: debugCalls,
          errors: debugErrors,
          worker_id: workerId,
          pages_traversed: pagesTraversed,
        },
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
    if (Date.now() < globalDeadline - 5000) {
      scoreRes = fetchScore()
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
      debug: {
        calls: debugCalls,
        errors: debugErrors,
        worker_id: workerId,
        pages_traversed: pagesTraversed,
      },
    })
  } catch (err) {
    $app.logger().error('Datalbus telemetry unexpected error', 'message', String(err))
    return e.json(502, {
      error: 'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.',
      debug: {
        calls: debugCalls,
        errors: debugErrors,
        worker_id: workerId,
        pages_traversed: pagesTraversed,
      },
    })
  }
})
