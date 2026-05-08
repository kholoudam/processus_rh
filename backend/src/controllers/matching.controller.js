const pool = require("../config/db");

/* =========================
   NORMALIZE
========================= */
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   RÉFÉRENTIELS MÉTIER (identiques à match.service.js)
========================================================= */
const JOB_REFERENTIALS = {
  "preparateur methodes": {
    keywords: [
      "catia", "solidworks", "autocad", "cfao", "fao", "sap", "amdec",
      "gamme", "nomenclature", "industrialisation", "lean", "kaizen",
      "methode", "process", "fabrication", "composites", "usinage",
      "cablage", "ewis", "nadcap", "en9100", "easa", "5s", "vsm",
      "mastercam", "nx", "siemens", "fibersim", "laminate", "ansys"
    ],
    levels: ["bac+2", "bts", "dut", "licence", "bac+3", "bac+5", "master", "ingenieur"],
    positions: [
      "preparateur methodes", "technicien methodes", "assistant industrialisation",
      "ingenieur methodes", "ingenieur process", "charge affaires"
    ]
  },

  "technicien moyens generaux": {
    keywords: [
      "facility", "hvac", "cvc", "climatisation", "plomberie", "electricite",
      "electrique", "maintenance", "batiment", "infrastructure", "gmao", "sap pm",
      "iso 14001", "iso 45001", "hse", "securite", "caces", "habilitation",
      "levage", "manutention", "hydraulique", "pneumatique", "electromecaniq",
      "sprinkler", "ssi", "cctv", "controle acces", "gestion prestataires",
      "budget", "multisite", "autocad"
    ],
    levels: ["bac+2", "bts", "dut", "licence", "bac+3"],
    positions: [
      "technicien moyens generaux", "technicien facilities", "technicien maintenance batiment",
      "agent maintenance", "coordinateur maintenance", "technicien cvc",
      "technicien electromecanique", "responsable moyens generaux"
    ]
  },

  "ingenieur de production": {
    keywords: [
      "lean", "six sigma", "kpi", "ordonnancement", "planification", "production",
      "amelioration continue", "ms project", "sap pp", "sap", "mes", "oee", "trs",
      "takt time", "kaizen", "vsm", "amdec", "5s", "smed", "tpm", "ppap",
      "catia", "power bi", "minitab", "gestion production", "management equipe",
      "performance", "industriel", "genie industriel", "qualite", "8d", "qrqc",
      "airbus", "safran", "renault", "bombardier", "autoclave", "composites"
    ],
    levels: ["bac+5", "master", "ingenieur", "diplome ingenieur"],
    positions: [
      "ingenieur production", "ingenieur process", "responsable ligne",
      "responsable production", "chef equipe", "ingenieur industrialisation",
      "ingenieur amelioration continue", "reap"
    ]
  },

  "technicien maintenance": {
    keywords: [
      "gmao", "maintenance preventive", "maintenance corrective", "hydraulique",
      "pneumatique", "automatisme", "automate", "plc", "diagnostic", "panne",
      "electromecaniq", "variateur", "capteur", "electricite", "mecanique",
      "sap pm", "vibration", "lubrification", "tpm", "fiabilite"
    ],
    levels: ["bac+2", "bts", "dut", "licence", "bac+3"],
    positions: [
      "technicien maintenance", "technicien electromecanique",
      "agent maintenance industrielle", "technicien automatisme",
      "technicien de maintenance"
    ]
  },

  "stagiaire maintenance": {
    keywords: [
      "maintenance", "mecanique", "electricite", "hydraulique", "pneumatique",
      "gmao", "diagnostic", "electromecaniq", "automatisme"
    ],
    levels: ["bac+2", "bts", "dut", "licence", "bac+3"],
    positions: ["stagiaire", "stage", "technicien maintenance", "technicien"]
  },

  "coordinateur hse": {
    keywords: [
      "hse", "qhse", "securite", "environnement", "iso 14001", "iso 45001",
      "audit", "risque", "duerp", "prevention", "formation", "incident",
      "accident", "epi", "permis feu", "plan prevention", "gestion dechets"
    ],
    levels: ["bac+5", "master", "ingenieur"],
    positions: [
      "coordinateur hse", "responsable hse", "ingenieur hse", "qhse",
      "charge hse", "technicien hse"
    ]
  },

  "hrbp": {
    keywords: [
      "rh", "ressources humaines", "recrutement", "formation", "gpec",
      "sirh", "paie", "contrat", "droit social", "gestion talents", "onboarding"
    ],
    levels: ["bac+5", "master"],
    positions: ["hrbp", "responsable rh", "charge rh", "drh", "hr manager", "rh generaliste"]
  },

  "coordinateur pic pdp": {
    keywords: [
      "supply chain", "logistique", "planification", "s&op", "pic", "pdp",
      "sap", "excel", "mrp", "approvisionnement", "stock", "ordonnancement"
    ],
    levels: ["bac+5", "master", "licence", "bac+3"],
    positions: ["coordinateur planification", "planificateur", "supply chain", "ordonnanceur"]
  },

  "reap responsable equipe autonome de production": {
    keywords: [
      "lean", "production", "management equipe", "amelioration continue",
      "kpi", "trs", "oee", "5s", "kaizen", "smed", "tpm", "securite", "qualite"
    ],
    levels: ["bac+3", "bac+5", "master", "ingenieur", "licence"],
    positions: [
      "responsable equipe", "reap", "chef equipe", "team leader",
      "responsable production", "superviseur", "responsable ligne"
    ]
  }
};

