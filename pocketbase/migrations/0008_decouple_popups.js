migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('popup_envios')

    const idInformativoField = col.fields.getByName('id_informativo')
    if (idInformativoField) {
      col.fields.remove(idInformativoField)
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

    const tituloField = col.fields.getByName('titulo')
    if (tituloField) col.fields.remove(tituloField)
    const conteudoField = col.fields.getByName('conteudo')
    if (conteudoField) col.fields.remove(conteudoField)

    col.addIndex('idx_popup_envios_usuario_informativo', false, 'id_usuario, id_informativo', '')
    col.removeIndex('idx_popup_envios_usuario_created')

    app.save(col)
  },
)
