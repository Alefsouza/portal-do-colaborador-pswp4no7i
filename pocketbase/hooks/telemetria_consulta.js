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
  try {
    var jwtPayload = $security.parseUnverifiedJWT(jwtToken)
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

  var body = e.requestInfo().body || {}
  var nomeCompleto = (body.nome_completo || '').trim()
  var data = (body.data || '').trim()

  if (!nomeCompleto) {
    return e.json(400, { error: 'Nome do colaborador não fornecido.' })
  }

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

  var filter = 'motorista_nome ~ {:nome} && data = {:d}'
  var params = { nome: nomeCompleto, d: data }

  $app
    .logger()
    .info(
      'telemetria_consulta: querying events',
      'motorista_nome',
      nomeCompleto,
      'filter',
      filter,
      'data',
      data,
    )

  var allEvents
  try {
    allEvents = $app.findRecordsByFilter(
      'telemetria_eventos',
      filter,
      '-data_hora',
      1000,
      0,
      params,
    )
  } catch (err) {
    $app
      .logger()
      .error(
        'telemetria_consulta: query failed',
        'motorista_nome',
        nomeCompleto,
        'filter',
        filter,
        'data',
        data,
        'error',
        String(err),
      )
    return e.json(500, { error: String(err) })
  }

  $app
    .logger()
    .info(
      'telemetria_consulta: records returned by filter',
      'count',
      allEvents.length,
      'motorista_nome',
      nomeCompleto,
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
      nomeCompleto,
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

  var tripsFilter = 'motorista_nome ~ {:nome} && data_viagem = {:d}'
  var trips = []
  try {
    trips = $app.findRecordsByFilter('telemetria_trips', tripsFilter, '-created', 1000, 0, params)
  } catch (err) {
    $app
      .logger()
      .error(
        'telemetria_consulta: trips query failed',
        'motorista_nome',
        nomeCompleto,
        'data',
        data,
        'error',
        String(err),
      )
  }

  var totalTrips = trips.length
  var totalKm = 0
  var totalSeconds = 0

  function parseKmFinal(rec) {
    var s = (rec.getString('km_final') || '').replace(',', '.').trim()
    var v = parseFloat(s)
    return isNaN(v) ? null : v
  }

  function parseInicioDate(rec) {
    var s = (rec.getString('inicio_viagem') || '').trim()
    if (!s) {
      // inicio_viagem vazio: usar fim_viagem como fallback para manter a ordem cronológica
      s = (rec.getString('fim_viagem') || '').trim()
    }
    if (!s) return new Date(0)
    var d = new Date(s.replace(' ', 'T'))
    return isNaN(d.getTime()) ? new Date(0) : d
  }

  // Ordenar viagens do dia por ordem cronológica de início
  var dayTrips = trips.slice().sort(function (a, b) {
    var da = parseInicioDate(a).getTime()
    var db = parseInicioDate(b).getTime()
    return da - db
  })

  if (dayTrips.length >= 2) {
    // 2+ viagens no dia: km_final da última - km_final da primeira
    var firstKm = parseKmFinal(dayTrips[0])
    var lastKm = parseKmFinal(dayTrips[dayTrips.length - 1])
    if (firstKm !== null && lastKm !== null) {
      totalKm = lastKm - firstKm
      if (totalKm < 0) totalKm = 0
    }
  } else if (dayTrips.length === 1) {
    // 1 viagem no dia: buscar a última viagem anterior do mesmo numero_veiculo
    var numeroVeiculo = (dayTrips[0].getString('numero_veiculo') || '').trim()
    var dayKm = parseKmFinal(dayTrips[0])
    if (numeroVeiculo && dayKm !== null) {
      var prevTrips = []
      try {
        var prevFilter = 'numero_veiculo = {:v} && data_viagem < {:d}'
        var prevParams = { v: numeroVeiculo, d: data }
        prevTrips = $app.findRecordsByFilter(
          'telemetria_trips',
          prevFilter,
          '-data_viagem,-inicio_viagem',
          1,
          0,
          prevParams,
        )
      } catch (err) {
        $app
          .logger()
          .error(
            'telemetria_consulta: previous trip query failed',
            'numero_veiculo',
            numeroVeiculo,
            'data',
            data,
            'error',
            String(err),
          )
      }
      if (prevTrips.length > 0) {
        var prevKm = parseKmFinal(prevTrips[0])
        if (prevKm !== null) {
          totalKm = dayKm - prevKm
          if (totalKm < 0) totalKm = 0
        }
      }
    }
  }

  for (var t = 0; t < trips.length; t++) {
    var tempoStr = trips[t].getString('tempo_total') || ''
    if (tempoStr.indexOf(':') !== -1) {
      var tParts = tempoStr.split(':')
      if (tParts.length === 3) {
        totalSeconds += (parseInt(tParts[0], 10) || 0) * 3600
        totalSeconds += (parseInt(tParts[1], 10) || 0) * 60
        totalSeconds += parseInt(tParts[2], 10) || 0
      } else if (tParts.length === 2) {
        totalSeconds += (parseInt(tParts[0], 10) || 0) * 60
        totalSeconds += parseInt(tParts[1], 10) || 0
      }
    } else {
      var secVal = parseFloat(tempoStr.replace(',', '.'))
      if (!isNaN(secVal)) totalSeconds += secVal
    }
  }

  var totalHours = totalSeconds / 3600
  var horasInt = Math.floor(totalHours)
  var minutosInt = Math.round((totalHours - horasInt) * 60)
  if (minutosInt === 60) {
    horasInt += 1
    minutosInt = 0
  }
  var horasFormatadas = horasInt + 'h ' + minutosInt + 'm'

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
    metricas_viagens: {
      quantidade_viagens: totalTrips,
      km_rodado: totalKm.toFixed(2),
      horas_dirigidas: horasFormatadas,
    },
  })
})
