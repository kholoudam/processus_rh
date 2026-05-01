const pool = require("../config/db")
const natural = require("natural")

const TfIdf = natural.TfIdf

exports.matchCandidates = async () => {
  try {

    // =========================
    // 1. FETCH DATA (FIX TABLE NAMES)
    // =========================
    const jobsRes = await pool.query(`
      SELECT id, title, COALESCE(description,'') as description
      FROM job
    `)

    const candidatesRes = await pool.query(`
      SELECT id, name
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
    // DEBUG (IMPORTANT)
    // =========================
    console.log("JOBS:", jobsRes.rows.length)
    console.log("CANDIDATES:", candidatesRes.rows.length)
    console.log("SKILLS:", skillsRes.rows.length)

    if (jobsRes.rows.length === 0) {
      console.log("❌ AUCUN JOB EN BASE")
      return []
    }

    // =========================
    // 2. BUILD MAPS
    // =========================
    const skillsMap = buildMap(skillsRes.rows, "candidate_id")
    const expMap    = buildMap(expRes.rows, "candidate_id")
    const eduMap    = buildMap(eduRes.rows, "candidate_id")

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
      const exps   = (expMap[c.id] || []).map(e => e.position).join(" ")
      const edus   = (eduMap[c.id] || []).map(e => e.degree).join(" ")

      const text = normalize(`${skills} ${exps} ${edus}`)

      documents.push({ type: "candidate", id: c.id, text })
      tfidf.addDocument(text)
    }

    // =========================
    // 4. COSINE SIMILARITY
    // =========================
    const results = []

    const jobDocs = documents.filter(d => d.type === "job")
    const candDocs = documents.filter(d => d.type === "candidate")

    for (let jIndex = 0; jIndex < jobDocs.length; jIndex++) {

      for (let cIndex = 0; cIndex < candDocs.length; cIndex++) {

        const similarity = cosineSimilarity(
          tfidf.listTerms(jIndex),
          tfidf.listTerms(jobDocs.length + cIndex)
        )

        results.push({
          jobId: jobDocs[jIndex].id,
          candidateId: candDocs[cIndex].id,
          score: Number(similarity.toFixed(3))
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)

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

  let dot = 0
  let magA = 0
  let magB = 0

  for (let term of allTerms) {
    const a = mapA[term] || 0
    const b = mapB[term] || 0

    dot += a * b
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
}