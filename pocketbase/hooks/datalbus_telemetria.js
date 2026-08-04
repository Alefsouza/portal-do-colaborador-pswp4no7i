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
  var data = (body.data || '').trim()
  var workerIdRaw = (body.worker_id || '').trim()

  if (!data || !workerIdRaw) {
    return e.json(400, { error: 'Parâmetros obrigatórios: data e worker_id.' })
  }
  var workerId = parseInt(workerIdRaw, 10)
  if (isNaN(workerId) || workerId <= 0) {
    return e.json(400, { error: 'worker_id inválido' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return e.json(400, { error: 'Data inválida. Use o formato YYYY-MM-DD.' })
  }

  var today = new Date()
  today.setHours(0, 0, 0, 0)
  var minDate = new Date()
  minDate.setDate(minDate.getDate() - 30)
  minDate.setHours(0, 0, 0, 0)
  var reqDate = new Date(data + 'T00:00:00')

  if (reqDate > today || reqDate < minDate) {
    return e.json(400, { erro: 'Consulta disponivel apenas para os ultimos 30 dias.' })
  }

  var syncRecords = []
  try {
    syncRecords = $app.findRecordsByFilter(
      'telemetria_sync_log',
      'data_sincronizada = {:d}',
      '-created',
      1,
      0,
      { d: data },
    )
  } catch (_) {}

  var syncLogStatus = syncRecords.length > 0 ? syncRecords[0].getString('status') : ''
  var isSyncLogFinal = syncLogStatus === 'sucesso' || syncLogStatus === 'completed'

  if (!isSyncLogFinal) {
    var syncStatusRecords = []
    try {
      syncStatusRecords = $app.findRecordsByFilter(
        'datalbus_sync_status',
        'date = {:d}',
        '-updated',
        1,
        0,
        { d: data },
      )
    } catch (_) {}

    var syncStatusVal = syncStatusRecords.length > 0 ? syncStatusRecords[0].getString('status') : ''
    if (syncStatusVal !== 'completed' && syncStatusVal !== 'sucesso') {
      return e.json(200, {
        sincronizado: false,
        mensagem:
          'Os dados desta data ainda nao foram sincronizados. Tente novamente em alguns minutos.',
      })
    }
  }

  var trips = []
  try {
    trips = $app.findRecordsByFilter(
      'telemetria_trips',
      'worker_id = {:w} && data = {:d}',
      '',
      1000,
      0,
      { w: workerId, d: data },
    )
  } catch (_) {}

  var drivingEventRecords = []
  try {
    drivingEventRecords = $app.findRecordsByFilter(
      'telemetria_eventos',
      'worker_id = {:w} && data = {:d} && classificacao = {:c}',
      '-data_hora',
      1000,
      0,
      { w: workerId, d: data, c: 'direcao' },
    )
  } catch (_) {}

  var technicalEventRecords = []
  try {
    technicalEventRecords = $app.findRecordsByFilter(
      'telemetria_eventos',
      'worker_id = {:w} && data = {:d} && classificacao = {:c}',
      '-data_hora',
      1000,
      0,
      { w: workerId, d: data, c: 'tecnico' },
    )
  } catch (_) {}

  function buildEvent(rec) {
    return {
      data: rec.getString('data_hora'),
      tipo: rec.getString('tipo_evento'),
      veiculo: String(rec.get('asset_id') || ''),
      descricao: rec.getString('categoria'),
      duracao: rec.get('duracao') || 0,
      latitude: rec.getString('latitude'),
      longitude: rec.getString('longitude'),
      quantidade: rec.get('quantidade') || 0,
    }
  }

  var eventosDirecao = []
  for (var i = 0; i < drivingEventRecords.length; i++) {
    eventosDirecao.push(buildEvent(drivingEventRecords[i]))
  }

  var eventosTecnicos = []
  for (var j = 0; j < technicalEventRecords.length; j++) {
    eventosTecnicos.push(buildEvent(technicalEventRecords[j]))
  }

  var totalViagens = trips.length
  var distanciaTotal = 0
  var duracaoTotalSegundos = 0

  for (var k = 0; k < trips.length; k++) {
    var mileageStr = trips[k].getString('mileage') || ''
    var mileageNum = parseFloat(mileageStr)
    if (!isNaN(mileageNum)) distanciaTotal += mileageNum

    var driveDur = trips[k].getString('drive_duration') || ''
    if (driveDur) {
      if (driveDur.indexOf(':') !== -1) {
        var parts = driveDur.split(':')
        if (parts.length === 3) {
          duracaoTotalSegundos +=
            (parseInt(parts[0], 10) || 0) * 3600 +
            (parseInt(parts[1], 10) || 0) * 60 +
            (parseInt(parts[2], 10) || 0)
        } else if (parts.length === 2) {
          duracaoTotalSegundos += (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)
        }
      } else {
        var secs = parseFloat(driveDur)
        if (!isNaN(secs)) duracaoTotalSegundos += secs
      }
    }
  }

  function formatDuration(totalSecs) {
    var hrs = Math.floor(totalSecs / 3600)
    var mins = Math.floor((totalSecs % 3600) / 60)
    var secs = Math.floor(totalSecs % 60)
    function p2(n) {
      return n < 10 ? '0' + n : String(n)
    }
    return p2(hrs) + ':' + p2(mins) + ':' + p2(secs)
  }

  var resumoPorTipo = {}
  for (var d = 0; d < eventosDirecao.length; d++) {
    var tipo = eventosDirecao[d].tipo
    if (tipo) {
      if (!resumoPorTipo[tipo]) resumoPorTipo[tipo] = 0
      resumoPorTipo[tipo]++
    }
  }

  var pontuacao = null

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
    var tokenRow = new DynamicModel({ token: '', expires: 0 })
    $app
      .db()
      .newQuery("SELECT token, expires FROM _datalbus_cache WHERE id = 'session' LIMIT 1")
      .one(tokenRow)
    if (tokenRow.token && Date.now() < tokenRow.expires) currentToken = tokenRow.token
  } catch (_) {}

  var dbEmail = $secrets.get('DATALBUS_EMAIL') || ''
  var dbPass = $secrets.get('DATALBUS_PASSWORD') || ''
  var dbTenancy = $secrets.get('DATALBUS_X_TENANCY') || $secrets.get('DATALBUS_TENANCY') || ''

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

  if (!currentToken && dbEmail && dbPass && dbTenancy) {
    doLogin()
  }

  if (currentToken && dbTenancy) {
    var scoreUrl =
      'https://datalbus.com.br:8000/api/v2/drivers/score?dtIni=' +
      encodeURIComponent(data) +
      '&dtFin=' +
      encodeURIComponent(data) +
      '&workerId[]=' +
      workerId
    try {
      var scoreRes = $http.send({
        url: scoreUrl,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + currentToken,
          'X-Tenancy': dbTenancy,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      if (scoreRes.statusCode === 200 && scoreRes.json) {
        pontuacao = scoreRes.json
      } else if (scoreRes.statusCode === 401) {
        doLogin()
        if (currentToken) {
          var scoreRes2 = $http.send({
            url: scoreUrl,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + currentToken,
              'X-Tenancy': dbTenancy,
              Accept: 'application/json',
            },
            timeout: 15,
          })
          if (scoreRes2.statusCode === 200 && scoreRes2.json) {
            pontuacao = scoreRes2.json
          }
        }
      }
    } catch (_) {}
  }

  return e.json(200, {
    sincronizado: true,
    pontuacao: pontuacao,
    eventos_direcao: eventosDirecao,
    eventos_tecnicos: eventosTecnicos,
    resumo: {
      total_eventos_direcao: eventosDirecao.length,
      por_tipo: resumoPorTipo,
    },
    metricas: {
      total_viagens: totalViagens,
      distancia_total_km: parseFloat(distanciaTotal.toFixed(3)),
      duracao_total: formatDuration(duracaoTotalSegundos),
    },
  })
})
