const pool = require('../config/db');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Seuil minimum de score pour qu'un candidat refusé soit recommandé
// automatiquement sur un autre poste.
const AUTO_RECOMMEND_MIN_SCORE = 50;

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || 'http://localhost:5003';

// Calcule le score sémantique candidat/job à la volée via le
// microservice d'embeddings (même service que match.service.js).
// Utilisé quand aucune ligne `matching` n'existe déjà pour cette
// paire — typiquement un candidat qui n'a jamais postulé au job
// vers lequel on veut vérifier s'il peut être recommandé.
async function computeSemanticScore(client, candidateId, jobId) {
  const [skillsRes, expRes, eduRes, jobRes] = await Promise.all([
    client.query('SELECT skill_name FROM candidate_skill WHERE candidate_id = $1', [candidateId]),
    client.query('SELECT * FROM experience WHERE candidate_id = $1', [candidateId]),
    client.query('SELECT * FROM education  WHERE candidate_id = $1', [candidateId]),
    client.query('SELECT * FROM job WHERE id = $1', [jobId]),
  ]);

  const j = jobRes.rows[0];
  if (!j) return null;

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
  };

  const jobPayload = {
    title:               j.title,
    description:         j.description,
    skills:              j.skills || [],
    experience_required: j.experience_required,
    education_level:     j.education_level,
  };

  try {
    const { data } = await axios.post(
      `${EMBEDDING_SERVICE_URL}/match`,
      { candidate: candidatePayload, job: jobPayload },
      { timeout: 15000 }
    );
    return data.score;
  } catch (err) {
    console.error(
      '  [AUTO-RECOMMEND] Erreur appel embedding service:',
      err.response?.data?.error || err.message
    );
    return null;
  }
}

exports.getAllCandidatesDetails = async (req, res) => {
  try {

    const candidates = await pool.query(`
      SELECT DISTINCT ON (c.id)
          c.id,
          c.name,
          c.email,
          c.phone,
          c.address,
          e.subject,
          e.body,
          a.status,
          a.applied_date
      FROM candidate c
      LEFT JOIN application a
          ON a.candidate_id = c.id
      LEFT JOIN email e
          ON e.id = a.email_id
      ORDER BY c.id DESC, a.id DESC
    `);

    const data = [];

    for (const candidate of candidates.rows) {

      const skills = await pool.query(
        `SELECT skill_name
         FROM candidate_skill
         WHERE candidate_id = $1`,
        [candidate.id]
      );

      const experience = await pool.query(
        `SELECT *
         FROM experience
         WHERE candidate_id = $1
         ORDER BY id`,
        [candidate.id]
      );

      const education = await pool.query(
        `SELECT *
         FROM education
         WHERE candidate_id = $1
         ORDER BY year DESC NULLS LAST`,
        [candidate.id]
      );

      const attachment = await pool.query(
        `SELECT file_path, type
         FROM attachment
         WHERE candidate_id = $1
         AND (type LIKE '%pdf%' OR file_path LIKE '%.pdf')
         ORDER BY id DESC
         LIMIT 1`,
        [candidate.id]
      );

      data.push({
        candidate,
        skills: skills.rows,
        experience: experience.rows,
        education: education.rows,
        attachment: attachment.rows[0] || null
      });
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur récupération des candidats"
    });
  }
};


/* ===============================
   MAIL CONFIG
=============================== */
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER / EMAIL_PASS manquants');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendMailSafe = async (options) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    await transporter.sendMail(options);
    console.log(`✉️ Mail envoyé à ${options.to}`);
  } catch (err) {
    console.error('Erreur mail :', err.message);
  }
};

/* ===============================
   GET CANDIDATES
=============================== */
exports.getCandidates = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (c.id)
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        a.status,
        a.applied_date,
        e.subject
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      WHERE (a.status NOT IN ('ACCEPTED','REJECTED')
         OR a.status IS NULL)
      ORDER BY c.id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/* ===============================
   GET DETAILS
=============================== */
exports.getCandidateDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const candidate = await pool.query(`
      SELECT
        c.*,
        e.subject,
        e.body,
        a.status,
        a.applied_date
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      WHERE c.id = $1
      ORDER BY a.id DESC
      LIMIT 1
    `, [id]);

    const skills = await pool.query(
      'SELECT skill_name FROM candidate_skill WHERE candidate_id=$1',
      [id]
    );

    const experience = await pool.query(
      'SELECT * FROM experience WHERE candidate_id=$1 ORDER BY id',
      [id]
    );

    const education = await pool.query(
      'SELECT * FROM education WHERE candidate_id=$1 ORDER BY year DESC NULLS LAST',
      [id]
    );

    // Récupérer la pièce jointe PDF (CV)
    const attachment = await pool.query(
      `SELECT file_path, type FROM attachment
       WHERE candidate_id = $1
         AND (type LIKE '%pdf%' OR file_path LIKE '%.pdf')
       ORDER BY id DESC
       LIMIT 1`,
      [id]
    );

    res.json({
      candidate:  candidate.rows[0],
      skills:     skills.rows,
      experience: experience.rows,
      education:  education.rows,
      attachment: attachment.rows[0] || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur détails candidat' });
  }
};

