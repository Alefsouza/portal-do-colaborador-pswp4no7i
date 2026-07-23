migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('popup_envios')

    if (col.fields.getByName('id_informativo')) {
      col.fields.removeByName('id_informativo')
    }

    if (!col.fields.getByName('titulo')) {
      col.fields.add(new TextField({ name: 'titulo', required: true }))
    }
    if (!col.fields.getByName('conteudo')) {
      col.fields.add(new TextField({ name: 'conteudo', required: true }))
    }

    col.removeIndex('idx_popup_envios_usuario_informativo')
    col.addIndex('idx_popup_envios_usuario_created', false, 'id_usuario, created', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('popup_envios')

    const informativosId = app.findCollectionByNameOrId('informativos').id
    if (!col.fields.getByName('id_informativo')) {
      col.fields.add(
        new RelationField({
          name: 'id_informativo',
          required: false,
          collectionId: informativosId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (col.fields.getByName('titulo')) col.fields.removeByName('titulo')
    if (col.fields.getByName('conteudo')) col.fields.removeByName('conteudo')

    col.addIndex('idx_popup_envios_usuario_informativo', false, 'id_usuario, id_informativo', '')
    col.removeIndex('idx_popup_envios_usuario_created')

    app.save(col)
  },
)
