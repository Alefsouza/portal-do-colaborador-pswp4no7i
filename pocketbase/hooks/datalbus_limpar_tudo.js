routerAdd('POST', '/backend/v1/datalbus/limpar-tudo', (e) => {
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
      return e.json(401, { error: 'Token de sincronização inválido.' })
    }
  }

  try {
    var tripsModel = new DynamicModel({ cnt: 0 })
    $app.db().newQuery('SELECT COUNT(*) as cnt FROM telemetria_trips').one(tripsModel)
    var tripsRemoved = tripsModel.cnt || 0

    var eventosModel = new DynamicModel({ cnt: 0 })
    $app.db().newQuery('SELECT COUNT(*) as cnt FROM telemetria_eventos').one(eventosModel)
    var eventosRemoved = eventosModel.cnt || 0

    var syncLogModel = new DynamicModel({ cnt: 0 })
    $app.db().newQuery('SELECT COUNT(*) as cnt FROM telemetria_sync_log').one(syncLogModel)
    var syncLogRemoved = syncLogModel.cnt || 0

    $app.db().newQuery('DELETE FROM telemetria_trips').execute()
    $app.db().newQuery('DELETE FROM telemetria_eventos').execute()
    $app.db().newQuery('DELETE FROM telemetria_sync_log').execute()

    return e.json(200, {
      trips_removidas: tripsRemoved,
      eventos_removidos: eventosRemoved,
      sync_log_removidos: syncLogRemoved,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao limpar todos os registros: ' + String(err) })
  }
})
