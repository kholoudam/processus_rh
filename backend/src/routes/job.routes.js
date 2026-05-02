const express = require("express")
const router  = express.Router()
const { getJobsFromDB } = require("../services/job.service")

// GET /api/jobs → retourne { id, title, description, source }[]
router.get("/", async (req, res) => {
  try {
    const jobs = await getJobsFromDB()
    res.json(jobs)
  } catch (err) {
    console.error("❌ GET /api/jobs :", err.message)
    res.status(500).json({ error: "Erreur récupération jobs", detail: err.message })
  }
})

module.exports = router