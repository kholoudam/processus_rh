const fs      = require('fs');
const pdf     = require('pdf-parse');
const mammoth = require('mammoth');
const path    = require('path');

// =========================
// EXTRACTION TEXTE
// =========================
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const data   = await pdf(buffer);
      if (data.text && data.text.trim().length > 30) return data.text;
      console.warn('PDF peu lisible.');
      return data.text || '';
    }
    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn('extractText error:', err.message);
    return '';
  }
}

function clean(text) {
  return (text || '')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\t/g, ' ').replace(/ {2,}/g, ' ').trim();
}

// =========================
// EMAIL
// =========================
function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : '';
}

// =========================
// TELEPHONE
// =========================
function extractPhone(text) {
  const patterns = [
    /(?:\+212|00212)\s?[5-7]\d{8}/,
    /0[5-7]\d{8}/,
    /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].replace(/[\s.\-]/g, '').trim();
  }
  return '';
}

// =========================
// NOM — 5 strategies
// =========================
function extractName(cvText, emailBody, senderEmail) {
  const allText = cvText + '\n' + emailBody;

  // 1. "je m'appelle / I am / my name is"
  const s1 = allText.match(/(?:je m['']?appelle|je suis|I am|my name is)\s+([A-ZÀ-Ÿa-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+){1,3})/i);
  if (s1) return s1[1].trim();

  // 2. "Nom : / Prénom :" dans le CV
  const s2 = cvText.match(/(?:^|\n)\s*(?:nom|name|prénom|full name)\s*[:\-]\s*([A-ZÀ-Ÿa-zà-ÿ][^\n]{2,40})/im);
  if (s2) return s2[1].trim();

  // 3. Première ligne MAJUSCULE (pattern CV classique)
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line === line.toUpperCase() && line.length > 4 && line.length < 50 && /^[A-ZÀ-Ÿ\s\-']+$/.test(line)) {
      return line.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 4. Première ligne avec 2-4 mots en lettres seulement
  for (const line of lines.slice(0, 12)) {
    if (/cv|curriculum|vitae|profil|contact|objet|@|\d{4}/i.test(line)) continue;
    const words = line.split(/\s+/).filter(w => /^[A-ZÀ-Ÿa-zà-ÿ\-']{2,}$/.test(w));
    if (words.length >= 2 && words.length <= 4) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 5. Fallback : partie locale email sender
  if (senderEmail) {
    const local = senderEmail.split('@')[0].replace(/[._\-\d]+/g, ' ').trim();
    if (local.length > 2) {
      return local.split(' ').filter(w => w.length > 1)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }
  return 'Non défini';
}

// =========================
// ADRESSE
// =========================
function extractAddress(text) {
  const villes = [
    'Casablanca','Rabat','Fès','Marrakech','Tanger','Agadir','Meknès','Oujda',
    'Kenitra','Tétouan','Safi','El Jadida','Nador','Settat','Berrechid',
    'Mohammedia','Larache','Khouribga','Beni Mellal','Errachidia',
    'Dakhla','Laâyoune','Taroudant','Ouarzazate','Ifrane','Salé',
  ];
  for (const v of villes) {
    if (new RegExp(v, 'i').test(text)) return v;
  }
  const m = text.match(/(?:adresse|ville|city|address)\s*[:\-]?\s*([^\n]{3,50})/i);
  return m ? m[1].trim() : 'Maroc';
}

// =========================
// DIPLOME
// =========================
function extractDegree(text) {
  const patterns = [
    /(?:master|mastère|m2)\s+[^\n]{0,80}/i,
    /(?:licence|bachelor|l3)\s+[^\n]{0,80}/i,
    /(?:ingénieur|engineer)\s+[^\n]{0,80}/i,
    /(?:doctorat|ph\.?d)\s+[^\n]{0,80}/i,
    /(?:bts|dut|bac\s*\+\s*\d)\s+[^\n]{0,80}/i,
    /(?:technicien spécialisé|technicien)\s+[^\n]{0,80}/i,
    /(?:diplôme|diploma)\s+[^\n]{0,80}/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim().slice(0, 120);
  }
  return '';
}

// =========================
// COMPETENCES
// =========================
function extractSkills(text) {
  const lower  = text.toLowerCase();
  const found  = new Set();

  const keywords = [
    'python','java','javascript','typescript','c++','c#','php','ruby','go','rust',
    'swift','kotlin','scala','r','matlab','vba','bash','shell',
    'react','vue','angular','nodejs','node.js','express','nextjs','nuxt',
    'django','flask','fastapi','spring','laravel','symfony','asp.net',
    'html','css','sass','scss','bootstrap','tailwind','jquery','graphql','rest api',
    'sql','postgresql','mysql','mongodb','redis','elasticsearch','oracle','sqlite',
    'power bi','tableau','qlik','sap','excel',
    'pandas','numpy','scikit-learn','tensorflow','pytorch','keras',
    'machine learning','deep learning','nlp','computer vision','data science',
    'big data','hadoop','spark','airflow','etl',
    'docker','kubernetes','aws','azure','gcp','terraform','ansible','jenkins',
    'git','github','gitlab','ci/cd','linux','unix','nginx',
    'jira','confluence','trello','figma','autocad','solidworks',
    'agile','scrum','kanban','merise','uml',
    'français','anglais','arabe','espagnol','allemand','italien',
    'lean','six sigma','5s','qualité','iso','hse','sécurité',
    'production','maintenance','supply chain','logistique','méthodes',
    'rh','ressources humaines','recrutement','paie','formation',
    'gestion de projet','management','leadership','communication',
  ];

  for (const kw of keywords) {
    if (lower.includes(kw)) found.add(kw);
  }

  // Section libre compétences
  const sec = text.match(/(?:compétences?|skills?|savoir[- ]faire|technologies?|outils?)\s*[:\-]?\n([\s\S]{0,800}?)(?:\n\n|\n[A-ZÀÂ])/i);
  if (sec) {
    sec[1].split(/[\n,•\-\|\/◆▪◦]/)
      .map(s => s.replace(/[:\*\[\]()\d]/g, '').trim())
      .filter(s => s.length > 2 && s.length < 50)
      .forEach(s => found.add(s.toLowerCase()));
  }

  return [...found].filter(Boolean).slice(0, 40);
}

// =========================
// EXPERIENCES → { position, company, duration }
// =========================
function extractExperience(text) {
  const results = [];

  const sec = text.match(/(?:expérience|experience|parcours professionnel|emplois?)\s*[:\-]?\n([\s\S]{0,2000}?)(?:\n(?:formation|éducation|compétences?|skills?|langues|projets?|références?|centres?)\s*[:\-]?\n|$)/i);
  const section = sec ? sec[1] : text.slice(0, 2000);

  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
  let current = null;

  for (const line of lines) {
    const yearRange  = line.match(/\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|présent|aujourd['']?hui|now|actuel)/i);
    const isPosition = /(?:ingénieur|développeur|dev |manager|chef|responsable|technicien|coordinateur|analyste|consultant|stagiaire|intern|directeur|assistant|chargé|agent)/i.test(line);

    if (yearRange || isPosition) {
      if (current && (current.position || current.company)) results.push(current);
      current = {
        position: line.replace(/\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|présent|aujourd['']?hui|now|actuel)\b/gi, '').replace(/[|•◆▪]/g, '').trim(),
        company:  '',
        duration: yearRange ? yearRange[0] : '',
      };
    } else if (current) {
      if (!current.company && line.length > 2 && line.length < 100) {
        current.company = line.replace(/[|•◆▪]/g, '').trim();
      }
    }
  }
  if (current && (current.position || current.company)) results.push(current);

  // Fallback lignes "stage"
  if (!results.length) {
    const stages = text.match(/(?:stage|mission|cdd|cdi)[^\n]{5,100}/gi) || [];
    stages.forEach(s => results.push({ position: s.trim(), company: '', duration: '' }));
  }

  return results.slice(0, 10);
}

// =========================
// FORMATIONS → { degree, institution, year }
// =========================
function extractEducation(text) {
  const results = [];

  const sec = text.match(/(?:formation|éducation|education|études|diplômes?|parcours scolaire)\s*[:\-]?\n([\s\S]{0,1500}?)(?:\n(?:expérience|compétences?|skills?|langues|projets?|références?|centres?)\s*[:\-]?\n|$)/i);
  if (!sec) return results;

  const lines = sec[1].split('\n').map(l => l.trim()).filter(Boolean);
  let current = null;

  for (const line of lines) {
    const yearMatch = line.match(/\b(20\d{2}|19\d{2})\b/);
    const isDiploma = /(?:master|mastère|licence|bachelor|ingénieur|bts|dut|bac|doctorat|phd|diplôme|technicien)/i.test(line);

    if (isDiploma) {
      if (current) results.push(current);
      current = {
        degree:      line.replace(/\b(20\d{2}|19\d{2})\b/g, '').replace(/[|•◆▪]/g, '').trim(),
        institution: '',
        year:        yearMatch ? parseInt(yearMatch[0]) : null,
      };
    } else if (current) {
      if (!current.institution && line.length > 3 && line.length < 120) {
        current.institution = line.replace(/[|•◆▪]/g, '').trim();
      }
      if (!current.year && yearMatch) current.year = parseInt(yearMatch[0]);
    }
  }
  if (current) results.push(current);

  return results.slice(0, 8);
}

// =========================
// EXPORT PRINCIPAL
// =========================
exports.parseCV = async (filePath, emailBody = '') => {
  try {
    const cvText  = await extractText(filePath);
    const full    = clean(cvText + '\n' + emailBody);
    const emailEx = extractEmail(full);
    const name    = extractName(cvText, emailBody, emailEx);
    const parts   = name.trim().split(/\s+/);

    return {
      first_name: parts[0]                 || '',
      last_name:  parts.slice(1).join(' ') || '',
      phone:      extractPhone(full),
      email:      emailEx,
      address:    extractAddress(full),
      degree:     extractDegree(full),
      skills:     extractSkills(full),
      experience: extractExperience(cvText),
      education:  extractEducation(cvText),
    };
  } catch (err) {
    console.error('parseCV error:', err.message);
    return {
      first_name: 'Non défini', last_name: '', phone: '', email: '',
      address: 'Maroc', degree: '', skills: [], experience: [], education: [],
    };
  }
};