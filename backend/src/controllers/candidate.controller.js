const pool = require('../config/db');
const nodemailer = require('nodemailer');

// ===============================
// MAILER CONFIG
// ===============================
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  MAIL_USER ou MAIL_PASS non définis — les emails ne seront pas envoyés.');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
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
      SELECT DISTINCT ON (c.id)
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.status,
        e.subject,
        j.id    AS job_id,
        j.title AS job_title
      FROM candidate c
      LEFT JOIN LATERAL (
        SELECT a.email_id
        FROM application a
        WHERE a.candidate_id = c.id
        ORDER BY a.id DESC
        LIMIT 1
      ) a ON true
      LEFT JOIN email e ON e.id = a.email_id
      LEFT JOIN LATERAL (
        SELECT m.job_id
        FROM matching m
        WHERE m.candidate_id = c.id
        ORDER BY m.score DESC
        LIMIT 1
      ) best ON true
      LEFT JOIN job j ON j.id = best.job_id
      WHERE c.status NOT IN ('ACCEPTED', 'REJECTED')
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

    // Récupère le sender depuis la table email (adresse utilisée pour envoyer le CV)
    const emailRes = await pool.query(`
      SELECT e.subject, e.sender FROM email e
      JOIN application a ON a.email_id = e.id
      WHERE a.candidate_id = $1
      ORDER BY e.id DESC LIMIT 1
    `, [id]);

    const subject     = emailRes.rows[0]?.subject || "le poste";
    const senderEmail = emailRes.rows[0]?.sender;

    if (!senderEmail) {
      console.warn(`⚠️  Aucun sender trouvé dans la table email pour candidate_id=${id}`);
    }

    await pool.query("UPDATE candidate SET status='ACCEPTED' WHERE id=$1", [id]);

    await pool.query(`
      INSERT INTO admis (candidate_id)
      VALUES ($1)
      ON CONFLICT DO NOTHING
    `, [id]);

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: senderEmail,
      subject: "Candidature acceptée",
      html: `<p>Félicitations ${candidate.name},</p><p>Nous avons le plaisir de vous informer que votre candidature pour le poste de <strong>${subject}</strong> a été retenue. Nous vous contacterons prochainement.</p><p>Cordialement,<br>L'équipe RH</p>`
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

    // Récupère le sender depuis la table email (adresse utilisée pour envoyer le CV)
    const emailRes = await pool.query(`
      SELECT e.subject, e.sender FROM email e
      JOIN application a ON a.email_id = e.id
      WHERE a.candidate_id = $1
      ORDER BY e.id DESC LIMIT 1
    `, [id]);

    const subject     = emailRes.rows[0]?.subject || "le poste";
    const senderEmail = emailRes.rows[0]?.sender;

    if (!senderEmail) {
      console.warn(`⚠️  Aucun sender trouvé dans la table email pour candidate_id=${id}`);
    }

    await pool.query("UPDATE candidate SET status='REJECTED' WHERE id=$1", [id]);

    await pool.query(`
      INSERT INTO refuses (candidate_id, reason)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [id, reason || null]);

    await sendMailSafe({
      from: `"RH" <${process.env.EMAIL_USER}>`,
      to: senderEmail,
      subject: "Candidature refusée",
      html: `<p>Bonjour ${candidate.name},</p><p>Après examen de votre candidature pour le poste de <strong>${subject}</strong>, nous ne sommes malheureusement pas en mesure de donner une suite favorable.${reason ? '<br><br><em>Motif : ' + reason + '</em>' : ''}</p><p>Nous vous remercions de l'intérêt porté à notre entreprise.</p><p>Cordialement,<br>L'équipe RH</p>`
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
      SELECT DISTINCT ON (ad.candidate_id)
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
      LEFT JOIN LATERAL (
        SELECT a.email_id FROM application a
        WHERE a.candidate_id = c.id
        ORDER BY a.id DESC LIMIT 1
      ) a ON true
      LEFT JOIN email e ON e.id = a.email_id
      ORDER BY ad.candidate_id, ad.accepted_at DESC
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
      SELECT DISTINCT ON (rf.candidate_id)
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
      LEFT JOIN LATERAL (
        SELECT a.email_id FROM application a
        WHERE a.candidate_id = c.id
        ORDER BY a.id DESC LIMIT 1
      ) a ON true
      LEFT JOIN email e ON e.id = a.email_id
      ORDER BY rf.candidate_id, rf.refused_at DESC
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