/* ===============================
   ACCEPT
   ---------------------------------------------------------------
   Quand un candidat est accepté pour un poste (jobId) :
     1. Il est inséré dans `admis`.
     2. Tous les AUTRES candidats encore en lice pour CE MÊME poste
        (présents dans `matching` pour ce job_id, ni admis ni déjà
        refusés) sont automatiquement refusés, avec une raison
        générée ("Poste pourvu par un autre candidat").
     3. Pour chacun de ces candidats auto-refusés, si un score de
        matching ≥ AUTO_RECOMMEND_MIN_SCORE existe pour un AUTRE
        poste, une recommandation automatique est créée vers le
        poste où son score est le plus élevé (hors le poste pourvu).
=============================== */
exports.acceptCandidate = async (
  req,
  res
) => {

  const { id } = req.params;
  const { jobId } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Accepter le candidat
    await client.query(
      `
      INSERT INTO admis
      (
        candidate_id
      )
      VALUES ($1)

      ON CONFLICT
      DO NOTHING
    `,
      [id]
    );

    let autoRejected = [];
    let autoRecommended = [];

    // 2. Si on connaît le poste concerné, traiter les autres candidats
    //    encore en lice pour ce même poste.
    if (jobId) {

      const othersRes = await client.query(
        `
        SELECT m.candidate_id, c.name, c.email
        FROM matching m
        JOIN candidate c ON c.id = m.candidate_id
        WHERE m.job_id = $1
          AND m.candidate_id <> $2
          AND NOT EXISTS (SELECT 1 FROM admis   ad WHERE ad.candidate_id = m.candidate_id)
          AND NOT EXISTS (SELECT 1 FROM refuses rf WHERE rf.candidate_id = m.candidate_id)
        `,
        [jobId, id]
      );

      const jobRes = await client.query(
        'SELECT title FROM job WHERE id = $1',
        [jobId]
      );
      const jobTitle = jobRes.rows[0]?.title || 'ce poste';
      const autoReason = `Poste "${jobTitle}" pourvu par un autre candidat`;

      for (const other of othersRes.rows) {

        // 2a. Refuser automatiquement
        await client.query(
          `
          INSERT INTO refuses
          (
            candidate_id,
            reason
          )
          VALUES ($1,$2)

          ON CONFLICT
          (
            candidate_id
          )
          DO NOTHING
        `,
          [other.candidate_id, autoReason]
        );

        autoRejected.push({ id: other.candidate_id, name: other.name });

        // 2b. Chercher le meilleur poste alternatif pour ce candidat.
        //     Étape 1 : un score déjà présent dans `matching` (rapide,
        //     cas où le candidat a aussi postulé ailleurs).
        const bestRes = await client.query(
          `
          SELECT m.job_id, j.title AS job_title, m.score
          FROM matching m
          JOIN job j ON j.id = m.job_id
          WHERE m.candidate_id = $1
            AND m.job_id <> $2
            AND m.score >= $3
          ORDER BY m.score DESC
          LIMIT 1
          `,
          [other.candidate_id, jobId, AUTO_RECOMMEND_MIN_SCORE]
        );

        let best = bestRes.rows[0] || null;

        // Étape 2 : rien dans `matching` (cas normal — le candidat n'a
        // postulé QUE sur le poste pourvu). On calcule alors le score
        // sémantique à la volée contre chaque autre job ouvert, et on
        // garde le meilleur s'il dépasse le seuil.
        if (!best) {
          const otherJobsRes = await client.query(
            'SELECT id, title FROM job WHERE id <> $1',
            [jobId]
          );

          let bestScore = 0;
          let bestJob   = null;

          for (const candidateJob of otherJobsRes.rows) {
            const score = await computeSemanticScore(client, other.candidate_id, candidateJob.id);
            if (score !== null && score > bestScore) {
              bestScore = score;
              bestJob   = candidateJob;
            }
          }

          if (bestJob && bestScore >= AUTO_RECOMMEND_MIN_SCORE) {
            best = { job_id: bestJob.id, job_title: bestJob.title, score: bestScore };
          }
        }

        if (best) {

          // Éviter une recommandation en double vers le même poste
          const existingRec = await client.query(
            `
            SELECT 1 FROM recommendation
            WHERE candidate_id = $1 AND job_id = $2
            `,
            [other.candidate_id, best.job_id]
          );

          if (!existingRec.rows.length) {
            await client.query(
              `
              INSERT INTO recommendation(candidate_id, job_id, reason)
              VALUES ($1, $2, $3)
              `,
              [
                other.candidate_id,
                best.job_id,
                `Recommandation automatique après refus pour "${jobTitle}" (score ${parseFloat(best.score)}% sur "${best.job_title}")`
              ]
            );

            autoRecommended.push({
              id:       other.candidate_id,
              name:     other.name,
              job_id:   best.job_id,
              job_title: best.job_title,
              score:    parseFloat(best.score),
            });

            // Email de recommandation (best-effort, ne bloque pas la transaction)
            if (other.email) {
              sendMailSafe({
                from: `"RH" <${process.env.EMAIL_USER}>`,
                to: other.email,
                subject: `Recommandation : ${best.job_title}`,
                html: `
                  <p>Bonjour <strong>${other.name}</strong>,</p>
                  <p>
                    Bien que votre candidature pour <strong>${jobTitle}</strong>
                    n'ait pas été retenue, nous souhaitons vous recommander pour :
                  </p>
                  <h3>${best.job_title}</h3>
                  <p>Votre profil correspond à cette opportunité.</p>
                  <p>Cordialement,<br>L'équipe RH</p>
                `
              });
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      autoRejected,
      autoRecommended,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('acceptCandidate:', err);
    res.status(500).json({ success: false, message: 'Erreur acceptation candidat' });
  } finally {
    client.release();
  }
};

/* ===============================
   REJECT
=============================== */
exports.rejectCandidate = async (
  req,
  res
) => {

  const { id } = req.params;

  const { reason } = req.body;

  await pool.query(
    `
    INSERT INTO refuses
    (
      candidate_id,
      reason
    )
    VALUES ($1,$2)

    ON CONFLICT
    (
      candidate_id
    )
    DO NOTHING
  `,
    [
      id,
      reason || null
    ]
  );

  res.json({
    success: true
  });
};

/* ===============================
   RECOMMEND
=============================== */
exports.recommendCandidate = async (req, res) => {
  const { id } = req.params;
  const { jobId } = req.body;

  try {
    const candRes = await pool.query(
      'SELECT * FROM candidate WHERE id=$1',
      [id]
    );

    if (!candRes.rows.length)
      return res.status(404).json({ message: 'Candidat introuvable' });

    const candidate = candRes.rows[0];

    const jobRes = await pool.query(
      'SELECT * FROM job WHERE id=$1',
      [jobId]
    );

    if (!jobRes.rows.length)
      return res.status(404).json({ message: 'Poste introuvable' });

    const job = jobRes.rows[0];

    const emailRes = await pool.query(`
      SELECT e.subject, e.sender
      FROM email e
      JOIN application a ON a.email_id=e.id
      WHERE a.candidate_id=$1
      ORDER BY e.id DESC
      LIMIT 1
    `, [id]);

    const appliedSubject = emailRes.rows[0]?.subject || 'votre poste';
    const senderEmail = emailRes.rows[0]?.sender || candidate.email;

    await pool.query(`
      INSERT INTO recommendation(candidate_id,job_id,reason)
      VALUES($1,$2,$3)
    `, [
      id,
      jobId,
      `Recommandation après refus pour "${appliedSubject}"`
    ]);

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: senderEmail,
      subject: `Recommandation : ${job.title}`,
      html: `
        <p>Bonjour <strong>${candidate.name}</strong>,</p>

        <p>
          Bien que votre candidature pour
          <strong>${appliedSubject}</strong>
          n'ait pas été retenue,
          nous souhaitons vous recommander pour :
        </p>

        <h3>${job.title}</h3>

        <p>
          Votre profil correspond à cette opportunité.
        </p>

        <p>Cordialement,<br>L'équipe RH</p>
      `
    });

    res.json({
      message: 'Recommandation envoyée',
      recommendedJob: job.title
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur recommandation',
      detail: err.message
    });
  }
};

/* ===============================
   GET RECOMMENDATIONS
=============================== */
exports.getRecommendations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.reason,
        r.created_at,

        c.id AS candidate_id,
        c.name,
        c.email,
        c.phone,

        j.id AS job_id,
        j.title AS recommended_job,

        e.subject AS original_job

      FROM recommendation r
      JOIN candidate c ON c.id = r.candidate_id
      JOIN job j ON j.id = r.job_id
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      ORDER BY r.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur récupération recommendations'
    });
  }
};

