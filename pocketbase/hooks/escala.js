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

  const dataParam = (e.requestInfo().query && e.requestInfo().query.data) || ''

  const escalaUrl = $secrets.get('RECIBO_VIEW') || ''
  if (!escalaUrl) {
    return e.json(502, { error: 'URL da escala não configurada.' })
  }

  function fetchPage(url) {
    var res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        timeout: 30,
      })
    } catch (err) {
      $app.logger().error('Escala fetch transport error', 'message', err.message)
      return null
    }
    if (res.statusCode !== 200) {
      $app.logger().error('Escala fetch failed', 'statusCode', res.statusCode)
      return null
    }
    try {
      return res.json
    } catch (_) {
      return null
    }
  }

  var firstData = fetchPage(escalaUrl)
  if (firstData === null) {
    return e.json(502, { error: 'Falha ao buscar dados da escala.' })
  }

  var allItems = []

  function extractItems(data) {
    if (Array.isArray(data)) {
      return data
    }
    if (data && Array.isArray(data.items)) {
      return data.items
    }
    if (data && Array.isArray(data.data)) {
      return data.data
    }
    if (data && Array.isArray(data.results)) {
      return data.results
    }
    if (data && typeof data === 'object') {
      return [data]
    }
    return []
  }

  function hasPagination(data) {
    if (!data || typeof data !== 'object') return false
    if (Array.isArray(data)) return false
    if (data.next && typeof data.next === 'string') return true
    if (data.page != null && data.pages != null && data.pages > 1) return true
    if (data.total_pages != null && data.total_pages > 1) return true
    if (data.last_page != null && data.last_page > 1) return true
    return false
  }

  function getNextUrl(data) {
    if (!data || typeof data !== 'object') return ''
    if (data.next && typeof data.next === 'string') return data.next
    return ''
  }

  allItems = allItems.concat(extractItems(firstData))

  if (hasPagination(firstData)) {
    var nextUrl = getNextUrl(firstData)
    var safetyCounter = 0
    while (nextUrl && safetyCounter < 500) {
      safetyCounter++
      var pageData = fetchPage(nextUrl)
      if (pageData === null) break
      allItems = allItems.concat(extractItems(pageData))
      nextUrl = getNextUrl(pageData)
    }
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
  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i]
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
