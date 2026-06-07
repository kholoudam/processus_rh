# -*- coding: utf-8 -*-
"""
cv_parser.py — Microservice Flask pour parsing de CV PDF
=========================================================
Librairies utilisées :
  - PyMuPDF (fitz)     : Lecture rapide des PDF, extraction texte + images
  - Transformers HF    : NER (camembert-ner) + classification zéro-shot
  - Flask              : Exposition API REST locale (appelée par Node.js)
  - langdetect         : Détection automatique langue du CV (fr/en)
  - Regex              : Fallback robuste email, téléphone, compétences

Installation :
  pip install flask pymupdf transformers torch langdetect python-dotenv
  pip install sentencepiece accelerate   # requis par CamemBERT

Lancement :
  python cv_parser.py
  → écoute sur http://localhost:5001
"""

import re
import sys
import json
import base64
import traceback
import os
import tempfile

import fitz  # PyMuPDF

from flask import Flask, request, jsonify

# ── langdetect (optionnel) ─────────────────────────────────
try:
    from langdetect import detect as lang_detect
    LANGDETECT_OK = True
except ImportError:
    LANGDETECT_OK = False
    print("[WARN] langdetect non installé — détection langue désactivée", flush=True)

# ── Transformers / HuggingFace ─────────────────────────────
# On charge les modèles une seule fois au démarrage (lourd mais rapide ensuite)
NER_MODEL   = None
NER_OK      = False
ZSC_MODEL   = None
ZSC_OK      = False

def load_models():
    """
    Charge les modèles HuggingFace en mémoire.
    Appelé une seule fois au démarrage du serveur Flask.
    
    Modèles utilisés :
      1. Jean-Baptiste/camembert-ner
         → NER (Named Entity Recognition) entraîné sur du français.
            Détecte : PER (personne), ORG (organisation), LOC (lieu), MISC
            Utilisé pour : extraire le nom du candidat et l'entreprise actuelle.
      
      2. facebook/bart-large-mnli  (OU cross-encoder/nli-MiniLM-L2-H256 plus léger)
         → Classification zéro-shot (Zero Shot Classification)
            Pas besoin d'entraînement : on lui donne des labels et il classe.
            Utilisé pour : détecter le métier/domaine du candidat (ex: "Développeur Web",
            "Data Scientist", "Chef de projet", etc.)
    """
    global NER_MODEL, NER_OK, ZSC_MODEL, ZSC_OK

    print("[CV Parser] Chargement modèles HuggingFace...", flush=True)

    # ── Modèle 1 : NER français (CamemBERT) ───────────────
    try:
        from transformers import pipeline
        NER_MODEL = pipeline(
            "ner",
            model="Jean-Baptiste/camembert-ner",
            aggregation_strategy="simple",  # regroupe les tokens du même entité
            device=-1  # -1 = CPU ; mettez 0 pour GPU si disponible
        )
        NER_OK = True
        print("[CV Parser] ✓ camembert-ner chargé (NER français)", flush=True)
    except Exception as e:
        print(f"[CV Parser] ✗ camembert-ner non disponible : {e}", flush=True)

    # ── Modèle 2 : Classification zéro-shot ──────────────
    # Modèle très léger (typeform/distilbart-mnli-12-3, ~250MB)
    # Alternative encore plus légère : valhalla/distilbart-mnli-12-1
    try:
        from transformers import pipeline as hf_pipeline
        ZSC_MODEL = hf_pipeline(
            "zero-shot-classification",
            model="typeform/distilbart-mnli-12-3",
            device=-1
        )
        ZSC_OK = True
        print("[CV Parser] ✓ zero-shot-classification chargé", flush=True)
    except Exception as e:
        print(f"[CV Parser] ✗ zero-shot-classification non disponible : {e}", flush=True)

    print("[CV Parser] Modèles prêts.", flush=True)


