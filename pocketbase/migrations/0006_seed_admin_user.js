migrate(
  (app) => {
    const usuariosCol = app.findCollectionByNameOrId('usuarios')

    const cpf = '98756432100'

    try {
      app.findFirstRecordByData('usuarios', 'cpf', cpf)
      return
    } catch (_) {}

    const record = new Record(usuariosCol)
    record.set('cpf', cpf)
    record.set('nome_completo', 'Administrador Teste')
    record.set('registro', 'ADM001')
    const salt = $security.randomString(16)
    const hash = $security.sha256(salt + 'via@1234')
    record.set('senha', salt + '$' + hash)
    record.set('perfil', 'RH')
    record.set('departamento', 'RH')
    record.set('primeiro_acesso', false)
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('usuarios', 'cpf', '98756432100')
      app.delete(record)
    } catch (_) {}
  },
)
