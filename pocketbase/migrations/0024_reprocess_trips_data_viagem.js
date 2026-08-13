migrate(
  (app) => {
    var trips = []
    try {
      trips = app.findRecordsByFilter('telemetria_trips', 'raw_data != ""', '', 10000, 0)
    } catch (_) {
      return
    }

    function extractDate(dateStr) {
      if (!dateStr) return ''
      var s = String(dateStr).trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.substring(0, 10)
      }
      var match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      if (match) return match[3] + '-' + match[2] + '-' + match[1]
      return ''
    }

    var fixed = 0
    for (var i = 0; i < trips.length; i++) {
      var record = trips[i]
      var rawDataStr = record.getString('raw_data')
      if (!rawDataStr) continue

      var rawData
      try {
        rawData = JSON.parse(rawDataStr)
      } catch (_) {
        continue
      }

      if (!rawData || !rawData.csv_line) continue

      var fields = rawData.csv_line.split(',')

      var newDataViagem = ''
      for (var f = 0; f < fields.length; f++) {
        var val = (fields[f] || '').trim()
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          newDataViagem = extractDate(val)
        }
      }

      if (!newDataViagem) continue

      var currentDataViagem = record.getString('data_viagem')
      if (newDataViagem !== currentDataViagem) {
        record.set('data_viagem', newDataViagem)
        app.saveNoValidate(record)
        fixed++
      }
    }

    app.logger().info('0024_reprocess_trips_data_viagem: fixed records', 'count', fixed)
  },
  (app) => {},
)
