const express = require("express");

const router = express.Router();

const linkedinController = require("../controllers/linkedinController");

router.post(
  "/sync",
  linkedinController.syncLinkedin
);

router.get("/status", (req, res) => {

  res.json({
    success: true,
    status: "running"
  });

});

module.exports = router;