cronAdd('escala_sync', '*/5 * * * *', () => {
  function convertDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return ''
    var parts = dateStr.split('-')
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0]
    }
    return dateStr
  }

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

  function fetchPage(url) {
    var res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        timeout: 30,
      })
    } catch (err) {
      $app.logger().error('Escala sync fetch transport error', 'message', err.message)
      return null
    }
    if (res.statusCode !== 200) {
      $app.logger().error('Escala sync fetch failed', 'statusCode', res.statusCode)
      return null
    }
    try {
      return res.json
    } catch (_) {
      return null
    }
  }

  var escalaUrl = $secrets.get('RECIBO_VIEW') || ''
  if (!escalaUrl) {
    $app.logger().error('Escala sync aborted: RECIBO_VIEW secret not configured')
    return
  }

  $app.logger().info('Escala sync started')

  var firstData = fetchPage(escalaUrl)
  if (firstData === null) {
    $app.logger().error('Escala sync failed: could not fetch first page')
    return
  }

  var allItems = [].concat(extractItems(firstData))

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

  var escalaCol = $app.findCollectionByNameOrId('escala_registros')
  var insertedCount = 0
  var updatedCount = 0

  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i]
    var reg = String(item.registro || '').trim()
    var rawData = item.data
    var convertedData = convertDate(rawData)
    var veic = String(item.prefixo || '').trim()

    if (!reg || !convertedData || !veic) {
      continue
    }

    var linha = String(item.linha || '')
    var tabela = String(item.tabela || '')
    var inicio = String(item.inicio || '')
    var fim = String(item.h_previsto || '')
    var pegada = String(item.pegada || '')

    var existing = null
    try {
      existing = $app.findFirstRecordByFilter(
        'escala_registros',
        'registro = {:reg} && data = {:dt} && veiculo = {:veic}',
        { reg: reg, dt: convertedData, veic: veic },
      )
    } catch (_) {}

    if (existing) {
      existing.set('linha', linha)
      existing.set('tabela', tabela)
      existing.set('inicio', inicio)
      existing.set('fim', fim)
      existing.set('pegada', pegada)
      try {
        $app.saveNoValidate(existing)
        updatedCount++
      } catch (errSave) {
        $app.logger().error('Escala sync error updating record', 'error', String(errSave))
      }
    } else {
      var newRecord = new Record(escalaCol)
      newRecord.set('registro', reg)
      newRecord.set('data', convertedData)
      newRecord.set('veiculo', veic)
      newRecord.set('linha', linha)
      newRecord.set('tabela', tabela)
      newRecord.set('inicio', inicio)
      newRecord.set('fim', fim)
      newRecord.set('pegada', pegada)
      try {
        $app.saveNoValidate(newRecord)
        insertedCount++
      } catch (errCreate) {
        $app.logger().error('Escala sync error inserting record', 'error', String(errCreate))
      }
    }
  }

  // 5. DELETE FROM escala_registros WHERE data < hoje - 4 dias
  var cutoffDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  var cutoffStr = cutoffDate.toISOString().slice(0, 10)
  var deletedCount = 0

  try {
    var countModel = new DynamicModel({ cnt: 0 })
    $app
      .db()
      .newQuery('SELECT COUNT(*) as cnt FROM escala_registros WHERE data < {:cutoff}')
      .bind({ cutoff: cutoffStr })
      .one(countModel)
    deletedCount = countModel.cnt || 0

    $app
      .db()
      .newQuery('DELETE FROM escala_registros WHERE data < {:cutoff}')
      .bind({ cutoff: cutoffStr })
      .execute()
  } catch (errDelete) {
    $app.logger().error('Escala sync error deleting old records', 'error', String(errDelete))
  }

  $app
    .logger()
    .info(
      'Escala sync completed',
      'total_fetched',
      allItems.length,
      'inserted',
      insertedCount,
      'updated',
      updatedCount,
      'deleted',
      deletedCount,
      'cutoff_date',
      cutoffStr,
    )
})
