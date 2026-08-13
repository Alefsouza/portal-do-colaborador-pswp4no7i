migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('telemetria_trips')
    var usuariosId = app.findCollectionByNameOrId('usuarios').id

    var oldFieldNames = [
      'trip_id',
      'worker_id',
      'driver_name',
      'data',
      'asset_id',
      'mileage',
      'fuel_used',
      'drive_duration',
      'line_name',
      'start_time',
      'end_time',
      'sincronizado_em',
    ]

    for (var i = 0; i < oldFieldNames.length; i++) {
      if (col.fields.getByName(oldFieldNames[i])) {
        col.fields.removeByName(oldFieldNames[i])
      }
    }

    var newTextFieldNames = [
      'drive_id',
      'numero_veiculo',
      'grupo_veiculo',
      'motorista_nome',
      'senha_motorista',
      'grupo_motorista',
      'cpf_matricula',
      'inicio_viagem',
      'origem',
      'fim_viagem',
      'destino',
      'distancia',
      'tempo_total',
      'horimetro',
      'combustivel_utilizado',
      'km_por_litro',
      'litros_por_100km',
      'idle_time',
      'idle_time_minutos',
      'km_final',
      'tempo_motor',
      'doa_distance',
      'doa_time',
      'doa_distance_percent',
      'doa_time_percent',
      'co2',
      'time_from_prev_drive',
      'start_lat',
      'start_long',
      'end_lat',
      'end_long',
      'operacional',
      'data_viagem',
      'processado_em',
    ]

    for (var j = 0; j < newTextFieldNames.length; j++) {
      if (!col.fields.getByName(newTextFieldNames[j])) {
        col.fields.add(new TextField({ name: newTextFieldNames[j] }))
      }
    }

    if (!col.fields.getByName('raw_data')) {
      col.fields.add(new JSONField({ name: 'raw_data' }))
    }

    if (!col.fields.getByName('motorista_id')) {
      col.fields.add(
        new RelationField({
          name: 'motorista_id',
          collectionId: usuariosId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
    }

    try {
      col.removeIndex('idx_telemetria_trips_worker_data')
    } catch (_) {}
    try {
      col.removeIndex('idx_telemetria_trips_trip_worker')
    } catch (_) {}

    col.addIndex('idx_telemetria_trips_motorista', false, 'motorista_id', '')
    col.addIndex('idx_telemetria_trips_data_viagem', false, 'data_viagem', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('telemetria_trips')

    var newFieldNames = [
      'drive_id',
      'numero_veiculo',
      'grupo_veiculo',
      'motorista_nome',
      'senha_motorista',
      'grupo_motorista',
      'cpf_matricula',
      'inicio_viagem',
      'origem',
      'fim_viagem',
      'destino',
      'distancia',
      'tempo_total',
      'horimetro',
      'combustivel_utilizado',
      'km_por_litro',
      'litros_por_100km',
      'idle_time',
      'idle_time_minutos',
      'km_final',
      'tempo_motor',
      'doa_distance',
      'doa_time',
      'doa_distance_percent',
      'doa_time_percent',
      'co2',
      'time_from_prev_drive',
      'start_lat',
      'start_long',
      'end_lat',
      'end_long',
      'operacional',
      'data_viagem',
      'processado_em',
      'raw_data',
      'motorista_id',
    ]

    for (var i = 0; i < newFieldNames.length; i++) {
      if (col.fields.getByName(newFieldNames[i])) {
        col.fields.removeByName(newFieldNames[i])
      }
    }

    col.removeIndex('idx_telemetria_trips_motorista')
    col.removeIndex('idx_telemetria_trips_data_viagem')

    app.save(col)
  },
)
