const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

app.use(cors());
app.use(express.json());

// ✅ CHEMIN EXACT DU DOSSIER uploads (dans backend)
const uploadsPath = path.join(__dirname, '../uploads'); 

// 🔥 IMPORTANT DEBUG
console.log("📁 Uploads SERVED FROM:", uploadsPath);

app.use('/uploads', express.static(uploadsPath));

app.use('/api/emails', require('./routes/email.routes'));
app.use('/api/candidates', require('./routes/candidate.routes'));

app.get('/', (req, res) => {
  res.send("API WORKING");
});

module.exports = app;