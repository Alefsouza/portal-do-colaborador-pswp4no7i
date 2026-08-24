routerAdd('GET', '/backend/v1/escala', (e) => {
  var corsOrigin = e.request.header.get('Origin') || '*'
  e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
  e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  const authHeader = e.requestInfo().headers['authorization'] || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!authToken) {
    return e.json(401, { error: 'Token não fornecido.' })
  }

  const jwtSecret = $secrets.get('PB_SUPERUSER_TOKEN') || 'portal-colaborador-secret'
  let payload
  try {
    payload = $security.parseJWT(authToken, jwtSecret)
  } catch (_) {
    return e.json(401, { error: 'Token inválido.' })
  }

  if (!payload || !payload.id) {
    return e.json(401, { error: 'Token inválido.' })
  }

  let usuarioRecord
  try {
    usuarioRecord = $app.findRecordById('usuarios', payload.id)
  } catch (_) {
    return e.json(401, { error: 'Usuário não encontrado.' })
  }

  const registro = usuarioRecord.getString('registro')
  if (!registro) {
    return e.json(200, { items: [] })
  }

  function normalizeDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return ''
    var parts = dateStr.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        // DD-MM-YYYY -> YYYY-MM-DD
        return parts[2] + '-' + parts[1] + '-' + parts[0]
      }
      if (parts[0].length === 4 && parts[2].length === 2) {
        // Already YYYY-MM-DD
        return dateStr
      }
    }
    return dateStr
  }

  const rawDataParam = (e.requestInfo().query && e.requestInfo().query.data) || ''
  const dataParam = normalizeDate(rawDataParam)

  var records = []
  try {
    if (dataParam) {
      records = $app.findRecordsByFilter(
        'escala_registros',
        'registro = {:registro} && data = {:data}',
        'data,inicio',
        0,
        0,
        { registro: registro, data: dataParam },
      )
    } else {
      records = $app.findRecordsByFilter(
        'escala_registros',
        'registro = {:registro}',
        'data,inicio',
        0,
        0,
        { registro: registro },
      )
    }
  } catch (err) {
    $app.logger().error('Escala query error', 'message', String(err))
    return e.json(500, { error: 'Erro ao consultar escala.' })
  }

  var items = []
  for (var i = 0; i < records.length; i++) {
    var rec = records[i]
    items.push({
      data: rec.getString('data'),
      veiculo: rec.getString('veiculo'),
      linha: rec.getString('linha'),
      tabela: rec.getString('tabela'),
      inicio: rec.getString('inicio'),
      fim: rec.getString('fim'),
      pegada: rec.getString('pegada'),
    })
  }

  return e.json(200, { items: items })
})
