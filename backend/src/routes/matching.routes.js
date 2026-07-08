const router = require("express").Router();
const controller = require("../controllers/matching.controller");

router.get("/", controller.getMatching);
router.get("/stats", controller.getMatchingStats);

module.exports = router;