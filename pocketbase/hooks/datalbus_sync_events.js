routerAdd('POST', '/backend/v1/datalbus/sync-events', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  var authHeader = e.requestInfo().headers['authorization'] || ''
  if (!authHeader.replace(/^Bearer\s+/i, '').trim()) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  var body = e.requestInfo().body || {}
  var date = (body.date || '').trim()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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

  var dbEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var dbPass = $secrets.get('DATALBUS_PASSWORD') || ''
  var dbTenancy = $secrets.get('DATALBUS_X_TENANCY') || $secrets.get('DATALBUS_TENANCY') || ''
  if (!dbEmail || !dbPass || !dbTenancy) {
    return e.json(500, { error: 'Credenciais do DataBus não configuradas.' })
  }

  var currentToken = ''
  try {
    var tokenRow = new DynamicModel({ token: '', expires: 0 })
    $app
      .db()
      .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
      .one(tokenRow)
    if (tokenRow.token && Date.now() < tokenRow.expires) currentToken = tokenRow.token
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
  if (!currentToken) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })

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

  var nowIso = new Date().toISOString()
  var tripsProcessed = 0

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
      var driverName = String(
        sub.driver_name || sub.worker_name || sub.motorista || trip.driver_name || '',
      )
      if (!driverName) continue
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
            dt: date,
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
      } catch (err) {
        $app
          .logger()
          .error('sync-events: upsertTrip failed', 'tripId', tripId, 'error', String(err))
      }
    }
    return count
  }

  try {
    var statusRecords = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: date,
    })
    if (statusRecords.length > 0 && statusRecords[0].getString('status') !== 'completed') {
      statusRecords[0].set('status', 'processing_events')
      statusRecords[0].set('updated_at', new Date().toISOString())
      $app.save(statusRecords[0])
    }
  } catch (_) {}

  var batchRows = []
  try {
    batchRows = $app
      .db()
      .newQuery(
        'SELECT id, trip_json FROM _datalbus_trips_cache WHERE date = {:d} AND (processed = 0 OR processed IS NULL) LIMIT 20',
      )
      .bind({ d: date })
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
    tripsProcessed += upsertTrip(trip)
    try {
      $app
        .db()
        .newQuery('UPDATE _datalbus_trips_cache SET processed = 1 WHERE id = {:id}')
        .bind({ id: row.id })
        .execute()
    } catch (_) {}
  }

  var remainingTrips = 0
  try {
    var remModel = new DynamicModel({ cnt: 0 })
    $app
      .db()
      .newQuery(
        'SELECT COUNT(*) as cnt FROM _datalbus_trips_cache WHERE date = {:d} AND (processed = 0 OR processed IS NULL)',
      )
      .bind({ d: date })
      .one(remModel)
    remainingTrips = remModel.cnt || 0
  } catch (_) {}

  var isComplete = remainingTrips === 0
  if (isComplete) {
    try {
      var statusRecords2 = $app.findRecordsByFilter(
        'datalbus_sync_status',
        'date = {:d}',
        '',
        1,
        0,
        { d: date },
      )
      if (statusRecords2.length > 0) {
        statusRecords2[0].set('status', 'completed')
        statusRecords2[0].set('updated_at', new Date().toISOString())
        $app.save(statusRecords2[0])
      }
    } catch (_) {}
    try {
      $app
        .db()
        .newQuery('DELETE FROM _datalbus_trips_cache WHERE date = {:d}')
        .bind({ d: date })
        .execute()
    } catch (_) {}
  }

  $app
    .logger()
    .info(
      'sync-events batch done (trips only)',
      'date',
      date,
      'tripsProcessed',
      tripsProcessed,
      'remaining',
      remainingTrips,
      'complete',
      isComplete,
    )

  return e.json(200, {
    sucesso: isComplete,
    trips_processadas: tripsProcessed,
    eventos_processados: 0,
    trips_restantes: remainingTrips,
    completo: isComplete,
  })
})
