const { fetchEmails } = require('../services/email.service');

// GET /api/emails/fetch
// Déclenche manuellement la récupération des emails
exports.processEmails = async (req, res) => {
  try {
    await fetchEmails();
    res.json({ success: true, message: 'Emails traites avec succes.' });
  } catch (err) {
    console.error('processEmails error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};