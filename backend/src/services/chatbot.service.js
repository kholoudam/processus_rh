const pool  = require("../config/db");
const axios = require("axios");

/*
  ═══════════════════════════════════════════════════════════════
  SCHÉMA RÉEL DE LA BDD (pour référence)
  ───────────────────────────────────────────────────────────────
  candidate      : id, name, email, phone, address, degree, cv_hash, created_at
  job            : id, title, company, description, contract_type, location,
                   work_mode, experience_required, education_level, skills[],
                   seniority_level, is_urgent, created_at   ← PAS de "status"
  experience     : id, candidate_id, company, position, duration  ← PAS start_date/end_date/title
  education      : id, candidate_id, degree, institution, year    ← PAS field/end_date
  candidate_skill: id, candidate_id, skill_name                   ← PAS "skill", PAS "level"
  matching       : id, candidate_id, job_id, score, created_at
  application    : id, candidate_id, email_id, status, applied_date, source
                   ← status IN ('RECEIVED','IN_PROGRESS'), PAS de job_id direct
                   ← applied_date (pas applied_at)
  admis          : id, candidate_id, accepted_at
  refuses        : id, candidate_id, refused_at, reason
  ═══════════════════════════════════════════════════════════════
*/


/* ============================================================
   CONTEXTE DE SESSION — BDD avec fallback mémoire
   ============================================================ */

async function loadCtx(sessionId) {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM chatbot_context WHERE session_id = $1", [sessionId]
        );
        return rows[0] ? { ...rows[0] } : {};
    } catch {
        if (!global._chatCtx) global._chatCtx = {};
        if (!global._chatCtx[sessionId]) global._chatCtx[sessionId] = {};
        return global._chatCtx[sessionId];
    }
}

async function saveCtx(sessionId, patch) {
    try {
        await pool.query(`
            INSERT INTO chatbot_context
                (session_id, job_id, job_title, candidate_id, candidate_name, updated_at)
            VALUES ($1,$2,$3,$4,$5,NOW())
            ON CONFLICT (session_id) DO UPDATE SET
                job_id         = COALESCE($2, chatbot_context.job_id),
                job_title      = COALESCE($3, chatbot_context.job_title),
                candidate_id   = COALESCE($4, chatbot_context.candidate_id),
                candidate_name = COALESCE($5, chatbot_context.candidate_name),
                updated_at     = NOW()
        `, [sessionId, patch.job_id||null, patch.job_title||null,
            patch.candidate_id||null, patch.candidate_name||null]);
    } catch {
        if (!global._chatCtx) global._chatCtx = {};
        if (!global._chatCtx[sessionId]) global._chatCtx[sessionId] = {};
        Object.assign(global._chatCtx[sessionId], patch);
    }
}


/* ============================================================
   TOKENISATION & NORMALISATION
   ============================================================ */

const STOP_WORDS = new Set([
    "le","la","les","de","du","des","un","une","et","en","au","aux",
    "pour","par","sur","dans","avec","qui","que","quel","quelle","quels",
    "quelles","moi","me","mon","ma","mes","son","sa","ses","leur","leurs",
    "est","sont","ont","pas","plus","tout","tous","il","elle","ils","elles",
    "je","tu","nous","vous","se","ce","cet","cette","ces",
    "has","have","most","the","for","and","with","from","into","this",
    "candidat","candidats","poste","postes","offre","offres","entreprise"
]);