# =========================================================
# EXTRACTION TEXTE — PyMuPDF (fitz)
# =========================================================
def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    PyMuPDF (fitz) :
      - Beaucoup plus rapide que pdfplumber ou PyPDF2
      - Préserve l'ordre de lecture du texte
      - Gère les PDF multi-colonnes, scannés (via OCR si Tesseract installé)
      - get_text("text") = texte brut dans l'ordre de lecture
    """
    text_parts = []
    try:
        # Ouvrir depuis bytes en mémoire (pas besoin de fichier temporaire)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        for page_num, page in enumerate(doc):
            # Extraction texte simple — rapide et fiable
            page_text = page.get_text("text")
            text_parts.append(page_text)

            # Optionnel : extraire les images de la page (utile pour les CV graphiques)
            # image_list = page.get_images(full=True)
            # (ici on ne traite pas les images OCR pour garder le code simple)

        doc.close()
    except Exception as e:
        print(f"[CV Parser] Erreur PyMuPDF : {e}", flush=True)

    return "\n".join(text_parts)


def extract_text_structured(pdf_bytes: bytes) -> dict:
    """
    Extraction structurée avec PyMuPDF :
    Retourne le texte de chaque page + métadonnées du document.
    Utile pour détecter les sections (EXPÉRIENCE, FORMATION, COMPÉTENCES...).
    """
    result = {"pages": [], "metadata": {}, "full_text": ""}
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        result["metadata"] = doc.metadata  # titre, auteur, sujet, créateur...

        for page in doc:
            # get_text("blocks") = liste de blocs de texte avec positions (x0,y0,x1,y1)
            # Utile pour reconstruire l'ordre lecture dans les CV multi-colonnes
            blocks = page.get_text("blocks")
            # Trier par position verticale (y0) puis horizontale (x0)
            blocks_sorted = sorted(blocks, key=lambda b: (round(b[1]/20)*20, b[0]))
            page_text = "\n".join(b[4] for b in blocks_sorted if b[4].strip())
            result["pages"].append(page_text)

        result["full_text"] = "\n\n".join(result["pages"])
        doc.close()
    except Exception as e:
        print(f"[CV Parser] Erreur extraction structurée : {e}", flush=True)

    return result


# =========================================================
# DÉTECTION DE LANGUE
# =========================================================
def detect_language(text: str) -> str:
    """Retourne 'fr', 'en', ou 'unknown'."""
    if not LANGDETECT_OK or not text.strip():
        return "unknown"
    try:
        lang = lang_detect(text[:1000])
        return lang if lang in ["fr", "en"] else "unknown"
    except:
        return "unknown"


# =========================================================
# PARSING REGEX — Extraction champs de base
# =========================================================

# ── Email ──────────────────────────────────────────────────
EMAIL_RE = re.compile(
    r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
)

# ── Téléphone (formats FR + international) ────────────────
PHONE_RE = re.compile(
    r'(?:\+212|0212|\+33|0033)?'         # indicatif optionnel
    r'[\s.\-]?'
    r'(?:0[5-9]|[5-9])'                  # premier chiffre
    r'(?:[\s.\-]?\d{2}){4}'             # 8 autres chiffres par paires
)

# ── Adresse (ville, code postal) ──────────────────────────
ADDRESS_RE = re.compile(
    r'\b(?:\d{5}|[A-Z]{2}-\d{4,5})\b.*'  # code postal
    r'|\b(?:Casablanca|Rabat|Marrakech|Fès|Tanger|Agadir|Paris|Lyon|Marseille|'
    r'Toulouse|Nice|Nantes|Bordeaux|Montreal|Bruxelles)\b',
    re.IGNORECASE
)

# ── Sections du CV ────────────────────────────────────────
SECTION_HEADERS = {
    "experience": re.compile(
        r'^(expériences?\s*(professionnelles?)?|experience|parcours\s*professionnel'
        r'|emplois?|postes?\s*occupés?)',
        re.IGNORECASE | re.MULTILINE
    ),
    "education": re.compile(
        r'^(formations?|éducation|diplômes?|études?|education|scolarité|cursus)',
        re.IGNORECASE | re.MULTILINE
    ),
    "skills": re.compile(
        r'^(compétences?(\s*techniques?)?|skills?|aptitudes?|outils?|technologies?)',
        re.IGNORECASE | re.MULTILINE
    ),
    "languages": re.compile(
        r'^(langues?|languages?)',
        re.IGNORECASE | re.MULTILINE
    ),
    "summary": re.compile(
        r'^(profil|résumé|summary|à\s*propos|about|objectif)',
        re.IGNORECASE | re.MULTILINE
    ),
}

# ── Compétences techniques ─────────────────────────────────
TECH_SKILLS_LIST = [
    # Langages
    "python","java","javascript","typescript","c++","c#","php","ruby","swift",
    "kotlin","go","rust","scala","r","matlab","bash","shell","powershell",
    # Frameworks web
    "react","vue","angular","node.js","nodejs","express","django","flask",
    "fastapi","spring","laravel","symfony","next.js","nuxt","nestjs",
    # Data / ML
    "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","spark",
    "hadoop","kafka","airflow","mlflow","huggingface","transformers",
    "bert","camembert","xlm-roberta","gpt",
    # Base de données
    "postgresql","mysql","mongodb","redis","elasticsearch","oracle","sqlite",
    "cassandra","dynamodb","neo4j",
    # DevOps / Cloud
    "docker","kubernetes","aws","azure","gcp","terraform","ansible","jenkins",
    "gitlab ci","github actions","ci/cd","linux","nginx","apache",
    # Outils
    "git","jira","confluence","trello","figma","photoshop","excel","power bi",
    "tableau","looker","sap","salesforce",
]

# ── Soft skills ────────────────────────────────────────────
SOFT_SKILLS_LIST = [
    "communication","travail en équipe","leadership","autonomie","rigueur",
    "créativité","adaptabilité","organisation","gestion du temps","curiosité",
    "problem solving","esprit d'analyse","esprit d'équipe","proactivité",
    "gestion de projet","sens du détail","polyvalence","initiative",
    "teamwork","analytical","organized","motivated","flexible",
]

# ── Niveaux de formation ───────────────────────────────────
EDUCATION_DEGREES = [
    r'doctorat|phd|ph\.d',
    r'master\s*[12]?|m\.?sc|mba|master\s*of',
    r'ingénieur|engineer|grande\s*école',
    r'licence\s*[123]?|bachelor|b\.?sc|l[123]',
    r'bts|dut|deug|deust|bac\s*\+\s*[23]',
    r'bac|baccalauréat|a\.?level',
]

DEGREE_RE = re.compile(
    '|'.join(f'({d})' for d in EDUCATION_DEGREES),
    re.IGNORECASE
)

# ── Années ─────────────────────────────────────────────────
YEAR_RE = re.compile(r'\b(19[6-9]\d|20[0-2]\d)\b')

# ── Durée expérience ───────────────────────────────────────
DURATION_RE = re.compile(
    r'(\d{4})\s*[-–—]\s*(\d{4}|présent|present|aujourd\'hui|actuel|current)',
    re.IGNORECASE
)


# =========================================================
# EXTRACTION REGEX — Fonctions individuelles
# =========================================================

def extract_email_regex(text: str):
    m = EMAIL_RE.search(text)
    return m.group(0) if m else None


def extract_phone_regex(text: str):
    m = PHONE_RE.search(text)
    if not m:
        return None
    phone = re.sub(r'[\s.\-]', '', m.group(0))
    return phone if len(phone) >= 9 else None


def extract_address_regex(text: str):
    m = ADDRESS_RE.search(text)
    if m:
        return m.group(0).strip()[:100]
    return None


def extract_skills_regex(text: str) -> dict:
    """
    Extrait compétences techniques et soft skills par correspondance de liste.
    Retourne {"tech": [...], "soft": [...]}
    """
    text_lower = text.lower()
    tech  = [s for s in TECH_SKILLS_LIST  if re.search(r'\b' + re.escape(s) + r'\b', text_lower)]
    soft  = [s for s in SOFT_SKILLS_LIST  if re.search(r'\b' + re.escape(s) + r'\b', text_lower)]
    return {"tech": list(dict.fromkeys(tech)), "soft": list(dict.fromkeys(soft))}


def extract_education_regex(text: str) -> list:
    """
    Parcourt le texte à la recherche de diplômes + institutions + années.
    """
    results = []
    lines = text.split('\n')

    for i, line in enumerate(lines):
        if not DEGREE_RE.search(line):
            continue

        degree_match = DEGREE_RE.search(line)
        degree_str = degree_match.group(0) if degree_match else line.strip()[:60]

        # Chercher l'institution dans les lignes proches
        school = None
        context = '\n'.join(lines[max(0, i-1):i+3])
        inst_patterns = [
            r'(université|university|école|ecole|faculté|institut|iut|'
            r'lycée|centre|ensa|encg|est|emsi|ofppt|iam|cpe|epitech)',
        ]
        for pat in inst_patterns:
            m = re.search(pat, context, re.IGNORECASE)
            if m:
                # Extraire la ligne contenant l'institution
                for l in lines[max(0, i-1):i+3]:
                    if re.search(pat, l, re.IGNORECASE):
                        school = l.strip()[:100]
                        break
                break

        # Année
        year_m = YEAR_RE.search(context)
        year = int(year_m.group(0)) if year_m else None

        results.append({
            "degree": degree_str.strip(),
            "school": school,
            "year":   year
        })

    return results


def extract_experience_regex(text: str) -> list:
    """
    Extrait les expériences professionnelles : poste, entreprise, durée.
    Stratégie : chercher des paires durée + titre de poste.
    """
    results = []
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    for i, line in enumerate(lines):
        dur_m = DURATION_RE.search(line)
        if not dur_m:
            continue

        duration = f"{dur_m.group(1)} - {dur_m.group(2)}"

        # Le poste est souvent sur la même ligne ou la suivante
        position = None
        company  = None

        # Chercher le titre sur les lignes proches
        context_lines = lines[max(0,i-2):i+3]
        for cl in context_lines:
            # Ignorer les lignes purement numériques / dates
            if re.match(r'^[\d\s\-–—]+$', cl):
                continue
            if DURATION_RE.search(cl):
                continue
            # Titre de poste probable (mots-clés métier)
            if re.search(
                r'(développeur|ingénieur|chef|manager|analyste|consultant|'
                r'technicien|directeur|responsable|stagiaire|intern|'
                r'developer|engineer|analyst|lead|senior|junior)',
                cl, re.IGNORECASE
            ):
                if not position:
                    position = cl.strip()[:100]
            elif not company and len(cl) > 3:
                company = cl.strip()[:100]

        if position:
            results.append({
                "position": position,
                "company":  company,
                "duration": duration
            })

    return results


def extract_name_regex(text: str) -> str:
    """
    Heuristique : le nom est souvent dans les 5 premières lignes,
    composé de 2-3 mots en majuscules ou capitalisés, sans chiffres.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:8]:
        # Ligne courte (2-4 mots), pas de chiffres, pas d'email/tel
        words = line.split()
        if 2 <= len(words) <= 4:
            if all(re.match(r'^[A-ZÀ-Ÿa-zà-ÿ\-]+$', w) for w in words):
                if not EMAIL_RE.search(line) and not PHONE_RE.search(line):
                    # Au moins un mot capitalisé ou tout en majuscules
                    if any(w[0].isupper() for w in words):
                        return line.strip()
    return None


