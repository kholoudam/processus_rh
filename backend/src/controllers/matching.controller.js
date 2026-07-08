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

// GET /api/matching/stats
// Score moyen / min / max par poste, calculé sur tous les matchings
// existants (candidats encore actifs, admis et refusés confondus).
exports.getMatchingStats = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        j.id    AS job_id,
        j.title AS job_title,

        ROUND(AVG(m.score)::numeric, 1) AS avg_score,
        MIN(m.score)                    AS min_score,
        MAX(m.score)                    AS max_score,
        COUNT(m.id)                     AS candidate_count

      FROM matching m
      JOIN job j ON j.id = m.job_id
      GROUP BY j.id, j.title
      ORDER BY avg_score DESC
    `)

    const stats = result.rows.map(row => ({
      job_id:           row.job_id,
      job_title:        row.job_title,
      avg_score:        parseFloat(row.avg_score),
      min_score:        parseFloat(row.min_score),
      max_score:        parseFloat(row.max_score),
      candidate_count:  parseInt(row.candidate_count),
    }))

    res.json({
      success: true,
      stats,
    })

  } catch (err) {
    console.error("getMatchingStats:", err.message)
    res.status(500).json({ success: false, message: err.message })
  }
}