function normalize(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(str) {
    return normalize(str)
        .split(" ")
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}


/* ============================================================
   DÉTECTION D'INTENTION — scoring mots-clés en priorité,
   NLP Flask en arbitre pour les cas ambigus
   ============================================================
   AVANT : Flask était appelé en premier, et comme la classification
   zero-shot renvoie TOUJOURS un label parmi les 4 qu'on lui donne
   (recommend_candidate / compare_experience / explain_candidate /
   search_job — jamais "aucun de ceux-là"), res.data.intent était
   presque toujours vrai. Résultat : le scoring mots-clés ci-dessous
   (qui connaît lui des intents comme candidate_contact, applications,
   admis, refuses, stats...) n'était quasiment JAMAIS exécuté, et des
   questions comme "Qui a postulé à X ?" ou "Quel est l'email de X ?"
   étaient forcées dans une des 4 catégories Flask les plus proches
   (souvent explain_candidate), avec le mauvais candidat/job repêché
   depuis le contexte de session.

   MAINTENANT : le scoring mots-clés passe en premier. S'il trouve un
   signal fort (score ≥ 8, ex: "email" détecte candidate_contact avec
   10 points), on répond directement — rapide et fiable. On ne
   consulte Flask que si le score est faible/ambigu, pour départager
   des formulations sans mot-clé net.
   ============================================================ */

async function detectIntent(message) {
    // ── 1. Scoring mots-clés (couvre TOUS les intents métier) ───
    const local = detectIntentFallback(message);
    if (local.score >= 8) {
        return local.intent;
    }

    // ── 2. Score faible/ambigu → on arbitre avec le NLP Flask ───
    try {
        const res = await axios.post(
            "http://localhost:5002/nlp",
            { message },
            { timeout: 4000 }
        );
        if (res.data.intent) return res.data.intent;
    } catch { /* Flask indisponible → on garde le meilleur score JS */ }

    return local.intent;
}

/*
  Détection d'intention par règles prioritaires.
  PRINCIPE : on teste les intentions du plus spécifique au plus général.
  Chaque règle a un score basé sur le nombre de signaux trouvés.
  L'intention avec le score le plus élevé gagne.
*/
function detectIntentFallback(message) {
    const t = normalize(message);

    // Système de scoring : { intent -> score }
    const scores = {};
    function add(intent, points) {
        scores[intent] = (scores[intent] || 0) + points;
    }

    // ── 1. CONTACT (très spécifique, priorité haute) ─────────────
    // "email de X", "téléphone de X", "contact de X", "coordonnées de X"
    if (/\bemail\b/.test(t))                          add("candidate_contact", 10);
    if (/\btelephone\b|\bphone\b|\btel\b/.test(t)) add("candidate_contact", 10);
    if (/\bcontact\b/.test(t))                        add("candidate_contact",  8);
    if (/\bcoordonnee/.test(t))                        add("candidate_contact",  8);
    if (/\bjoindre\b|\bappeler\b/.test(t))          add("candidate_contact",  6);

    // ── 2. FEEDBACK / CORRECTION ─────────────────────────────────
    if (/n.{0,3}est pas|pas un\b|ce n.{0,3}est/.test(t)) add("user_feedback", 10);
    if (/\bfaux\b|\berreur\b|\bincorrect\b/.test(t)) add("user_feedback",  8);
    if (/\bmauvais\b|\bwrong\b/.test(t))               add("user_feedback",  6);

    // ── 3. STATISTIQUES ──────────────────────────────────────────
    if (/\bcombien\b/.test(t))                           add("stats", 10);
    if (/\bstatistique|\bstat\b/.test(t))               add("stats",  9);
    if (/\bnombre\b|\btotal\b/.test(t))                add("stats",  7);
    if (/\bpourcentage\b|\btaux\b/.test(t))            add("stats",  7);
    if (/\bscore moyen|\bscore max/.test(t))             add("stats",  8);

    // ── 4. ADMIS ─────────────────────────────────────────────────
    if (/\badmi[st]\b/.test(t))                          add("admis", 10);
    if (/\baccepte\b|\bretenu\b/.test(t))              add("admis",  8);
    if (/\bselectionne\b/.test(t))                       add("admis",  6);

    // ── 5. REFUSÉS ───────────────────────────────────────────────
    if (/\brefus/.test(t))                                add("refuses", 10);
    if (/\brejet\b|\becarte\b/.test(t))                add("refuses",  8);
    if (/\brejete\b/.test(t))                            add("refuses",  8);

    // ── 6. CANDIDATURES / APPLICATIONS ───────────────────────────
    // "qui a postulé", "candidatures reçues", "en attente"
    if (/\bpostul/.test(t))                               add("applications", 10);
    if (/\bcandidature/.test(t))                          add("applications",  9);
    if (/\ben attente\b/.test(t))                        add("applications",  9);
    if (/\bapplica/.test(t))                              add("applications",  7);
    if (/\brecu[e]?\b|\breceive/.test(t))               add("applications",  5);

    // ── 7. DÉTAIL CANDIDAT ────────────────────────────────────────
    // "détail X", "profil complet de X", "analyse X", "qui est X"
    if (/\bdetail\b/.test(t))                            add("candidate_detail", 10);
    if (/\bprofil\b.*\bcomplet/.test(t))                add("candidate_detail", 10);
    if (/\bprofil\b/.test(t) && !/\bmeilleur/.test(t)) add("candidate_detail",  5);
    if (/\banalyse\b/.test(t) && !/\banalyse[sz]\b.*candidat/.test(t))
                                                           add("candidate_detail",  6);
    if (/\bpresente\b|\bqui est\b/.test(t))            add("candidate_detail",  5);
    if (/\bexpliqu/.test(t))                              add("candidate_detail",  6);

    // ── 8. EXPÉRIENCE / CLASSEMENT ───────────────────────────────
    // "qui a le plus d'expérience", "classe par expérience"
    if (/plus d.{0,5}experience/.test(t))                  add("compare_experience", 12);
    if (/\bclasse.{0,10}experience/.test(t))              add("compare_experience", 12);
    if (/\bexperience\b/.test(t))                        add("compare_experience",  6);
    if (/\bannee.{0,5}experience|experience.{0,5}annee/.test(t))
                                                           add("compare_experience",  8);

    // ── 9. RECOMMANDATIONS / LISTE ───────────────────────────────
    // "recommande des candidats pour X", "meilleurs profils pour X"
    if (/\brecommand/.test(t))                            add("recommend_candidate", 10);
    if (/\bmeilleur/.test(t))                             add("recommend_candidate",  8);
    if (/\bsugg/.test(t))                                 add("recommend_candidate",  7);
    if (/\badapte\b|\bcorrespond/.test(t))              add("recommend_candidate",  7);
    if (/\bconvient\b/.test(t))                          add("recommend_candidate",  7);
    if (/\bliste\b|\bmontre\b|\baffiche\b/.test(t))  add("list",                 6);
    if (/\btous les candidats/.test(t))                   add("list",                 8);
    if (/\bvoir les candidats/.test(t))                   add("list",                 8);

    // ── 10. COMPÉTENCES / FORMATION ──────────────────────────────
    if (/\bcompetence|\bskill/.test(t))                  add("candidate_detail",  5);
    if (/\bformation\b|\bdiplome\b/.test(t))           add("candidate_detail",  5);
    if (/\beducation\b|\betude\b/.test(t))             add("candidate_detail",  5);

    // ── Désambiguïsation : "profil de X" sans "complet" ni "meilleur"
    //    Si un nom de candidat est dans le message ET pas de verbe "recommander"
    //    → probablement un détail candidat
    if (/\bde\b/.test(t) && /\bprofil\b/.test(t) && !/\bmeilleur/.test(t)) {
        add("candidate_detail", 3);
    }

    // ── Trouver le gagnant ────────────────────────────────────────
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    if (best.length === 0) return { intent: "general", score: 0 };

    // Si le score gagnant est trop bas (< 5) → général
    if (best[0][1] < 5) return { intent: "general", score: best[0][1] };

    return { intent: best[0][0], score: best[0][1] };
}


/* ============================================================
   EXTRACTION DU POSTE — recherche floue + Levenshtein
   ============================================================ */

async function extractJob(message, ctxJobId, useCtxFallback = true) {
    const { rows: jobs } = await pool.query("SELECT id, title FROM job");
    const msgTokens = tokenize(message);

    let best = null, bestScore = 0;

    for (const job of jobs) {
        if (!job.title) continue;
        const titleTokens = tokenize(job.title);
        if (!titleTokens.length) continue;

        const matched = titleTokens.filter(t => msgTokens.some(m =>
            m.includes(t) || t.includes(m) || levenshtein(m, t) <= 1
        ));
        const score = matched.length / titleTokens.length;

        if (score > bestScore && score >= 0.4) {
            bestScore = score;
            best = job;
        }
    }

    // Utiliser le job en contexte seulement si :
    // 1. Pas de job trouvé dans le message
    // 2. useCtxFallback est activé (désactivé pour detail/contact)
    if (!best && ctxJobId && useCtxFallback) {
        const { rows } = await pool.query(
            "SELECT id, title FROM job WHERE id = $1", [ctxJobId]
        );
        if (rows.length) best = rows[0];
    }

    return best;
}

function levenshtein(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[a.length][b.length];
}


/* ============================================================
   EXTRACTION DU CANDIDAT
   ============================================================ */

async function extractCandidate(message, ctxCandidateId) {
    const { rows: candidates } = await pool.query("SELECT id, name FROM candidate");
    const msgNorm = normalize(message);

    for (const c of candidates) {
        if (!c.name) continue;
        const nameParts = normalize(c.name).split(" ");
        if (nameParts.some(part => part.length > 2 && msgNorm.includes(part))) {
            return c;
        }
    }

    if (ctxCandidateId) {
        const { rows } = await pool.query(
            "SELECT id, name FROM candidate WHERE id = $1", [ctxCandidateId]
        );
        if (rows.length) return rows[0];
    }
    return null;
}


/* ============================================================
   REQUÊTES SQL — alignées sur le vrai schéma
   ============================================================ */

// ── Recommandations ──────────────────────────────────────────
async function recommendCandidates(job, limit = 8) {
    if (!job) {
        return {
            rows: [],
            msg: "Aucun poste détecté. Précisez le nom du poste, ex : \"Recommande des candidats pour Technicien Méthodes\"."
        };
    }

    const { rows } = await pool.query(`
        SELECT * FROM (
            SELECT DISTINCT ON (c.id)
                c.id, c.name, c.email,
                j.title AS job_title, j.company,
                m.score
            FROM matching m
            JOIN candidate c ON c.id = m.candidate_id
            JOIN job j       ON j.id = m.job_id
            WHERE j.id = $1
            ORDER BY c.id, m.score DESC
        ) sub
        ORDER BY score DESC
        LIMIT $2
    `, [job.id, limit]);

    return { rows, job };
}

// ── Comparer expérience
//    experience : company, position, duration  (pas start_date/end_date)
// ─────────────────────────────────────────────────────────────
async function compareExperience(job) {
    const jobFilter = job
        ? `AND c.id IN (SELECT candidate_id FROM matching WHERE job_id = ${job.id})`
        : "";

    const { rows } = await pool.query(`
        SELECT
            c.id, c.name,
            COUNT(DISTINCT e.id) AS exp_count
        FROM candidate c
        JOIN experience e ON e.candidate_id = c.id
        WHERE 1=1 ${jobFilter}
        GROUP BY c.id, c.name
        ORDER BY exp_count DESC
        LIMIT 5
    `);

    return { rows, job };
}

// ── Détail candidat
//    experience  : position (pas title), company, duration (pas start/end_date)
//    education   : degree, institution, year (pas field, pas end_date)
//    skills      : table candidate_skill, colonne skill_name (pas "skill")
// ─────────────────────────────────────────────────────────────
async function candidateDetail(candidate, job) {
    if (!candidate) {
        return { error: "Précisez le nom du candidat pour obtenir son détail." };
    }

    const [matchRes, expRes, eduRes, skillRes] = await Promise.all([

        // Meilleur matching du candidat
        pool.query(`
            SELECT j.title AS job_title, j.company, m.score
            FROM matching m
            JOIN job j ON j.id = m.job_id
            WHERE m.candidate_id = $1
            ${job ? "AND m.job_id = $2" : ""}
            ORDER BY m.score DESC
            LIMIT 1
        `, job ? [candidate.id, job.id] : [candidate.id]),

        // Expériences — colonnes réelles : position, company, duration
        pool.query(`
            SELECT position, company, duration
            FROM experience
            WHERE candidate_id = $1
            LIMIT 5
        `, [candidate.id]),

        // Formation — colonnes réelles : degree, institution, year
        pool.query(`
            SELECT degree, institution, year
            FROM education
            WHERE candidate_id = $1
            ORDER BY year DESC NULLS LAST
            LIMIT 3
        `, [candidate.id]),

        // Compétences — table candidate_skill, colonne skill_name
        pool.query(`
            SELECT skill_name
            FROM candidate_skill
            WHERE candidate_id = $1
            LIMIT 10
        `, [candidate.id])
    ]);

    return {
        candidate,
        match:  matchRes.rows[0] || null,
        exps:   expRes.rows,
        edus:   eduRes.rows,
        skills: skillRes.rows
    };
}

// ── Statistiques
//    job n'a PAS de colonne "status" — on compte tous les postes
//    application : applied_date (pas applied_at), pas de job_id direct
// ─────────────────────────────────────────────────────────────
async function getStats(job) {
    const [cRes, jRes, mRes, appRes, admisRes, refusesRes] = await Promise.all([

        pool.query("SELECT COUNT(*) AS cnt FROM candidate"),

        // Tous les postes (pas de status dans job)
        pool.query("SELECT COUNT(*) AS cnt FROM job"),

        // Scores de matching (filtrés par job si fourni)
        pool.query(
            `SELECT
                ROUND(AVG(score)::numeric, 1) AS avg,
                MAX(score) AS max,
                MIN(score) AS min
             FROM matching
             ${job ? "WHERE job_id = $1" : ""}`,
            job ? [job.id] : []
        ),

        // Candidatures totales (application n'a pas job_id direct)
        // On passe par matching pour lier à un job si fourni
        job
            ? pool.query(`
                SELECT COUNT(DISTINCT a.id) AS cnt
                FROM application a
                JOIN matching m ON m.candidate_id = a.candidate_id AND m.job_id = $1
              `, [job.id])
            : pool.query("SELECT COUNT(*) AS cnt FROM application"),

        pool.query("SELECT COUNT(*) AS cnt FROM admis"),
        pool.query("SELECT COUNT(*) AS cnt FROM refuses")
    ]);

    return {
        candidates:   cRes.rows[0].cnt,
        openJobs:     jRes.rows[0].cnt,
        avgScore:     mRes.rows[0].avg || "0.0",
        maxScore:     parseFloat(mRes.rows[0].max || 0).toFixed(1),
        applications: appRes.rows[0].cnt,
        admis:        admisRes.rows[0].cnt,
        refuses:      refusesRes.rows[0].cnt,
        job
    };
}

// ── Candidatures
//    application : status IN ('RECEIVED','IN_PROGRESS'), applied_date, email_id
//    On joint via email pour récupérer le candidat
// ─────────────────────────────────────────────────────────────
async function getApplications(job) {

    let query, params = [];

    if (job) {
        // Passer par matching pour lier application à un job
        query = `
            SELECT
                c.name, c.email,
                j.title AS job_title,
                a.status,
                a.applied_date
            FROM application a
            JOIN candidate c  ON c.id = a.candidate_id
            JOIN matching m   ON m.candidate_id = c.id AND m.job_id = $1
            JOIN job j        ON j.id = m.job_id
            ORDER BY a.applied_date DESC NULLS LAST
            LIMIT 10
        `;
        params = [job.id];
    } else {
        query = `
            SELECT
                c.name, c.email,
                a.status,
                a.applied_date
            FROM application a
            JOIN candidate c ON c.id = a.candidate_id
            ORDER BY a.applied_date DESC NULLS LAST
            LIMIT 10
        `;
    }

    const { rows } = await pool.query(query, params);
    return { rows, job };
}

// ── Candidats admis ──────────────────────────────────────────
async function getAdmis() {
    const { rows } = await pool.query(`
        SELECT c.name, c.email, a.accepted_at
        FROM admis a
        JOIN candidate c ON c.id = a.candidate_id
        ORDER BY a.accepted_at DESC
        LIMIT 10
    `);
    return { rows };
}

// ── Candidats refusés ────────────────────────────────────────
async function getRefuses() {
    const { rows } = await pool.query(`
        SELECT c.name, c.email, r.refused_at, r.reason
        FROM refuses r
        JOIN candidate c ON c.id = r.candidate_id
        ORDER BY r.refused_at DESC
        LIMIT 10
    `);
    return { rows };
}

// ── Contact candidat
//    candidate : name, email, phone, address (pas location)
// ─────────────────────────────────────────────────────────────
async function getCandidateContact(candidate) {
    if (!candidate) return { error: "Précisez le nom du candidat." };
    const { rows } = await pool.query(
        "SELECT name, email, phone, address FROM candidate WHERE id = $1",
        [candidate.id]
    );
    return { rows };
}

// ── Liste générale ───────────────────────────────────────────
async function listCandidates(job, limit = 10) {
    if (job) return recommendCandidates(job, limit);
    const { rows } = await pool.query(`
        SELECT DISTINCT ON (c.id)
            c.id, c.name, c.email,
            j.title AS job_title, j.company, m.score
        FROM matching m
        JOIN candidate c ON c.id = m.candidate_id
        JOIN job j       ON j.id = m.job_id
        ORDER BY c.id, m.score DESC
        LIMIT $1
    `, [limit]);
    return { rows, job: null };
}

// ── Explication candidat ─────────────────────────────────────
async function explainCandidate(candidate, job) {
    if (!candidate) {
        return { error: "Précisez le nom du candidat ou posez d'abord une question de recommandation." };
    }
    return candidateDetail(candidate, job);
}


/* ============================================================
   FORMATEURS DE RÉPONSES
   ============================================================ */

function scoreBar(score) {
    const s = parseFloat(score) || 0;
    const f = Math.round(s / 10);
    return `${"█".repeat(f)}${"░".repeat(10 - f)}`;
}

function scoreLabel(score) {
    const s = parseFloat(score) || 0;
    if (s >= 80) return "Excellent ✨";
    if (s >= 65) return "Bon profil 👍";
    if (s >= 50) return "Acceptable";
    return "Profil partiel";
}

function formatRecommendations(data) {
    if (!data.rows?.length) {
        return data.msg || `Aucun candidat trouvé${data.job ? ` pour **${data.job.title}**` : ""}.`;
    }

    const header = data.job
        ? `Voici les meilleurs candidats pour **${data.job.title}** :\n\n`
        : "Voici les candidats recommandés :\n\n";

    const lines = data.rows.map((c, i) => {
        const name  = c.name    || "Candidat sans nom";
        const comp  = c.company || "Entreprise inconnue";
        const score = parseFloat(c.score) || 0;
        return `${i + 1}) 👤 **${name}**\n🏢 ${comp}   ⭐ ${score}%  ${scoreBar(score)}  ${scoreLabel(score)}`;
    }).join("\n\n");

    const first = data.rows[0]?.name;
    const tip   = first ? `\n\n💡 Tapez **"Détail ${first}"** pour voir son profil complet.` : "";

    return header + lines + tip;
}

function formatExperience(data) {
    if (!data.rows?.length) return "Aucune donnée d'expérience trouvée.";

    const header = data.job
        ? `Classement par expérience pour **${data.job.title}** :\n\n`
        : "Classement global par expérience :\n\n";

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const lines  = data.rows.map((r, i) => {
        const name = r.name || "Candidat sans nom";
        return `${medals[i] || `${i + 1})`} **${name}** — ${r.exp_count} expérience(s)`;
    }).join("\n");

    const top  = data.rows[0];
    const name = top.name || "Ce candidat";
    return header + lines
        + `\n\n💡 **${name}** est en tête avec ${top.exp_count} expérience(s).`
        + `\n\nTapez **"Détail ${name}"** pour son analyse complète.`;
}

