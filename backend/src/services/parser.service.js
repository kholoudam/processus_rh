const pdfParse = require("pdf-parse");

/* =========================
   NORMALIZE
   Remplace (cid:XXX) → bullet visible, nettoie whitespace
========================= */
function normalize(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    // (cid:127) et tous les (cid:*) utilisés comme bullets → •
    .replace(/\(cid:\d+\)/g, "•")
    .replace(/[ ]+/g, " ")
    .trim();
}

/* =========================
   DETECTION PDF ILLISIBLE
========================= */
function isCorruptedText(text) {
  if (!text || text.length < 80) return true;
  const pdfTokens = (text.match(/\b(obj|endobj|stream|endstream|xref|trailer|startxref)\b/g) || []).length;
  if (pdfTokens >= 3) return true;
  return false;
}

/* =========================
   EXTRACT SECTION
========================= */
function getSection(text, startVariants, endVariants = []) {
  let startIndex = -1;
  let matchedStart = "";

  for (const variant of startVariants) {
    const idx = text.indexOf(variant);
    if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
      startIndex = idx;
      matchedStart = variant;
    }
  }

  if (startIndex === -1) return "";

  let endIndex = text.length;
  for (const marker of endVariants) {
    const idx = text.indexOf(marker, startIndex + matchedStart.length);
    if (idx !== -1 && idx < endIndex) endIndex = idx;
  }

  return text.substring(startIndex + matchedStart.length, endIndex).trim();
}

/* =========================
   EXTRACT EMAIL
========================= */
function extractEmail(text) {
  const match = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  return match ? match[0].trim() : null;
}

/* =========================
   EXTRACT PHONE
   Marocain (+212, 06/07) + Français (+33, 0X XX XX XX XX)
========================= */
function extractPhone(text) {
  const moroccan = text.match(/(\+212|00212|0212)[.\-\s]?[5-7][.\-\s]?\d{2}[.\-\s]?\d{2}[.\-\s]?\d{2}[.\-\s]?\d{2}/);
  if (moroccan) return moroccan[0].replace(/[.\-\s]/g, "").trim();

  const local = text.match(/0[5-7][.\-\s]?\d{2}[.\-\s]?\d{2}[.\-\s]?\d{2}[.\-\s]?\d{2}/);
  if (local) return local[0].replace(/[.\-\s]/g, "").trim();

  // Français : +33 X XX XX XX XX  ou  0X XX XX XX XX
  const french = text.match(/(\+33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}/);
  if (french && french[0].replace(/\D/g, "").length >= 9) return french[0].trim();

  // Labellisé
  const labeled = text.match(/(?:t[eé]l[eé]?phone?|mobile|gsm)\s*[:\-]?\s*([\+\d][.\-\s\d]{7,20})/i);
  if (labeled && labeled[1].replace(/\D/g, "").length >= 8) return labeled[1].trim();

  return null;
}

/* =========================
   EXTRACT ADDRESS
   Retourne la ligne d'adresse propre, pas le header complet.
========================= */
function extractAddress(text) {
  // "Ville, Maroc" explicite
  const cityCountry = text.match(
    /\b(Casablanca|Rabat|Fès|Fes|Tanger|Agadir|Marrakech|Kénitra|Kenitra|Meknès|Meknes|Salé|Sale|Mohammedia|Settat|Oujda|Laâyoune|Témara|Temara)\s*,\s*Maroc\b/i
  );
  if (cityCountry) return cityCountry[0].trim();

  const lines = text.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.includes("|") || t.includes("@") || t.toLowerCase().includes("linkedin")) continue;
    // Ligne "Adresse : ..." → on prend la valeur
    const addrLabel = t.match(/^adresse\s*:\s*(.+)/i);
    if (addrLabel) return addrLabel[1].trim();
    // Numéro + rue
    if (/^\d+[\s,].{5,}/.test(t) && t.length < 100) return t;
    // Rue / avenue / chemin / boulevard
    if (/\b(rue|avenue|av\.|boulevard|bd\.|chemin|allée|allee|impasse|place)\b/i.test(t) && t.length < 100) return t;
    // Ville marocaine seule
    if (
      t.length < 60 &&
      /(Casablanca|Rabat|Fès|Fes|Tanger|Agadir|Marrakech|Kénitra|Kenitra|Meknès|Meknes|Salé|Sale|Mohammedia|Settat|Oujda)/i.test(t)
    ) return t;
  }
  return null;
}

