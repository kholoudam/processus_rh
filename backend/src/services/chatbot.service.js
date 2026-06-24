const pool  = require("../config/db");
const axios = require("axios");


/*
=======================================================
  CONTEXTE DE SESSION en mémoire
  Permet au chatbot de se souvenir du dernier candidat
  et du dernier poste mentionnés dans la conversation.
=======================================================
*/
const sessionContext = {};   // { [sessionId]: { jobId, candidateName, candidateId } }

function getCtx(sessionId) {
    if (!sessionContext[sessionId]) sessionContext[sessionId] = {};
    return sessionContext[sessionId];
}


/*
=======================================================
  EXTRACTION DU POSTE depuis le message utilisateur
  Cherche en BDD les titres de postes et renvoie le
  job_id si le message contient un titre connu.
=======================================================
*/
async function extractJobFromMessage(message) {
    const { rows } = await pool.query("SELECT id, title FROM job");
    const lower    = message.toLowerCase();

    // Cherche la correspondance la plus longue en premier (évite faux positifs)
    const sorted = rows.sort((a, b) => b.title.length - a.title.length);
    for (const job of sorted) {
        if (lower.includes(job.title.toLowerCase())) {
            return job;   // { id, title }
        }
    }
    return null;
}


/*
=======================================================
  DÉTECTION D'INTENTION avec NLP (+ fallback)
=======================================================
*/
async function detectIntent(message) {
    try {
        const response = await axios.post(
            "http://localhost:5002/nlp",
            { message },
            { timeout: 5000 }
        );
        return response.data.intent;
    } catch {
        console.log("NLP indisponible => mode fallback");
        const t = message.toLowerCase();

        if (t.includes("expérience") || t.includes("experience") ||
            t.includes("année")      || t.includes("annee"))        return "compare_experience";

        if (t.includes("pourquoi")   || t.includes("meilleur")  ||
            t.includes("expliquer")  || t.includes("explique"))     return "explain_candidate";

        if (t.includes("poste")      || t.includes("offre")     ||
            t.includes("recommande") || t.includes("candidat"))     return "recommend_candidate";

        return "general";
    }
}


/*
=======================================================
  FONCTION PRINCIPALE
=======================================================
*/
exports.processMessage = async (data) => {

    const {
        message,
        candidateId: frontendCandidateId,
        jobId:       frontendJobId,
        sessionId = "default"
    } = data;

    const ctx    = getCtx(sessionId);
    const intent = await detectIntent(message);

    // ── Extraire le poste depuis le message ──────────────────────────────────
    const jobInMessage = await extractJobFromMessage(message);
    if (jobInMessage) {
        ctx.jobId    = jobInMessage.id;
        ctx.jobTitle = jobInMessage.title;
    }

    // jobId résolu : priorité → frontend → message → contexte session
    const resolvedJobId = frontendJobId || ctx.jobId || null;

    // candidateId résolu : priorité → frontend → contexte session
    const resolvedCandidateId = frontendCandidateId || ctx.candidateId || null;

    let answer;
    let lastCandidateName = null;

    switch (intent) {

        case "recommend_candidate":
            answer = await recommendCandidates(resolvedJobId, ctx);
            // Mémoriser le premier candidat retourné pour les questions suivantes
            if (ctx.lastRecommended) {
                ctx.candidateId   = ctx.lastRecommended.id;
                ctx.candidateName = ctx.lastRecommended.name;
            }
            break;

        case "compare_experience":
            answer = await compareExperience(resolvedJobId, ctx);
            // Mémoriser le candidat le plus expérimenté
            if (ctx.mostExperienced) {
                ctx.candidateId   = ctx.mostExperienced.id;
                ctx.candidateName = ctx.mostExperienced.name;
            }
            break;

        case "explain_candidate":
            answer = await explainCandidate(resolvedCandidateId, resolvedJobId, ctx);
            break;

        default:
            answer = `Je suis votre assistant RH. Je peux vous aider à :
- 🎯 Recommander des candidats pour un poste (ex: "Recommande des candidats pour Ingénieur Production")
- 📊 Comparer les expériences (ex: "Qui a le plus d'expérience ?")
- 💡 Expliquer une recommandation (ex: "Pourquoi ce candidat ?")`;
    }

    // Sauvegarder en BDD avec le jobId résolu
    await saveHistory(sessionId, message, answer, resolvedCandidateId, resolvedJobId);

    return { answer, intent };
};


