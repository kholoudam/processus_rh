const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

app.use(cors());
app.use(express.json());

// ✅ uploads est EN DEHORS de src
const uploadsPath = path.join(__dirname, '../uploads');

// 🔍 DEBUG
console.log("📁 Uploads SERVED FROM:", uploadsPath);

// 🔍 Vérification
if (!fs.existsSync(uploadsPath)) {
  console.error("❌ Dossier uploads introuvable !");
} else {
  console.log("📄 Fichiers dans uploads:", fs.readdirSync(uploadsPath));
}

// ✅ rendre accessible
app.use('/uploads', express.static(uploadsPath));

// ROUTES
app.use('/api/emails', require('./routes/email.routes'));
app.use('/api/jobs', require('./routes/job.routes'));
app.use('/api/candidates', require('./routes/candidate.routes'));

// TEST
app.get('/', (req, res) => {
  res.send("API WORKING");
});

module.exports = app;