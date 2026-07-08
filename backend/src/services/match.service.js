// match.service.js
// ================
// Matching candidat ↔ job LIÉ uniquement à sa candidature
//
// Pipeline :
//   candidate → application → email.subject → job (similarité titre)
//   Score sémantique : embeddings (Sentence Transformers) + Cosine Similarity
//   Modèle : paraphrase-multilingual-MiniLM-L12-v2
//   (remplace l'ancien score pondéré Skills 60% | Expérience 25% | Éducation 15%)

const db = require("../config/db")
const axios = require("axios")

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:5003"

// ─── Normalisation ─────────────────────────────────────────
const norm = (s = "") => s.toLowerCase().trim().replace(/\s+/g, " ")

// ─── Similarité titre job / sujet email ────────────────────
// Utilisée uniquement pour retrouver le job auquel le candidat a
// postulé (association candidature → offre) — inchangée, ne fait
// pas partie du calcul du score de matching lui-même.
function similarity(titleStr, subjectStr) {
  const titleWords   = norm(titleStr).split(/\s+/).filter(w => w.length > 2)
  const subjectWords = norm(subjectStr).split(/\s+/).filter(w => w.length > 2)
  if (!titleWords.length) return 0
  const common = titleWords.filter(tw =>
    subjectWords.some(sw => sw.includes(tw) || tw.includes(sw))
  ).length
  return common / titleWords.length
}

// ─── Trouver le job d'une candidature ──────────────────────
async function findJobForApplication(client, emailSubject) {
  if (!emailSubject || !emailSubject.trim()) return null

  const jobs = await client.query("SELECT id, title FROM job")
  let bestJob   = null
  let bestScore = 0

  for (const job of jobs.rows) {
    const sim = similarity(job.title, emailSubject)
    if (sim > bestScore) {
      bestScore = sim
      bestJob   = job
    }
  }

  return bestScore > 0 ? bestJob : null
}

// ─── Score sémantique via microservice d'embeddings ────────
// Appelle POST /match sur le microservice Flask (port 5003) en temps
// réel : encode le texte candidat et le texte offre, calcule la
// cosine similarity, retourne un score 0-100.
async function computeSemanticScore(candidatePayload, jobPayload) {
  try {
    const { data } = await axios.post(
      `${EMBEDDING_SERVICE_URL}/match`,
      { candidate: candidatePayload, job: jobPayload },
      { timeout: 15000 }
    )
    return data.score
  } catch (err) {
    console.error(
      "  [MATCH] Erreur appel embedding service:",
      err.response?.data?.error || err.message
    )
    // En cas d'échec du microservice, on ne masque pas l'erreur avec un
    // score arbitraire — on renvoie null pour que l'appelant décide
    // (ex: passer ce candidat plutôt que stocker une fausse valeur).
    return null
  }
}

// ─── Génération matching ───────────────────────────────────
async function generateMatching() {
  const client = await db.connect()

  try {
    // Récupérer toutes les candidatures (hors admis et refusés)
    // avec le sujet de l'email pour identifier le poste postulé
    const applications = await client.query(`
      SELECT
        a.candidate_id,
        e.subject AS email_subject
      FROM application a
      LEFT JOIN email e ON e.id = a.email_id
      WHERE NOT EXISTS (SELECT 1 FROM admis   ad WHERE ad.candidate_id = a.candidate_id)
        AND NOT EXISTS (SELECT 1 FROM refuses rf WHERE rf.candidate_id = a.candidate_id)
    `)

    for (const app of applications.rows) {

      // 1. Trouver le job correspondant à ce candidat via le sujet de son email
      const job = await findJobForApplication(client, app.email_subject)
      if (!job) {
        console.log(`  [MATCH] Aucun job trouvé pour sujet: "${app.email_subject}"`)
        continue
      }

      // 2. Récupérer toutes les données du candidat
      const [skillsRes, expRes, eduRes, jobRes] = await Promise.all([
        client.query("SELECT skill_name FROM candidate_skill WHERE candidate_id = $1", [app.candidate_id]),
        client.query("SELECT * FROM experience WHERE candidate_id = $1",               [app.candidate_id]),
        client.query("SELECT * FROM education  WHERE candidate_id = $1",               [app.candidate_id]),
        client.query("SELECT * FROM job WHERE id = $1",                                [job.id]),
      ])

      const j = jobRes.rows[0]

      const candidatePayload = {
        skills: skillsRes.rows.map(r => r.skill_name),
        experience: expRes.rows.map(r => ({
          position: r.position,
          company:  r.company,
          duration: r.duration,
        })),
        education: eduRes.rows.map(r => ({
          degree:      r.degree,
          institution: r.institution,
        })),
      }

      const jobPayload = {
        title:                j.title,
        description:          j.description,
        skills:               j.skills || [],
        experience_required:  j.experience_required,
        education_level:      j.education_level,
      }

      // 3. Calculer le score sémantique en temps réel via le microservice
      const total = await computeSemanticScore(candidatePayload, jobPayload)

      if (total === null) {
        console.log(`  [MATCH] Score non calculé (service indisponible) pour candidat ${app.candidate_id}`)
        continue
      }

      console.log(
        `  [MATCH] ${app.candidate_id} → job "${j.title}" | score sémantique=${total}%`
      )

      // 4. Upsert dans matching — un seul enregistrement par paire (candidat, job)
      await client.query(`
        INSERT INTO matching (candidate_id, job_id, score)
        VALUES ($1, $2, $3)
        ON CONFLICT (candidate_id, job_id)
        DO UPDATE SET score = EXCLUDED.score, created_at = NOW()
      `, [app.candidate_id, j.id, total])
    }

    return true

  } catch (err) {
    console.error("MATCHING ERROR:", err)
    throw err
  } finally {
    client.release()
  }
}

module.exports = { generateMatching }