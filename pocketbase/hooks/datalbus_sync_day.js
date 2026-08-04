routerAdd('POST', '/backend/v1/datalbus/sync-day', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token')

  var syncToken = e.requestInfo().headers['x_sync_token'] || ''
  var expectedToken = $secrets.get('DATALBUS_SYNC_TOKEN') || ''
  if (!expectedToken || syncToken !== expectedToken) {
    return e.json(401, { error: 'Token de sincronização inválido.' })
  }

  var body = e.requestInfo().body || {}
  var data = (body.data || '').trim()
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return e.json(400, { error: 'Data inválida. Use o formato YYYY-MM-DD.' })
  }

  var startTime = Date.now()
  var TIME_LIMIT = 280000

  var syncLogCol = $app.findCollectionByNameOrId('telemetria_sync_log')
  var logRecord = new Record(syncLogCol)
  logRecord.set('data_sincronizada', data)
  logRecord.set('status', 'em_andamento')
  logRecord.set('iniciado_em', new Date().toISOString())
  logRecord.set('tentativa', 1)
  $app.save(logRecord)

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

  try {
    $app
      .db()
      .newQuery(
        'CREATE TABLE IF NOT EXISTS _datalbus_cache (id TEXT PRIMARY KEY, token TEXT, expires INTEGER)',
      )
      .execute()
  } catch (_) {}

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

  var totalPages = 0,
    pagesProcessed = 0,
    tripsProcessed = 0,
    eventosProcessed = 0
  var uniqueWorkers = {},
    tripWorkers = {}
  var isPartial = false
  var nowIso = new Date().toISOString()

  function upsertTrip(trip) {
    var tripId = parseInt(String(trip.id || trip.trip_id || trip.tripId || '0'), 10)
    if (!tripId) return
    var subtrips = trip.subtrips || trip.sub_trips || trip.subTrips || []
    if (!tripWorkers[tripId]) tripWorkers[tripId] = []
    if (!Array.isArray(subtrips) || subtrips.length === 0) return
    for (var s = 0; s < subtrips.length; s++) {
      var sub = subtrips[s]
      var workerId = parseInt(String(sub.worker_id || '0'), 10)
      if (!workerId) continue
      if (tripWorkers[tripId].indexOf(workerId) === -1) tripWorkers[tripId].push(workerId)
      uniqueWorkers[workerId] = true
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
        tripsProcessed++
      } catch (_) {}
    }
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

  try {
    var firstRes = apiGet(
      'https://datalbus.com.br:8000/api/v2/trips?date=' +
        encodeURIComponent(data) +
        '&per_page=100&page=1',
    )
    if (firstRes.statusCode !== 200 || !firstRes.json)
      throw new Error('Falha ao buscar trips: ' + firstRes.statusCode)
    var respObj = firstRes.json
    totalPages =
      respObj.last_page || respObj.total_pages || (respObj.meta && respObj.meta.last_page) || 1
    pagesProcessed = 1
    var tripsArr = extractArray(respObj)
    for (var i = 0; i < tripsArr.length; i++) upsertTrip(tripsArr[i])

    for (var page = 2; page <= totalPages; page++) {
      if (Date.now() - startTime > TIME_LIMIT) {
        isPartial = true
        break
      }
      var pageRes = apiGet(
        'https://datalbus.com.br:8000/api/v2/trips?date=' +
          encodeURIComponent(data) +
          '&per_page=100&page=' +
          page,
      )
      if (pageRes.statusCode !== 200 || !pageRes.json) continue
      pagesProcessed++
      var pageTrips = extractArray(pageRes.json)
      for (var j = 0; j < pageTrips.length; j++) upsertTrip(pageTrips[j])
    }

    var tripIds = Object.keys(tripWorkers)
    for (var k = 0; k < tripIds.length; k++) {
      if (Date.now() - startTime > TIME_LIMIT) {
        isPartial = true
        break
      }
      var tid = parseInt(tripIds[k], 10)
      var workers = tripWorkers[tid] || []
      var defaultWorker = workers.length > 0 ? workers[0] : 0
      var evRes = apiGet(
        'https://datalbus.com.br:8000/api/v2/trips/' +
          encodeURIComponent(String(tid)) +
          '/events?date=' +
          encodeURIComponent(data) +
          '&per_page=100',
      )
      if (evRes.statusCode !== 200 || !evRes.json) continue
      var events = extractArray(evRes.json)
      for (var m = 0; m < events.length; m++) {
        var ev = events[m]
        var evWorker = parseInt(String(ev.worker_id || '0'), 10) || defaultWorker
        upsertEvent(ev, tid, evWorker)
      }
    }

    var status = isPartial ? 'parcial' : 'sucesso'
    logRecord.set('status', status)
    logRecord.set('concluido_em', new Date().toISOString())
    logRecord.set('duracao_segundos', Math.floor((Date.now() - startTime) / 1000))
    logRecord.set('paginas_total', totalPages)
    logRecord.set('paginas_processadas', pagesProcessed)
    logRecord.set('trips_processadas', tripsProcessed)
    logRecord.set('motoristas_encontrados', Object.keys(uniqueWorkers).length)
    logRecord.set('eventos_processados', eventosProcessed)
    if (isPartial) logRecord.set('mensagem_erro', 'Sincronização interrompida por tempo limite')
    $app.save(logRecord)

    return e.json(200, {
      sucesso: !isPartial,
      status: status,
      trips_processadas: tripsProcessed,
      eventos_processados: eventosProcessed,
      duracao_segundos: Math.floor((Date.now() - startTime) / 1000),
      paginas_total: totalPages,
      paginas_processadas: pagesProcessed,
    })
  } catch (err) {
    logRecord.set('status', 'erro')
    logRecord.set('concluido_em', new Date().toISOString())
    logRecord.set('duracao_segundos', Math.floor((Date.now() - startTime) / 1000))
    logRecord.set('mensagem_erro', String(err).substring(0, 500))
    logRecord.set('trips_processadas', tripsProcessed)
    logRecord.set('eventos_processados', eventosProcessed)
    $app.save(logRecord)
    return e.json(500, {
      sucesso: false,
      error: String(err),
      trips_processadas: tripsProcessed,
      eventos_processados: eventosProcessed,
    })
  }
})
