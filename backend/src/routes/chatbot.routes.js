const router     = require("express").Router();
const controller = require("../controllers/chatbot.controller");

router.post("/message",              controller.sendMessage);
router.get("/history/:sessionId",   controller.getHistory);
router.get("/sessions",             controller.getSessions);

module.exports = router;