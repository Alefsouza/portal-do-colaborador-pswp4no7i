migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('datalbus_sync_status')
      return
    } catch (_) {}

    const collection = new Collection({
      name: 'datalbus_sync_status',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'date', type: 'text', required: true },
        { name: 'total_pages', type: 'number', required: false },
        { name: 'pages_processed', type: 'json', required: false },
        { name: 'status', type: 'text', required: true },
        { name: 'updated_at', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_datalbus_sync_status_date ON datalbus_sync_status (date)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('datalbus_sync_status')
      app.delete(c)
    } catch (_) {}
  },
)
