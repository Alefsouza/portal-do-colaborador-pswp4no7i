migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('informativos_visualizados')
      return
    } catch (_) {}

    const usuariosId = app.findCollectionByNameOrId('usuarios').id
    const informativosId = app.findCollectionByNameOrId('informativos').id

    const collection = new Collection({
      name: 'informativos_visualizados',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'id_usuario',
          type: 'relation',
          required: true,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'id_informativo',
          type: 'relation',
          required: true,
          collectionId: informativosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_informativos_visualizados_usuario_informativo ON informativos_visualizados (id_usuario, id_informativo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('informativos_visualizados')
      app.delete(c)
    } catch (_) {}
  },
)
