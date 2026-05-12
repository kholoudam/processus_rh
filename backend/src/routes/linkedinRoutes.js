const express = require("express");
const router = express.Router();
const linkedinController = require("../controllers/linkedinController");

router.post("/sync", linkedinController.syncLinkedin);

module.exports = router;