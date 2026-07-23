migrate(
  (app) => {
    const usuariosCol = app.findCollectionByNameOrId('usuarios')

    try {
      const records = app.findRecordsByFilter('usuarios', "registro != ''", '-created', 1000, 0)
      for (const record of records) {
        const currentSenha = record.getString('senha')
        if (currentSenha.indexOf('$') === -1) {
          const registro = record.getString('registro')
          const salt = $security.randomString(16)
          const hash = $security.sha256(salt + registro)
          record.set('senha', salt + '$' + hash)
          record.set('primeiro_acesso', true)
          app.save(record)
        }
      }
    } catch (_) {}

    const seedUsers = [
      {
        cpf: '123.456.789-00',
        nome: 'Carlos Silva',
        registro: '12345',
        depto: 'Operacional',
        perfil: 'Motorista',
      },
      {
        cpf: '987.654.321-00',
        nome: 'Mariana Costa',
        registro: '54321',
        depto: 'Recursos Humanos',
        perfil: 'Gestor',
      },
      {
        cpf: '456.789.123-00',
        nome: 'Roberto Alves',
        registro: '67890',
        depto: 'Manutenção',
        perfil: 'Técnico',
      },
    ]

    for (const u of seedUsers) {
      try {
        app.findFirstRecordByData('usuarios', 'registro', u.registro)
      } catch (_) {
        const record = new Record(usuariosCol)
        record.set('cpf', u.cpf)
        record.set('nome_completo', u.nome)
        record.set('registro', u.registro)
        const salt = $security.randomString(16)
        const hash = $security.sha256(salt + u.registro)
        record.set('senha', salt + '$' + hash)
        record.set('perfil', u.perfil)
        record.set('departamento', u.depto)
        record.set('primeiro_acesso', true)
        app.save(record)
      }
    }
  },
  (app) => {
    const registros = ['12345', '54321', '67890']
    for (const r of registros) {
      try {
        const record = app.findFirstRecordByData('usuarios', 'registro', r)
        app.delete(record)
      } catch (_) {}
    }
  },
)
