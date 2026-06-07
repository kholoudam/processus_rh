const { spawn } = require("child_process");
const path = require("path");

// ─── État global du scraper ─────────────────────────────────
let scraperState = {
  running:    false,
  startedAt:  null,
  logs:       [],
  lastResult: null,
};

const MAX_LOGS = 300;

function addLog(line) {
  const ts = new Date().toLocaleTimeString("fr-FR");
  scraperState.logs.push(`[${ts}] ${line}`);
  if (scraperState.logs.length > MAX_LOGS) scraperState.logs.shift();
}

// ─── POST /api/linkedin/sync ────────────────────────────────
exports.syncLinkedin = (req, res) => {
  if (scraperState.running) {
    return res.status(409).json({
      success:   false,
      message:   "Synchronisation déjà en cours",
      startedAt: scraperState.startedAt,
    });
  }

  const scraperPath = path.join(
    __dirname,
    "../../linkedin_scraper/scraper.py"
  );
  const pythonPath =
    "C:\\Users\\kholo\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";

  scraperState.running   = true;
  scraperState.startedAt = new Date().toISOString();
  scraperState.logs      = [];
  addLog("Démarrage scraper LinkedIn...");

  // ── Répondre immédiatement — ne pas attendre la fin ─────
  res.json({
    success:        true,
    message:        "Synchronisation démarrée en arrière-plan",
    startedAt:      scraperState.startedAt,
    statusEndpoint: "/api/linkedin/status",
  });

  // ── Lancer Python en arrière-plan ───────────────────────
  const child = spawn(pythonPath, [scraperPath], {
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
    },
  });

  child.stdout.on("data", (data) => {
    data.toString("utf8").split("\n").forEach((line) => {
      if (line.trim()) { console.log("[LI]", line); addLog(line); }
    });
  });

  child.stderr.on("data", (data) => {
    data.toString("utf8").split("\n").forEach((line) => {
      if (line.trim()) { console.error("[LI ERR]", line); addLog("⚠ " + line); }
    });
  });

  child.on("close", (code) => {
    scraperState.running = false;
    const allLogs = scraperState.logs.join("\n");
    const ins = (allLogs.match(/(\d+) job\(s\) insere/) || [])[1];
    const dup = (allLogs.match(/(\d+) doublon/) || [])[1];

    scraperState.lastResult = {
      finishedAt: new Date().toISOString(),
      exitCode:   code,
      success:    code === 0,
      inserted:   ins ? parseInt(ins) : 0,
      skipped:    dup ? parseInt(dup) : 0,
    };

    const msg = code === 0
      ? `✓ Terminé — ${scraperState.lastResult.inserted} job(s) inséré(s)`
      : `✗ Erreur (code ${code})`;
    addLog(msg);
    console.log("[LinkedIn]", msg);
  });

  child.on("error", (err) => {
    scraperState.running = false;
    addLog("ERREUR PROCESS : " + err.message);
    console.error("[LinkedIn PROCESS ERROR]", err);
  });
};

// ─── GET /api/linkedin/status ───────────────────────────────
exports.getStatus = (req, res) => {
  res.json({
    success:    true,
    running:    scraperState.running,
    startedAt:  scraperState.startedAt,
    lastResult: scraperState.lastResult,
    recentLogs: scraperState.logs.slice(-80),
  });
};