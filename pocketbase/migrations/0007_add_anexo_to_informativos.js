migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    const conteudoField = col.fields.getByName('conteudo')
    if (conteudoField) {
      conteudoField.required = false
    }

    if (!col.fields.getByName('anexo')) {
      col.fields.add(
        new FileField({
          name: 'anexo',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('informativos')

    const conteudoField = col.fields.getByName('conteudo')
    if (conteudoField) {
      conteudoField.required = true
    }

    const anexoField = col.fields.getByName('anexo')
    if (anexoField) {
      col.fields.remove(anexoField)
    }

    app.save(col)
  },
)