/* ===============================
   SEND RECOMMENDATION MAIL
   ---------------------------------------------------------------
   Envoie (ou renvoie) le mail de recommandation pour une ligne
   déjà existante dans `recommendation`, depuis le bouton
   "Envoyer mail recommandation" de la vue Recommendations.
=============================== */
exports.sendRecommendationMail = async (req, res) => {
  const { id } = req.params; // candidate_id
  const { jobId } = req.body;

  try {
    const candRes = await pool.query(
      'SELECT * FROM candidate WHERE id=$1',
      [id]
    );

    if (!candRes.rows.length)
      return res.status(404).json({ message: 'Candidat introuvable' });

    const candidate = candRes.rows[0];

    if (!jobId)
      return res.status(400).json({ message: 'jobId manquant' });

    const jobRes = await pool.query(
      'SELECT * FROM job WHERE id=$1',
      [jobId]
    );

    if (!jobRes.rows.length)
      return res.status(404).json({ message: 'Poste introuvable' });

    const job = jobRes.rows[0];

    if (!candidate.email) {
      return res.status(400).json({ message: "Ce candidat n'a pas d'adresse email" });
    }

    const emailRes = await pool.query(`
      SELECT e.subject
      FROM email e
      JOIN application a ON a.email_id = e.id
      WHERE a.candidate_id = $1
      ORDER BY e.id DESC
      LIMIT 1
    `, [id]);

    const appliedSubject = emailRes.rows[0]?.subject || 'votre candidature';

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: candidate.email,
      subject: `Recommandation : ${job.title}`,
      html: `
        <p>Bonjour <strong>${candidate.name}</strong>,</p>

        <p>
          Bien que votre candidature pour
          <strong>${appliedSubject}</strong>
          n'ait pas été retenue,
          nous souhaitons vous recommander pour :
        </p>

        <h3>${job.title}</h3>

        <p>
          Votre profil correspond à cette opportunité.
        </p>

        <p>Cordialement,<br>L'équipe RH</p>
      `
    });

    res.json({
      success: true,
      message: `Mail de recommandation envoyé à ${candidate.name}`,
    });

  } catch (err) {
    console.error('sendRecommendationMail:', err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du mail de recommandation",
      detail: err.message
    });
  }
};

