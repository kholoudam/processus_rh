const express = require("express");
const router = express.Router();
const { getJobsFromCSV } = require("../services/job.service");

router.get("/", async (req, res) => {
  try {
    const jobs = await getJobsFromCSV();
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lecture CSV" });
  }
});

module.exports = router;