const pool = require('../config/db');
const nodemailer = require('nodemailer');

// ===============================
// MAILER CONFIG
// ===============================
const createTransporter = () => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn('⚠️  MAIL_USER ou MAIL_PASS non définis — les emails ne seront pas envoyés.');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
};

const sendMailSafe = async (options) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    await transporter.sendMail(options);
    console.log(`✉️  Email envoyé à ${options.to}`);
  } catch (err) {
    console.error('❌ Erreur envoi email (non bloquant):', err.message);
  }
};

// ===============================
// GET ALL CANDIDATES
// ===============================
exports.getCandidates = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
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
      ORDER BY c.id DESC
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET DETAILS
// ===============================
exports.getCandidateDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const candidate = await pool.query(`
      SELECT c.*, e.subject, e.body
      FROM candidate c
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      WHERE c.id = $1
    `, [id]);

    const skills     = await pool.query("SELECT skill_name FROM candidate_skill WHERE candidate_id=$1", [id]);
    const experience = await pool.query("SELECT * FROM experience WHERE candidate_id=$1", [id]);
    const education  = await pool.query("SELECT * FROM education WHERE candidate_id=$1", [id]);

    const cv = await pool.query(`
      SELECT att.file_path FROM attachment att
      WHERE att.candidate_id = $1
        AND (att.type ILIKE '%pdf%' OR att.file_path ILIKE '%.pdf')
      ORDER BY att.id DESC LIMIT 1
    `, [id]);

    let cvPath = cv.rows[0]?.file_path || null;

    if (!cvPath) {
      const cvFallback = await pool.query(`
        SELECT att.file_path FROM attachment att
        JOIN application a ON a.email_id = att.email_id
        WHERE a.candidate_id = $1
          AND (att.type ILIKE '%pdf%' OR att.file_path ILIKE '%.pdf')
        ORDER BY att.id DESC LIMIT 1
      `, [id]);
      cvPath = cvFallback.rows[0]?.file_path || null;
    }

    res.json({
      candidate: { ...(candidate.rows[0] || {}), cv_link: cvPath },
      skills: skills.rows || [],
      experience: experience.rows || [],
      education: education.rows || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// ACCEPT CANDIDATE
// ===============================
exports.acceptCandidate = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM candidate WHERE id=$1", [id]);
    const candidate = result.rows[0];
    if (!candidate) {
      return res.status(404).json({ message: "Candidat introuvable" });
    }

    const subjectRes = await pool.query(`
      SELECT e.subject FROM email e
      JOIN application a ON a.email_id = e.id
      WHERE a.candidate_id = $1 LIMIT 1
    `, [id]);

    const subject = subjectRes.rows[0]?.subject || "le poste";

    await pool.query("UPDATE candidate SET status='ACCEPTED' WHERE id=$1", [id]);

    await pool.query(`
      INSERT INTO admis (candidate_id)
      VALUES ($1)
      ON CONFLICT DO NOTHING
    `, [id]);

    await sendMailSafe({
      from: `"RH" <${process.env.MAIL_USER}>`,
      to: candidate.email,
      subject: "Candidature acceptée",
      html: `<p>Félicitations ${candidate.name}, vous êtes accepté pour ${subject}</p>`
    });

    res.json({ message: "OK" });

  } catch (err) {
    console.error("ACCEPT ERROR:", err);
    res.status(500).json({ message: "Erreur acceptation", detail: err.message });
  }
};

// ===============================
// REJECT CANDIDATE
// ===============================
exports.rejectCandidate = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const result = await pool.query("SELECT * FROM candidate WHERE id=$1", [id]);
    const candidate = result.rows[0];
    if (!candidate) {
      return res.status(404).json({ message: "Candidat introuvable" });
    }

    const subjectRes = await pool.query(`
      SELECT e.subject FROM email e
      JOIN application a ON a.email_id = e.id
      WHERE a.candidate_id = $1 LIMIT 1
    `, [id]);

    const subject = subjectRes.rows[0]?.subject || "le poste";

    await pool.query("UPDATE candidate SET status='REJECTED' WHERE id=$1", [id]);

    await pool.query(`
      INSERT INTO refuses (candidate_id, reason)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [id, reason || null]);

    await sendMailSafe({
      from: `"RH" <${process.env.MAIL_USER}>`,
      to: candidate.email,
      subject: "Candidature refusée",
      html: `<p>Bonjour ${candidate.name}, votre candidature pour ${subject} est refusée.</p>`
    });

    res.json({ message: "OK" });

  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ message: "Erreur refus", detail: err.message });
  }
};

// ===============================
// GET ADMIS
// ✅ FIX : JOIN sur candidate pour retourner name, email, phone, subject
//    Les vues Admis.vue et Refuses.vue affichent ces champs — sans le JOIN
//    les colonnes restaient vides (---).
// ===============================
exports.getAdmis = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ad.id,
        ad.candidate_id,
        ad.accepted_at,
        c.name,
        c.email,
        c.phone,
        c.address,
        e.subject
      FROM admis ad
      JOIN candidate c ON c.id = ad.candidate_id
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      ORDER BY ad.accepted_at DESC
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET REFUSES
// ✅ FIX : même JOIN que getAdmis
// ===============================
exports.getRefuses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rf.id,
        rf.candidate_id,
        rf.reason,
        rf.refused_at,
        c.name,
        c.email,
        c.phone,
        c.address,
        e.subject
      FROM refuses rf
      JOIN candidate c ON c.id = rf.candidate_id
      LEFT JOIN application a ON a.candidate_id = c.id
      LEFT JOIN email e ON e.id = a.email_id
      ORDER BY rf.refused_at DESC
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// UPDATE STATUS
// ===============================
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query("UPDATE candidate SET status=$1 WHERE id=$2", [status, id]);
    res.json({ message: "OK" });
  } catch (err) {
    res.status(500).json({ message: "Erreur update" });
  }
};