# =========================================================
# NER — Extraction intelligente avec CamemBERT
# =========================================================

def extract_with_ner(text: str) -> dict:
    """
    Utilise Jean-Baptiste/camembert-ner pour détecter :
      - PER  → nom de la personne
      - ORG  → organisations (entreprises, écoles)
      - LOC  → localisations (villes, pays)
      - MISC → divers

    On limite le texte aux 512 premiers tokens (limite BERT).
    """
    result = {"name": None, "organizations": [], "locations": []}

    if not NER_OK:
        return result

    try:
        # Limiter à ~1500 caractères (≈ 512 tokens) pour rester dans la fenêtre BERT
        sample = text[:1500].replace('\n', ' ')
        entities = NER_MODEL(sample)

        persons = []
        orgs    = []
        locs    = []

        for ent in entities:
            label = ent.get("entity_group", "")
            word  = ent.get("word", "").strip()
            score = ent.get("score", 0)

            if score < 0.70:  # Seuil de confiance
                continue

            if label == "PER" and len(word) > 2:
                persons.append((word, score))
            elif label == "ORG" and len(word) > 1:
                orgs.append(word)
            elif label == "LOC" and len(word) > 1:
                locs.append(word)

        # Prendre le PER avec le plus haut score
        if persons:
            persons.sort(key=lambda x: -x[1])
            result["name"] = persons[0][0]

        result["organizations"] = list(dict.fromkeys(orgs))
        result["locations"]     = list(dict.fromkeys(locs))

    except Exception as e:
        print(f"[CV Parser] Erreur NER : {e}", flush=True)

    return result


