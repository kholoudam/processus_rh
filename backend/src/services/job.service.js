const pool = require("../config/db")

// Retourne tous les jobs depuis la base de données
exports.getJobsFromDB = async () => {
  const result = await pool.query(
    `SELECT id, title, description, source
     FROM job
     ORDER BY id ASC`
  )
  return result.rows
}