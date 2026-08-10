migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('solicitacoes')
    const usuariosId = app.findCollectionByNameOrId('usuarios').id

    if (!col.fields.getByName('id_proprietario')) {
      col.fields.add(
        new RelationField({
          name: 'id_proprietario',
          required: false,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('solicitacoes')
    const field = col.fields.getByName('id_proprietario')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
