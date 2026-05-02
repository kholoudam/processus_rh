const pool = require("../config/db")
const natural = require("natural")

const TfIdf = natural.TfIdf

exports.matchCandidates = async () => {
  try {

    // =========================
    // 1. FETCH DATA
    // =========================
    const jobsRes = await pool.query(`
      SELECT id, title, COALESCE(description,'') as description
      FROM job
    `)

    const candidatesRes = await pool.query(`
      SELECT id, name, email, phone
      FROM candidate
      WHERE status NOT IN ('ACCEPTED','REJECTED')
    `)

    const skillsRes = await pool.query(`
      SELECT candidate_id, skill_name FROM candidate_skill
    `)

    const expRes = await pool.query(`
      SELECT candidate_id, position FROM experience
    `)

    const eduRes = await pool.query(`
      SELECT candidate_id, degree FROM education
    `)

    // =========================
    // DEBUG
    // =========================
    console.log("JOBS:", jobsRes.rows.length)
    console.log("CANDIDATES:", candidatesRes.rows.length)
    console.log("SKILLS:", skillsRes.rows.length)

    if (jobsRes.rows.length === 0 || candidatesRes.rows.length === 0) {
      console.log("❌ Pas de jobs ou de candidats en base")
      return []
    }

    // =========================
    // 2. BUILD MAPS
    // =========================
    const skillsMap = buildMap(skillsRes.rows, "candidate_id")
    const expMap    = buildMap(expRes.rows, "candidate_id")
    const eduMap    = buildMap(eduRes.rows, "candidate_id")

    // Map rapide job/candidate par id
    const jobMap       = {}
    const candidateMap = {}
    jobsRes.rows.forEach(j => jobMap[j.id] = j)
    candidatesRes.rows.forEach(c => candidateMap[c.id] = c)

    // =========================
    // 3. TF-IDF
    // =========================
    const tfidf = new TfIdf()
    const documents = []

    // JOB DOCS
    for (let j of jobsRes.rows) {
      const text = normalize(j.title + " " + j.description)
      documents.push({ type: "job", id: j.id, text })
      tfidf.addDocument(text)
    }

    // CANDIDATE DOCS
    for (let c of candidatesRes.rows) {
      const skills = (skillsMap[c.id] || []).map(s => s.skill_name).join(" ")
      const exps   = (expMap[c.id]    || []).map(e => e.position).join(" ")
      const edus   = (eduMap[c.id]    || []).map(e => e.degree).join(" ")

      const text = normalize(`${skills} ${exps} ${edus}`)
      documents.push({ type: "candidate", id: c.id, text })
      tfidf.addDocument(text)
    }

    // =========================
    // 4. COSINE SIMILARITY
    // =========================
    const results = []

    const jobDocs  = documents.filter(d => d.type === "job")
    const candDocs = documents.filter(d => d.type === "candidate")

    for (let jIndex = 0; jIndex < jobDocs.length; jIndex++) {
      const job = jobMap[jobDocs[jIndex].id]

      for (let cIndex = 0; cIndex < candDocs.length; cIndex++) {
        const candidate = candidateMap[candDocs[cIndex].id]

        const similarity = cosineSimilarity(
          tfidf.listTerms(jIndex),
          tfidf.listTerms(jobDocs.length + cIndex)
        )

        // ── Éléments matchés : termes communs entre job et candidat ──
        const jobTerms  = new Set(tfidf.listTerms(jIndex).map(t => t.term))
        const candTerms = tfidf.listTerms(jobDocs.length + cIndex).map(t => t.term)
        const matched   = candTerms
          .filter(t => jobTerms.has(t))
          .slice(0, 6) // max 6 tags affichés

        results.push({
          jobId:          job.id,
          jobTitle:       job.title,
          candidateId:    candidate.id,
          candidateName:  candidate.name,
          candidateEmail: candidate.email  || '',
          candidatePhone: candidate.phone  || '',
          score:          Number(similarity.toFixed(3)),
          matchedItems:   matched
        })
      }
    }

    // =========================
    // 5. TRI + CALCUL maxScore
    // =========================
    const sorted = results.sort((a, b) => b.score - a.score)

    const maxScore = sorted.length > 0 ? sorted[0].score : 0

    // On normalise le score en pourcentage lisible (0–100)
    return sorted.map(r => ({
      ...r,
      scorePercent: maxScore > 0 ? Math.round((r.score / maxScore) * 100) : 0
    }))

  } catch (err) {
    console.error("❌ MATCH ERROR:", err)
    throw err
  }
}

// =========================
// COSINE
// =========================
function cosineSimilarity(vecA, vecB) {
  const mapA = {}
  const mapB = {}

  vecA.forEach(t => mapA[t.term] = t.tfidf)
  vecB.forEach(t => mapB[t.term] = t.tfidf)

  const allTerms = new Set([...Object.keys(mapA), ...Object.keys(mapB)])

  let dot = 0, magA = 0, magB = 0

  for (let term of allTerms) {
    const a = mapA[term] || 0
    const b = mapB[term] || 0
    dot  += a * b
    magA += a * a
    magB += b * b
  }

  if (magA === 0 || magB === 0) return 0

  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// =========================
// HELPERS
// =========================
function buildMap(rows, key) {
  const map = {}
  rows.forEach(r => {
    if (!map[r[key]]) map[r[key]] = []
    map[r[key]].push(r)
  })
  return map
}

function normalize(str) {
  if (!str) return ""
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}