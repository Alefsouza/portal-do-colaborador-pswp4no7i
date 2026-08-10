migrate(
  (app) => {
    app.db().newQuery("UPDATE usuarios SET perfil = 'DP' WHERE perfil = 'Gerente'").execute()
  },
  (app) => {
    app.db().newQuery("UPDATE usuarios SET perfil = 'Gerente' WHERE perfil = 'DP'").execute()
  },
)
