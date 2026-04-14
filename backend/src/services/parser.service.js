const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const path = require('path');

// =========================
// 🔹 EXTRACTION TEXTE
// =========================
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);

    if (data.text && data.text.trim().length > 50) {
      return data.text;
    }

    return await ocrExtract(filePath);
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return await ocrExtract(filePath);
}

// =========================
// 🔹 OCR
// =========================
async function ocrExtract(filePath) {
  const { data } = await Tesseract.recognize(filePath, 'eng+fra');
  return data.text;
}

// =========================
// 🔹 PARSER PRINCIPAL
// =========================
exports.parseCV = async (filePath, emailBody = "") => {
  try {
    const cvText = await extractText(filePath);
    const text = (cvText + " " + emailBody).toLowerCase();

    // =========================
    // 🔹 NOM / PRENOM
    // =========================
    let first_name = "Inconnu";
    let last_name = "Inconnu";

    const nameMatch = emailBody.match(/je m[' ]?appelle\s+([a-zA-Z]+)\s+([a-zA-Z]+)/i);

    if (nameMatch) {
      first_name = nameMatch[1];
      last_name = nameMatch[2];
    }

    // =========================
    // 🔹 PHONE
    // =========================
    const phoneMatch = text.match(/(\+212|0)[5-7][0-9]{8}/);
    const phone = phoneMatch ? phoneMatch[0] : "";

    // =========================
    // 🔹 EMAIL
    // =========================
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    const email = emailMatch ? emailMatch[0] : "";

    // =========================
    // 🔹 ADRESSE
    // =========================
    const addressMatch = cvText.match(
      /(casablanca|rabat|marrakech|tanger|agadir|maroc)/i
    );
    const address = addressMatch ? addressMatch[0] : "";

    // =========================
    // 🔹 EDUCATION (PROPRE)
    // =========================
    let education = [];

    const eduSection = cvText.match(/éducation([\s\S]*?)(expérience|projets|skills|$)/i);

    if (eduSection) {
      const lines = eduSection[1].split("\n").map(l => l.trim());

      for (let line of lines) {
        if (
          line.length > 10 &&
          (
            line.toLowerCase().includes("master") ||
            line.toLowerCase().includes("ingénieur") ||
            line.toLowerCase().includes("technicien") ||
            line.toLowerCase().includes("baccalauréat")
          )
        ) {
          education.push(line);
        }
      }
    }

    // =========================
    // 🔹 EXPERIENCE (RÉSUMÉ)
    // =========================
    let experience = [];

    const expMatches = cvText.match(/stage[^\n]+/gi);

    if (expMatches) {
      experience = expMatches.map(e => e.trim());
    }

    // =========================
    // 🔹 SKILLS FILTRÉES
    // =========================
    const allowedSkills = [
      "python","java","sql","react","node","angular","vue",
      "javascript","php","django","flask","spring","docker",
      "kubernetes","aws","power bi","tableau",
      "machine learning","deep learning",
      "tensorflow","pytorch"
    ];

    let skills = [];

    for (let skill of allowedSkills) {
      if (text.includes(skill)) {
        skills.push(skill);
      }
    }

    return {
      first_name,
      last_name,
      phone,
      email,
      address,
      skills,
      education,
      experience
    };

  } catch (err) {
    console.error("❌ Parsing error:", err);

    return {
      first_name: "Inconnu",
      last_name: "Inconnu",
      phone: "",
      email: "",
      address: "",
      skills: [],
      education: [],
      experience: []
    };
  }
};