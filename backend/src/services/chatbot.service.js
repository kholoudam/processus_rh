// chatbot.service.js
const pool = require('../config/db');
const { askLLM, classifyIntentLLM } = require('./llm.service');

const CONFIDENCE_THRESHOLD = 8;
const HISTORY_LIMIT = 6;

function detectIntentKeywords(message) {
  const msg = message.toLowerCase();
  let bestIntent = null;
  let bestScore = 0;

  const intentKeywords = {
    candidats_stats: ["combien", "nombre", "statistique", "total"],
    candidats_liste: ["liste", "candidats", "qui a postulé"],
    job_details: ["poste", "offre", "job"],
    matching_score: ["score", "matching", "correspondance"],
    recommandations: ["recommand", "suggestion"],
    admis: ["admis", "accepté", "retenu"],
    refuses: ["refusé", "rejeté", "non retenu"],
    greeting: ["bonjour", "salut", "hello"],
    help: ["aide", "help", "comment"],
  };

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    let score = 0;

    for (const kw of keywords) {
      if (msg.includes(kw)) score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return {
    intent: bestIntent || "unknown",
    confidence: bestScore,
  };
}

async function fetchContextData(intent) {
  switch (intent) {
    case "candidats_stats": {
      const r = await pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE a.status IS NULL
               OR a.status NOT IN ('ACCEPTED','REJECTED')
          ) AS en_attente,
          (SELECT COUNT(*) FROM admis) AS admis,
          (SELECT COUNT(*) FROM refuses) AS refuses,
          COUNT(*) AS total
        FROM candidate c
        LEFT JOIN application a
          ON a.candidate_id = c.id
      `);

      return r.rows[0];
    }

    case "candidats_liste": {
      const r = await pool.query(`
        SELECT
          c.name,
          c.email,
          e.subject,
          a.applied_date
        FROM candidate c
        LEFT JOIN application a
          ON a.candidate_id = c.id
        LEFT JOIN email e
          ON e.id = a.email_id
        ORDER BY c.id DESC
        LIMIT 10
      `);

      return r.rows;
    }

    case "job_details": {
      const r = await pool.query(`
        SELECT *
        FROM job
        ORDER BY id DESC
        LIMIT 10
      `);

      return r.rows;
    }

    case "matching_score": {
      const r = await pool.query(`
        SELECT
          c.name,
          j.title,
          m.score
        FROM matching m
        JOIN candidate c
          ON c.id = m.candidate_id
        JOIN job j
          ON j.id = m.job_id
        ORDER BY m.score DESC
        LIMIT 10
      `);

      return r.rows;
    }

    case "recommandations": {
      const r = await pool.query(`
        SELECT
          c.name,
          j.title AS recommended_job,
          r.reason
        FROM recommendation r
        JOIN candidate c
          ON c.id = r.candidate_id
        JOIN job j
          ON j.id = r.job_id
        ORDER BY r.created_at DESC
        LIMIT 10
      `);

      return r.rows;
    }

    case "admis": {
      const r = await pool.query(`
        SELECT
          c.name,
          c.email,
          ad.accepted_at
        FROM admis ad
        JOIN candidate c
          ON c.id = ad.candidate_id
        ORDER BY ad.accepted_at DESC
        LIMIT 10
      `);

      return r.rows;
    }

    case "refuses": {
      const r = await pool.query(`
        SELECT
          c.name,
          rf.reason,
          rf.refused_at
        FROM refuses rf
        JOIN candidate c
          ON c.id = rf.candidate_id
        ORDER BY rf.refused_at DESC
        LIMIT 10
      `);

      return r.rows;
    }

    default:
      return {
        info: "Aucune donnée spécifique récupérée pour cette intention."
      };
  }
}

async function loadHistoryFromDB(sessionId) {
  if (!sessionId) return [];

  const r = await pool.query(
    `
      SELECT user_message, bot_response
      FROM chatbot_history
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [sessionId, HISTORY_LIMIT]
  );

  const rows = r.rows.reverse();

  const messages = [];

  for (const row of rows) {
    messages.push({
      role: "user",
      content: row.user_message
    });

    if (row.bot_response) {
      messages.push({
        role: "assistant",
        content: row.bot_response
      });
    }
  }

  return messages;
}

async function saveHistoryToDB({
  sessionId,
  userMessage,
  botResponse,
  candidateId,
  jobId,
}) {
  await pool.query(
    `
      INSERT INTO chatbot_history
      (
        session_id,
        user_message,
        bot_response,
        candidate_id,
        job_id
      )
      VALUES ($1,$2,$3,$4,$5)
    `,
    [
      sessionId || null,
      userMessage,
      botResponse || null,
      candidateId || null,
      jobId || null,
    ]
  );
}

async function handleUserMessage(userMessage, sessionId, extra = {}) {

  const conversationHistory = await loadHistoryFromDB(sessionId);

  const jsResult = detectIntentKeywords(userMessage);

  let finalIntent = jsResult.intent;

  if (jsResult.confidence < CONFIDENCE_THRESHOLD) {
    finalIntent = await classifyIntentLLM(userMessage);
  }

  const contextData = await fetchContextData(finalIntent);

  const llmResponse = await askLLM(
    userMessage,
    contextData,
    conversationHistory
  );

  try {

    // Limiter la taille enregistrée dans l'historique
    const truncatedReply =
      llmResponse.reply
        ? llmResponse.reply.substring(0, 800)
        : "";

    await saveHistoryToDB({
      sessionId,
      userMessage,
      botResponse: truncatedReply,
      candidateId: extra.candidateId || null,
      jobId: extra.jobId || null,
    });

  } catch (err) {
    console.error(
      "Erreur sauvegarde chatbot_history:",
      err.message
    );
  }

  return {
    intent: finalIntent,
    reply: llmResponse.reply,
    success: llmResponse.success,
  };
}

module.exports = {
  handleUserMessage,
};