// Valeurs parasites issues du parsing de CV — à ne pas afficher
const JUNK_VALUES = new Set([
    "experiences professionnelles", "experience professionnelle",
    "formation", "competences", "profil", "education",
    "non renseigne", "n/a", "na", "null", "-", "."
]);

function isJunk(str) {
    if (!str) return true;
    return JUNK_VALUES.has(normalize(str));
}

// Tronquer les valeurs trop longues (ex: degree contenant tout le texte du CV)
function clean(str, maxLen = 120) {
    if (!str) return null;
    const s = str.trim();
    if (isJunk(s)) return null;
    return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function formatDetail(data) {
    if (data.error) return data.error;

    const { candidate, match, exps, edus, skills } = data;
    const cname = candidate.name || "Candidat";
    let txt = `**${cname}** — Profil complet\n\n`;

    if (match) {
        const s = parseFloat(match.score) || 0;
        txt += `⭐ Score pour **${match.job_title || "ce poste"}** : ${s}%  ${scoreBar(s)}  ${scoreLabel(s)}\n`;
        if (match.company && !isJunk(match.company)) txt += `🏢 ${match.company}\n`;
        txt += "\n";
    }

    if (exps?.length) {
        // Filtrer les expériences avec company = "EXPÉRIENCES PROFESSIONNELLES" ou valeurs parasites
        const cleanExps = exps.filter(e => !isJunk(e.company) && !isJunk(e.position));
        if (cleanExps.length) {
            txt += `💼 **Expériences (${cleanExps.length}) :**\n`;
            cleanExps.forEach(e => {
                const pos  = clean(e.position) || "Poste non précisé";
                const comp = clean(e.company)  || "Entreprise non précisée";
                const dur  = e.duration && !isJunk(e.duration) ? ` — ${clean(e.duration)}` : "";
                txt += `   • ${pos} chez ${comp}${dur}\n`;
            });
            txt += "\n";
        } else {
            txt += `💼 **Expériences :** ${exps.length} entrée(s) détectée(s)\n\n`;
        }
    }

    if (edus?.length) {
        txt += `🎓 **Formation :**\n`;
        edus.forEach(e => {
            const deg  = clean(e.degree, 80)      || "Diplôme non précisé";
            const inst = clean(e.institution, 80) || null;
            const yr   = e.year ? ` (${e.year})` : "";
            // Ne pas afficher institution si elle est identique au degree ou parasite
            const instPart = inst && normalize(inst) !== normalize(deg) ? ` — ${inst}` : "";
            txt += `   • ${deg}${instPart}${yr}\n`;
        });
        txt += "\n";
    }

    if (skills?.length) {
        const cleanSkills = skills
            .map(s => s.skill_name)
            .filter(s => s && !isJunk(s) && s.trim().length > 1);
        if (cleanSkills.length) {
            txt += `🛠️ **Compétences :** ${cleanSkills.join(", ")}\n`;
        }
    }

    if (!match && !exps?.length && !edus?.length && !skills?.length) {
        txt += "_Aucune information détaillée disponible pour ce candidat._\n";
    }

    return txt.trimEnd();
}

function formatStats(data) {
    const ctx = data.job ? ` pour **${data.job.title}**` : " (global)";
    return `📊 **Statistiques RH${ctx}**\n\n`
        + `👥 Candidats enregistrés : **${data.candidates}**\n`
        + `📋 Offres d'emploi total : **${data.openJobs}**\n`
        + `📨 Candidatures${ctx} : **${data.applications}**\n`
        + `✅ Candidats admis : **${data.admis}**\n`
        + `❌ Candidats refusés : **${data.refuses}**\n`
        + `⭐ Score moyen${ctx} : **${data.avgScore}%**\n`
        + `🏆 Score max${ctx} : **${data.maxScore}%**\n\n`
        + `💡 Tapez "Recommande candidats pour [poste]" pour voir les profils.`;
}

function formatApplications(data) {
    if (!data.rows?.length) {
        return data.job
            ? `Aucune candidature pour **${data.job.title}**.`
            : "Aucune candidature trouvée.";
    }

    const header = data.job
        ? `Candidatures pour **${data.job.title}** :\n\n`
        : "Dernières candidatures reçues :\n\n";

    const lines = data.rows.map((r, i) => {
        const name   = r.name       || "Candidat sans nom";
        const date   = r.applied_date
            ? new Date(r.applied_date).toLocaleDateString("fr-FR")
            : "Date inconnue";
        const status = r.status === "IN_PROGRESS" ? "En cours" : "Reçue";
        const job    = r.job_title ? ` — ${r.job_title}` : "";
        return `${i + 1}) 👤 **${name}**${job}\n   📅 ${date}  •  Statut : ${status}`;
    }).join("\n\n");

    return header + lines;
}

function formatAdmis(data) {
    if (!data.rows?.length) return "Aucun candidat admis pour le moment.";
    let txt = `✅ **Candidats admis (${data.rows.length}) :**\n\n`;
    data.rows.forEach((r, i) => {
        const date = r.accepted_at
            ? new Date(r.accepted_at).toLocaleDateString("fr-FR")
            : "Date inconnue";
        txt += `${i + 1}) 👤 **${r.name || "Candidat"}**  📧 ${r.email || "-"}  📅 ${date}\n`;
    });
    return txt.trimEnd();
}

function formatRefuses(data) {
    if (!data.rows?.length) return "Aucun candidat refusé pour le moment.";
    let txt = `❌ **Candidats refusés (${data.rows.length}) :**\n\n`;
    data.rows.forEach((r, i) => {
        const date   = r.refused_at
            ? new Date(r.refused_at).toLocaleDateString("fr-FR")
            : "Date inconnue";
        const reason = r.reason ? `  •  Raison : ${r.reason}` : "";
        txt += `${i + 1}) 👤 **${r.name || "Candidat"}**  📅 ${date}${reason}\n`;
    });
    return txt.trimEnd();
}

function formatContact(data) {
    if (data.error) return data.error;
    if (!data.rows?.length) return "Candidat introuvable.";
    const c = data.rows[0];
    return `📋 **Contact — ${c.name || "Candidat"}**\n\n`
        + `📧 Email : ${c.email   || "non renseigné"}\n`
        + `📞 Tél.  : ${c.phone   || "non renseigné"}\n`
        + `📍 Adresse : ${c.address || "non renseignée"}`;
}

function formatFeedback(msg, ctx) {
    const name = ctx.candidate_name || "ce candidat";
    const job  = ctx.job_title      || "ce poste";
    return `Merci pour cette correction ! 🙏\n\n`
        + `Je note que **${name}** ne semble pas correspondre au profil attendu pour **${job}**.\n\n`
        + `Mon évaluation se base sur le score de matching calculé depuis le CV.\n`
        + `Si le résultat est inexact, cela peut venir d'un CV peu détaillé ou de mots-clés insuffisants.\n\n`
        + `💡 Voulez-vous voir d'autres candidats pour **${job}** ?`;
}

function buildHelp(ctx) {
    const j = ctx.job_title ? ` pour **${ctx.job_title}**` : " pour [poste]";
    return `Je suis votre assistant RH. Voici ce que je comprends :\n\n`
        + `🎯 **Recommandations** — "Recommande des candidats${j}"\n`
        + `📊 **Expérience** — "Qui a le plus d'expérience${j} ?"\n`
        + `🔍 **Détail candidat** — "Détail Omar BENHADDOU"\n`
        + `📨 **Candidatures** — "Qui a postulé ?"\n`
        + `✅ **Admis** — "Montre les candidats admis"\n`
        + `❌ **Refusés** — "Liste les candidats refusés"\n`
        + `📈 **Statistiques** — "Statistiques globales"\n`
        + `📞 **Contact** — "Quel est l'email de [candidat] ?"\n\n`
        + `Posez votre question librement, je comprends le langage naturel !`;
}


/* ============================================================
   POINT D'ENTRÉE PRINCIPAL
   ============================================================ */

exports.processMessage = async (data) => {
    const { message, sessionId = "default" } = data;

    if (!message || typeof message !== "string" || !message.trim()) {
        return { answer: "Votre message est vide. Posez votre question RH.", intent: "general" };
    }

    const ctx    = await loadCtx(sessionId);
    const intent = await detectIntent(message);

    // Pour détail/contact, on ne force PAS le job du contexte :
    // "email de Omar" ne doit pas utiliser le job précédent pour filtrer
    const noJobCtxIntents = ["candidate_detail", "explain_candidate", "candidate_contact"];
    const useJobCtx = !noJobCtxIntents.includes(intent);

    const [job, candidate] = await Promise.all([
        extractJob(message, ctx.job_id, useJobCtx),
        extractCandidate(message, ctx.candidate_id)
    ]);

    const patch = {};
    if (job       && job.id       !== ctx.job_id)       { patch.job_id = job.id; patch.job_title = job.title; }
    if (candidate && candidate.id !== ctx.candidate_id) { patch.candidate_id = candidate.id; patch.candidate_name = candidate.name; }

    let answer;

    switch (intent) {

        case "recommend_candidate":
        case "list":
        case "search_job": {
            // Si pas de job trouvé du tout, expliquer clairement
            if (!job) {
                answer = `Précisez le nom du poste, ex : 'Recommande des candidats pour Ingénieur Production'.`;
                break;
            }
            const result = await (intent === "list" ? listCandidates(job) : recommendCandidates(job));
            answer = formatRecommendations(result);
            if (result.rows?.[0]) {
                patch.candidate_id   = result.rows[0].id;
                patch.candidate_name = result.rows[0].name;
            }
            break;
        }

        case "compare_experience": {
            // job peut être null → classement global
            const result = await compareExperience(job);
            answer = formatExperience(result);
            if (result.rows?.[0]) {
                patch.candidate_id   = result.rows[0].id;
                patch.candidate_name = result.rows[0].name;
            }
            break;
        }

        case "explain_candidate":
        case "candidate_detail": {
            // Chercher le candidat dans le message en priorité, puis contexte
            const result = await explainCandidate(candidate, job);
            answer = formatDetail(result);
            break;
        }

        case "stats": {
            const result = await getStats(job);
            answer = formatStats(result);
            break;
        }

        case "applications": {
            // Pour candidatures : chercher le job dans le message UNIQUEMENT
            // Ne pas utiliser le contexte job pour éviter les faux positifs
            const jobForApp = await extractJob(message, null, false);
            const result    = await getApplications(jobForApp);
            answer = formatApplications(result);
            break;
        }

        case "admis": {
            const result = await getAdmis();
            answer = formatAdmis(result);
            break;
        }

        case "refuses": {
            const result = await getRefuses();
            answer = formatRefuses(result);
            break;
        }

        case "candidate_contact": {
            // Contact : on utilise le candidat trouvé dans le message OU le contexte
            const result = await getCandidateContact(candidate);
            answer = formatContact(result);
            break;
        }

        case "user_feedback":
            answer = formatFeedback(message, { ...ctx, ...patch });
            break;

        default:
            answer = buildHelp({ ...ctx, ...patch });
    }

    if (Object.keys(patch).length) await saveCtx(sessionId, patch);

    await saveHistory(
        sessionId, message, answer,
        patch.candidate_id || ctx.candidate_id,
        patch.job_id       || ctx.job_id
    );

    return { answer, intent };
};


/* ============================================================
   HISTORIQUE & SESSIONS
   ============================================================ */

exports.getHistory = async (sessionId) => {
    try {
        const { rows } = await pool.query(`
            SELECT user_message, bot_response, candidate_id, job_id, created_at
            FROM chatbot_history
            WHERE session_id = $1
            ORDER BY created_at ASC
        `, [sessionId]);
        return rows;
    } catch { return []; }
};

exports.getSessions = async () => {
    try {
        const { rows } = await pool.query(`
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
        return rows;
    } catch { return []; }
};

async function saveHistory(sessionId, userMessage, botResponse, candidateId, jobId) {
    try {
        await pool.query(`
            INSERT INTO chatbot_history
                (session_id, user_message, bot_response, candidate_id, job_id)
            VALUES ($1,$2,$3,$4,$5)
        `, [sessionId, userMessage, botResponse, candidateId||null, jobId||null]);
    } catch (err) {
        console.log("Erreur historique:", err.message);
    }
}