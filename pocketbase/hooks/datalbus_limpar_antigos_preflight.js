routerAdd('OPTIONS', '/backend/v1/datalbus/limpar-antigos', (e) => {
  var origin = e.request.header.get('Origin')
  if (origin) {
    e.response.header().set('Access-Control-Allow-Origin', origin)
    e.response.header().set('Access-Control-Allow-Credentials', 'true')
  } else {
    e.response.header().set('Access-Control-Allow-Origin', '*')
  }
  e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token')
  e.response.header().set('Access-Control-Max-Age', '86400')
  return e.noContent(204)
})
