migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    if (!col.fields.getByName('data_inicio')) {
      col.fields.add(
        new DateField({
          name: 'data_inicio',
        }),
      )
    }

    if (!col.fields.getByName('data_final')) {
      col.fields.add(
        new DateField({
          name: 'data_final',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    if (col.fields.getByName('data_inicio')) {
      col.fields.removeByName('data_inicio')
    }

    if (col.fields.getByName('data_final')) {
      col.fields.removeByName('data_final')
    }

    app.save(col)
  },
)