/* =========================
   FIND JOB REFERENTIAL
========================= */
function findReferential(jobTitle) {
  const normTitle = normalize(jobTitle);
  if (JOB_REFERENTIALS[normTitle]) return JOB_REFERENTIALS[normTitle];

  let bestKey = null;
  let bestScore = 0;
  for (const key of Object.keys(JOB_REFERENTIALS)) {
    const keyWords = key.split(" ").filter(w => w.length >= 4);
    const hits = keyWords.filter(w => normTitle.includes(w)).length;
    if (hits > bestScore) { bestScore = hits; bestKey = key; }
  }
  return bestScore >= 1 ? JOB_REFERENTIALS[bestKey] : null;
}

/* =========================
   FIND MATCHING JOB
========================= */
function findMatchingJob(subject, jobs) {
  if (!subject) return null;
  const clean = normalize(
    subject
      .replace(/candidature\s*(spontanee|spontanée)?/gi, "")
      .replace(/objet\s*:/gi, "")
      .replace(/[-_:|&]/g, " ")
  );

  let found = jobs.find(j => clean.includes(normalize(j.title)));
  if (found) return found;

  found = jobs.find(j =>
    normalize(j.title).split(" ").filter(w => w.length >= 4).every(w => clean.includes(w))
  );
  if (found) return found;

  const scored = jobs
    .map(j => {
      const words = normalize(j.title).split(" ").filter(w => w.length >= 4);
      const hits  = words.filter(w => clean.includes(w)).length;
      return { job: j, hits, total: words.length };
    })
    .filter(x => x.hits >= Math.min(2, x.total))
    .sort((a, b) => b.hits - a.hits);

  return scored.length ? scored[0].job : null;
}

/* =========================
   SCORING FONCTIONS
========================= */
const LEVEL_VALUES = {
  "bac": 1,
  "bts": 2, "dut": 2, "bac+2": 2,
  "licence": 3, "bac+3": 3,
  "master": 5, "bac+5": 5,
  "ingenieur": 5, "diplome ingenieur": 5,
  "doctorat": 6
};

function scoreSkills(skills, ref) {
  if (!skills.length || !ref) return 0;
  const matched = skills.filter(s => {
    const ns = normalize(s);
    return ref.keywords.some(kw => ns.includes(kw) || kw.includes(ns));
  });
  return Math.round((matched.length / skills.length) * 100);
}

