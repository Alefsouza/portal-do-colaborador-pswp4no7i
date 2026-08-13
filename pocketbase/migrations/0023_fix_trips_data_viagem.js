migrate(
  (app) => {
    var trips = []
    try {
      trips = app.findRecordsByFilter('telemetria_trips', 'data_viagem = ""', '', 10000, 0)
    } catch (_) {
      return
    }

    var fixed = 0
    for (var i = 0; i < trips.length; i++) {
      var record = trips[i]
      var fimViagem = record.getString('fim_viagem')
      var dataViagem = ''

      if (fimViagem) {
        if (/^\d{4}-\d{2}-\d{2}/.test(fimViagem)) {
          dataViagem = fimViagem.substring(0, 10)
        } else {
          var match = fimViagem.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
          if (match) {
            dataViagem = match[3] + '-' + match[2] + '-' + match[1]
          }
        }
      }

      if (!dataViagem) {
        var inicioViagem = record.getString('inicio_viagem')
        if (inicioViagem) {
          if (/^\d{4}-\d{2}-\d{2}/.test(inicioViagem)) {
            dataViagem = inicioViagem.substring(0, 10)
          } else {
            var match2 = inicioViagem.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
            if (match2) {
              dataViagem = match2[3] + '-' + match2[2] + '-' + match2[1]
            }
          }
        }
      }

      if (dataViagem) {
        record.set('data_viagem', dataViagem)
        app.saveNoValidate(record)
        fixed++
      }
    }

    app.logger().info('0023_fix_trips_data_viagem: fixed records', 'count', fixed)
  },
  (app) => {},
)
