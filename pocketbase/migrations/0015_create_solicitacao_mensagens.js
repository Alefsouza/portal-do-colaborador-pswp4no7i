migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('solicitacao_mensagens')
      return
    } catch (_) {}

    const solicitacoesId = app.findCollectionByNameOrId('solicitacoes').id
    const usuariosId = app.findCollectionByNameOrId('usuarios').id

    const collection = new Collection({
      name: 'solicitacao_mensagens',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_solicitacao',
          type: 'relation',
          required: true,
          collectionId: solicitacoesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'id_usuario',
          type: 'relation',
          required: true,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo_remetente',
          type: 'select',
          required: true,
          values: ['Colaborador', 'Admin'],
          maxSelect: 1,
        },
        { name: 'mensagem', type: 'text', required: true },
        { name: 'anexo', type: 'file', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_solicitacao_mensagens_solicitacao ON solicitacao_mensagens (id_solicitacao)',
        'CREATE INDEX idx_solicitacao_mensagens_usuario ON solicitacao_mensagens (id_usuario)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('solicitacao_mensagens')
      app.delete(c)
    } catch (_) {}
  },
)
