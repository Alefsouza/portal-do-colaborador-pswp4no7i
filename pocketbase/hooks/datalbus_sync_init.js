routerAdd('POST', '/backend/v1/datalbus/sync-init', (e) => {
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
  if (!date) return e.json(400, { error: 'Parâmetro obrigatório: date.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return e.json(400, { error: 'Data inválida. Use YYYY-MM-DD.' })

  var dbEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var dbPass = $secrets.get('DATALBUS_PASSWORD') || ''
  var dbTenancy = $secrets.get('DATALBUS_X_TENANCY') || $secrets.get('DATALBUS_TENANCY') || ''
  if (!dbEmail || !dbPass || !dbTenancy) {
    return e.json(500, { error: 'Credenciais do DataBus não configuradas.' })
  }

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

  function extractArray(resp) {
    if (!resp) return []
    if (Array.isArray(resp)) return resp
    if (Array.isArray(resp.data)) return resp.data
    if (Array.isArray(resp.trips)) return resp.trips
    if (Array.isArray(resp.items)) return resp.items
    if (Array.isArray(resp.results)) return resp.results
    return []
  }

  function getLastPage(resp) {
    if (!resp) return 1
    if (typeof resp.last_page === 'number') return resp.last_page
    if (resp.meta && typeof resp.meta.last_page === 'number') return resp.meta.last_page
    if (resp.pagination && typeof resp.pagination.last_page === 'number')
      return resp.pagination.last_page
    return 1
  }

  function getTotalTrips(resp) {
    if (!resp) return 0
    if (typeof resp.total === 'number') return resp.total
    if (resp.meta && typeof resp.meta.total === 'number') return resp.meta.total
    if (resp.pagination && typeof resp.pagination.total === 'number') return resp.pagination.total
    return 0
  }

  function getTripId(trip) {
    return trip.id || trip.trip_id || trip.tripId || ''
  }

  var token = getCachedToken()
  if (!token) {
    token = authenticate()
    if (!token) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
  }

  var pageUrl =
    'https://datalbus.com.br:8000/api/v2/trips?date=' +
    encodeURIComponent(date) +
    '&per_page=100&page=1'
  var res = $http.send({
    url: pageUrl,
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Tenancy': dbTenancy,
      Accept: 'application/json',
    },
    timeout: 30,
  })

  if (res.statusCode === 401) {
    token = authenticate()
    if (!token) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
    res = $http.send({
      url: pageUrl,
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Tenancy': dbTenancy,
        Accept: 'application/json',
      },
      timeout: 30,
    })
  }

  if (res.statusCode !== 200)
    return e.json(502, { error: 'Falha ao buscar viagens da API DataBus.' })

  var respJson = null
  try {
    respJson = res.json
  } catch (_) {}
  if (!respJson) return e.json(502, { error: 'Resposta inválida da API DataBus.' })

  var totalPages = getLastPage(respJson)
  var totalTrips = getTotalTrips(respJson)
  var trips = extractArray(respJson)

  try {
    $app
      .db()
      .newQuery('DELETE FROM _datalbus_trips_cache WHERE date = {:d}')
      .bind({ d: date })
      .execute()
  } catch (_) {}

  for (var i = 0; i < trips.length; i++) {
    var tripId = String(getTripId(trips[i]) || 'trip_' + i)
    var cacheId = date + ':' + tripId
    try {
      $app
        .db()
        .newQuery(
          'INSERT OR REPLACE INTO _datalbus_trips_cache (id, date, trip_id, trip_json) VALUES ({:id}, {:date}, {:tripId}, {:json})',
        )
        .bind({ id: cacheId, date: date, tripId: tripId, json: JSON.stringify(trips[i]) })
        .execute()
    } catch (_) {}
  }

  var syncId = $security.randomString(16)
  try {
    var existing = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: date,
    })
    if (existing.length > 0) {
      existing[0].set('total_pages', totalPages)
      existing[0].set('pages_processed', JSON.stringify([1]))
      existing[0].set('status', 'in_progress')
      existing[0].set('updated_at', new Date().toISOString())
      $app.save(existing[0])
      syncId = existing[0].id
    } else {
      var col = $app.findCollectionByNameOrId('datalbus_sync_status')
      var record = new Record(col)
      record.set('date', date)
      record.set('total_pages', totalPages)
      record.set('pages_processed', JSON.stringify([1]))
      record.set('status', 'in_progress')
      record.set('updated_at', new Date().toISOString())
      $app.save(record)
      syncId = record.id
    }
  } catch (err) {
    $app.logger().error('sync-init: failed to save sync status', 'message', String(err))
  }

  return e.json(200, {
    total_pages: totalPages,
    total_trips: totalTrips,
    current_page: 1,
    sync_id: syncId,
  })
})
