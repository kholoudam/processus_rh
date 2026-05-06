require("dotenv").config();

const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

let watcherStarted = false;

/* =========================
   EXTRACTION EMAIL
========================= */
function extractEmail(text) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

/* =========================
   EXTRACTION NOM
========================= */
function extractNameFromCV(text) {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 8)) {
    if (
      /^[A-ZÀ-Ÿ][a-zà-ÿ]+(\s[A-ZÀ-Ÿ][a-zà-ÿ]+)+$/.test(line)
    ) {
      return line;
    }
  }

  return null;
}

/* =========================
   EXTRACTION PHONE
========================= */
function extractPhone(text) {
  const match = text.match(/(\+?\d[\d\s\-]{8,15})/);
  return match ? match[0].trim() : null;
}

/* =========================
   EXTRACTION ADRESSE
========================= */
function extractAddress(text) {
  const lines = text.split("\n");

  for (const line of lines) {
    if (
      /(casablanca|rabat|fes|tanger|agadir|marrakech|kenitra|meknes|salé)/i.test(line)
    ) {
      return line.trim();
    }
  }

  return null;
}

/* =========================
   EXTRACTION SKILLS DYNAMIQUE
========================= */
function extractSkills(text) {
  const lines = text.split("\n");

  return [...new Set(
    lines
      .map(l => l.trim())
      .filter(Boolean)
      .filter(l => l.length > 2 && l.length < 40)
      .filter(l =>
        /^[A-Za-zÀ-ÿ0-9+#.\-\s]+$/.test(l)
      )
      .filter(l =>
        !/cv|profil|contact|email|phone|experience|education|formation/i.test(l)
      )
  )].slice(0, 20);
}

/* =========================
   EDUCATION
========================= */
function extractEducation(text) {
  const lines = text.split("\n");

  const education = [];

  for (let i = 0; i < lines.length; i++) {
    if (
      /master|licence|bachelor|ingénieur|doctorat|dipl[oô]me/i.test(lines[i])
    ) {
      education.push({
        degree: lines[i]?.trim() || null,
        institution: lines[i + 1]?.trim() || null,
        year: lines[i + 2]?.match(/\b(19|20)\d{2}\b/)
          ? parseInt(lines[i + 2].match(/\b(19|20)\d{2}\b/)[0])
          : null
      });
    }
  }

  return education;
}

/* =========================
   EXPERIENCE
========================= */
function extractExperience(text) {
  const lines = text.split("\n");

  const experiences = [];

  for (let i = 0; i < lines.length; i++) {
    if (
      /developer|engineer|analyst|manager|assistant|technicien|stage|intern/i.test(lines[i])
    ) {
      experiences.push({
        position: lines[i]?.trim() || null,
        company: lines[i + 1]?.trim() || null,
        duration: lines[i + 2]?.match(/\d{4}\s?-\s?\d{4}|present|présent/i)
          ? lines[i + 2].trim()
          : null
      });
    }
  }

  return experiences;
}

/* =========================
   FALLBACK PDF
========================= */
async function extractPdfText(filepath) {
  try {
    const buffer = fs.readFileSync(filepath);
    const pdf = await pdfParse(buffer);
    return pdf.text;
  } catch (err) {
    console.log("⚠ PDF complexe, extraction brute");
    return fs.readFileSync(filepath).toString("latin1");
  }
}

/* =========================
   PARSE CV
========================= */
async function parseAndInsertCV(filepath, candidateId, sender) {
  try {
    const text = await extractPdfText(filepath);

    const name = extractNameFromCV(text);
    const email = extractEmail(text);
    const phone = extractPhone(text);
    const address = extractAddress(text);

    await pool.query(
      `
      UPDATE candidate
      SET
        name=$1,
        email=$2,
        phone=$3,
        address=$4
      WHERE id=$5
      `,
      [
        name || sender.split("@")[0],
        email || sender,
        phone,
        address,
        candidateId
      ]
    );

    /* SKILLS */
    const skills = extractSkills(text);

    for (const skill of skills) {
      await pool.query(
        `
        INSERT INTO candidate_skill(candidate_id, skill_name)
        VALUES($1,$2)
        `,
        [candidateId, skill]
      );
    }

    /* EDUCATION */
    const education = extractEducation(text);

    for (const edu of education) {
      await pool.query(
        `
        INSERT INTO education(candidate_id, degree, institution, year)
        VALUES($1,$2,$3,$4)
        `,
        [
          candidateId,
          edu.degree,
          edu.institution,
          edu.year
        ]
      );
    }

    /* EXPERIENCE */
    const experiences = extractExperience(text);

    for (const exp of experiences) {
      await pool.query(
        `
        INSERT INTO experience(candidate_id, company, position, duration)
        VALUES($1,$2,$3,$4)
        `,
        [
          candidateId,
          exp.company,
          exp.position,
          exp.duration
        ]
      );
    }

    console.log("🧠 Parsing CV terminé");

  } catch (err) {
    console.error("❌ Parsing CV:", err.message);
  }
}

/* =========================
   FETCH EMAILS
========================= */
async function fetchEmails() {
  const config = {
    imap: {
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS,
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false
      }
    }
  };

  try {
    console.log("📩 Vérification nouveaux emails...");

    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");

    const messages = await connection.search(
      ["UNSEEN"],
      {
        bodies: [""],
        markSeen: true,
        struct: true
      }
    );

    console.log(`📨 ${messages.length} emails trouvés`);

    for (const item of messages) {
      try {
        const all = item.parts.find(p => p.which === "");
        if (!all) continue;

        const parsed = await simpleParser(all.body);

        const sender =
          parsed.from?.value?.[0]?.address || "unknown@mail.com";

        const subject = parsed.subject || "Sans objet";
        const body = parsed.text || "";

        /* EMAIL */
        const emailInsert = await pool.query(
          `
          INSERT INTO email(subject, body, sender)
          VALUES($1,$2,$3)
          RETURNING id
          `,
          [subject, body, sender]
        );

        const emailId = emailInsert.rows[0].id;

        /* CANDIDATE */
        const candidateInsert = await pool.query(
          `
          INSERT INTO candidate(status)
          VALUES('RECEIVED')
          RETURNING id
          `
        );

        const candidateId = candidateInsert.rows[0].id;

        /* APPLICATION */
        await pool.query(
          `
          INSERT INTO application(status, applied_date, source, email_id, candidate_id)
          VALUES('RECEIVED',NOW(),'EMAIL',$1,$2)
          `,
          [emailId, candidateId]
        );

        /* ATTACHMENTS */
        if (parsed.attachments?.length > 0) {
          const uploadDir = path.resolve(__dirname, "../../uploads");

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          for (const att of parsed.attachments) {
            if (!att.filename?.toLowerCase().endsWith(".pdf")) continue;

            const filename = `${uuidv4()}_${att.filename}`;
            const filepath = path.join(uploadDir, filename);

            fs.writeFileSync(filepath, att.content);

            await pool.query(
              `
              INSERT INTO attachment(email_id,file_path,type,candidate_id)
              VALUES($1,$2,$3,$4)
              `,
              [
                emailId,
                `uploads/${filename}`,
                att.contentType,
                candidateId
              ]
            );

            await parseAndInsertCV(
              filepath,
              candidateId,
              sender
            );
          }
        }

        console.log("✅ Candidature complète insérée");

      } catch (err) {
        console.error("❌ Email parsing:", err.message);
      }
    }

    connection.end();

  } catch (err) {
    console.error("❌ IMAP:", err.message);
  }
}

/* =========================
   WATCHER
========================= */
function startEmailWatcher() {
  if (watcherStarted) return;

  watcherStarted = true;

  fetchEmails();
  setInterval(fetchEmails, 120000);

  console.log("📩 Email watcher démarré");
}

module.exports = {
  fetchEmails,
  startEmailWatcher
};