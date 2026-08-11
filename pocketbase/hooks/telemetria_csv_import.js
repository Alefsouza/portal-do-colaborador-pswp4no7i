routerAdd('POST', '/backend/v1/telemetria/csv-import', (e) => {
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
      return e.json(401, { error: 'Acesso negado. Apenas administradores.' })
    }
  }

  var body = e.requestInfo().body || {}
  var csvText = body.csv || ''

  if (!csvText.trim()) {
    return e.json(400, { error: 'CSV vazio.' })
  }

  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.substring(1)
  }

  var lines = csvText.split('\n')
  if (lines.length < 2) {
    return e.json(400, { error: 'CSV sem dados.' })
  }

  var dataLines = []
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim()
    if (line) dataLines.push(line)
  }

  function normalizeName(name) {
    if (!name) return ''
    var s = String(name).trim()
    var from = 'àáâãäåçèéêëìíîïðñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝ'
    var to = 'aaaaaaceeeeiiiidnooooouuuuyyAAAAAACEEEEIIIIDNOOOOOUUUUY'
    for (var j = 0; j < from.length; j++) {
      s = s.replace(new RegExp(from[j], 'g'), to[j])
    }
    s = s.toUpperCase()
    s = s.replace(/\s+/g, ' ').trim()
    return s
  }

  function firstThreeNames(name) {
    var normalized = normalizeName(name)
    var parts = normalized.split(' ')
    if (parts.length <= 3) return normalized
    return parts.slice(0, 3).join(' ')
  }

  var usuarios = []
  try {
    usuarios = $app.findRecordsByFilter('usuarios', 'cpf != ""', '', 10000, 0)
  } catch (_) {}

  var nameToId = {}
  var firstThreeToId = {}
  for (var u = 0; u < usuarios.length; u++) {
    var nomeCompleto = usuarios[u].getString('nome_completo')
    var normalized = normalizeName(nomeCompleto)
    var firstThree = firstThreeNames(nomeCompleto)
    if (normalized) nameToId[normalized] = usuarios[u].id
    if (firstThree && !firstThreeToId[firstThree]) firstThreeToId[firstThree] = usuarios[u].id
  }

  var eventosCol = $app.findCollectionByNameOrId('telemetria_eventos')

  var maxModel = new DynamicModel({ maxId: 0 })
  try {
    $app.db().newQuery('SELECT MAX(evento_id) as maxId FROM telemetria_eventos').one(maxModel)
  } catch (_) {}
  var eventoIdCounter = (maxModel.maxId || 0) + 1

  var direcaoTypes = [
    'Excesso de velocidade',
    'Freada brusca',
    'Aceleracao brusca',
    'Desconforto em curva',
    'Aceleracao lateral',
    'Pontuacao do Motorista',
    'Marcha Lenta',
    'Ponto de forca',
  ]

  function isDirecao(categoria, tipo) {
    if (categoria && categoria.trim() === 'Desconforto lateral') return true
    if (tipo) {
      var t = tipo.trim()
      for (var d = 0; d < direcaoTypes.length; d++) {
        if (t === direcaoTypes[d]) return true
      }
    }
    return false
  }

  function extractDate(horaInicio) {
    if (!horaInicio) return ''
    var match = horaInicio.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (match) return match[3] + '-' + match[2] + '-' + match[1]
    return ''
  }

  var nowIso = new Date().toISOString()
  var totalLinhas = 0
  var eventosDirecao = 0
  var eventosTecnicos = 0
  var motoristasEncontrados = 0
  var motoristasNaoEncontrados = 0

  for (var k = 0; k < dataLines.length; k++) {
    var fields = dataLines[k].split(',')
    function getField(idx) {
      return idx < fields.length ? (fields[idx] || '').trim() : ''
    }

    var motoristaNome = getField(0)
    var frotaPlaca = getField(2)
    var grupoVeiculo = getField(3)
    var grupoPrincipal = getField(4)
    var horaInicio = getField(5)
    var latitudeInicial = getField(7)
    var longitudeInicial = getField(8)
    var direction = getField(9)
    var categoriaEvento = getField(10)
    var tipoEvento = getField(11)
    var horaFim = getField(12)
    var latitudeFinal = getField(14)
    var longitudeFinal = getField(15)
    var distancia = getField(16)
    var velocidade = getField(17)
    var duracao = getField(19)

    var data = extractDate(horaInicio)
    var classificacao = isDirecao(categoriaEvento, tipoEvento) ? 'direcao' : 'tecnico'

    var motoristaId = ''
    var normalizedMotorista = normalizeName(motoristaNome)
    if (normalizedMotorista && nameToId[normalizedMotorista]) {
      motoristaId = nameToId[normalizedMotorista]
      motoristasEncontrados++
    } else if (normalizedMotorista) {
      var firstThree = firstThreeNames(motoristaNome)
      if (firstThreeToId[firstThree]) {
        motoristaId = firstThreeToId[firstThree]
        motoristasEncontrados++
      } else {
        motoristasNaoEncontrados++
      }
    } else {
      motoristasNaoEncontrados++
    }

    try {
      var record = new Record(eventosCol)
      record.set('evento_id', eventoIdCounter++)
      record.set('trip_id', 0)
      record.set('worker_id', 0)
      record.set('data', data || '')
      record.set('data_hora', horaInicio)
      record.set('tipo_evento', tipoEvento)
      record.set('categoria', categoriaEvento)
      record.set('classificacao', classificacao)
      record.set('duracao', parseFloat(duracao) || 0)
      record.set('raw_data', JSON.stringify({ csv_line: dataLines[k] }))
      record.set('sincronizado_em', nowIso)
      record.set('motorista_nome', motoristaNome)
      record.set('motorista_id', motoristaId || null)
      record.set('hora_inicio', horaInicio)
      record.set('hora_fim', horaFim)
      record.set('frota_placa', frotaPlaca)
      record.set('grupo_veiculo', grupoVeiculo)
      record.set('grupo_principal', grupoPrincipal)
      record.set('categoria_evento', categoriaEvento)
      record.set('direcao', direction)
      record.set('distancia', distancia)
      record.set('velocidade', velocidade)
      record.set('latitude_inicial', latitudeInicial)
      record.set('longitude_inicial', longitudeInicial)
      record.set('latitude_final', latitudeFinal)
      record.set('longitude_final', longitudeFinal)
      record.set('processado_em', nowIso)

      if (motoristaId) {
        $app.saveNoValidate(record)
      } else {
        $app.saveNoValidate(record)
      }

      totalLinhas++
      if (classificacao === 'direcao') eventosDirecao++
      else eventosTecnicos++
    } catch (err) {
      $app.logger().error('telemetria csv import save error', 'line', k + 2, 'error', String(err))
    }
  }

  $app
    .logger()
    .info(
      'telemetria csv import complete',
      'total',
      totalLinhas,
      'direcao',
      eventosDirecao,
      'tecnico',
      eventosTecnicos,
    )

  return e.json(200, {
    total_linhas: totalLinhas,
    eventos_direcao: eventosDirecao,
    eventos_tecnicos: eventosTecnicos,
    motoristas_encontrados: motoristasEncontrados,
    motoristas_nao_encontrados: motoristasNaoEncontrados,
  })
})
