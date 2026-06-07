// email.service.js — version mise à jour
// Changements par rapport à la version précédente :
//   - candidate INSERT inclut maintenant job_title (détecté automatiquement par Zero-Shot)
//   - candidate UPDATE inclut job_title depuis le CV parsé
//   - checkParserHealth() appelé au démarrage pour détecter les problèmes tôt

require("dotenv").config();

const imaps         = require("imap-simple");
const { simpleParser } = require("mailparser");
const fs            = require("fs");
const path          = require("path");
const { v4: uuidv4 } = require("uuid");
const pool          = require("../config/db");
const { parseCV, checkParserHealth } = require("./parser.service");

let watcherStarted = false;

/* =========================
   PARSE CV & INSERT EN DB
========================= */
async function parseAndInsertCV(filepath, candidateId, sender) {
  try {
    const buffer = fs.readFileSync(filepath);

    let parsed;
    try {
      parsed = await parseCV(buffer);
    } catch (err) {
      console.warn(`⚠ CV ignoré (candidat ${candidateId}): ${err.message}`);
      return;
    }

    // Mise à jour candidat — toutes les données extraites du CV
    await pool.query(
      `UPDATE candidate
       SET name      = COALESCE($1, name),
           email     = COALESCE($2, email),
           phone     = COALESCE($3, phone),
           address   = COALESCE($4, address),
           degree    = COALESCE($5, degree)
       WHERE id = $6`,
      [
        parsed.name      || null,
        parsed.email     || null,
        parsed.phone     || null,
        parsed.address   || null,
        parsed.job_title || null,   // ← métier détecté par Zero-Shot → stocké dans degree (champ libre)
        candidateId
      ]
    );

    // Skills techniques
    for (const skill of parsed.skills || []) {
      if (!skill || skill.trim().length < 2) continue;
      await pool.query(
        `INSERT INTO candidate_skill(candidate_id, skill_name)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [candidateId, skill.trim()]
      );
    }

    // Soft skills
    for (const skill of parsed.softSkills || []) {
      if (!skill || skill.trim().length < 2) continue;
      await pool.query(
        `INSERT INTO candidate_skill(candidate_id, skill_name)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [candidateId, skill.trim()]
      );
    }

    // Education
    for (const edu of parsed.education || []) {
      if (!edu.degree) continue;
      await pool.query(
        `INSERT INTO education(candidate_id, degree, institution, year)
         VALUES ($1, $2, $3, $4)`,
        [candidateId, edu.degree, edu.school || null, edu.year || null]
      );
    }

    // Experience
    for (const exp of parsed.experience || []) {
      if (!exp.position) continue;
      await pool.query(
        `INSERT INTO experience(candidate_id, company, position, duration)
         VALUES ($1, $2, $3, $4)`,
        [candidateId, exp.company || null, exp.position, exp.duration || null]
      );
    }

    const totalSkills = (parsed.skills?.length || 0) + (parsed.softSkills?.length || 0);
    console.log(
      `🧠 CV parsé — candidat ${candidateId} | nom: ${parsed.name || "?"} ` +
      `| métier: ${parsed.job_title || "?"} (${parsed.language}) ` +
      `| skills: ${totalSkills} | expériences: ${parsed.experience?.length || 0}`
    );

  } catch (err) {
    console.error(`❌ parseAndInsertCV (candidat ${candidateId}):`, err.message);
  }
}

/* =========================
   FETCH EMAILS
========================= */
async function fetchEmails() {
  const config = {
    imap: {
      user:       process.env.EMAIL_USER,
      password:   process.env.EMAIL_PASS,
      host:       process.env.IMAP_HOST,
      port:       parseInt(process.env.IMAP_PORT) || 993,
      tls:        true,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    console.log("📩 Vérification nouveaux emails...");

    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");

    const messages = await connection.search(
      ["UNSEEN"],
      { bodies: [""], markSeen: true, struct: true }
    );

    console.log(`📨 ${messages.length} email(s) trouvé(s)`);

    for (const item of messages) {
      try {
        const all = item.parts.find(p => p.which === "");
        if (!all) continue;

        const parsed  = await simpleParser(all.body);
        const sender  = parsed.from?.value?.[0]?.address || "unknown@mail.com";
        const subject = parsed.subject || "Sans objet";
        const body    = parsed.text    || "";

        // Insérer l'email
        const emailInsert = await pool.query(
          `INSERT INTO email(subject, body, sender)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [subject, body, sender]
        );
        const emailId = emailInsert.rows[0].id;

        // Créer le candidat vide — rempli par parseAndInsertCV
        const candidateInsert = await pool.query(
          `INSERT INTO candidate(email) VALUES ($1)
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
           RETURNING id`,
          [sender]  // email sender comme clé de déduplication
        );
        const candidateId = candidateInsert.rows[0].id;

        // Candidature
        await pool.query(
          `INSERT INTO application(status, applied_date, source, email_id, candidate_id)
           VALUES ('RECEIVED', NOW(), 'EMAIL', $1, $2)`,
          [emailId, candidateId]
        );

        // Pièces jointes PDF
        if (parsed.attachments?.length > 0) {
          const uploadDir = path.resolve(__dirname, "../../uploads");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

          for (const att of parsed.attachments) {
            if (!att.filename?.toLowerCase().endsWith(".pdf")) continue;

            const filename = `${uuidv4()}_${att.filename}`;
            const filepath = path.join(uploadDir, filename);

            fs.writeFileSync(filepath, att.content);

            await pool.query(
              `INSERT INTO attachment(email_id, file_path, type, candidate_id)
               VALUES ($1, $2, $3, $4)`,
              [emailId, `uploads/${filename}`, att.contentType, candidateId]
            );

            // ← Parsing du CV via Python (PyMuPDF + Transformers)
            await parseAndInsertCV(filepath, candidateId, sender);
          }
        }

        console.log(`✅ Candidature insérée — candidat ${candidateId}`);

      } catch (err) {
        console.error("❌ Traitement email:", err.message);
      }
    }

    connection.end();

  } catch (err) {
    console.error("❌ IMAP:", err.message);
  }
}

/* =========================
   WATCHER (toutes les 2 min)
========================= */
function startEmailWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;

  // Vérifier que le microservice Python est bien démarré
  checkParserHealth();

  fetchEmails();
  setInterval(fetchEmails, 120_000);
  console.log("📩 Email watcher démarré");
}

module.exports = { fetchEmails, startEmailWatcher };