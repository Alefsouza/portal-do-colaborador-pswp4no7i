migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    if (!col.fields.getByName('recipient_type')) {
      col.fields.add(
        new SelectField({
          name: 'recipient_type',
          required: false,
          values: ['Todos', 'Especificos'],
          maxSelect: 1,
        }),
      )
    }

    const usuariosId = app.findCollectionByNameOrId('usuarios').id

    if (!col.fields.getByName('destinatarios')) {
      col.fields.add(
        new RelationField({
          name: 'destinatarios',
          required: false,
          collectionId: usuariosId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 0,
        }),
      )
    }

    app.save(col)

    app
      .db()
      .newQuery(
        "UPDATE informativos SET recipient_type = 'Todos' WHERE recipient_type = '' OR recipient_type IS NULL",
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    if (col.fields.getByName('recipient_type')) {
      col.fields.removeByName('recipient_type')
    }
    if (col.fields.getByName('destinatarios')) {
      col.fields.removeByName('destinatarios')
    }

    app.save(col)
  },
)
