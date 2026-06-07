// parser.service.js
// =================
// Passerelle Node.js → microservice Python cv_parser.py
// Appelé par email.service.js via : const { parseCV } = require('./parser.service')
//
// Fonctionnement :
//   1. Reçoit un Buffer PDF depuis email.service.js
//   2. Encode le PDF en base64
//   3. Envoie une requête HTTP POST au microservice Flask (localhost:5001/parse)
//   4. Retourne le résultat structuré au format attendu par email.service.js

const http  = require("http");

const CV_PARSER_HOST = process.env.CV_PARSER_HOST || "localhost";
const CV_PARSER_PORT = parseInt(process.env.CV_PARSER_PORT) || 5001;
const CV_PARSER_TIMEOUT = 120_000; // 120s — 1er appel plus long (chargement modèles HF)

/**
 * Vérifie que le microservice Python est disponible.
 * Appelé au démarrage du serveur Node.js pour détecter les problèmes tôt.
 */
async function checkParserHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: CV_PARSER_HOST, port: CV_PARSER_PORT, path: "/health", timeout: 5000 },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            console.log(
              `✅ CV Parser connecté (NER=${json.ner}, ZSC=${json.zsc}, PyMuPDF=${json.pymupdf})`
            );
            resolve(true);
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => {
      console.warn(
        `⚠️  CV Parser non disponible sur localhost:${CV_PARSER_PORT} — démarrez cv_parser.py`
      );
      resolve(false);
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/**
 * parseCV(buffer) → objet structuré
 * 
 * Format de retour (compatible email.service.js) :
 * {
 *   name:       string | null,
 *   email:      string | null,
 *   phone:      string | null,
 *   address:    string | null,
 *   job_title:  string | null,   ← détecté automatiquement par Zero-Shot
 *   language:   string,          ← 'fr' | 'en' | 'unknown'
 *   skills:     string[],        ← compétences techniques
 *   softSkills: string[],        ← soft skills
 *   education:  { degree, school, year }[],
 *   experience: { position, company, duration }[],
 * }
 */
async function parseCV(buffer) {
  // Encoder le PDF en base64 pour le transport HTTP JSON
  const pdf_base64 = buffer.toString("base64");
  const bodyStr    = JSON.stringify({ pdf_base64 });

  return new Promise((resolve, reject) => {
    const options = {
      host:    CV_PARSER_HOST,
      port:    CV_PARSER_PORT,
      path:    "/parse",
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: CV_PARSER_TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let rawBody = "";
      res.setEncoding("utf8");
      res.on("data",  (chunk) => (rawBody += chunk));
      res.on("end",   () => {
        try {
          const parsed = JSON.parse(rawBody);

          if (res.statusCode !== 200) {
            return reject(new Error(`CV Parser erreur ${res.statusCode}: ${parsed.error || rawBody}`));
          }

          // Normaliser la réponse pour email.service.js
          resolve({
            name:       parsed.name       || null,
            email:      parsed.email      || null,
            phone:      parsed.phone      || null,
            address:    parsed.address    || null,
            job_title:  parsed.job_title  || null,
            language:   parsed.language   || "unknown",
            skills:     parsed.skills     || [],
            softSkills: parsed.softSkills || [],
            education:  (parsed.education  || []).map(e => ({
              degree:  e.degree  || null,
              school:  e.school  || null,
              year:    e.year    || null,
            })),
            experience: (parsed.experience || []).map(e => ({
              position: e.position || null,
              company:  e.company  || null,
              duration: e.duration || null,
            })),
          });

        } catch (err) {
          reject(new Error(`CV Parser réponse invalide : ${err.message}`));
        }
      });
    });

    req.on("error",   (err) => reject(new Error(`CV Parser connexion : ${err.message}`)));
    req.on("timeout", ()    => { req.destroy(); reject(new Error("CV Parser timeout (60s)")); });

    req.write(bodyStr);
    req.end();
  });
}

module.exports = { parseCV, checkParserHealth };