/* =========================
   EXTRACT NAME
========================= */
function extractName(lines) {
  for (const line of lines.slice(0, 8)) {
    if (!line || line.includes("|") || line.includes("@") || line.toLowerCase().includes("linkedin")) continue;
    if (line.length > 60) continue;
    // "Saad EL AMRANI" ou "Omar BENHADDOU"
    if (/^[A-ZÀ-Ÿa-zà-ÿ\-]+(\s[A-ZÀ-Ÿa-zà-ÿ\-]+)*\s[A-ZÀ-Ÿ]{2,}(\s[A-ZÀ-Ÿ]{2,})?$/.test(line)) return line.trim();
    // "Capucine Launay" — prénom + nom classique
    if (/^[A-ZÀ-Ÿ][a-zà-ÿ\-]+(\s[A-ZÀ-Ÿ][a-zà-ÿ\-]+)+$/.test(line)) return line.trim();
    // "Arthur du Alves" — avec particule
    if (/^[A-ZÀ-Ÿ][a-zà-ÿ\-]+(\s(du|de|le|la|van|von|el|al)\s)?[A-ZÀ-Ÿ][a-zà-ÿ\-]+$/i.test(line)) return line.trim();
    // NOM Prénom
    if (/^[A-ZÀ-Ÿ]{2,}(\s[A-ZÀ-Ÿ]{2,})*\s[A-ZÀ-Ÿ][a-zà-ÿ\-]+/.test(line)) return line.trim();
  }
  return null;
}

/* =========================
   PARSE EDUCATION
   Format Colab : "Diplôme Année\nÉcole"  (année collée au diplôme)
   Format alternatif : "Diplôme\nÉcole\nAnnée"
========================= */
function parseEducation(section) {
  if (!section) return [];

  const lines = section.split("\n").map(l => l.trim()).filter(Boolean);
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Format A : "Master Génie Industriel 2022"  (diplôme + année sur même ligne)
    const withYear = line.match(/^(.+?)\s+((?:19|20)\d{2})$/);
    if (withYear) {
      const degreeText = withYear[1].trim();
      const year       = parseInt(withYear[2]);
      if (/master|licence|bachelor|ingénieur|ingenieur|doctorat|bts|dut|bac\b|dipl[oô]me/i.test(degreeText)) {
        const nextLine = lines[i + 1] || "";
        const school   = nextLine && !/^((?:19|20)\d{2})$/.test(nextLine) ? nextLine : null;
        result.push({ degree: degreeText, school, year });
        i += school ? 2 : 1;
        continue;
      }
    }

    // Format B : "Diplôme\nÉcole\n2022"
    if (/master|licence|bachelor|ingénieur|ingenieur|doctorat|bts|dut|bac\b|dipl[oô]me/i.test(line)) {
      const school   = (lines[i + 1] && !/^\d{4}$/.test(lines[i + 1])) ? lines[i + 1] : null;
      const yearLine = school ? lines[i + 2] : lines[i + 1];
      const year     = yearLine?.match(/\b(19|20)\d{2}\b/) ? parseInt(yearLine.match(/\b(19|20)\d{2}\b/)[0]) : null;
      result.push({ degree: line, school, year });
      i += (school ? 1 : 0) + (year ? 1 : 0) + 1;
      continue;
    }

    i++;
  }

  return result;
}

/* =========================
   PARSE EXPERIENCE
   Format Colab : "Ingénieur Production 2019-2022\nAlstom Maroc"
   Format alternatif bullet / lignes séparées
========================= */
function parseExperience(section) {
  if (!section) return [];

  const lines = section.split("\n").map(l => l.trim()).filter(Boolean);
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Format A : "Titre 2019-2022"  (titre + durée sur même ligne)
    const titleDuration = line.match(/^(.+?)\s+((?:19|20)\d{2}\s*[-–]\s*(?:(?:19|20)\d{2}|[Pp]r[eé]sent|[Aa]ctuel|aujourd))$/);
    if (titleDuration) {
      const company = lines[i + 1] && !/^((?:19|20)\d{2})/.test(lines[i + 1]) ? lines[i + 1] : null;
      result.push({
        position: titleDuration[1].trim(),
        duration: titleDuration[2].trim(),
        company:  company || null
      });
      i += company ? 2 : 1;
      continue;
    }

    // Format B : "Titre • Entreprise • 2020–2023"
    if (line.includes("•") && /\d{4}/.test(line)) {
      const parts = line.split("•").map(p => p.trim()).filter(Boolean);
      const duration = parts.find(p => /\d{4}/.test(p)) || null;
      result.push({
        position: parts[0],
        company:  parts.find((p, idx) => idx > 0 && !/\d{4}/.test(p)) || null,
        duration
      });
      i++;
      continue;
    }

    // Format C : "Titre\nEntreprise\n2020-2023"
    if (/ingénieur|ingenieur|technicien|responsable|préparateur|preparateur|agent|manager|assistant|analyste|process|coordinateur/i.test(line)) {
      const nextLine  = lines[i + 1] || "";
      const thirdLine = lines[i + 2] || "";
      const dur = thirdLine.match(/((?:19|20)\d{2}\s*[-–]\s*(?:(?:19|20)\d{2}|[Pp]r[eé]sent|[Aa]ctuel))/);
      result.push({
        position: line,
        company:  nextLine || null,
        duration: dur ? dur[0] : null
      });
      i += dur ? 3 : 2;
      continue;
    }

    i++;
  }

  return result;
}

