const pool = require("../config/db")

exports.getJobsFromDB = async () => {
  const result = await pool.query(
    `SELECT
       id,
       title,
       description,
       company,
       contract_type,
       location,
       work_mode,
       experience_required,
       education_level,
       skills,
       seniority_level,
       is_urgent,
       created_at,
       linkedin_profile,
       linkedin_post_id
     FROM job
     ORDER BY
       is_urgent DESC,
       id DESC`
  )
  return result.rows
}