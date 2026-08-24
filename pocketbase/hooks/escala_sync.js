cronAdd('escala_sync', '*/5 * * * *', () => {
  function convertDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return ''
    var parts = dateStr.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // Already YYYY-MM-DD
        return dateStr
      }
      // DD-MM-YYYY -> YYYY-MM-DD
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
    if (data.hasMore === true) return true
    if (Array.isArray(data.links)) {
      for (var i = 0; i < data.links.length; i++) {
        if (data.links[i] && data.links[i].rel === 'next' && data.links[i].href) {
          return true
        }
      }
    }
    if (data.next && typeof data.next === 'string') return true
    if (data.page != null && data.pages != null && data.pages > 1) return true
    if (data.total_pages != null && data.total_pages > 1) return true
    if (data.last_page != null && data.last_page > 1) return true
    return false
  }

  function getNextUrl(data) {
    if (!data || typeof data !== 'object') return ''
    if (Array.isArray(data.links)) {
      for (var i = 0; i < data.links.length; i++) {
        if (
          data.links[i] &&
          data.links[i].rel === 'next' &&
          typeof data.links[i].href === 'string' &&
          data.links[i].href
        ) {
          return data.links[i].href
        }
      }
    }
    if (data.next && typeof data.next === 'string') return data.next
    return ''
  }

  function maskUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return ''
    try {
      return rawUrl.replace(/([?&](?:token|key|secret|password|senha|auth)=)[^&]+/gi, '$1***')
    } catch (_) {
      return rawUrl
    }
  }

  function getResponseBodyPreview(res) {
    if (!res) return ''
    try {
      if (typeof res.raw === 'string' && res.raw) {
        return res.raw.slice(0, 200)
      }
      if (typeof res.body === 'string' && res.body) {
        return res.body.slice(0, 200)
      }
      if (res.body) {
        var decoder = new TextDecoder()
        var text = decoder.decode(res.body)
        return (text || '').slice(0, 200)
      }
      if (res.json) {
        return JSON.stringify(res.json).slice(0, 200)
      }
    } catch (e) {
      return 'preview_error: ' + (e.message || String(e))
    }
    return ''
  }

  function fetchPage(url, isFirstPage, pageNum) {
    var pageLabel = pageNum ? 'page ' + pageNum : isFirstPage ? 'first page' : 'page'
    var masked = maskUrl(url)
    var timeoutSec = isFirstPage ? 120 : 60
    console.log(
      'Escala sync: fetching ' + pageLabel + ' (' + masked + ') [timeout=' + timeoutSec + 's]',
    )
    $app.logger().info('Escala sync: fetching ' + pageLabel, 'url', masked, 'timeout', timeoutSec)

    var res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        timeout: timeoutSec,
      })
    } catch (err) {
      var errMsg = err && err.message ? err.message : String(err)
      var errStack = err && err.stack ? err.stack : ''
      var errObjStr = ''
      try {
        errObjStr = JSON.stringify(err)
      } catch (_) {}
      console.log(
        'Escala sync fetch transport error on ' +
          pageLabel +
          ': ' +
          errMsg +
          (errStack ? ' | stack: ' + errStack : '') +
          (errObjStr && errObjStr !== '{}' ? ' | details: ' + errObjStr : ''),
      )
      $app
        .logger()
        .error(
          'Escala sync fetch transport error',
          'page',
          pageLabel,
          'message',
          errMsg,
          'stack',
          errStack,
          'details',
          errObjStr,
          'url',
          masked,
        )
      return null
    }

    if (res.statusCode !== 200) {
      var preview = getResponseBodyPreview(res)
      console.log(
        'Escala sync fetch failed on ' +
          pageLabel +
          ' with status ' +
          res.statusCode +
          ' body: ' +
          preview,
      )
      $app
        .logger()
        .error(
          'Escala sync fetch failed',
          'page',
          pageLabel,
          'statusCode',
          res.statusCode,
          'bodyPreview',
          preview,
          'url',
          masked,
        )
      return null
    }

    try {
      var data = res.json
      if (data !== undefined && data !== null) {
        return data
      }
      if (typeof res.body === 'string' && res.body) {
        return JSON.parse(res.body)
      }
      if (res.body) {
        var decoder = new TextDecoder()
        var text = decoder.decode(res.body)
        if (text && text.trim()) {
          return JSON.parse(text)
        }
      }
      return null
    } catch (parseErr) {
      var parseMsg = parseErr && parseErr.message ? parseErr.message : String(parseErr)
      console.log('Escala sync JSON parse error on ' + pageLabel + ': ' + parseMsg)
      $app.logger().error('Escala sync JSON parse error', 'page', pageLabel, 'error', parseMsg)
      return null
    }
  }

  var escalaUrl = $secrets.get('RECIBO_VIEW') || ''
  if (!escalaUrl) {
    console.log('Escala sync aborted: RECIBO_VIEW secret not configured')
    $app.logger().error('Escala sync aborted: RECIBO_VIEW secret not configured')
    return
  }

  var maskedEscalaUrl = maskUrl(escalaUrl)
  console.log('Escala sync starting, URL: ' + maskedEscalaUrl)
  $app.logger().info('Escala sync starting', 'url', maskedEscalaUrl)

  var firstData = fetchPage(escalaUrl, true, 1)
  if (firstData === null) {
    console.log('Escala sync failed at stage fetch_first_page with 0 pages fetched')
    $app
      .logger()
      .error(
        'Escala sync failed at stage fetch_first_page with 0 pages fetched',
        'url',
        maskedEscalaUrl,
      )
    return
  }

  var firstItems = extractItems(firstData)
  console.log('Escala sync: extracted ' + firstItems.length + ' items from page 1')
  $app.logger().info('Escala sync: extracted items from page 1', 'count', firstItems.length)

  var allItems = [].concat(firstItems)
  var pagesFetched = 1

  if (hasPagination(firstData)) {
    var nextUrl = getNextUrl(firstData)
    var safetyCounter = 0
    while (nextUrl && safetyCounter < 500) {
      safetyCounter++
      var currPageNum = safetyCounter + 1
      var pageData = fetchPage(nextUrl, false, currPageNum)
      if (pageData === null) {
        console.log(
          'Escala sync: pagination stopped at page ' + currPageNum + ' due to fetch error',
        )
        $app
          .logger()
          .warn(
            'Escala sync: pagination stopped due to fetch error',
            'page',
            currPageNum,
            'pagesFetched',
            pagesFetched,
          )
        break
      }
      pagesFetched++
      var pageItems = extractItems(pageData)
      console.log('Escala sync: extracted ' + pageItems.length + ' items from page ' + currPageNum)
      $app
        .logger()
        .info('Escala sync: extracted items', 'page', currPageNum, 'count', pageItems.length)
      allItems = allItems.concat(pageItems)
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
    var veic = item.prefixo != null ? String(item.prefixo).trim() : ''

    if (!reg || !convertedData) {
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

  // 5. DELETE FROM escala_registros WHERE data < hoje OR data > hoje + 3 dias
  // Mantém apenas a janela de hoje até hoje + 3 dias (4 dias no total)
  var now = new Date()
  var todayStr = now.toISOString().slice(0, 10)
  var maxDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  var maxDateStr = maxDate.toISOString().slice(0, 10)
  var deletedCount = 0

  try {
    var countModel = new DynamicModel({ cnt: 0 })
    $app
      .db()
      .newQuery(
        'SELECT COUNT(*) as cnt FROM escala_registros WHERE data < {:today} OR data > {:maxDate}',
      )
      .bind({ today: todayStr, maxDate: maxDateStr })
      .one(countModel)
    deletedCount = countModel.cnt || 0

    $app
      .db()
      .newQuery('DELETE FROM escala_registros WHERE data < {:today} OR data > {:maxDate}')
      .bind({ today: todayStr, maxDate: maxDateStr })
      .execute()
  } catch (errDelete) {
    $app
      .logger()
      .error('Escala sync error deleting out-of-window records', 'error', String(errDelete))
  }

  console.log(
    'Escala sync completed: pagesFetched=' +
      pagesFetched +
      ', totalFetched=' +
      allItems.length +
      ', inserted=' +
      insertedCount +
      ', updated=' +
      updatedCount +
      ', deleted=' +
      deletedCount,
  )
  $app
    .logger()
    .info(
      'Escala sync completed',
      'pages_fetched',
      pagesFetched,
      'total_fetched',
      allItems.length,
      'inserted',
      insertedCount,
      'updated',
      updatedCount,
      'deleted',
      deletedCount,
      'today',
      todayStr,
      'max_date',
      maxDateStr,
    )
})
