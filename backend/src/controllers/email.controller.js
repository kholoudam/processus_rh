// src/controllers/email.controller.js
const emailService = require('../services/email.service');
const parser = require('../services/parser.service');
const drive = require('../services/drive.service');
const pool = require('../config/db');

exports.processEmails = async (req, res) => {
  const emails = await emailService.fetchEmails();

  for (let mail of emails) {
    let cvLink = null;

    if (mail.attachments.length > 0) {
      cvLink = drive.uploadToDrive(mail.attachments[0]);

      const parsedData = parser.parseCV(mail.text);

      await pool.query(
        `INSERT INTO candidates (email, cv_link, subject, body, skills, education)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          parsedData.email,
          cvLink,
          mail.subject,
          mail.text,
          JSON.stringify(parsedData.skills),
          parsedData.education
        ]
      );
    }
  }

  res.send("Emails processed");
};