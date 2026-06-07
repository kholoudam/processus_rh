const router = require("express").Router();
const controller = require("../controllers/matching.controller");

router.get("/", controller.getMatching);

module.exports = router;