/*
=======================================================
  RECOMMANDATION CANDIDATS
  - Filtre par poste (nom extrait du message ou jobId)
  - Déduplique par candidat (DISTINCT ON candidate_id)
  - Mémorise le 1er résultat dans ctx.lastRecommended
=======================================================
*/
async function recommendCandidates(jobId, ctx) {

    let query, params = [];

    if (jobId) {
        // Filtre par job précis → un seul poste → pas de ligne "Poste" redondante
        query = `
            SELECT DISTINCT ON (c.id)
                c.id,
                c.name,
                j.title  AS job_title,
                j.company,
                m.score
            FROM matching m
            JOIN candidate c ON c.id = m.candidate_id
            JOIN job j       ON j.id = m.job_id
            WHERE j.id = $1
            ORDER BY c.id, m.score DESC
        `;
        params = [jobId];
    } else {
        // Pas de filtre → top 5 toutes offres confondues, dédupliqué par candidat
        query = `
            SELECT DISTINCT ON (c.id)
                c.id,
                c.name,
                j.title  AS job_title,
                j.company,
                m.score
            FROM matching m
            JOIN candidate c ON c.id = m.candidate_id
            JOIN job j       ON j.id = m.job_id
            ORDER BY c.id, m.score DESC
        `;
    }

    // Envelopper pour trier globalement et limiter après DISTINCT
    const wrapped = `
        SELECT * FROM (${query}) sub
        ORDER BY score DESC
        LIMIT 5
    `;

    const result = await pool.query(wrapped, params);

    if (!result.rows.length) {
        return jobId
            ? `Aucun candidat compatible trouvé pour ce poste.`
            : "Aucun candidat compatible trouvé.";
    }

    // Mémoriser le 1er candidat pour "pourquoi ce candidat ?"
    ctx.lastRecommended = { id: result.rows[0].id, name: result.rows[0].name };

    const jobLabel = ctx.jobTitle ? ` pour le poste **${ctx.jobTitle}**` : "";
    let response   = `Voici les meilleurs candidats${jobLabel} :\n\n`;

    result.rows.forEach((c, i) => {
        const bar   = scoreBar(parseFloat(c.score));
        const poste = jobId ? "" : `\n💼 Poste visé : ${c.job_title}`;
        response += `${i + 1}) 👤 ${c.name}${poste}\n🏢 ${c.company}   ⭐ ${c.score}%  ${bar}\n\n`;
    });

    return response.trimEnd();
}


/*
=======================================================
  COMPARER EXPÉRIENCE
  - Filtre par jobId si disponible
  - Mémorise le candidat le plus expérimenté dans ctx
=======================================================
*/
async function compareExperience(jobId, ctx) {

    const hasFilter = !!jobId;

    const query = `
        SELECT
            c.id,
            c.name,
            COUNT(DISTINCT e.id) AS exp_count
        FROM candidate c
        JOIN experience e ON e.candidate_id = c.id
        ${hasFilter ? "JOIN matching m ON m.candidate_id = c.id AND m.job_id = $1" : ""}
        GROUP BY c.id, c.name
        ORDER BY exp_count DESC
        LIMIT 3
    `;

    const result = await pool.query(query, hasFilter ? [jobId] : []);

    if (!result.rows.length) {
        return "Impossible de déterminer l'expérience des candidats.";
    }

    const top = result.rows[0];
    ctx.mostExperienced = { id: top.id, name: top.name };

    // Titre du poste si filtré
    let jobLabel = "";
    if (hasFilter && ctx.jobTitle) jobLabel = ` pour le poste **${ctx.jobTitle}**`;

    let response = `Classement par expérience${jobLabel} :\n\n`;
    result.rows.forEach((r, i) => {
        const medal = ["🥇","🥈","🥉"][i] || `${i+1})`;
        response += `${medal} ${r.name} — ${r.exp_count} expérience(s)\n`;
    });

    response += `\n💡 ${top.name} mène avec ${top.exp_count} expérience(s) professionnelle(s) détectée(s).`;
    response += `\n\nVoulez-vous savoir **pourquoi ${top.name} est recommandé(e)** ? Tapez "Pourquoi ce candidat ?"`;

    return response;
}


