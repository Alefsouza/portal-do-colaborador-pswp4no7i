migrate(
  (app) => {
    const collection = new Collection({
      name: 'escala_cache',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'data', type: 'text', max: 100000000 },
        { name: 'fetched_at', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('escala_cache')
    app.delete(collection)
  },
)
