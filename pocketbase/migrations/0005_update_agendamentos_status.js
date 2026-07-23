migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE agendamentos SET status = 'Pendente' WHERE status = 'Agendado'")
      .execute()

    const col = app.findCollectionByNameOrId('agendamentos')
    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        values: ['Pendente', 'Confirmado', 'Cancelado', 'Realizado'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    app
      .db()
      .newQuery("UPDATE agendamentos SET status = 'Agendado' WHERE status = 'Pendente'")
      .execute()

    const col = app.findCollectionByNameOrId('agendamentos')
    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        values: ['Agendado', 'Confirmado', 'Cancelado', 'Realizado'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
