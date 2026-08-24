migrate(
  (app) => {
    const collection = new Collection({
      name: 'escala_registros',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'registro', type: 'text', required: true },
        { name: 'data', type: 'text', required: true },
        { name: 'veiculo', type: 'text', required: true },
        { name: 'linha', type: 'text' },
        { name: 'tabela', type: 'text' },
        { name: 'inicio', type: 'text' },
        { name: 'fim', type: 'text' },
        { name: 'pegada', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_escala_registros_unique ON escala_registros (registro, data, veiculo)',
        'CREATE INDEX idx_escala_registros_lookup ON escala_registros (registro, data, inicio)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('escala_registros')
    app.delete(collection)
  },
)
