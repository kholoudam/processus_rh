// match.service.js
// ================
// Matching candidat ↔ job LIÉ uniquement à sa candidature
//
// Pipeline :
//   candidate → application → email.subject → job (similarité titre)
//   Score pondéré :  Skills 60% | Expérience 25% | Éducation 15%

const db = require("../config/db")

// ─── Normalisation ─────────────────────────────────────────
const norm = (s = "") => s.toLowerCase().trim().replace(/\s+/g, " ")

// ─── Similarité titre job / sujet email ────────────────────
// On compte les mots en commun (longueur > 2) entre les deux textes.
// Ex: subject="Candidature Ingénieur Production" + title="Ingénieur de Production"
//     → mots communs: ["ingénieur","production"] → sim = 2/3 = 0.66
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
// Cherche parmi tous les jobs celui dont le titre ressemble
// le plus au sujet de l'email de candidature.
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

  // Seuil minimum : au moins 1 mot significatif en commun (>0)
  return bestScore > 0 ? bestJob : null
}

// ─── Score skills (0-100) ──────────────────────────────────
// Compte le nombre de skills du job retrouvés chez le candidat.
function scoreSkills(candidateSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) return 50
  if (!candidateSkills || candidateSkills.length === 0) return 0
  const matches = jobSkills.filter(js =>
    candidateSkills.some(
      cs => norm(cs) === norm(js) || norm(cs).includes(norm(js)) || norm(js).includes(norm(cs))
    )
  ).length
  return Math.round((matches / jobSkills.length) * 100)
}

// ─── Score expérience (0-100) ──────────────────────────────
// Compare le nb de postes occupés vs le nb d'années requises dans le job.
function scoreExperience(experienceRows, experienceRequired) {
  const count = experienceRows?.length || 0
  if (!experienceRequired) return count > 0 ? 70 : 30
  const m = experienceRequired.match(/(\d+)/)
  if (!m) return count > 0 ? 60 : 30
  const required = parseInt(m[1])
  if (count === 0)            return 0
  if (count >= required)      return 100
  if (count >= required - 1)  return 70
  return 40
}

// ─── Score éducation (0-100) ──────────────────────────────
const EDU_RANK = {
  "bac": 1, "bac+1": 2, "bts": 2, "dut": 2,
  "bac+2": 2, "bac+3": 3, "licence": 3, "bachelor": 3,
  "bac+4": 4, "bac+5": 5, "master": 5, "ingénieur": 5, "mba": 5,
  "doctorat": 6, "phd": 6,
}

function eduRank(str = "") {
  const s = norm(str)
  for (const [key, rank] of Object.entries(EDU_RANK)) {
    if (s.includes(key)) return rank
  }
  return 0
}

function scoreEducation(educationRows, educationRequired) {
  if (!educationRequired) return 60
  const required = eduRank(educationRequired)
  if (required === 0) return 60
  const best = Math.max(0, ...(educationRows || []).map(e => eduRank(e.degree || "")))
  if (best === 0)             return 10
  if (best >= required)       return 100
  if (best === required - 1)  return 65
  return 30
}

// ─── Score global pondéré ──────────────────────────────────
function computeScore(s, e, edu) {
  return Math.round(s * 0.60 + e * 0.25 + edu * 0.15)
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

      const j               = jobRes.rows[0]
      const candidateSkills = skillsRes.rows.map(r => r.skill_name)
      const experiences     = expRes.rows
      const educations      = eduRes.rows

      // 3. Calculer les 3 scores
      const s_skills  = scoreSkills(candidateSkills, j.skills || [])
      const s_exp     = scoreExperience(experiences,  j.experience_required)
      const s_edu     = scoreEducation(educations,    j.education_level)
      const total     = computeScore(s_skills, s_exp, s_edu)

      console.log(
        `  [MATCH] ${app.candidate_id} → job "${j.title}" | ` +
        `skills=${s_skills}% exp=${s_exp}% edu=${s_edu}% → total=${total}%`
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