migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('telemetria_eventos')
    var usuariosId = app.findCollectionByNameOrId('usuarios').id

    var newTextFieldNames = [
      'motorista_nome',
      'hora_inicio',
      'hora_fim',
      'frota_placa',
      'grupo_veiculo',
      'grupo_principal',
      'categoria_evento',
      'direcao',
      'distancia',
      'velocidade',
      'latitude_inicial',
      'longitude_inicial',
      'latitude_final',
      'longitude_final',
      'processado_em',
    ]

    for (var i = 0; i < newTextFieldNames.length; i++) {
      if (!col.fields.getByName(newTextFieldNames[i])) {
        col.fields.add(new TextField({ name: newTextFieldNames[i] }))
      }
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

    col.addIndex(
      'idx_telemetria_eventos_motorista_data_class',
      false,
      'motorista_id, data, classificacao',
      '',
    )

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('telemetria_eventos')

    var fieldsToRemove = [
      'motorista_nome',
      'motorista_id',
      'hora_inicio',
      'hora_fim',
      'frota_placa',
      'grupo_veiculo',
      'grupo_principal',
      'categoria_evento',
      'direcao',
      'distancia',
      'velocidade',
      'latitude_inicial',
      'longitude_inicial',
      'latitude_final',
      'longitude_final',
      'processado_em',
    ]

    for (var i = 0; i < fieldsToRemove.length; i++) {
      if (col.fields.getByName(fieldsToRemove[i])) {
        col.fields.removeByName(fieldsToRemove[i])
      }
    }

    col.removeIndex('idx_telemetria_eventos_motorista_data_class')
    app.save(col)
  },
)
