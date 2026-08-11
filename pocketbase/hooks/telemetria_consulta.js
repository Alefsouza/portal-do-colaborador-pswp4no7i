routerAdd('POST', '/backend/v1/telemetria/consulta', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  var authHeader = e.requestInfo().headers['authorization'] || ''
  if (!authHeader.replace(/^Bearer\s+/i, '').trim()) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  var jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  var jwtPayload = null
  try {
    jwtPayload = $security.parseUnverifiedJWT(jwtToken)
  } catch (err) {
    $app.logger().error('telemetria_consulta: failed to parse JWT', 'error', String(err))
    return e.json(401, { error: 'Sessão inválida.' })
  }

  if (!jwtPayload || !jwtPayload.id) {
    return e.json(401, { error: 'Sessão inválida.' })
  }

  if (jwtPayload.exp && Date.now() >= jwtPayload.exp * 1000) {
    return e.json(401, { error: 'Sessão inválida.' })
  }

  var userId = jwtPayload.id
  var userCpf = jwtPayload.cpf || ''

  var userNomeCompleto = ''
  try {
    var usuarioRec = $app.findRecordById('usuarios', userId)
    if (usuarioRec) {
      userNomeCompleto = usuarioRec.getString('nome_completo') || ''
    }
  } catch (err) {
    $app
      .logger()
      .error(
        'telemetria_consulta: failed to find usuario by id',
        'userId',
        userId,
        'error',
        String(err),
      )
  }

  if (!userNomeCompleto && userCpf) {
    try {
      var cpfRec = $app.findFirstRecordByData('usuarios', 'cpf', userCpf)
      if (cpfRec) {
        userNomeCompleto = cpfRec.getString('nome_completo') || ''
      }
    } catch (err) {
      $app
        .logger()
        .error(
          'telemetria_consulta: failed to find usuario by cpf',
          'cpf',
          userCpf,
          'error',
          String(err),
        )
    }
  }

  if (!userNomeCompleto) {
    $app
      .logger()
      .warn(
        'telemetria_consulta: no nome_completo found for user',
        'userId',
        userId,
        'cpf',
        userCpf,
      )
    return e.json(200, {
      eventos_direcao: [],
      eventos_tecnicos: [],
      resumo: {
        total_eventos: 0,
        total_eventos_direcao: 0,
        total_eventos_tecnicos: 0,
        por_tipo: {},
      },
      metricas: {
        distancia_total: '0.00',
        velocidade_media: '0.0',
      },
    })
  }

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

  var filter = 'motorista_nome = {:nome} && data = {:d}'
  var params = { nome: userNomeCompleto, d: data }

  $app
    .logger()
    .info(
      'telemetria_consulta: querying events',
      'motorista_nome',
      userNomeCompleto,
      'filter',
      filter,
      'data',
      data,
    )

  var allEvents = $app.findRecordsByFilter(
    'telemetria_eventos',
    filter,
    '-data_hora',
    1000,
    0,
    params,
  )

  $app
    .logger()
    .info(
      'telemetria_consulta: records returned by filter',
      'count',
      allEvents.length,
      'motorista_nome',
      userNomeCompleto,
      'data',
      data,
    )

  var seenIds = {}
  var eventosDirecao = []
  var eventosTecnicos = []

  for (var i = 0; i < allEvents.length; i++) {
    var rec = allEvents[i]
    var recId = rec.id
    if (seenIds[recId]) continue
    seenIds[recId] = true

    var classificacao = (rec.getString('classificacao') || '').toLowerCase().trim()

    var eventObj = {
      data: rec.getString('hora_inicio') || rec.getString('data_hora'),
      tipo: rec.getString('tipo_evento'),
      veiculo: rec.getString('frota_placa'),
      categoria: rec.getString('categoria_evento'),
      duracao: rec.get('duracao') || 0,
      distancia: rec.getString('distancia'),
      velocidade: rec.getString('velocidade'),
    }

    if (classificacao === 'tecnico' || classificacao === 'técnico') {
      eventosTecnicos.push(eventObj)
    } else {
      eventosDirecao.push(eventObj)
    }
  }

  $app
    .logger()
    .info(
      'telemetria_consulta: deduplicated results',
      'direcao',
      eventosDirecao.length,
      'tecnicos',
      eventosTecnicos.length,
      'motorista_nome',
      userNomeCompleto,
    )

  var porTipo = {}
  var distanciaTotal = 0
  var velocidadeSoma = 0
  var velocidadeCount = 0
  var combined = eventosDirecao.concat(eventosTecnicos)

  for (var k = 0; k < combined.length; k++) {
    var tipo = combined[k].tipo
    if (tipo) {
      if (!porTipo[tipo]) porTipo[tipo] = 0
      porTipo[tipo]++
    }
    var dist = parseFloat(combined[k].distancia)
    if (!isNaN(dist)) distanciaTotal += dist
    var vel = parseFloat(combined[k].velocidade)
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
      total_eventos: combined.length,
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
