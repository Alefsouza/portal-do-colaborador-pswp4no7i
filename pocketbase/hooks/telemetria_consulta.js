routerAdd('POST', '/backend/v1/telemetria/consulta', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  var authHeader = e.requestInfo().headers['authorization'] || ''
  if (!authHeader.replace(/^Bearer\s+/i, '').trim()) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  var userId = ''
  var jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  try {
    var jwtPayload = $security.parseUnverifiedJWT(jwtToken)
    if (jwtPayload && jwtPayload.id) {
      if (!jwtPayload.exp || Date.now() < jwtPayload.exp * 1000) {
        userId = jwtPayload.id
      }
    }
  } catch (_) {}

  if (!userId) {
    return e.json(401, { error: 'Sessão inválida.' })
  }

  var userNomeCompleto = ''
  try {
    var usuarioRec = $app.findRecordById('usuarios', userId)
    if (usuarioRec) {
      userNomeCompleto = usuarioRec.getString('nome_completo') || ''
    }
  } catch (_) {}

  var body = e.requestInfo().body || {}
  var data = (body.data || '').trim()
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return e.json(400, { error: 'Data inválida. Use o formato YYYY-MM-DD.' })
  }

  var today = new Date()
  today.setHours(23, 59, 59, 999)
  var minDate = new Date()
  minDate.setDate(minDate.getDate() - 30)
  minDate.setHours(0, 0, 0, 0)
  var reqDate = new Date(data + 'T00:00:00')

  if (reqDate > today || reqDate < minDate) {
    return e.json(400, { error: 'Consulta disponível apenas para os últimos 30 dias.' })
  }

  var filterBase = '(motorista_id = {:uid}'
  var filterParams = { uid: userId, d: data, c: 'direcao' }
  if (userNomeCompleto) {
    filterBase += ' || motorista_nome = {:nome}'
    filterParams.nome = userNomeCompleto
  }
  filterBase += ') && data = {:d} && classificacao = {:c}'

  var drivingEvents = []
  try {
    drivingEvents = $app.findRecordsByFilter(
      'telemetria_eventos',
      filterBase,
      '-data_hora',
      1000,
      0,
      filterParams,
    )
  } catch (_) {}

  var technicalFilterParams = { uid: userId, d: data, c: 'tecnico' }
  if (userNomeCompleto) {
    technicalFilterParams.nome = userNomeCompleto
  }
  var technicalEvents = []
  try {
    technicalEvents = $app.findRecordsByFilter(
      'telemetria_eventos',
      filterBase,
      '-data_hora',
      1000,
      0,
      technicalFilterParams,
    )
  } catch (_) {}

  var seenIds = {}

  function buildEvent(rec) {
    var recId = rec.id
    if (seenIds[recId]) return null
    seenIds[recId] = true
    return {
      data: rec.getString('hora_inicio') || rec.getString('data_hora'),
      tipo: rec.getString('tipo_evento'),
      veiculo: rec.getString('frota_placa'),
      categoria: rec.getString('categoria_evento'),
      duracao: rec.get('duracao') || 0,
      distancia: rec.getString('distancia'),
      velocidade: rec.getString('velocidade'),
    }
  }

  var eventosDirecao = []
  for (var i = 0; i < drivingEvents.length; i++) {
    var ev = buildEvent(drivingEvents[i])
    if (ev) eventosDirecao.push(ev)
  }

  var eventosTecnicos = []
  for (var j = 0; j < technicalEvents.length; j++) {
    var evT = buildEvent(technicalEvents[j])
    if (evT) eventosTecnicos.push(evT)
  }

  var porTipo = {}
  var distanciaTotal = 0
  var velocidadeSoma = 0
  var velocidadeCount = 0
  var allEvents = eventosDirecao.concat(eventosTecnicos)

  for (var k = 0; k < allEvents.length; k++) {
    var tipo = allEvents[k].tipo
    if (tipo) {
      if (!porTipo[tipo]) porTipo[tipo] = 0
      porTipo[tipo]++
    }
    var dist = parseFloat(allEvents[k].distancia)
    if (!isNaN(dist)) distanciaTotal += dist
    var vel = parseFloat(allEvents[k].velocidade)
    if (!isNaN(vel)) {
      velocidadeSoma += vel
      velocidadeCount++
    }
  }

  var velocidadeMedia = velocidadeCount > 0 ? velocidadeSoma / velocidadeCount : 0

  return e.json(200, {
    eventos_direcao: eventosDirecao,
    eventos_tecnicos: eventosTecnicos,
    resumo: {
      total_eventos: allEvents.length,
      total_eventos_direcao: eventosDirecao.length,
      total_eventos_tecnicos: eventosTecnicos.length,
      por_tipo: porTipo,
    },
    metricas: {
      distancia_total: distanciaTotal.toFixed(2),
      velocidade_media: velocidadeMedia.toFixed(1),
    },
  })
})
