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
   RÉFÉRENTIELS MÉTIER
   Chaque poste a :
     - keywords   : mots-clés techniques du domaine
     - levels     : niveaux d'études acceptés (Bac+2, Bac+3, Bac+5…)
     - positions  : intitulés de postes d'expérience associés
   Ces référentiels permettent le matching même quand la
   description du job est courte.
========================================================= */
const JOB_REFERENTIALS = {
  "preparateur methodes": {
    keywords: [
      "catia", "solidworks", "autocad", "cfao", "fao", "sap", "amdec",
      "gamme", "nomenclature", "industrialisation", "lean", "kaizen",
      "methode", "process", "fabrication", "composites", "usinage",
      "cablage", "ewis", "nadcap", "en9100", "easa", "5s", "vam", "vsm",
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
      "sap pm", "vibration", "lubrification", "graissage", "habilitation",
      "iso", "lean", "5s", "tpm", "fiabilite"
    ],
    levels: ["bac+2", "bts", "dut", "licence", "bac+3"],
    positions: [
      "technicien maintenance", "technicien electromecanique",
      "agent maintenance industrielle", "technicien automatisme",
      "technicien instrumentation", "technicien de maintenance"
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
      "audit", "risque", "duerp", "dossier", "prevention", "formation",
      "incident", "accident", "epi", "permis feu", "plan prevention",
      "gestion dechets", "reglementaire"
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
      "sirh", "paie", "contrat", "droit social", "relations sociales",
      "gestion talents", "onboarding", "performance", "evaluation"
    ],
    levels: ["bac+5", "master"],
    positions: ["hrbp", "responsable rh", "charge rh", "drh", "hr manager", "rh generaliste"]
  },

  "coordinateur pic pdp": {
    keywords: [
      "supply chain", "logistique", "planification", "s&op", "pic", "pdp",
      "sap", "excel", "mrp", "approvisionnement", "stock", "flux",
      "ordonnancement", "prevision", "demande"
    ],
    levels: ["bac+5", "master", "licence", "bac+3"],
    positions: [
      "coordinateur planification", "planificateur", "supply chain",
      "gestionnaire production", "ordonnanceur"
    ]
  },

  "reap responsable equipe autonome de production": {
    keywords: [
      "lean", "production", "management equipe", "amelioration continue",
      "kpi", "trs", "oee", "5s", "kaizen", "smed", "tpm", "securite",
      "qualite", "performance", "animation equipe", "aéronautique", "automobile"
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
   Cherche le référentiel le plus proche du titre du poste.
========================= */
function findReferential(jobTitle) {
  const normTitle = normalize(jobTitle);

  // Correspondance exacte
  if (JOB_REFERENTIALS[normTitle]) return JOB_REFERENTIALS[normTitle];

  // Correspondance partielle : on prend la clé qui partage le plus de mots
  let bestKey = null;
  let bestScore = 0;

  for (const key of Object.keys(JOB_REFERENTIALS)) {
    const keyWords = key.split(" ").filter(w => w.length >= 4);
    const hits = keyWords.filter(w => normTitle.includes(w)).length;
    if (hits > bestScore) {
      bestScore = hits;
      bestKey = key;
    }
  }

  return bestScore >= 1 ? JOB_REFERENTIALS[bestKey] : null;
}

/* =========================
   FIND MATCHING JOB
   Correspondance souple sujet → poste
========================= */
function findMatchingJob(subject, jobs) {
  if (!subject) return null;

  const cleanSubject = normalize(
    subject
      .replace(/candidature\s*(spontanee|spontanée)?/gi, "")
      .replace(/objet\s*:/gi, "")
      .replace(/[-_:|&]/g, " ")
  );

  // 1. Titre exact dans le sujet
  let found = jobs.find(j => cleanSubject.includes(normalize(j.title)));
  if (found) return found;

  // 2. Tous les mots significatifs (≥4 car.) du titre dans le sujet
  found = jobs.find(j =>
    normalize(j.title).split(" ").filter(w => w.length >= 4).every(w => cleanSubject.includes(w))
  );
  if (found) return found;

  // 3. Partiel : meilleur score (≥ 2 mots matchés)
  const scored = jobs
    .map(j => {
      const words = normalize(j.title).split(" ").filter(w => w.length >= 4);
      const hits  = words.filter(w => cleanSubject.includes(w)).length;
      return { job: j, hits, total: words.length };
    })
    .filter(x => x.hits >= Math.min(2, x.total))
    .sort((a, b) => b.hits - a.hits);

  return scored.length ? scored[0].job : null;
}

/* =========================
   BUILD MAP  { key => [rows] }
========================= */
function buildMap(rows, key) {
  const map = {};
  rows.forEach(r => {
    if (!map[r[key]]) map[r[key]] = [];
    map[r[key]].push(r);
  });
  return map;
}

/* =========================================================
   SCORING MULTI-DIMENSIONNEL
   Poids : Skills 40% | Expérience 35% | Éducation 25%

   Pour chaque dimension on calcule un score 0→100 en
   comparant les données du candidat contre le référentiel
   du poste (keywords, levels, positions).
========================================================= */

/**
 * Score SKILLS (40%)
 * Proportion des skills du candidat qui matchent les keywords du référentiel.
 */
function scoreSkills(candidateSkills, ref) {
  if (!candidateSkills.length || !ref) return 0;

  const matched = candidateSkills.filter(skill => {
    const normSkill = normalize(skill);
    return ref.keywords.some(kw => normSkill.includes(kw) || kw.includes(normSkill));
  });

  return Math.round((matched.length / candidateSkills.length) * 100);
}

/**
 * Score EXPÉRIENCE (35%)
 * Vérifie si les intitulés de postes du candidat correspondent
 * aux positions attendues pour ce référentiel.
 */
function scoreExperience(candidateExp, ref) {
  if (!candidateExp.length || !ref) return 0;

  const matched = candidateExp.filter(pos => {
    const normPos = normalize(pos);
    return ref.positions.some(rp => {
      const normRp = normalize(rp);
      // Correspondance souple : partage d'au moins 1 mot-clé significatif (≥5 car.)
      const rpWords = normRp.split(" ").filter(w => w.length >= 5);
      return rpWords.some(w => normPos.includes(w)) || normPos.includes(normRp);
    });
  });

  // Score basé sur la proportion de postes matchés (plafonné à 100)
  return Math.min(100, Math.round((matched.length / candidateExp.length) * 100));
}

/**
 * Score ÉDUCATION (25%)
 * Vérifie si le niveau d'études du candidat correspond
 * au niveau attendu par le poste.
 */
function scoreEducation(candidateEdu, ref) {
  if (!candidateEdu.length || !ref) return 0;

  // Mapping niveau → valeur numérique
  const LEVEL_VALUES = {
    "bac":      1,
    "bts":      2, "dut": 2, "bac+2": 2,
    "licence":  3, "bac+3": 3,
    "master":   5, "bac+5": 5,
    "ingenieur": 5, "diplome ingenieur": 5,
    "doctorat": 6
  };

  // Niveau minimum requis par le poste
  const requiredLevels = ref.levels.map(l => LEVEL_VALUES[normalize(l)] || 0);
  const minRequired    = requiredLevels.length ? Math.min(...requiredLevels) : 0;

  // Niveau maximum du candidat
  let candidateMax = 0;
  for (const deg of candidateEdu) {
    const normDeg = normalize(deg);
    for (const [key, val] of Object.entries(LEVEL_VALUES)) {
      if (normDeg.includes(key) && val > candidateMax) {
        candidateMax = val;
      }
    }
  }

  if (candidateMax === 0) return 0;

  // Score
  if (candidateMax >= minRequired) return 100;
  if (candidateMax === minRequired - 1) return 60; // légèrement sous le niveau requis
  return 30; // très en dessous
}

/* =========================
   MATCH CANDIDATES
========================= */
exports.matchCandidates = async () => {
  try {
    const jobsRes = await pool.query(`
      SELECT id, title, COALESCE(description, '') AS description FROM job
    `);

    const candidatesRes = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        e.subject
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email       e ON e.id = a.email_id
      WHERE c.status NOT IN ('ACCEPTED', 'REJECTED')
    `);

    const skillsRes = await pool.query(`SELECT candidate_id, skill_name FROM candidate_skill`);
    const expRes    = await pool.query(`SELECT candidate_id, position     FROM experience`);
    const eduRes    = await pool.query(`SELECT candidate_id, degree       FROM education`);

    const skillsMap = buildMap(skillsRes.rows, "candidate_id");
    const expMap    = buildMap(expRes.rows,    "candidate_id");
    const eduMap    = buildMap(eduRes.rows,    "candidate_id");

    const results = [];

    for (const candidate of candidatesRes.rows) {
      const targetJob = findMatchingJob(candidate.subject, jobsRes.rows);
      if (!targetJob) continue;

      const ref = findReferential(targetJob.title);

      const candidateSkills = (skillsMap[candidate.id] || []).map(s => s.skill_name).filter(Boolean);
      const candidateExp    = (expMap[candidate.id]    || []).map(e => e.position).filter(Boolean);
      const candidateEdu    = (eduMap[candidate.id]    || []).map(e => e.degree).filter(Boolean);

      // ── Scores par dimension ─────────────────────────────────────────
      const sSkills  = scoreSkills(candidateSkills, ref);     // /100
      const sExp     = scoreExperience(candidateExp, ref);    // /100
      const sEdu     = scoreEducation(candidateEdu, ref);     // /100

      // ── Score global pondéré ─────────────────────────────────────────
      const score = Math.round(
        sSkills * 0.40 +
        sExp    * 0.35 +
        sEdu    * 0.25
      );

      // ── Items matchés pour l'affichage ───────────────────────────────
      const matchedSkills = ref
        ? candidateSkills.filter(skill => {
            const ns = normalize(skill);
            return ref.keywords.some(kw => ns.includes(kw) || kw.includes(ns));
          })
        : [];

      results.push({
        jobId:          targetJob.id,
        jobTitle:       targetJob.title,
        candidateId:    candidate.id,
        candidateName:  candidate.name,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        score,
        scoreDetail: {
          skills:     sSkills,
          experience: sExp,
          education:  sEdu
        },
        matchedItems: [...new Set(matchedSkills)].slice(0, 8)
      });
    }

    return results.sort((a, b) => b.score - a.score);

  } catch (err) {
    console.error("MATCH ERROR:", err);
    throw err;
  }
};