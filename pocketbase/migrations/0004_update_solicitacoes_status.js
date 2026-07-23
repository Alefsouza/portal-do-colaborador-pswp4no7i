migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE solicitacoes SET status = 'Solicitada' WHERE status = 'Pendente'")
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE solicitacoes SET status = 'Finalizada' WHERE status IN ('Concluído', 'Cancelado')",
      )
      .execute()

    const col = app.findCollectionByNameOrId('solicitacoes')
    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        values: ['Solicitada', 'Em Andamento', 'Finalizada'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    app
      .db()
      .newQuery("UPDATE solicitacoes SET status = 'Pendente' WHERE status = 'Solicitada'")
      .execute()
    app
      .db()
      .newQuery("UPDATE solicitacoes SET status = 'Concluído' WHERE status = 'Finalizada'")
      .execute()

    const col = app.findCollectionByNameOrId('solicitacoes')
    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        values: ['Pendente', 'Em Andamento', 'Concluído', 'Cancelado'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
