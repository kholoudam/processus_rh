const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { parseCV } = require('./parser.service');

// ===============================
// 🔥 DOSSIER UPLOADS (DANS BACKEND)
// ===============================
const uploadDir = path.join(__dirname, '../../uploads');

// ✅ créer dossier automatiquement si inexistant
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ===============================
// 🔹 CONFIG IMAP
// ===============================
const config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
  }
};

// ===============================
// 🔹 SAFE JSON
// ===============================
const safeJSON = (data) => {
  try {
    return JSON.stringify(data || []);
  } catch {
    return "[]";
  }
};

// ===============================
// 🔹 FETCH EMAILS
// ===============================
exports.fetchEmails = async () => {
  try {
    console.log("📩 Checking emails...");

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    console.log("✅ Connexion IMAP réussie");

    const searchCriteria = ['ALL'];
    const fetchOptions = { bodies: [''], markSeen: true };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`📥 Emails trouvés : ${messages.length}`);

    for (let item of messages) {
      try {
        const all = item.parts.find(p => p.which === '');
        const parsed = await simpleParser(all.body);

        const email = parsed.from?.value[0]?.address || "";
        const subject = parsed.subject || "";
        const body = parsed.text || parsed.html || "";

        let cv_link = null;
        let filePath = null;

        // ===============================
        // 📎 ATTACHMENT (UPLOAD FIX)
        // ===============================
        if (parsed.attachments && parsed.attachments.length > 0) {
          const att = parsed.attachments[0];

          // sécuriser nom fichier
          const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const fileName = Date.now() + "_" + safeName;

          filePath = path.join(uploadDir, fileName);

          // 🔥 écrire fichier
          fs.writeFileSync(filePath, att.content);

          console.log("📄 CV sauvegardé :", filePath);

          // 🔥 lien correct
          cv_link = `/uploads/${fileName}`;
        }

        // ===============================
        // 🔹 PARSING CV
        // ===============================
        let parsedData = {
          first_name: "",
          last_name: "",
          phone: "",
          address: "Casablanca",
          skills: [],
          education: [],
          experience: []
        };

        if (filePath) {
          try {
            parsedData = await parseCV(filePath, body);
          } catch (err) {
            console.log("⚠️ Erreur parsing CV :", err.message);
          }
        }

        // ===============================
        // 🔹 ANTI DUPLICATION
        // ===============================
        const exists = await pool.query(
          "SELECT * FROM candidates WHERE email = $1 AND subject = $2",
          [email, subject]
        );

        if (exists.rows.length > 0) {
          console.log("⚠️ Email déjà existant :", email);
          continue;
        }

        // ===============================
        // 🔹 INSERT DB
        // ===============================
        await pool.query(`
          INSERT INTO candidates
          (first_name, last_name, email, subject, body, cv_link, phone, address, education, experience, skills)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `, [
          parsedData.first_name || "",
          parsedData.last_name || "",
          email,
          subject,
          body,
          cv_link,
          parsedData.phone || "",
          parsedData.address || "Casablanca",
          safeJSON(parsedData.education),
          safeJSON(parsedData.experience),
          safeJSON(parsedData.skills)
        ]);

        console.log("✅ Email enregistré :", email);

      } catch (err) {
        console.error("❌ Erreur traitement email :", err.message);
      }
    }

    connection.end();

  } catch (err) {
    console.error("❌ IMAP ERROR:", err);
  }
};