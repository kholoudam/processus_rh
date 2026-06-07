// matching.controller.js
const db = require("../config/db")
const { generateMatching } = require("../services/match.service")

// GET /api/matching
// Recalcule le matching puis retourne les résultats groupés par job
exports.getMatching = async (req, res) => {
  try {
    await generateMatching()

    // Résultats avec détail des 3 scores et infos complètes
    const result = await db.query(`
      SELECT
        m.id,
        m.score,
        m.created_at,

        c.id    AS candidate_id,
        c.name  AS candidate_name,
        c.email AS candidate_email,
        c.phone AS candidate_phone,

        j.id    AS job_id,
        j.title AS job_title,
        j.company,
        j.location,
        j.education_level,
        j.experience_required,

        e.subject AS applied_subject

      FROM matching m
      JOIN candidate   c ON c.id = m.candidate_id
      JOIN job         j ON j.id = m.job_id
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email       e ON e.id = a.email_id
      WHERE NOT EXISTS (SELECT 1 FROM admis   ad WHERE ad.candidate_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM refuses rf WHERE rf.candidate_id = c.id)
      ORDER BY j.title ASC, m.score DESC
    `)

    // Grouper par job_id pour affichage par poste
    const grouped = {}
    for (const row of result.rows) {
      if (!grouped[row.job_id]) {
        grouped[row.job_id] = {
          job_id:               row.job_id,
          job_title:            row.job_title,
          company:              row.company,
          location:             row.location,
          education_level:      row.education_level,
          experience_required:  row.experience_required,
          candidates:           [],
        }
      }
      grouped[row.job_id].candidates.push({
        id:              row.candidate_id,
        name:            row.candidate_name,
        email:           row.candidate_email,
        phone:           row.candidate_phone,
        score:           parseFloat(row.score),
        applied_subject: row.applied_subject,
      })
    }

    res.json({
      success: true,
      total:   result.rows.length,
      jobs:    Object.values(grouped),
    })

  } catch (err) {
    console.error("getMatching:", err.message)
    res.status(500).json({ success: false, message: err.message })
  }
}