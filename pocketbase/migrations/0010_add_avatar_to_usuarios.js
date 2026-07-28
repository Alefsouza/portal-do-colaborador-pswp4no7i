migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('usuarios')
    if (!col.fields.getByName('avatar')) {
      col.fields.add(
        new FileField({
          name: 'avatar',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('usuarios')
    const field = col.fields.getByName('avatar')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
