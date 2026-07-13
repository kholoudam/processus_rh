// chatbot.routes.js
const router = require('express').Router();
const pool = require('../config/db');
const { handleUserMessage } = require('../services/chatbot.service');

// ─── POST /api/chatbot/message ──────────────────────────────────────────
router.post('/message', async (req, res) => {
  const { message, sessionId, candidateId, jobId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, answer: "Message vide." });
  }
  if (!sessionId) {
    return res.status(400).json({ success: false, answer: "sessionId manquant." });
  }

  try {
    const result = await handleUserMessage(message, sessionId, { candidateId, jobId });
    res.json(result); // { intent, answer, success }
  } catch (err) {
    console.error("Erreur chatbot:", err);
    res.status(500).json({ success: false, answer: "Erreur serveur." });
  }
});

// ─── GET /api/chatbot/sessions ──────────────────────────────────────────
// Liste des sessions distinctes pour le panneau de gauche, triées par
// dernier message décroissant. C'est cette route qui manquait (404).
router.get('/sessions', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        session_id,
        MAX(created_at)   AS last_message_at,
        COUNT(*)::int     AS message_count
      FROM chatbot_history
      WHERE session_id IS NOT NULL
      GROUP BY session_id
      ORDER BY last_message_at DESC
    `);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur récupération sessions:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// ─── GET /api/chatbot/history/:sessionId ────────────────────────────────
// Historique complet d'une session, en tableau PLAT (pas d'enveloppe
// { success, history } ici — le frontend fait directement data.flatMap(...)).
router.get('/history/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const r = await pool.query(
      `
      SELECT user_message, bot_response, created_at
      FROM chatbot_history
      WHERE session_id = $1
      ORDER BY created_at ASC
      `,
      [sessionId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur récupération historique:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;