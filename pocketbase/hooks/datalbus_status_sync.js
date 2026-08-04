routerAdd(
  'GET',
  '/backend/v1/datalbus/status-sync',
  (e) => {
    var data = ''
    try {
      data = e.requestInfo().query['data'] || ''
    } catch (_) {}
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return e.json(400, { error: 'Parâmetro data é obrigatório (formato YYYY-MM-DD).' })
    }

    try {
      var records = $app.findRecordsByFilter(
        'telemetria_sync_log',
        'data_sincronizada = {:d}',
        '-created',
        1,
        0,
        { d: data },
      )
      if (records.length === 0) {
        return e.json(200, { status: 'nao_sincronizado', data: data })
      }
      var r = records[0]
      return e.json(200, {
        status: r.getString('status'),
        iniciado_em: r.getString('iniciado_em'),
        concluido_em: r.getString('concluido_em'),
        duracao_segundos: r.get('duracao_segundos') || 0,
        paginas_total: r.get('paginas_total') || 0,
        paginas_processadas: r.get('paginas_processadas') || 0,
        trips_processadas: r.get('trips_processadas') || 0,
        eventos_processados: r.get('eventos_processados') || 0,
        mensagem_erro: r.getString('mensagem_erro') || '',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao consultar status: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
