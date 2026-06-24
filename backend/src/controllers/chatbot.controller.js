const chatbotService = require("../services/chatbot.service");


exports.sendMessage = async (req, res) => {

    try {

        const result = await chatbotService.processMessage({
            message:     req.body.message,
            candidateId: req.body.candidateId,
            jobId:       req.body.jobId,
            sessionId:   req.body.sessionId || "default"
        });

        res.json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};


// GET /api/chatbot/history/:sessionId
exports.getHistory = async (req, res) => {

    try {

        const rows = await chatbotService.getHistory(req.params.sessionId);
        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};


// GET /api/chatbot/sessions
exports.getSessions = async (req, res) => {

    try {

        const rows = await chatbotService.getSessions();
        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};