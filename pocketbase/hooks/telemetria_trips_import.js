routerAdd('POST', '/backend/v1/telemetria/trips-import', (e) => {
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

  var headerLine = lines[0].trim()
  var headers = headerLine.split(',')
  var headerMap = {}
  for (var h = 0; h < headers.length; h++) {
    headerMap[headers[h].trim().toLowerCase()] = h
  }

  var dataLines = []
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim()
    if (line) dataLines.push(line)
  }

  if (dataLines.length === 0) {
    return e.json(400, { error: 'CSV sem dados.' })
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

  function getField(rowFields, headerName) {
    var idx = headerMap[headerName.toLowerCase()]
    if (idx === undefined || idx < 0 || idx >= rowFields.length) return ''
    return (rowFields[idx] || '').trim()
  }

  function extractDate(dateStr) {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.substring(0, 10)
    }
    var match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (match) return match[3] + '-' + match[2] + '-' + match[1]
    return ''
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

  var tripsCol = $app.findCollectionByNameOrId('telemetria_trips')
  var nowIso = new Date().toISOString()
  var totalLinhas = 0
  var motoristasEncontrados = 0
  var motoristasNaoEncontrados = 0

  var tripsFieldNames = [
    'drive_id',
    'numero_veiculo',
    'grupo_veiculo',
    'motorista_nome',
    'senha_motorista',
    'grupo_motorista',
    'cpf_matricula',
    'inicio_viagem',
    'origem',
    'fim_viagem',
    'destino',
    'distancia',
    'tempo_total',
    'horimetro',
    'combustivel_utilizado',
    'km_por_litro',
    'litros_por_100km',
    'idle_time',
    'idle_time_minutos',
    'km_final',
    'tempo_motor',
    'doa_distance',
    'doa_time',
    'doa_distance_percent',
    'doa_time_percent',
    'co2',
    'time_from_prev_drive',
    'start_lat',
    'start_long',
    'end_lat',
    'end_long',
    'operacional',
    'data_viagem',
  ]

  var headerToFieldMap = {
    'drive id': 'drive_id',
    drive_id: 'drive_id',
    'numero veiculo': 'numero_veiculo',
    numero_veiculo: 'numero_veiculo',
    'grupo veiculo': 'grupo_veiculo',
    grupo_veiculo: 'grupo_veiculo',
    motorista: 'motorista_nome',
    motorista_nome: 'motorista_nome',
    'senha motorista': 'senha_motorista',
    senha_motorista: 'senha_motorista',
    'grupo motorista': 'grupo_motorista',
    grupo_motorista: 'grupo_motorista',
    'cpf / matricula': 'cpf_matricula',
    cpf_matricula: 'cpf_matricula',
    'inicio da viagem': 'inicio_viagem',
    inicio_viagem: 'inicio_viagem',
    origem: 'origem',
    'fim da viagem': 'fim_viagem',
    fim_viagem: 'fim_viagem',
    destino: 'destino',
    distancia: 'distancia',
    'tempo total': 'tempo_total',
    tempo_total: 'tempo_total',
    horimetro: 'horimetro',
    'combustivel utilizado': 'combustivel_utilizado',
    combustivel_utilizado: 'combustivel_utilizado',
    'km / litro': 'km_por_litro',
    km_por_litro: 'km_por_litro',
    'litros / 100km': 'litros_por_100km',
    litros_por_100km: 'litros_por_100km',
    'idle time': 'idle_time',
    idle_time: 'idle_time',
    'idle time (min)': 'idle_time_minutos',
    idle_time_minutos: 'idle_time_minutos',
    'km final': 'km_final',
    km_final: 'km_final',
    'tempo motor': 'tempo_motor',
    tempo_motor: 'tempo_motor',
    'doa distance': 'doa_distance',
    doa_distance: 'doa_distance',
    'doa time': 'doa_time',
    doa_time: 'doa_time',
    'doa distance %': 'doa_distance_percent',
    doa_distance_percent: 'doa_distance_percent',
    'doa time %': 'doa_time_percent',
    doa_time_percent: 'doa_time_percent',
    co2: 'co2',
    'time from prev drive': 'time_from_prev_drive',
    time_from_prev_drive: 'time_from_prev_drive',
    'start lat': 'start_lat',
    start_lat: 'start_lat',
    'start long': 'start_long',
    start_long: 'start_long',
    'end lat': 'end_lat',
    end_lat: 'end_lat',
    'end long': 'end_long',
    end_long: 'end_long',
    operacional: 'operacional',
    'data viagem': 'data_viagem',
    data_viagem: 'data_viagem',
  }

  for (var k = 0; k < dataLines.length; k++) {
    var rowFields = dataLines[k].split(',')

    var motoristaNome = ''
    var inicioViagemVal = ''
    var fimViagemVal = ''

    var motoristaHeaderKeys = ['motorista', 'motorista_nome', 'driver', 'driver_name']
    for (var mk = 0; mk < motoristaHeaderKeys.length; mk++) {
      var val = getField(rowFields, motoristaHeaderKeys[mk])
      if (val) {
        motoristaNome = val
        break
      }
    }

    var inicioHeaderKeys = ['inicio da viagem', 'inicio_viagem', 'start time', 'start_time']
    for (var ik = 0; ik < inicioHeaderKeys.length; ik++) {
      var val2 = getField(rowFields, inicioHeaderKeys[ik])
      if (val2) {
        inicioViagemVal = val2
        break
      }
    }

    var fimHeaderKeys = ['fim da viagem', 'fim_viagem', 'end time', 'end_time']
    for (var fk = 0; fk < fimHeaderKeys.length; fk++) {
      var val3 = getField(rowFields, fimHeaderKeys[fk])
      if (val3) {
        fimViagemVal = val3
        break
      }
    }

    var dataViagemHeaderKeys = ['data viagem', 'data_viagem', 'data da viagem']
    var dataViagemVal = ''
    for (var dk = 0; dk < dataViagemHeaderKeys.length; dk++) {
      var val4 = getField(rowFields, dataViagemHeaderKeys[dk])
      if (val4) {
        dataViagemVal = val4
        break
      }
    }

    var dataViagem = extractDate(dataViagemVal || fimViagemVal || inicioViagemVal)

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
      var record = new Record(tripsCol)

      for (var headerKey in headerMap) {
        if (headerMap.hasOwnProperty(headerKey)) {
          var fieldIdx = headerMap[headerKey]
          var fieldValue = fieldIdx < rowFields.length ? (rowFields[fieldIdx] || '').trim() : ''
          var fieldName = headerToFieldMap[headerKey]
          if (fieldName) {
            record.set(fieldName, fieldValue)
          }
        }
      }

      if (!record.getString('motorista_nome')) {
        record.set('motorista_nome', motoristaNome)
      }
      if (!record.getString('inicio_viagem')) {
        record.set('inicio_viagem', inicioViagemVal)
      }

      record.set('data_viagem', dataViagem)
      record.set('motorista_id', motoristaId || null)
      record.set('raw_data', JSON.stringify({ csv_line: dataLines[k] }))
      record.set('processado_em', nowIso)

      $app.saveNoValidate(record)
      totalLinhas++
    } catch (err) {
      $app.logger().error('telemetria trips import save error', 'line', k + 2, 'error', String(err))
    }
  }

  $app
    .logger()
    .info(
      'telemetria trips import complete',
      'total',
      totalLinhas,
      'drivers_found',
      motoristasEncontrados,
      'drivers_not_found',
      motoristasNaoEncontrados,
    )

  return e.json(200, {
    total_linhas: totalLinhas,
    trips_encontrados: totalLinhas,
    motoristas_encontrados: motoristasEncontrados,
    motoristas_nao_encontrados: motoristasNaoEncontrados,
  })
})
