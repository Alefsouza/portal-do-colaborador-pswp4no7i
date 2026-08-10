migrate(
  (app) => {
    const updates = [
      { from: 'Recursos Humanos', to: 'RH' },
      { from: 'Administrativo', to: 'Administrador' },
      { from: 'Operações', to: 'Operacional' },
      { from: 'Manutenção', to: 'Operacional' },
    ]

    for (const { from, to } of updates) {
      app
        .db()
        .newQuery('UPDATE usuarios SET departamento = {:to} WHERE departamento = {:from}')
        .bind({ to, from })
        .execute()
    }
  },
  (app) => {
    const reverses = [
      { from: 'RH', to: 'Recursos Humanos' },
      { from: 'Administrador', to: 'Administrativo' },
      { from: 'Operacional', to: 'Operações' },
    ]

    for (const { from, to } of reverses) {
      app
        .db()
        .newQuery('UPDATE usuarios SET departamento = {:to} WHERE departamento = {:from}')
        .bind({ to, from })
        .execute()
    }
  },
)
