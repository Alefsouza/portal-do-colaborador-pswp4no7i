routerAdd('POST', '/backend/v1/datalbus/sync-chunk', (e) => {
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
  var startPage = parseInt(body.start_page || '0', 10)
  var chunkSize = parseInt(body.chunk_size || '3', 10) || 3

  if (!date) return e.json(400, { error: 'Parâmetro obrigatório: date.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return e.json(400, { error: 'Data inválida. Use YYYY-MM-DD.' })
  if (isNaN(startPage) || startPage < 1) return e.json(400, { error: 'start_page inválido.' })

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

  function getTripId(trip) {
    return trip.id || trip.trip_id || trip.tripId || ''
  }

  var token = getCachedToken()
  if (!token) {
    token = authenticate()
    if (!token) return e.json(502, { error: 'Erro de autenticação com a API DataBus.' })
  }

  var totalPages = 0
  var pagesProcessed = []
  try {
    var statusRecords = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: date,
    })
    if (statusRecords.length > 0) {
      totalPages = statusRecords[0].get('total_pages') || 0
      var raw = statusRecords[0].getString('pages_processed')
      try {
        pagesProcessed = raw ? JSON.parse(raw) : []
      } catch (_) {
        pagesProcessed = []
      }
    }
  } catch (_) {}

  var processedPages = []
  var tripsProcessed = 0
  var endPage = Math.min(startPage + chunkSize - 1, totalPages)

  for (var page = startPage; page <= endPage; page++) {
    if (pagesProcessed.indexOf(page) !== -1) {
      processedPages.push(page)
      continue
    }

    var pageUrl =
      'https://datalbus.com.br:8000/api/v2/trips?date=' +
      encodeURIComponent(date) +
      '&per_page=100&page=' +
      page
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

    if (res.statusCode !== 200) {
      $app
        .logger()
        .error('sync-chunk: page fetch failed', 'page', page, 'statusCode', res.statusCode)
      continue
    }

    var respJson = null
    try {
      respJson = res.json
    } catch (_) {}
    if (!respJson) continue

    var trips = extractArray(respJson)
    tripsProcessed += trips.length

    for (var i = 0; i < trips.length; i++) {
      var tripId = String(getTripId(trips[i]) || 'trip_' + page + '_' + i)
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

    processedPages.push(page)
    pagesProcessed.push(page)

    if (trips.length < 100) break
  }

  try {
    var statusRecords2 = $app.findRecordsByFilter('datalbus_sync_status', 'date = {:d}', '', 1, 0, {
      d: date,
    })
    if (statusRecords2.length > 0) {
      var rec = statusRecords2[0]
      var allDone = pagesProcessed.length >= totalPages
      rec.set('pages_processed', JSON.stringify(pagesProcessed))
      rec.set('status', allDone ? 'trips_downloaded' : 'in_progress')
      rec.set('updated_at', new Date().toISOString())
      $app.save(rec)
    }
  } catch (err) {
    $app.logger().error('sync-chunk: failed to update sync status', 'message', String(err))
  }

  var nextPage = startPage + chunkSize
  var hasMore = nextPage <= totalPages

  return e.json(200, {
    processed_pages: processedPages,
    next_page: nextPage,
    has_more: hasMore,
    trips_processed: tripsProcessed,
  })
})