# =========================================================
# CLASSIFICATION ZÉRO-SHOT — Détection du métier
# =========================================================

JOB_LABELS_FR = [
    "Développeur Web",
    "Développeur Mobile",
    "Data Scientist",
    "Data Engineer",
    "Machine Learning Engineer",
    "DevOps / SRE",
    "Ingénieur Réseau",
    "Cybersécurité",
    "Chef de Projet IT",
    "Product Manager",
    "UX/UI Designer",
    "Administrateur Système",
    "Analyste Financier",
    "Comptable",
    "Responsable RH",
    "Commercial / Ventes",
    "Marketing Digital",
    "Juriste",
    "Ingénieur Industriel",
    "Technicien Maintenance",
    "Médecin / Santé",
    "Enseignant / Formateur",
    "Architecte",
    "Logisticien",
    "Stagiaire / Junior",
]

def classify_job_domain(text: str) -> dict:
    """
    Zero-Shot Classification :
    Pas besoin d'entraîner le modèle sur des exemples de CV.
    On lui demande : "Ce texte correspond-il à [label] ?"
    Le modèle répond avec un score de probabilité pour chaque label.
    
    Retourne : {"job_title": "...", "confidence": 0.xx, "top3": [...]}
    """
    result = {"job_title": None, "confidence": 0.0, "top3": []}

    if not ZSC_OK:
        return result

    try:
        # Prendre le résumé / début du CV pour la classification
        sample = text[:800].replace('\n', ' ')

        output = ZSC_MODEL(
            sample,
            candidate_labels=JOB_LABELS_FR,
            hypothesis_template="Ce CV est celui d'un {}.",
            multi_label=False
        )

        labels = output["labels"]
        scores = output["scores"]

        result["job_title"]  = labels[0]
        result["confidence"] = round(scores[0], 3)
        result["top3"] = [
            {"label": labels[i], "score": round(scores[i], 3)}
            for i in range(min(3, len(labels)))
        ]

    except Exception as e:
        print(f"[CV Parser] Erreur Zero-Shot : {e}", flush=True)

    return result