/* ===============================
   GET ADMIS
=============================== */
exports.getAdmis = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ad.id, ad.accepted_at,
        c.name, c.email, c.phone,
        MIN(e.subject)       AS subject,
        MIN(a.applied_date)  AS applied_date
      FROM admis ad
      JOIN candidate c ON c.id=ad.candidate_id
      LEFT JOIN application a ON a.candidate_id=c.id
      LEFT JOIN email e ON e.id=a.email_id
      GROUP BY ad.id, ad.accepted_at, c.name, c.email, c.phone
      ORDER BY ad.accepted_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur admis' });
  }
};

/* ===============================
   GET REFUSES
=============================== */
exports.getRefuses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rf.id, rf.refused_at, rf.reason,
        c.name, c.email, c.phone,
        MIN(e.subject)       AS subject,
        MIN(a.applied_date)  AS applied_date
      FROM refuses rf
      JOIN candidate c ON c.id=rf.candidate_id
      LEFT JOIN application a ON a.candidate_id=c.id
      LEFT JOIN email e ON e.id=a.email_id
      GROUP BY rf.id, rf.refused_at, rf.reason, c.name, c.email, c.phone
      ORDER BY rf.refused_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur refusés' });
  }
};

/* ===============================
   UPDATE STATUS
=============================== */
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      'UPDATE application SET status=$1 WHERE candidate_id=$2',
      [status, id]
    );

    res.json({ message: 'Statut mis à jour' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur update' });
  }
};