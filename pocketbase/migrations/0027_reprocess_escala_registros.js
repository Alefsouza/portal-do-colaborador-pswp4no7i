migrate(
  (app) => {
    // 1. Deleta TODOS os registros da tabela escala_registros
    app.db().newQuery('DELETE FROM escala_registros').execute()
  },
  (app) => {
    // Revert is a no-op (deleted data cannot be restored)
  },
)