# =========================================================
# PARSING COMPLET D'UN CV
# =========================================================

def parse_cv(pdf_bytes: bytes) -> dict:
    """
    Fonction principale : orchestre toutes les étapes.
    
    Pipeline :
      1. PyMuPDF     → extraction texte structuré
      2. langdetect  → détection langue
      3. Regex       → email, téléphone, adresse, skills, formation, expérience
      4. CamemBERT NER → nom, organisations, localisations
      5. Zero-Shot   → classification du métier / domaine
      6. Fusion      → NER prime sur Regex pour le nom, Regex prime pour le reste
    """
    result = {
        "name":       None,
        "email":      None,
        "phone":      None,
        "address":    None,
        "language":   "unknown",
        "job_title":  None,
        "job_confidence": None,
        "skills":     [],
        "softSkills": [],
        "education":  [],
        "experience": [],
        "organizations": [],
        "locations":  [],
        "raw_text":   "",
    }

    # ── 1. Extraction texte (PyMuPDF) ──────────────────────
    structured = extract_text_structured(pdf_bytes)
    full_text  = structured["full_text"]
    result["raw_text"] = full_text[:3000]  # limiter pour la réponse JSON

    if not full_text.strip():
        result["error"] = "PDF vide ou non lisible"
        return result

    # ── 2. Langue ──────────────────────────────────────────
    result["language"] = detect_language(full_text)

    # ── 3. Regex ───────────────────────────────────────────
    result["email"]   = extract_email_regex(full_text)
    result["phone"]   = extract_phone_regex(full_text)
    result["address"] = extract_address_regex(full_text)
    result["name"]    = extract_name_regex(full_text)

    skills_data        = extract_skills_regex(full_text)
    result["skills"]   = skills_data["tech"]
    result["softSkills"] = skills_data["soft"]

    result["education"]  = extract_education_regex(full_text)
    result["experience"] = extract_experience_regex(full_text)

    # ── 4. NER CamemBERT (si disponible) ───────────────────
    ner_data = extract_with_ner(full_text)

    # NER prime sur regex pour le nom (plus fiable)
    if ner_data["name"]:
        result["name"] = ner_data["name"]

    result["organizations"] = ner_data["organizations"]
    result["locations"]     = ner_data["locations"]

    # Enrichir l'adresse avec les lieux détectés par NER
    if not result["address"] and ner_data["locations"]:
        result["address"] = ", ".join(ner_data["locations"][:2])

    # ── 5. Classification métier (Zero-Shot) ───────────────
    job_class = classify_job_domain(full_text)
    if job_class["job_title"] and job_class["confidence"] > 0.30:
        result["job_title"]       = job_class["job_title"]
        result["job_confidence"]  = job_class["confidence"]
        result["job_top3"]        = job_class["top3"]

    return result


