migrate(
  (app) => {
    const usuariosCol = app.findCollectionByNameOrId('usuarios')

    let usuario
    try {
      usuario = app.findFirstRecordByData('usuarios', 'registro', '12345')
      usuario.set('cpf', '000.000.000-00')
      usuario.set('nome_completo', 'Usuário Teste')
      usuario.set('primeiro_acesso', true)
      const salt = $security.randomString(16)
      const hash = $security.sha256(salt + '12345')
      usuario.set('senha', salt + '$' + hash)
      app.save(usuario)
    } catch (_) {
      try {
        usuario = app.findFirstRecordByData('usuarios', 'cpf', '000.000.000-00')
      } catch (_) {
        const record = new Record(usuariosCol)
        record.set('cpf', '000.000.000-00')
        record.set('nome_completo', 'Usuário Teste')
        record.set('registro', '12345')
        const salt = $security.randomString(16)
        const hash = $security.sha256(salt + '12345')
        record.set('senha', salt + '$' + hash)
        record.set('perfil', 'Colaborador')
        record.set('departamento', 'Operacional')
        record.set('primeiro_acesso', true)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const usuario = app.findFirstRecordByData('usuarios', 'cpf', '000.000.000-00')
      app.delete(usuario)
    } catch (_) {}
  },
)
