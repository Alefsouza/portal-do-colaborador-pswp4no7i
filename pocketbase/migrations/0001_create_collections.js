migrate(
  (app) => {
    const usuariosCollection = new Collection({
      name: 'usuarios',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'cpf', type: 'text', required: true },
        { name: 'nome_completo', type: 'text', required: true },
        { name: 'registro', type: 'text', required: true },
        { name: 'senha', type: 'text', required: true },
        { name: 'perfil', type: 'text', required: true },
        { name: 'departamento', type: 'text', required: true },
        { name: 'primeiro_acesso', type: 'bool' },
        { name: 'data_criacao', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_usuarios_cpf ON usuarios (cpf)',
        'CREATE UNIQUE INDEX idx_usuarios_registro ON usuarios (registro)',
      ],
    })
    app.save(usuariosCollection)

    const informativosCollection = new Collection({
      name: 'informativos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'titulo', type: 'text', required: true },
        { name: 'conteudo', type: 'text', required: true },
        { name: 'departamento', type: 'text' },
        { name: 'status_ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_informativos_status_ativo ON informativos (status_ativo)'],
    })
    app.save(informativosCollection)

    const usuariosId = app.findCollectionByNameOrId('usuarios').id

    const solicitacoesCollection = new Collection({
      name: 'solicitacoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_usuario',
          type: 'relation',
          required: false,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'departamento', type: 'text', required: true },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Em Andamento', 'Concluído', 'Cancelado'],
          maxSelect: 1,
        },
        { name: 'data_atualizacao', type: 'autodate', onCreate: false, onUpdate: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_solicitacoes_usuario_status ON solicitacoes (id_usuario, status)',
      ],
    })
    app.save(solicitacoesCollection)

    const agendamentosCollection = new Collection({
      name: 'agendamentos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_usuario',
          type: 'relation',
          required: false,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'departamento', type: 'text', required: true },
        { name: 'data', type: 'date', required: true },
        { name: 'hora', type: 'text', required: true },
        { name: 'observacao', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Agendado', 'Confirmado', 'Cancelado', 'Realizado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_agendamentos_usuario_data_status ON agendamentos (id_usuario, data, status)',
      ],
    })
    app.save(agendamentosCollection)

    const informativosId = app.findCollectionByNameOrId('informativos').id

    const popupEnviosCollection = new Collection({
      name: 'popup_envios',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'id_informativo',
          type: 'relation',
          required: false,
          collectionId: informativosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'id_usuario',
          type: 'relation',
          required: false,
          collectionId: usuariosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'status_lido', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_popup_envios_usuario_informativo ON popup_envios (id_usuario, id_informativo)',
      ],
    })
    app.save(popupEnviosCollection)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('popup_envios')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('agendamentos')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('solicitacoes')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('informativos')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('usuarios')
      app.delete(c)
    } catch (_) {}
  },
)