/* =========================
   PARSE BULLETS
   Gère :
     • "(cid:127) Valeur"  → déjà converti en "• Valeur" par normalize()
     • "• Valeur"
     • "Catégorie : val1 • val2"
========================= */
function parseBullets(section) {
  if (!section) return [];

  const expanded = [];
  const rawLines = section.split("\n").map(l => l.trim()).filter(Boolean);

  for (const line of rawLines) {
    // Skip titres de section résiduels
    if (/^(COMPÉTENCES|COMPETENCES|SOFT SKILLS|LANGUES|CERTIFICATIONS|EXPÉRIENCE|EXPERIENCE|FORMATION|EDUCATION)/i.test(line)) continue;

    // "Catégorie : val1 • val2 • val3"
    if (line.includes(":") && !line.startsWith("•")) {
      const colonIdx   = line.indexOf(":");
      const afterColon = line.substring(colonIdx + 1).trim();
      if (afterColon.length > 0) {
        const subItems = afterColon
          .split(/[•,]/)
          .map(v => v.trim())
          .filter(v => v.length > 1 && v.length < 80);
        if (subItems.length >= 1) {
          subItems.forEach(v => expanded.push(v));
          continue;
        }
      }
    }

    // Ligne avec plusieurs "•" : "• val1 • val2"
    if ((line.match(/•/g) || []).length > 1) {
      line.split("•").map(v => v.trim()).filter(v => v.length > 1 && v.length < 80)
        .forEach(v => expanded.push(v));
      continue;
    }

    // Bullet simple "• Valeur" ou "- Valeur"
    const clean = line.replace(/^[•\-–*]\s*/, "").trim();
    if (clean.length > 1 && clean.length < 80) expanded.push(clean);
  }

  return [...new Set(expanded)].filter(s => s.length > 1);
}

/* =========================
   PARSE CV  — export principal
========================= */
async function parseCV(buffer) {
  const data = await pdfParse(buffer);
  const raw  = normalize(data.text);

  if (isCorruptedText(raw)) {
    throw new Error("PDF non lisible (scanné ou corrompu) — extraction impossible");
  }

  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

  const SEC_FORMATION  = ["FORMATION", "FORMATIONS", "ÉDUCATION", "EDUCATION", "DIPLÔMES", "DIPLOMES", "PARCOURS ACADÉMIQUE", "PARCOURS ACADEMIQUE"];
  const SEC_EXPERIENCE = [
    "EXPÉRIENCES PROFESSIONNELLES", "EXPERIENCES PROFESSIONNELLES",
    "EXPÉRIENCE PROFESSIONNELLE",   "EXPERIENCE PROFESSIONNELLE",
    "EXPÉRIENCES",                  "EXPERIENCES",
    "EXPÉRIENCE",                   "EXPERIENCE",
    "PARCOURS PROFESSIONNEL"
  ];
  const SEC_SKILLS = [
    "COMPÉTENCES TECHNIQUES", "COMPETENCES TECHNIQUES",
    "COMPÉTENCES",            "COMPETENCES",
    "HARD SKILLS",            "OUTILS & TECHNOLOGIES"
  ];
  const SEC_SOFT  = ["SOFT SKILLS", "COMPÉTENCES COMPORTEMENTALES", "COMPETENCES COMPORTEMENTALES", "QUALITÉS", "QUALITES"];
  const SEC_CERTS = ["CERTIFICATIONS", "CERTIFICATS", "HABILITATIONS", "CERTIFICATIONS & HABILITATIONS"];
  const SEC_LANG  = ["LANGUES"];
  const ALL_SEC   = [
    ...SEC_FORMATION, ...SEC_EXPERIENCE, ...SEC_SKILLS,
    ...SEC_SOFT, ...SEC_CERTS, ...SEC_LANG,
    "CENTRES D'INTÉRÊT", "LOISIRS", "RÉFÉRENCES", "REFERENCES",
    "INFORMATIONS PERSONNELLES", "CONTACT"
  ];

  const formation  = getSection(raw, SEC_FORMATION,  [...SEC_EXPERIENCE, ...ALL_SEC]);
  const experience = getSection(raw, SEC_EXPERIENCE, [...SEC_SKILLS,     ...ALL_SEC]);
  const skills     = getSection(raw, SEC_SKILLS,     [...SEC_SOFT,       ...ALL_SEC]);
  const soft       = getSection(raw, SEC_SOFT,       [...SEC_CERTS,      ...ALL_SEC]);
  const certs      = getSection(raw, SEC_CERTS,      ALL_SEC);

  return {
    name:           extractName(lines),
    email:          extractEmail(raw),
    phone:          extractPhone(raw),
    address:        extractAddress(raw),
    education:      parseEducation(formation),
    experience:     parseExperience(experience),
    skills:         parseBullets(skills),
    softSkills:     parseBullets(soft),
    certifications: parseBullets(certs),
    rawText:        raw
  };
}

module.exports = { parseCV };