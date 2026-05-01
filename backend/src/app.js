const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ===============================
// 🔧 MIDDLEWARES
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// 📁 UPLOADS (CHEMIN ABSOLU)
// ===============================
const uploadsPath = path.resolve(__dirname, '../uploads');
// const matchingRoutes = require('./routes/matching.routes');

console.log("📁 Uploads SERVED FROM:", uploadsPath);

// 🔍 Vérification dossier
if (!fs.existsSync(uploadsPath)) {
  console.error("❌ Dossier uploads introuvable !");
} else {
  console.log("✅ Uploads OK");
  console.log("📄 Fichiers:", fs.readdirSync(uploadsPath));
}

// ===============================
// 🔥 SERVIR LES FICHIERS (CV)
// ===============================
app.use('/uploads', express.static(uploadsPath));

// ===============================
// 🚀 ROUTES API
// ===============================
app.use('/api/emails', require('./routes/email.routes'));
app.use('/api/jobs', require('./routes/job.routes'));
app.use('/api/candidates', require('./routes/candidate.routes'));
//app.use('/api/match', matchingRoutes);
app.use("/api/match", require("./routes/matching.routes"))

// ===============================
// 🧪 TEST API
// ===============================
app.get('/', (req, res) => {
  res.send("✅ API WORKING");
});

// ===============================
// ❌ 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable" });
});

// ===============================
// ❌ ERROR HANDLER GLOBAL
// ===============================
app.use((err, req, res, next) => {
  console.error("❌ SERVER ERROR:", err);
  res.status(500).json({ message: "Erreur serveur" });
});

module.exports = app;