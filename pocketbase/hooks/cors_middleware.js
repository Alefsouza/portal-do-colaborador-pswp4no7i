onServe((e) => {
  e.next()

  try {
    e.router.use((c) => {
      var origin = c.request.header.get('Origin')
      if (origin) {
        c.response.header().set('Access-Control-Allow-Origin', origin)
        c.response.header().set('Access-Control-Allow-Credentials', 'true')
      } else {
        c.response.header().set('Access-Control-Allow-Origin', '*')
      }
      c.response
        .header()
        .set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      c.response
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenancy, Accept')
      c.response.header().set('Access-Control-Max-Age', '86400')

      if (c.request.method === 'OPTIONS') {
        return c.noContent(204)
      }
      c.next()
    })
  } catch (_) {}
})
