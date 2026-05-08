const express = require("express");
const router = express.Router();
const matchingController = require("../controllers/matching.controller");

router.get("/", matchingController.getMatching);

module.exports = router;