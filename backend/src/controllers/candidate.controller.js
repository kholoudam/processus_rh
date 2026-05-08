const pool = require('../config/db');
const nodemailer = require('nodemailer');

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
        c.status,
        e.subject
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      WHERE c.status NOT IN ('ACCEPTED','REJECTED')
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
      SELECT c.*, e.subject, e.body
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      WHERE c.id=$1
    `, [id]);

    const skills = await pool.query(
      'SELECT skill_name FROM candidate_skill WHERE candidate_id=$1',
      [id]
    );

    const experience = await pool.query(
      'SELECT * FROM experience WHERE candidate_id=$1',
      [id]
    );

    const education = await pool.query(
      'SELECT * FROM education WHERE candidate_id=$1',
      [id]
    );

    res.json({
      candidate: candidate.rows[0],
      skills: skills.rows,
      experience: experience.rows,
      education: education.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur détails candidat' });
  }
};

/* ===============================
   ACCEPT
=============================== */
exports.acceptCandidate = async (req, res) => {
  const { id } = req.params;

  try {
    const cand = await pool.query(
      'SELECT * FROM candidate WHERE id=$1',
      [id]
    );

    if (!cand.rows.length)
      return res.status(404).json({ message: 'Candidat introuvable' });

    const candidate = cand.rows[0];

    const emailRes = await pool.query(`
      SELECT e.subject, e.sender
      FROM email e
      JOIN application a ON a.email_id=e.id
      WHERE a.candidate_id=$1
      ORDER BY e.id DESC
      LIMIT 1
    `, [id]);

    const subject = emailRes.rows[0]?.subject || 'le poste';
    const senderEmail = emailRes.rows[0]?.sender || candidate.email;

    await pool.query(
      `UPDATE candidate SET status='ACCEPTED' WHERE id=$1`,
      [id]
    );

    await pool.query(`
      INSERT INTO admis(candidate_id)
      VALUES($1)
      ON CONFLICT DO NOTHING
    `, [id]);

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: senderEmail,
      subject: 'Candidature acceptée',
      html: `
        <p>Bonjour <strong>${candidate.name}</strong>,</p>
        <p>Votre candidature pour <strong>${subject}</strong> a été retenue.</p>
        <p>Cordialement,<br>L'équipe RH</p>
      `
    });

    res.json({ message: 'Candidat accepté' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur acceptation' });
  }
};

/* ===============================
   REJECT
=============================== */
exports.rejectCandidate = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const cand = await pool.query(
      'SELECT * FROM candidate WHERE id=$1',
      [id]
    );

    if (!cand.rows.length)
      return res.status(404).json({ message: 'Candidat introuvable' });

    const candidate = cand.rows[0];

    const emailRes = await pool.query(`
      SELECT e.subject, e.sender
      FROM email e
      JOIN application a ON a.email_id=e.id
      WHERE a.candidate_id=$1
      ORDER BY e.id DESC
      LIMIT 1
    `, [id]);

    const subject = emailRes.rows[0]?.subject || 'le poste';
    const senderEmail = emailRes.rows[0]?.sender || candidate.email;

    await pool.query(
      `UPDATE candidate SET status='REJECTED' WHERE id=$1`,
      [id]
    );

    await pool.query(`
      INSERT INTO refuses(candidate_id,reason)
      VALUES($1,$2)
      ON CONFLICT DO NOTHING
    `, [id, reason || null]);

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: senderEmail,
      subject: 'Candidature refusée',
      html: `
        <p>Bonjour <strong>${candidate.name}</strong>,</p>
        <p>Votre candidature pour <strong>${subject}</strong> n'a pas été retenue.</p>
        ${reason ? `<p>Motif : ${reason}</p>` : ''}
        <p>Cordialement,<br>L'équipe RH</p>
      `
    });

    res.json({ message: 'Candidat refusé' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur refus' });
  }
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
   GET ADMIS
=============================== */
exports.getAdmis = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ad.*, c.name, c.email, c.phone, e.subject
      FROM admis ad
      JOIN candidate c ON c.id=ad.candidate_id
      LEFT JOIN application a ON a.candidate_id=c.id
      LEFT JOIN email e ON e.id=a.email_id
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
      SELECT rf.*, c.name, c.email, c.phone, e.subject
      FROM refuses rf
      JOIN candidate c ON c.id=rf.candidate_id
      LEFT JOIN application a ON a.candidate_id=c.id
      LEFT JOIN email e ON e.id=a.email_id
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
      'UPDATE candidate SET status=$1 WHERE id=$2',
      [status, id]
    );

    res.json({ message: 'Statut mis à jour' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur update' });
  }
};