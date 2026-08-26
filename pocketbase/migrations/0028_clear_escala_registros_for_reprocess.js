migrate(
  (app) => {
    // Limpa a tabela escala_registros para reprocessamento com a nova regra de filtro
    app.db().newQuery('DELETE FROM escala_registros').execute()
  },
  (app) => {
    // Revert is a no-op (deleted data cannot be restored)
  },
)
