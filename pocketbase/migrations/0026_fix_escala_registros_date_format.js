migrate(
  (app) => {
    // In SQLite, dates in format DD-MM-YYYY (e.g. '24-08-2026') match:
    // length 10, '-' at positions 3 and 6 (1-based: substr(data, 3, 1) = '-' and substr(data, 6, 1) = '-')
    // or regexp / substr checking if first part is 2 digits and last part is 4 digits.
    // Convert DD-MM-YYYY (substr(data, 1, 2) - substr(data, 4, 2) - substr(data, 7, 4))
    // to YYYY-MM-DD (substr(data, 7, 4) || '-' || substr(data, 4, 2) || '-' || substr(data, 1, 2))

    app
      .db()
      .newQuery(`
      UPDATE escala_registros
      SET data = substr(data, 7, 4) || '-' || substr(data, 4, 2) || '-' || substr(data, 1, 2)
      WHERE length(data) = 10
        AND substr(data, 3, 1) = '-'
        AND substr(data, 6, 1) = '-'
        AND substr(data, 1, 2) GLOB '[0-9][0-9]'
        AND substr(data, 7, 4) GLOB '[0-9][0-9][0-9][0-9]'
    `)
      .execute()
  },
  (app) => {
    // Down migration: if needed, revert YYYY-MM-DD back to DD-MM-YYYY
    app
      .db()
      .newQuery(`
      UPDATE escala_registros
      SET data = substr(data, 9, 2) || '-' || substr(data, 6, 2) || '-' || substr(data, 1, 4)
      WHERE length(data) = 10
        AND substr(data, 5, 1) = '-'
        AND substr(data, 8, 1) = '-'
        AND substr(data, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
        AND substr(data, 9, 2) GLOB '[0-9][0-9]'
    `)
      .execute()
  },
)
