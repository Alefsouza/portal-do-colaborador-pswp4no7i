migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('telemetria_trips')
      return
    } catch (_) {}

    var tripsCollection = new Collection({
      name: 'telemetria_trips',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'trip_id', type: 'number', required: true, onlyInt: true },
        { name: 'worker_id', type: 'number', required: true, onlyInt: true },
        { name: 'driver_name', type: 'text' },
        { name: 'data', type: 'text', required: true },
        { name: 'asset_id', type: 'number', onlyInt: true },
        { name: 'mileage', type: 'text' },
        { name: 'fuel_used', type: 'text' },
        { name: 'drive_duration', type: 'text' },
        { name: 'line_name', type: 'text' },
        { name: 'start_time', type: 'text' },
        { name: 'end_time', type: 'text' },
        { name: 'raw_data', type: 'json' },
        { name: 'sincronizado_em', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_telemetria_trips_worker_data ON telemetria_trips (worker_id, data)',
        'CREATE UNIQUE INDEX idx_telemetria_trips_trip_worker ON telemetria_trips (trip_id, worker_id)',
      ],
    })
    app.save(tripsCollection)

    var eventosCollection = new Collection({
      name: 'telemetria_eventos',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'evento_id', type: 'number', required: true, onlyInt: true },
        { name: 'trip_id', type: 'number', required: true, onlyInt: true },
        { name: 'worker_id', type: 'number', required: true, onlyInt: true },
        { name: 'data', type: 'text', required: true },
        { name: 'data_hora', type: 'text' },
        { name: 'asset_id', type: 'number', onlyInt: true },
        { name: 'tipo_evento', type: 'text' },
        { name: 'event_type_id', type: 'number', onlyInt: true },
        { name: 'categoria', type: 'text' },
        { name: 'duracao', type: 'number' },
        { name: 'quantidade', type: 'number' },
        { name: 'latitude', type: 'text' },
        { name: 'longitude', type: 'text' },
        { name: 'classificacao', type: 'text' },
        { name: 'raw_data', type: 'json' },
        { name: 'sincronizado_em', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_telemetria_eventos_worker_data_class ON telemetria_eventos (worker_id, data, classificacao)',
        'CREATE UNIQUE INDEX idx_telemetria_eventos_evento ON telemetria_eventos (evento_id)',
      ],
    })
    app.save(eventosCollection)

    var syncLogCollection = new Collection({
      name: 'telemetria_sync_log',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'data_sincronizada', type: 'text', required: true },
        { name: 'status', type: 'text', required: true },
        { name: 'iniciado_em', type: 'text' },
        { name: 'concluido_em', type: 'text' },
        { name: 'duracao_segundos', type: 'number' },
        { name: 'paginas_total', type: 'number', onlyInt: true },
        { name: 'paginas_processadas', type: 'number', onlyInt: true },
        { name: 'trips_processadas', type: 'number', onlyInt: true },
        { name: 'motoristas_encontrados', type: 'number', onlyInt: true },
        { name: 'eventos_processados', type: 'number', onlyInt: true },
        { name: 'mensagem_erro', type: 'text' },
        { name: 'tentativa', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_telemetria_sync_log_data ON telemetria_sync_log (data_sincronizada)',
      ],
    })
    app.save(syncLogCollection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('telemetria_trips'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('telemetria_eventos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('telemetria_sync_log'))
    } catch (_) {}
  },
)
