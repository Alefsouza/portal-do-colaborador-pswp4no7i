routerAdd('GET', '/backend/v1/escala', (e) => {
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

  const dataParam = (e.requestInfo().query && e.requestInfo().query.data) || ''

  const escalaUrl = $secrets.get('RECIBO_VIEW') || ''
  if (!escalaUrl) {
    return e.json(502, { error: 'URL da escala não configurada.' })
  }

  let res
  try {
    res = $http.send({
      url: escalaUrl,
      method: 'GET',
      timeout: 30,
    })
  } catch (err) {
    $app.logger().error('Escala fetch transport error', 'message', err.message)
    return e.json(502, { error: 'Falha ao buscar dados da escala.' })
  }

  if (res.statusCode !== 200) {
    $app.logger().error('Escala fetch failed', 'statusCode', res.statusCode)
    return e.json(502, { error: 'Falha ao buscar dados da escala.' })
  }

  let data
  try {
    data = res.json
  } catch (_) {
    return e.json(502, { error: 'Dados da escala em formato inválido.' })
  }

  let items = []
  if (data && Array.isArray(data.items)) {
    items = data.items
  } else if (Array.isArray(data)) {
    items = data
  }

  function convertDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return ''
    var parts = dateStr.split('-')
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0]
    }
    return dateStr
  }

  var filtered = []
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    if (String(item.registro || '') === String(registro)) {
      var convertedData = convertDate(item.data)
      if (dataParam && convertedData !== dataParam) {
        continue
      }
      filtered.push({
        data: convertedData,
        veiculo: String(item.prefixo || ''),
        linha: String(item.linha || ''),
        tabela: String(item.tabela || ''),
        inicio: String(item.inicio || ''),
        fim: String(item.h_previsto || ''),
        pegada: String(item.pegada || ''),
      })
    }
  }

  return e.json(200, { items: filtered })
})
