// Importacao de telemetria (eventos) em lotes (chunks) para contornar o
// limite de tamanho de upload.
// Redeploy: forcar recarga/registro da rota pelo PocketBase.
//
// Contrato do chunk: cada lote (incluindo o chunk_index 0) deve conter a
// linha de cabecalho do CSV como primeira linha, seguida de ate ~500 linhas
// de dados. Isso permite que cada requisicao seja autocontida (o parse
// posicional dos eventos pula a primeira linha, igual ao hook original).
//
// Regras:
//  1. chunk_index == 0 => limpa todos os registros de telemetria_eventos
//     cujo campo `data` seja igual a data_referencia (ou a data de hoje).
//  2. Faz o parse/insert usando a MESMA logica de normalizacao de nome,
//     match de motorista (nome normalizado + fallback 3 primeiros nomes) e
//     classificacao (direcao/tecnico) do hook telemetria_csv_import.js.
//  3. Ultimo lote (chunk_index == total_chunks - 1) => retorna resumo
//     cumulativo consultado do banco para a data_referencia.
//  4. Caso contrario => { status, chunk_recebido, registros_inseridos }.
routerAdd('POST', '/backend/v1/telemetria/csv-import-chunk', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token')

  // ---- Autenticacao (X-Sync-Token ou JWT de admin TI/Admin) ----
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

  // ---- Body ----
  var body = e.requestInfo().body || {}
  var csvText = body.csv_chunk || ''
  var chunkIndex = Number(body.chunk_index || 0)
  var totalChunks = Number(body.total_chunks || 1)

  if (!csvText.trim()) {
    return e.json(400, { error: 'csv_chunk vazio.' })
  }

  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.substring(1)
  }

  // data_referencia (ou hoje) no formato YYYY-MM-DD
  var today = new Date()
  var tY = today.getFullYear()
  var tM = today.getMonth() + 1
  var tD = today.getDate()
  var todayStr = tY + '-' + (tM < 10 ? '0' + tM : tM) + '-' + (tD < 10 ? '0' + tD : tD)
  var dataReferencia = body.data_referencia || todayStr

  // ---- Regra 1: limpar registros da data no primeiro lote ----
  if (chunkIndex === 0) {
    try {
      $app
        .db()
        .newQuery('DELETE FROM telemetria_eventos WHERE data = {:d}')
        .bind({ d: dataReferencia })
        .execute()
    } catch (err) {
      $app.logger().error('telemetria csv-import-chunk delete error', 'error', String(err))
    }
  }

  // ---- Parse das linhas (igual ao hook original: pula o cabecalho) ----
  var lines = csvText.split('\n')
  var dataLines = []
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim()
    if (line) dataLines.push(line)
  }

  // ---- Funcoes de normalizacao (inline - VM de callback nao enxerga topo) ----
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

  function extractDate(horaInicio) {
    if (!horaInicio) return ''
    var match = horaInicio.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (match) return match[3] + '-' + match[2] + '-' + match[1]
    return ''
  }

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

  // ---- Mapa de motoristas ----
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

  // ---- Contador de evento_id (continua do MAX atual a cada lote) ----
  var eventosCol = $app.findCollectionByNameOrId('telemetria_eventos')

  var maxModel = new DynamicModel({ maxId: 0 })
  try {
    $app.db().newQuery('SELECT MAX(evento_id) as maxId FROM telemetria_eventos').one(maxModel)
  } catch (_) {}
  var eventoIdCounter = (maxModel.maxId || 0) + 1

  // ---- Insercao ----
  var nowIso = new Date().toISOString()
  var registrosInseridos = 0

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
    } else if (normalizedMotorista) {
      var firstThree = firstThreeNames(motoristaNome)
      if (firstThreeToId[firstThree]) {
        motoristaId = firstThreeToId[firstThree]
      }
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

      $app.saveNoValidate(record)
      registrosInseridos++
    } catch (err) {
      $app
        .logger()
        .error('telemetria csv-import-chunk save error', 'line', k + 2, 'error', String(err))
    }
  }

  // ---- Resposta ----
  var isLast = chunkIndex === totalChunks - 1

  if (!isLast) {
    return e.json(200, {
      status: 'ok',
      chunk_recebido: chunkIndex,
      registros_inseridos: registrosInseridos,
    })
  }

  // Ultimo lote: resumo cumulativo consultado do banco para data_referencia
  var sumModel = new DynamicModel({
    total: 0,
    direcao: 0,
    tecnico: 0,
    encontrados: 0,
    nao_encontrados: 0,
  })
  try {
    $app
      .db()
      .newQuery(
        'SELECT COUNT(*) as total, ' +
          "SUM(CASE WHEN classificacao = 'direcao' THEN 1 ELSE 0 END) as direcao, " +
          "SUM(CASE WHEN classificacao = 'tecnico' THEN 1 ELSE 0 END) as tecnico, " +
          "SUM(CASE WHEN motorista_id IS NOT NULL AND motorista_id != '' THEN 1 ELSE 0 END) as encontrados, " +
          "SUM(CASE WHEN motorista_id IS NULL OR motorista_id = '' THEN 1 ELSE 0 END) as nao_encontrados " +
          'FROM telemetria_eventos WHERE data = {:d}',
      )
      .bind({ d: dataReferencia })
      .one(sumModel)
  } catch (err) {
    $app.logger().error('telemetria csv-import-chunk summary error', 'error', String(err))
  }

  $app
    .logger()
    .info(
      'telemetria csv-import-chunk complete',
      'data',
      dataReferencia,
      'total',
      sumModel.total,
      'direcao',
      sumModel.direcao,
      'tecnico',
      sumModel.tecnico,
    )

  return e.json(200, {
    status: 'concluido',
    data_referencia: dataReferencia,
    total_registros_inseridos: sumModel.total,
    motoristas_encontrados: sumModel.encontrados,
    motoristas_nao_encontrados: sumModel.nao_encontrados,
    eventos_direcao: sumModel.direcao,
    eventos_tecnicos: sumModel.tecnico,
    chunk_recebido: chunkIndex,
    registros_inseridos_este_lote: registrosInseridos,
  })
})