/*
=======================================================
  EXPLIQUER CANDIDAT
  - Utilise ctx.candidateId si aucun candidateId explicit
  - Récupère compétences + score depuis matching
=======================================================
*/
async function explainCandidate(candidateId, jobId, ctx) {

    // Résoudre le candidateId depuis le contexte si manquant
    const resolvedId   = candidateId || ctx.candidateId || null;
    const resolvedName = ctx.candidateName || null;

    if (!resolvedId) {
        const hint = resolvedName
            ? `Je parle de ${resolvedName}.`
            : "Aucun candidat n'a encore été mentionné dans cette conversation.";
        return `${hint}\n\nPosez d'abord une question comme "Recommande des candidats pour [poste]" ou "Qui a le plus d'expérience ?", puis revenez avec "Pourquoi ce candidat ?".`;
    }

    // Récupérer toutes les lignes matching pour ce candidat
    const params  = jobId ? [resolvedId, jobId] : [resolvedId];
    const jobCond = jobId ? "AND m.job_id = $2" : "";

    const result = await pool.query(`
        SELECT
            c.name,
            c.email,
            j.title   AS job_title,
            j.company,
            m.score
        FROM candidate c
        JOIN matching m ON c.id = m.candidate_id
        JOIN job j      ON j.id = m.job_id
        WHERE c.id = $1 ${jobCond}
        ORDER BY m.score DESC
        LIMIT 1
    `, params);

    if (!result.rows.length) {
        return `Aucune donnée de matching trouvée pour ${resolvedName || "ce candidat"}.`;
    }

    const c    = result.rows[0];
    const bar  = scoreBar(parseFloat(c.score));
    const note = scoreNote(parseFloat(c.score));

    // Récupérer le nombre d'expériences
    const expResult = await pool.query(
        "SELECT COUNT(*) AS cnt FROM experience WHERE candidate_id = $1",
        [resolvedId]
    );
    const expCount = expResult.rows[0]?.cnt || 0;

    return `**${c.name}** est recommandé(e) pour le poste **${c.job_title}** chez ${c.company}\n\n` +
           `⭐ Score de compatibilité : ${c.score}%  ${bar}\n` +
           `📝 Évaluation : ${note}\n\n` +
           `Détails :\n` +
           `- 💼 ${expCount} expérience(s) professionnelle(s) détectée(s)\n` +
           `- ✅ Profil analysé sur compétences, expérience et formation\n` +
           `- 🔍 Score calculé par l'algorithme de matching RH Manager\n\n` +
           `📧 Contact : ${c.email || "non renseigné"}`;
}


/*
=======================================================
  UTILITAIRES
=======================================================
*/

function scoreBar(score) {
    const filled = Math.round(score / 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
}

function scoreNote(score) {
    if (score >= 80) return "Excellent profil ✨";
    if (score >= 65) return "Bon profil 👍";
    if (score >= 50) return "Profil acceptable";
    return "Profil partiel";
}


/*
=======================================================
  HISTORIQUE
=======================================================
*/

exports.getHistory = async (sessionId) => {
    const result = await pool.query(`
        SELECT user_message, bot_response, candidate_id, job_id, created_at
        FROM chatbot_history
        WHERE session_id = $1
        ORDER BY created_at ASC
    `, [sessionId]);
    return result.rows;
};

exports.getSessions = async () => {
    const result = await pool.query(`
        SELECT
            session_id,
            MIN(created_at)  AS started_at,
            MAX(created_at)  AS last_message_at,
            COUNT(*)         AS message_count
        FROM chatbot_history
        GROUP BY session_id
        ORDER BY last_message_at DESC
        LIMIT 50
    `);
    return result.rows;
};

async function saveHistory(sessionId, userMessage, botResponse, candidateId, jobId) {
    try {
        await pool.query(`
            INSERT INTO chatbot_history (session_id, user_message, bot_response, candidate_id, job_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [sessionId, userMessage, botResponse, candidateId || null, jobId || null]);
    } catch (err) {
        console.log("Erreur sauvegarde historique:", err.message);
    }
}