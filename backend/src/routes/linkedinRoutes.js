const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/linkedinController");

// POST /api/linkedin/sync   → lance scraper (réponse immédiate)
router.post("/sync",   controller.syncLinkedin);

// GET  /api/linkedin/status → état en temps réel + logs
router.get("/status",  controller.getStatus);

module.exports = router;