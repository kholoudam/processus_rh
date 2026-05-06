require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

/* ===============================
   MIDDLEWARES
=============================== */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   DOSSIER UPLOADS
=============================== */
const uploadsPath = path.resolve(__dirname, "../uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use("/uploads", express.static(uploadsPath));

console.log("📁 Uploads:", uploadsPath);

/* ===============================
   ROUTES API
=============================== */
try {
  app.use("/api/emails", require("./routes/email.routes"));
} catch (err) {
  console.log("⚠ email.routes absent");
}

try {
  app.use("/api/jobs", require("./routes/job.routes"));
} catch (err) {
  console.log("⚠ job.routes absent");
}

try {
  app.use("/api/candidates", require("./routes/candidate.routes"));
} catch (err) {
  console.log("⚠ candidate.routes absent");
}

try {
  app.use("/api/match", require("./routes/matching.routes"));
} catch (err) {
  console.log("⚠ matching.routes absent");
}

/* ===============================
   TEST ROUTE
=============================== */
app.get("/", (req, res) => {
  res.send("🚀 Backend RH running");
});

/* ===============================
   EMAIL WATCHER AUTO
=============================== */
try {
  const { startEmailWatcher } = require("./services/email.service");

  if (startEmailWatcher) {
    startEmailWatcher();
    console.log("📩 Email watcher démarré");
  } else {
    console.log("⚠ startEmailWatcher non trouvé");
  }
} catch (err) {
  console.error("❌ Email watcher error:", err.message);
}

/* ===============================
   404
=============================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route introuvable"
  });
});

/* ===============================
   ERROR HANDLER
=============================== */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Erreur serveur",
    error: err.message
  });
});

module.exports = app;