# =========================================================
# API FLASK
# =========================================================

app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    """Page d'accueil — confirme que le service tourne."""
    return jsonify({
        "service": "CV Parser",
        "version": "1.0",
        "status":  "running",
        "endpoints": {
            "health": "GET /health",
            "parse":  "POST /parse  (body: {pdf_base64: '...'})"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    """Point de contrôle : vérifie que le service est vivant."""
    return jsonify({
        "status":  "ok",
        "ner":     NER_OK,
        "zsc":     ZSC_OK,
        "pymupdf": True,
    })


@app.route("/parse", methods=["POST"])
def parse_endpoint():
    """
    POST /parse
    Body JSON : { "pdf_base64": "<base64 du PDF>" }
          OU
    Body multipart : fichier PDF en form-data (champ "file")
    
    Retourne : JSON avec tous les champs extraits du CV.
    """
    try:
        # ── Accepter base64 ou multipart ───────────────────
        if request.content_type and "multipart" in request.content_type:
            if "file" not in request.files:
                return jsonify({"error": "Champ 'file' manquant"}), 400
            pdf_bytes = request.files["file"].read()

        else:
            data = request.get_json(force=True)
            if not data or "pdf_base64" not in data:
                return jsonify({"error": "Champ 'pdf_base64' manquant"}), 400
            pdf_bytes = base64.b64decode(data["pdf_base64"])

        if not pdf_bytes:
            return jsonify({"error": "PDF vide"}), 400

        # ── Parsing ────────────────────────────────────────
        result = parse_cv(pdf_bytes)
        return jsonify(result), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================================================
# DÉMARRAGE
# =========================================================

if __name__ == "__main__":
    load_models()   # Charger les modèles HuggingFace une seule fois
    port = int(os.environ.get("CV_PARSER_PORT", 5001))
    print(f"[CV Parser] Serveur Flask démarré sur http://localhost:{port}", flush=True)
    # threaded=True : chaque requête dans son propre thread (évite les blocages)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)