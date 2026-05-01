const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { parseCV } = require('./parser.service');

const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  }
};

exports.fetchEmails = async () => {
  const connection = await imaps.connect(config);
  await connection.openBox('INBOX');

  const messages = await connection.search(['UNSEEN'], {
    bodies: [''],
    markSeen: true
  });

  for (let item of messages) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const all = item.parts.find(p => p.which === '');
      const parsed = await simpleParser(all.body);

      const sender = parsed.from?.value[0]?.address || "";
      const subject = parsed.subject || "";
      const body = parsed.text || "";

      // EMAIL
      const emailRes = await client.query(
        `INSERT INTO email (subject, body, sender)
         VALUES ($1,$2,$3) RETURNING id`,
        [subject, body, sender]
      );

      const email_id = emailRes.rows[0].id;

      // PARSE
      let parsedData = { first_name: "", last_name: "", phone: "", address: "Casablanca", degree: "" };
      let filePath = null;

      if (parsed.attachments?.length) {
        const att = parsed.attachments[0];

        const fileName = Date.now() + "_" + att.filename.replace(/[^\w.-]/g, "_");
        filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, att.content);
        parsedData = await parseCV(filePath, body);
      }

      const fullName = `${parsedData.first_name} ${parsedData.last_name}`.trim();

      let candidate = await client.query(
        "SELECT * FROM candidate WHERE email=$1",
        [sender]
      );

      let candidate_id;

      if (candidate.rows.length > 0) {
        candidate_id = candidate.rows[0].id;
      } else {
        const newC = await client.query(
          `INSERT INTO candidate (name,email,phone,address,degree,status)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [
            fullName || "Non défini",
            sender,
            parsedData.phone || "",
            parsedData.address || "Casablanca",
            parsedData.degree || "",
            "RECEIVED"
          ]
        );

        candidate_id = newC.rows[0].id;
      }

      // 🔥 ATTACHMENT
      if (filePath) {
        await client.query(
          `INSERT INTO attachment (email_id,file_path,type,candidate_id)
           VALUES ($1,$2,$3,$4)`,
          [email_id, filePath, "CV", candidate_id]
        );
      }

      // 🔥 APPLICATION
      await client.query(
        `INSERT INTO application (status, applied_date, source, email_id, candidate_id)
         VALUES ($1,NOW(),$2,$3,$4)`,
        ["RECEIVED", "EMAIL", email_id, candidate_id]
      );

      await client.query('COMMIT');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
    } finally {
      client.release();
    }
  }

  connection.end();
};