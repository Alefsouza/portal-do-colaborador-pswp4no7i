routerAdd('POST', '/backend/v1/datalbus/sync-day', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token')

  var syncToken = e.requestInfo().headers['x_sync_token'] || ''
  var expectedToken = $secrets.get('DATALBUS_SYNC_TOKEN') || ''
  var isTokenAuth = expectedToken && syncToken === expectedToken

  if (!isTokenAuth) {
    var adminAuthOk = false
    var authHeader = e.requestInfo().headers['authorization'] || ''
    if (authHeader.startsWith('Bearer ')) {
      var jwtToken = authHeader.slice(7)
      try {
        var jwtPayload = $security.parseUnverifiedJWT(jwtToken)
        if (jwtPayload && jwtPayload.id) {
          if (!jwtPayload.exp || Date.now() < jwtPayload.exp * 1000) {
            var usuarioRec = $app.findRecordById('usuarios', jwtPayload.id)
            var usuarioPerfil = usuarioRec.getString('perfil')
            if (usuarioPerfil === 'TI' || usuarioPerfil === 'Admin') {
              adminAuthOk = true
            }
          }
        }
      } catch (_) {}
    }
    if (!adminAuthOk) {
      return e.json(401, { error: 'Token de sincronização inválido.' })
    }
  }

  var body = e.requestInfo().body || {}
  var data = (body.data || '').trim()
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return e.json(400, { error: 'Data inválida. Use o formato YYYY-MM-DD.' })
  }

  var TIME_LIMIT = 25000
  var startTime = Date.now()

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_cache (id TEXT PRIMARY KEY, token TEXT, expires INTEGER)',
      )
      .execute()
  } catch (_) {}
  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_trips_cache (id TEXT PRIMARY KEY, date TEXT, trip_id TEXT, trip_json TEXT, processed INTEGER DEFAULT 0)',
      )
      .execute()
  } catch (_) {}
  try {
    $app
      .db()
      .newQuery('ALTER TABLE _datalbus_trips_cache ADD COLUMN processed INTEGER DEFAULT 0')
      .execute()
  } catch (_) {}

  var syncLogCol = $app.findCollectionByNameOrId('telemetria_sync_log')
  var logRecord = null
  var isResuming = false

  try {
    var existingLogs = $app.findRecordsByFilter(
      'telemetria_sync_log',
      'data_sincronizada = {:d}',
      '-created',
      1,
      0,
      { d: data },
    )
    if (existingLogs.length > 0) {
      logRecord = existingLogs[0]
      if (logRecord.getString('status') === 'em_andamento') {
        isResuming = true
      }
    }
  } catch (_) {}

  if (!logRecord) {
    logRecord = new Record(syncLogCol)
    logRecord.set('data_sincronizada', data)
    logRecord.set('status', 'em_andamento')
    logRecord.set('iniciado_em', new Date().toISOString())
    logRecord.set('tentativa', 1)
    logRecord.set('paginas_total', 0)
    logRecord.set('paginas_processadas', 0)
    logRecord.set('trips_processadas', 0)
    logRecord.set('eventos_processados', 0)
    logRecord.set('motoristas_encontrados', 0)
    $app.save(logRecord)
  } else if (!isResuming) {
    logRecord.set('status', 'em_andamento')
    logRecord.set('iniciado_em', new Date().toISOString())
    logRecord.set('concluido_em', '')
    logRecord.set('duracao_segundos', 0)
    logRecord.set('paginas_total', 0)
    logRecord.set('paginas_processadas', 0)
    logRecord.set('trips_processadas', 0)
    logRecord.set('eventos_processados', 0)
    logRecord.set('motoristas_encontrados', 0)
    logRecord.set('mensagem_erro', '')
    logRecord.set('tentativa', (logRecord.get('tentativa') || 0) + 1)
    $app.save(logRecord)
    try {
      $app
        .db()
        .newQuery('DELETE FROM _datalbus_trips_cache WHERE date = {:d}')
        .bind({ d: data })
        .execute()
    } catch (_) {}
  }

  var syncStatus = null
  try {
    var statusRecords = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: data,
    })
    if (statusRecords.length > 0) syncStatus = statusRecords[0]
  } catch (_) {}

  if (!syncStatus || !isResuming) {
    var statusCol = $app.findCollectionByNameOrId('datalbus_sync_status')
    if (!syncStatus) {
      syncStatus = new Record(statusCol)
      syncStatus.set('date', data)
    }
    syncStatus.set('total_pages', 0)
    syncStatus.set('pages_processed', JSON.stringify([]))
    syncStatus.set('status', 'fetching_trips')
    syncStatus.set('updated_at', new Date().toISOString())
    $app.save(syncStatus)
  }

  var totalPages = syncStatus.get('total_pages') || 0
  var pagesProcessed = []
  try {
    pagesProcessed = JSON.parse(syncStatus.getString('pages_processed')) || []
  } catch (_) {
    pagesProcessed = []
  }
  var phase = syncStatus.getString('status') || 'fetching_trips'
  var tripsProcessed = logRecord.get('trips_processadas') || 0
  var eventosProcessed = logRecord.get('eventos_processados') || 0

  var dbEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var dbPass = $secrets.get('DATALBUS_PASSWORD') || ''
  var dbTenancy = $secrets.get('DATALBUS_X_TENANCY') || $secrets.get('DATALBUS_TENANCY') || ''

  if (!dbEmail || !dbPass || !dbTenancy) {
    logRecord.set('status', 'erro')
    logRecord.set('concluido_em', new Date().toISOString())
    logRecord.set('mensagem_erro', 'Credenciais não configuradas')
    $app.save(logRecord)
    return e.json(500, { error: 'Credenciais DataBus não configuradas.' })
  }

  var currentToken = ''
  try {
    var tr = new DynamicModel({ token: '', expires: 0 })
    $app
      .db()
      .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
      .one(tr)
    if (tr.token && Date.now() < tr.expires) currentToken = tr.token
  } catch (_) {}

  function doLogin() {
    try {
      var res = $http.send({
        url: 'https://datalbus.com.br:8000/api/v2/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenancy': dbTenancy },
        body: JSON.stringify({ email: dbEmail, password: dbPass }),
        timeout: 30,
      })
      if (res.statusCode === 200 && res.json) {
        var j = res.json
        var t =
          j.token ||
          j.access_token ||
          j.jwt ||
          (j.data && (j.data.token || j.data.access_token)) ||
          ''
        if (t) {
          currentToken = t
          $app
            .db()
            .newQuery(
              "INSERT OR REPLACE INTO _datalbus_cache (id, token, expires) VALUES ('session', {:t}, {:e})",
            )
            .bind({ t: t, e: Date.now() + 3600000 })
            .execute()
        }
      }
    } catch (_) {}
  }

  if (!currentToken) doLogin()
  if (!currentToken) {
    logRecord.set('status', 'erro')
    logRecord.set('concluido_em', new Date().toISOString())
    logRecord.set('mensagem_erro', 'Falha na autenticação DataBus')
    $app.save(logRecord)
    return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
  }

  function apiGet(url) {
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
        timeout: 30,
      })
    } catch (_) {
      return { statusCode: 0, json: null }
    }
    if (res.statusCode === 401) {
      doLogin()
      if (!currentToken) return { statusCode: 401, json: null }
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + currentToken,
            'X-Tenancy': dbTenancy,
            Accept: 'application/json',
          },
          timeout: 30,
        })
      } catch (_) {
        return { statusCode: 0, json: null }
      }
    }
    var parsed = null
    try {
      parsed = res.json
    } catch (_) {}
    return { statusCode: res.statusCode, json: parsed }
  }

  function extractArray(resp) {
    if (!resp) return []
    if (Array.isArray(resp)) return resp
    if (Array.isArray(resp.data)) return resp.data
    if (Array.isArray(resp.events)) return resp.events
    if (Array.isArray(resp.items)) return resp.items
    return []
  }

  function cacheTrip(trip, dateStr) {
    var tripId = String(trip.id || trip.trip_id || trip.tripId || '')
    if (!tripId) return
    var cacheId = dateStr + ':' + tripId
    try {
      $app
        .db()
        .newQuery(
          'INSERT OR REPLACE INTO _datalbus_trips_cache (id, date, trip_id, trip_json, processed) VALUES ({:id}, {:date}, {:tripId}, {:json}, 0)',
        )
        .bind({ id: cacheId, date: dateStr, tripId: tripId, json: JSON.stringify(trip) })
        .execute()
    } catch (_) {}
  }

  var DRIVING_EVENTS = {
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

  var nowIso = new Date().toISOString()

  function upsertTrip(trip) {
    var tripId = parseInt(String(trip.id || trip.trip_id || trip.tripId || '0'), 10)
    if (!tripId) return 0
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!Array.isArray(subtrips) || subtrips.length === 0) return 0
    var count = 0
    for (var s = 0; s < subtrips.length; s++) {
      var sub = subtrips[s]
      var workerId = parseInt(String(sub.worker_id || '0'), 10)
      if (!workerId) continue
      try {
        $app
          .db()
          .newQuery(
            'INSERT INTO telemetria_trips (id, trip_id, worker_id, driver_name, data, asset_id, mileage, fuel_used, drive_duration, line_name, start_time, end_time, raw_data, sincronizado_em, created, updated) VALUES ({:id}, {:tid}, {:wid}, {:dn}, {:dt}, {:ai}, {:ml}, {:fu}, {:dd}, {:ln}, {:st}, {:et}, {:rd}, {:se}, {:n}, {:n}) ON CONFLICT(trip_id, worker_id) DO UPDATE SET driver_name={:dn}, data={:dt}, asset_id={:ai}, mileage={:ml}, fuel_used={:fu}, drive_duration={:dd}, line_name={:ln}, start_time={:st}, end_time={:et}, raw_data={:rd}, sincronizado_em={:se}, updated={:n}',
          )
          .bind({
            id: $security.randomString(15),
            tid: tripId,
            wid: workerId,
            dn: String(
              sub.driver_name || sub.worker_name || sub.motorista || trip.driver_name || '',
            ),
            dt: data,
            ai: parseInt(String(trip.asset_id || trip.vehicle_id || '0'), 10) || 0,
            ml: String(trip.mileage || trip.distancia || trip.km || ''),
            fu: String(trip.fuel_used || trip.combustivel || ''),
            dd: String(trip.drive_duration || trip.duracao_direcao || trip.driving_duration || ''),
            ln: String(trip.line_name || trip.linha || trip.line || ''),
            st: String(trip.start_time || trip.inicio || trip.start || ''),
            et: String(trip.end_time || trip.fim || trip.end || ''),
            rd: JSON.stringify(trip),
            se: nowIso,
            n: nowIso,
          })
          .execute()
        count++
      } catch (_) {}
    }
    return count
  }

  function upsertEvent(ev, tripId, workerId) {
    var eventoId = parseInt(String(ev.id || ev.event_id || ev.eventId || '0'), 10)
    if (!eventoId) return
    var tipo = String(
      ev.event_type_description || ev.event_type || ev.tipo || ev.type || ev.event_name || '',
    )
    var cls = DRIVING_EVENTS[String(tipo).trim().toLowerCase()] ? 'direcao' : 'tecnico'
    try {
      $app
        .db()
        .newQuery(
          'INSERT INTO telemetria_eventos (id, evento_id, trip_id, worker_id, data, data_hora, asset_id, tipo_evento, event_type_id, categoria, duracao, quantidade, latitude, longitude, classificacao, raw_data, sincronizado_em, created, updated) VALUES ({:id}, {:eid}, {:tid}, {:wid}, {:dt}, {:dh}, {:ai}, {:te}, {:eti}, {:cat}, {:dur}, {:qtd}, {:lat}, {:lng}, {:cls}, {:rd}, {:se}, {:n}, {:n}) ON CONFLICT(evento_id) DO UPDATE SET trip_id={:tid}, worker_id={:wid}, data={:dt}, data_hora={:dh}, asset_id={:ai}, tipo_evento={:te}, event_type_id={:eti}, categoria={:cat}, duracao={:dur}, quantidade={:qtd}, latitude={:lat}, longitude={:lng}, classificacao={:cls}, raw_data={:rd}, sincronizado_em={:se}, updated={:n}',
        )
        .bind({
          id: $security.randomString(15),
          eid: eventoId,
          tid: tripId,
          wid: workerId,
          dt: data,
          dh: String(
            ev.time || ev.event_date || ev.data_hora || ev.timestamp || ev.created_at || '',
          ),
          ai: parseInt(String(ev.asset_id || ev.vehicle_id || '0'), 10) || 0,
          te: tipo,
          eti: parseInt(String(ev.event_type_id || ev.event_type || '0'), 10) || 0,
          cat: String(ev.event_category_description || ev.category || ev.categoria || ''),
          dur: ev.duration || ev.duracao || 0,
          qtd:
            ev.amount !== undefined ? ev.amount : ev.quantidade !== undefined ? ev.quantidade : 0,
          lat: String(ev.latitude || ev.lat || ''),
          lng: String(ev.longitude || ev.lng || ev.lon || ''),
          cls: cls,
          rd: JSON.stringify(ev),
          se: nowIso,
          n: nowIso,
        })
        .execute()
      eventosProcessed++
    } catch (_) {}
  }

  if (phase === 'fetching_trips') {
    if (totalPages === 0) {
      var firstRes = apiGet(
        'https://datalbus.com.br:8000/api/v2/trips?date=' +
          encodeURIComponent(data) +
          '&per_page=100&page=1',
      )
      if (firstRes.statusCode !== 200 || !firstRes.json) {
        logRecord.set('status', 'erro')
        logRecord.set('concluido_em', new Date().toISOString())
        logRecord.set('mensagem_erro', 'Falha ao buscar trips: ' + firstRes.statusCode)
        $app.save(logRecord)
        return e.json(502, { error: 'Falha ao buscar viagens da API DataBus.' })
      }
      var respObj = firstRes.json
      totalPages =
        respObj.last_page || respObj.total_pages || (respObj.meta && respObj.meta.last_page) || 1
      syncStatus.set('total_pages', totalPages)
      var tripsArr = extractArray(respObj)
      for (var i = 0; i < tripsArr.length; i++) cacheTrip(tripsArr[i], data)
      pagesProcessed.push(1)
    }

    for (var page = 2; page <= totalPages; page++) {
      if (Date.now() - startTime > TIME_LIMIT) break
      if (pagesProcessed.indexOf(page) !== -1) continue
      var pageRes = apiGet(
        'https://datalbus.com.br:8000/api/v2/trips?date=' +
          encodeURIComponent(data) +
          '&per_page=100&page=' +
          page,
      )
      if (pageRes.statusCode === 200 && pageRes.json) {
        var pageTrips = extractArray(pageRes.json)
        for (var j = 0; j < pageTrips.length; j++) cacheTrip(pageTrips[j], data)
        pagesProcessed.push(page)
      }
    }

    syncStatus.set('pages_processed', JSON.stringify(pagesProcessed))
    syncStatus.set('updated_at', new Date().toISOString())
    $app.save(syncStatus)

    if (pagesProcessed.length >= totalPages) {
      phase = 'processing_events'
      syncStatus.set('status', 'processing_events')
      syncStatus.set('updated_at', new Date().toISOString())
      $app.save(syncStatus)
    }
  }

  if (phase === 'processing_events') {
    var batchRows = []
    try {
      batchRows = $app
        .db()
        .newQuery(
          'SELECT id, trip_json FROM _datalbus_trips_cache WHERE date = {:d} AND (processed = 0 OR processed IS NULL) LIMIT 20',
        )
        .bind({ d: data })
        .all(new DynamicModel({ id: '', trip_json: '' }))
    } catch (_) {
      batchRows = []
    }
    if (!Array.isArray(batchRows)) batchRows = []

    for (var r = 0; r < batchRows.length; r++) {
      if (Date.now() - startTime > TIME_LIMIT) break
      var row = batchRows[r]
      var trip = null
      try {
        trip = JSON.parse(row.trip_json)
      } catch (_) {
        trip = null
      }
      if (!trip) {
        try {
          $app
            .db()
            .newQuery('UPDATE _datalbus_trips_cache SET processed = 1 WHERE id = {:id}')
            .bind({ id: row.id })
            .execute()
        } catch (_) {}
        continue
      }
      var upsertedCount = upsertTrip(trip)
      tripsProcessed += upsertedCount

      var tripIdNum = parseInt(String(trip.id || trip.trip_id || trip.tripId || '0'), 10)
      var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
      var defaultWorker = 0
      if (Array.isArray(subtrips) && subtrips.length > 0) {
        defaultWorker = parseInt(String(subtrips[0].worker_id || '0'), 10) || 0
      }

      var evRes = apiGet(
        'https://datalbus.com.br:8000/api/v2/trips/' +
          encodeURIComponent(String(tripIdNum)) +
          '/events?date=' +
          encodeURIComponent(data) +
          '&per_page=100',
      )
      if (evRes.statusCode === 200 && evRes.json) {
        var events = extractArray(evRes.json)
        for (var m = 0; m < events.length; m++) {
          var ev = events[m]
          var evWorker = parseInt(String(ev.worker_id || '0'), 10) || defaultWorker
          upsertEvent(ev, tripIdNum, evWorker)
        }
      }

      try {
        $app
          .db()
          .newQuery('UPDATE _datalbus_trips_cache SET processed = 1 WHERE id = {:id}')
          .bind({ id: row.id })
          .execute()
      } catch (_) {}
    }
  }

  var motoristasEncontrados = 0
  try {
    var motoristasModel = new DynamicModel({ cnt: 0 })
    $app
      .db()
      .newQuery('SELECT COUNT(DISTINCT worker_id) as cnt FROM telemetria_trips WHERE data = {:d}')
      .bind({ d: data })
      .one(motoristasModel)
    motoristasEncontrados = motoristasModel.cnt || 0
  } catch (_) {}

  var remainingTrips = 0
  try {
    var remModel = new DynamicModel({ cnt: 0 })
    $app
      .db()
      .newQuery(
        'SELECT COUNT(*) as cnt FROM _datalbus_trips_cache WHERE date = {:d} AND (processed = 0 OR processed IS NULL)',
      )
      .bind({ d: data })
      .one(remModel)
    remainingTrips = remModel.cnt || 0
  } catch (_) {}

  var isComplete = phase === 'processing_events' && remainingTrips === 0
  var finalStatus = isComplete ? 'sucesso' : 'em_andamento'

  if (isComplete) {
    try {
      $app
        .db()
        .newQuery('DELETE FROM _datalbus_trips_cache WHERE date = {:d}')
        .bind({ d: data })
        .execute()
    } catch (_) {}
  }

  logRecord.set('status', finalStatus)
  logRecord.set('paginas_total', totalPages)
  logRecord.set('paginas_processadas', pagesProcessed.length)
  logRecord.set('trips_processadas', tripsProcessed)
  logRecord.set('eventos_processados', eventosProcessed)
  logRecord.set('motoristas_encontrados', motoristasEncontrados)
  if (isComplete) {
    logRecord.set('concluido_em', new Date().toISOString())
    logRecord.set(
      'duracao_segundos',
      Math.floor((Date.now() - new Date(logRecord.getString('iniciado_em')).getTime()) / 1000),
    )
  }
  $app.save(logRecord)

  if (isComplete) {
    syncStatus.set('status', 'completed')
    syncStatus.set('updated_at', new Date().toISOString())
    $app.save(syncStatus)
  }

  return e.json(200, {
    sucesso: isComplete,
    status: finalStatus,
    fase: isComplete ? 'completed' : phase,
    trips_processadas: tripsProcessed,
    eventos_processados: eventosProcessed,
    duracao_segundos: Math.floor((Date.now() - startTime) / 1000),
    paginas_total: totalPages,
    paginas_processadas: pagesProcessed.length,
    motoristas_encontrados: motoristasEncontrados,
    trips_restantes: remainingTrips,
  })
})
