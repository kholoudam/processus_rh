require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

const { fetchEmails } = require('./services/email.service');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  fetchEmails();
}, 60000); // 🔥 1 minute (plus stable)