function scoreExperience(positions, ref) {
  if (!positions.length || !ref) return 0;
  const matched = positions.filter(pos => {
    const np = normalize(pos);
    return ref.positions.some(rp => {
      const nrp = normalize(rp);
      return nrp.split(" ").filter(w => w.length >= 5).some(w => np.includes(w)) || np.includes(nrp);
    });
  });
  return Math.min(100, Math.round((matched.length / positions.length) * 100));
}

function scoreEducation(degrees, ref) {
  if (!degrees.length || !ref) return 0;
  const requiredLevels = ref.levels.map(l => LEVEL_VALUES[normalize(l)] || 0);
  const minRequired    = requiredLevels.length ? Math.min(...requiredLevels) : 0;
  let candidateMax = 0;
  for (const deg of degrees) {
    const nd = normalize(deg);
    for (const [key, val] of Object.entries(LEVEL_VALUES)) {
      if (nd.includes(key) && val > candidateMax) candidateMax = val;
    }
  }
  if (candidateMax === 0) return 0;
  if (candidateMax >= minRequired) return 100;
  if (candidateMax === minRequired - 1) return 60;
  return 30;
}

/* =========================
   GET MATCHING
========================= */
exports.getMatching = async (req, res) => {
  try {
    const jobs = await pool.query(`SELECT id, title, description FROM job`);

    const candidates = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        e.subject
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email       e ON e.id = a.email_id
      WHERE c.status = 'RECEIVED'
    `);

    const skillsRes = await pool.query(`SELECT candidate_id, skill_name FROM candidate_skill`);
    const expRes    = await pool.query(`SELECT candidate_id, position     FROM experience`);
    const eduRes    = await pool.query(`SELECT candidate_id, degree       FROM education`);

    // Maps
    const skillsMap = {}, expMap = {}, eduMap = {};
    skillsRes.rows.forEach(r => { if (!skillsMap[r.candidate_id]) skillsMap[r.candidate_id] = []; skillsMap[r.candidate_id].push(r.skill_name); });
    expRes.rows.forEach(r    => { if (!expMap[r.candidate_id])    expMap[r.candidate_id]    = []; expMap[r.candidate_id].push(r.position); });
    eduRes.rows.forEach(r    => { if (!eduMap[r.candidate_id])    eduMap[r.candidate_id]    = []; eduMap[r.candidate_id].push(r.degree); });

    const results = [];

    for (const candidate of candidates.rows) {
      const matchedJob = findMatchingJob(candidate.subject, jobs.rows);
      if (!matchedJob) continue;

      const ref = findReferential(matchedJob.title);

      const candidateSkills = skillsMap[candidate.id] || [];
      const candidateExp    = expMap[candidate.id]    || [];
      const candidateEdu    = eduMap[candidate.id]    || [];

      const sSkills = scoreSkills(candidateSkills, ref);
      const sExp    = scoreExperience(candidateExp, ref);
      const sEdu    = scoreEducation(candidateEdu, ref);

      const score = Math.round(sSkills * 0.40 + sExp * 0.35 + sEdu * 0.25);

      const matchedSkills = ref
        ? candidateSkills.filter(s => {
            const ns = normalize(s);
            return ref.keywords.some(kw => ns.includes(kw) || kw.includes(ns));
          })
        : [];

      results.push({
        id:        candidate.id,
        name:      candidate.name,
        email:     candidate.email,
        phone:     candidate.phone,
        score,
        scoreDetail: {
          skills:     sSkills,
          experience: sExp,
          education:  sEdu
        },
        skills:    candidateSkills,
        job_title: matchedJob.title
      });
    }

    results.sort((a, b) => b.score - a.score);
    res.json(results);

  } catch (error) {
    console.error("MATCHING ERROR:", error);
    res.status(500).json({ message: "Erreur matching" });
  }
};