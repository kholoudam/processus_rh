# -*- coding: utf-8 -*-
"""
LinkedIn Scraper — version complète avec NLP spaCy
==================================================
Prérequis :
    pip install selenium webdriver-manager psycopg2-binary python-dotenv spacy
    python -m spacy download fr_core_news_lg
    python -m spacy download en_core_web_sm
"""

import os
import re
import sys
import json
import time
import hashlib
import traceback
import psycopg2

from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager

# stdout non-bufferisé → logs visibles en temps réel dans Node.js
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)

# ── spaCy (optionnel mais recommandé) ──────────────────────
try:
    import spacy
    NLP_FR = spacy.load("fr_core_news_lg")
    NLP_EN = spacy.load("en_core_web_sm")
    SPACY_OK = True
    print("spaCy charge (fr_core_news_lg + en_core_web_sm)", flush=True)
except Exception as e:
    SPACY_OK = False
    print(f"spaCy non disponible ({e}) — parsing regex uniquement", flush=True)

# =========================================================
# LOAD ENV
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, "../.env")

load_dotenv(dotenv_path=ENV_PATH)

# =========================================================
# CONFIG
# =========================================================

DB_CONFIG = {
    "host": os.getenv("DB_HOST","localhost"),
    "database": os.getenv("DB_NAME","recrutement"),
    "user": os.getenv("DB_USER","postgres"),
    "password": os.getenv("DB_PASSWORD",""),
    "port": os.getenv("DB_PORT","5432"),
}

LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD")

print(
    f"EMAIL LOADED: {LINKEDIN_EMAIL}",
    flush=True
)

print(
    f"PASSWORD LOADED: {'OUI' if LINKEDIN_PASSWORD else 'NON'}",
    flush=True
)

WAIT_TIMEOUT = 35

# ── Cache chromedriver ─────────────────────────────────────
DRIVER_CACHE_DIR = os.path.join(BASE_DIR, "chromedriver_cache")
os.makedirs(DRIVER_CACHE_DIR, exist_ok=True)

# =========================================================
# DATABASE
# =========================================================
def connect_db():
    conn = psycopg2.connect(**DB_CONFIG)
    print("Connexion PostgreSQL reussie", flush=True)
    return conn

def ensure_schema(conn):
    """S'assure que toutes les colonnes nécessaires existent."""
    cur = conn.cursor()
    columns = {
        "linkedin_profile":    "TEXT",
        "linkedin_post_id":    "TEXT",
        "company":             "TEXT",
        "job_category":        "TEXT",
        "contract_type":       "TEXT",
        "location":            "TEXT",
        "work_mode":           "TEXT",
        "experience_required": "TEXT",
        "education_level":     "TEXT",
        "education_field":     "TEXT",
        "tech_skills":         "TEXT[]",
        "soft_skills":         "TEXT[]",
        "languages":           "TEXT[]",
        "salary_range":        "TEXT",
        "sector":              "TEXT",
        "benefits":            "TEXT[]",
        "short_description":   "TEXT",
        "seniority_level":     "TEXT",
        "is_urgent":           "BOOLEAN DEFAULT FALSE",
        "relevance_score":     "INTEGER DEFAULT 0",
        "contact_email":       "TEXT",
    }
    for col, dtype in columns.items():
        cur.execute(f"""
            ALTER TABLE job ADD COLUMN IF NOT EXISTS {col} {dtype};
        """)
    # Contrainte unique
    cur.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'job_linkedin_post_id_unique'
            ) THEN
                ALTER TABLE job
                ADD CONSTRAINT job_linkedin_post_id_unique
                UNIQUE (linkedin_post_id);
            END IF;
        END $$;
    """)
    conn.commit()
    cur.close()
    print("Schema LinkedIn verifie.", flush=True)

# =========================================================
# UTILITAIRES
# =========================================================
def generate_post_id(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()

def extract_profile_slug(url: str) -> str | None:
    m = re.search(r'linkedin\.com/in/([^/?#]+)', url)
    return m.group(1) if m else None

def clean_text(text: str) -> str:
    """Nettoyage complet : liens markdown LinkedIn, mentions, hashtags, URLs."""
    # Liens markdown [hashtag#emploi](https://...) → supprimer
    text = re.sub(r'\[hashtag[#\s]\w+\]\(https?://[^\)]+\)', '', text)
    # mailto: → garder email
    text = re.sub(r'\[([^\]]+@[^\]]+)\]\(mailto:[^\)]+\)', r'\1', text)
    # Autres liens markdown → garder texte
    text = re.sub(r'\[([^\]]{1,80})\]\(https?://[^\)]+\)', r'\1', text)
    # Mentions @NomEntreprise → garder nom
    text = re.sub(r'@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s&\-]+)', r'\1', text)
    # Hashtags résiduels
    text = re.sub(r'hashtag[#\s]?\w+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'#\w+', '', text)
    # Lignes purement hashtag
    lines = [l for l in text.split('\n') if not re.match(r'^\s*(hashtag\s*){2,}$', l, re.IGNORECASE)]
    text = '\n'.join(lines)
    # URLs résiduelles
    text = re.sub(r'https?://\S+', '', text)
    # Normaliser espaces
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

RECRUITMENT_KW = [
    # Français
    "recrute", "recrutement", "recrutons", "nous recrutons", "je recrute",
    "offre d'emploi", "offre de poste", "offre de recrutement",
    "poste à pourvoir", "poste ouvert", "nous recherchons", "on recherche",
    "candidature", "postulez", "postule", "cv", "profil recherché",
    "rejoignez-nous", "rejoignez notre", "rejoignez l'équipe",
    "opportunité", "opportunité professionnelle", "opportunité de carrière",
    "stage", "stagiaire", "alternance", "alternant", "pfe",
    "cdi", "cdd", "intérim", "freelance",
    "bac+", "master", "ingénieur", "licence",
    "ans d'expérience", "années d'expérience", "expérience requise",
    "mission", "poste de", "chef de projet", "responsable",
    # Anglais
    "hiring", "we are hiring", "job opening", "job opportunity",
    "apply now", "apply here", "send your cv", "send your resume",
    "we're looking for", "looking for a", "join our team",
    "open position", "job offer", "career opportunity",
    "internship", "full-time", "part-time", "remote",
]

def is_recruitment_post(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in RECRUITMENT_KW)

# On supprime is_recent_post : trop restrictif pour des profils RH
# qui écrivent parfois sans date relative dans le texte.

# =========================================================
# PARSER NLP + REGEX — extraction des champs structurés
# =========================================================

# ── Dictionnaires de référence ─────────────────────────────

CONTRACT_PATTERNS = {
    "CDI/CDD":    [r"\bcdi\s*/\s*cdd\b"],
    "CDI":        [r"\bcdi\b"],
    "CDD":        [r"\bcdd\b"],
    "Stage":      [r"\bstage\b", r"\bstagiaire\b", r"\bpfe\b", r"\binternship\b", r"\banapec\b"],
    "Alternance": [r"\balternance\b", r"\bapprentissage\b"],
    "Freelance":  [r"\bfreelance\b", r"\bindépendant\b"],
    "Intérim":    [r"\bintérim\b", r"\bcontrat\s+intérim\b"],
}

WORK_MODE_PATTERNS = {
    "Remote":      [r"\btélétravail\b", r"\bremote\b", r"\bà distance\b", r"\bdistanciel\b"],
    "Hybride":     [r"\bhybride?\b", r"\bhybrid\b"],
    "Présentiel":  [r"\bprésentiel\b", r"\bon[\s\-]?site\b", r"\bsur\s+site\b"],
}

SENIORITY_PATTERNS = {
    "Stagiaire": [r"\bstagiaire\b", r"\bpfe\b", r"\bstage\s+de\s+fin\b"],
    "Junior":    [r"\bjunior\b", r"\bdébutant\b", r"\bfresh\b", r"\bentry[\s\-]level\b"],
    "Confirmé":  [r"\bconfirmé\b", r"\bintermédiaire\b", r"\bmid[\s\-]level\b"],
    "Senior":    [r"\bsenior\b", r"\bexpert\b"],
    "Manager":   [r"\bmanager\b", r"\bdirecteur\b", r"\bresponsable\s+\w+", r"\bchef\s+d[e']\s*\w+"],
}

EDUCATION_LEVELS = {
    "Doctorat": [r"\bdoctorat\b", r"\bphd\b", r"\bth\xe8se\b"],
    "Bac+5":    [r"\bbac\s*\+\s*5\b", r"\bbac\s*\+\s*[34]/5\b",
                 r"\bmaster\s*2\b", r"\bmaster\b(?!\s*1)",
                 r"\bdipl\xf4me\s+d[e']\s*ing\xe9nieur\b",
                 r"\bgrande\s+\xe9cole\b"],
    "Bac+4":    [r"\bbac\s*\+\s*4\b", r"\bmaster\s*1\b"],
    "Bac+3":    [r"\bbac\s*\+\s*3\b", r"\bbac\s*\+\s*[23]/3\b", r"\blicence\b", r"\bbachelor\b"],
    "Bac+2":    [r"\bbac\s*\+\s*2\b", r"\bbac\s*\+\s*2/?\d?\b", r"\bbts\b", r"\bdut\b"],
    "Bac":      [r"\bbac(?!\s*\+|\w)\b", r"\bbaccalaur\xe9at\b"],
}

def _extract_education_level_smart(text: str) -> str | None:
    """Gère Bac+2/3 → Bac+2, Bac+3/5 → Bac+3 (prend le minimum = requis)."""
    m = re.search(r"[Bb]ac\s*\+\s*(\d)\s*/\s*(\d)", text)
    if m:
        low_val = min(int(m.group(1)), int(m.group(2)))
        return {2:"Bac+2",3:"Bac+3",4:"Bac+4",5:"Bac+5"}.get(low_val, f"Bac+{low_val}")
    return _match_dict(text, EDUCATION_LEVELS)


TECH_SKILLS_LIST = [
    # Langages
    "python","java","javascript","typescript","c#",r"c\+\+","php","ruby","go","rust","scala","kotlin","swift",
    "r\b","matlab","sql","nosql","bash","powershell","vba",
    # Frameworks / libs
    "react","angular","vue",r"node\.?js","django","flask","fastapi","spring","laravel",
    "tensorflow","pytorch","keras","scikit.learn","pandas","numpy","opencv","huggingface",
    # Data / BI
    "power bi","tableau","qlik","looker","dbt","airflow","spark","hadoop","kafka",
    "elasticsearch","databricks","snowflake","dbt",
    # Cloud / DevOps
    "aws","azure","gcp","google cloud","docker","kubernetes","k8s","terraform","ansible",
    "jenkins","github actions","gitlab ci","ci/cd",
    # BDD
    "postgresql","mysql","oracle","mongodb","redis","cassandra","sqlite","sql server",
    # Autre
    "sap","salesforce","sharepoint","power platform","jira","confluence",
    "git","linux","agile","scrum","devops","mlops","llm","nlp","computer vision",
]
TECH_SKILLS_RE = [re.compile(r'\b' + p + r'\b', re.IGNORECASE) for p in TECH_SKILLS_LIST]

SOFT_SKILLS_LIST = [
    "communication","travail d'équipe","esprit d'équipe","autonomie","organisation",
    "rigueur","curiosité","adaptabilité","leadership","gestion de projet",
    "résolution de problèmes","créativité","proactivité","sens du service",
    "gestion du stress","esprit analytique","force de proposition",
    "teamwork","problem solving","critical thinking","time management",
]

LANGUAGES_LIST = [
    "français","french","anglais","english","arabe","arabic","espagnol","spanish",
    "allemand","german","italien","italian","portugais","portuguese","chinois","chinese",
    "japonais","japanese",
]

LOCATIONS_MA = [
    "casablanca","rabat","marrakech","agadir","tanger","fès","meknès","oujda",
    "kénitra","témara","salé","mohammedia","settat","beni mellal","nador",
    "el jadida","khémisset","taza","berrechid","khénifra","laâyoune",
    "dakhla","tétouan","larache","guelmim","ifrane","ifrane","benslimane",
    # France
    "paris","lyon","marseille","toulouse","bordeaux","nantes","lille","strasbourg",
    "montpellier","rennes","nice","grenoble",
    # Général
    "maroc","france","belgique","canada","dubai","uae","remote","télétravail",
]

SECTORS = {
    # Aéronautique en premier (très spécifique, évite collision avec Industrie)
    "Aéronautique":       ["aéronautique","aérospatial","airbus","safran","boeing","avion","aerospace"],
    "Automobile":         ["automobile","automotive","renault","stellantis","psa","véhicule"],
    # IT : mots courts en dernier, pas "it" seul (trop générique)
    "IT / Tech":          ["développement logiciel","software engineer","data engineer","data scientist",
                           "devops","cloud computing","cybersécurité","intelligence artificielle",
                           "machine learning","big data","informatique","programmation"],
    "Finance / Banque":   ["banque","finance","assurance","fintech","comptabilité","audit",
                           "contrôle de gestion","trésorerie","fiscal","comptable"],
    "RH":                 ["ressources humaines","rh","recrutement","talent","hrbp","people",
                           "gestion des ressources"],
    "Industrie":          ["industrie","production","usine","qualité","lean","supply chain",
                           "logistique","maintenance industrielle","ordonnancement","méthodes",
                           "amélioration continue","fabrication","mécanique industrielle"],
    "Énergie":            ["énergie","énergies renouvelables","hvac","électricité","thermique",
                           "environnement","développement durable"],
    "Marketing":          ["marketing","communication","digital marketing","seo","sem","branding",
                           "community manager"],
    "BTP":                ["btp","construction","génie civil","architecture","bâtiment","travaux"],
    "Santé":              ["santé","médical","pharmaceutique","clinique","hôpital","pharmacie"],
    "Conseil":            ["conseil","consulting","cabinet conseil","stratégie","transformation"],
    "Commerce":           ["commercial","vente","business development","bdm","account manager",
                           "chef des ventes","responsable commercial"],
    "Éducation":          ["éducation","formation","enseignement","pédagogie","université","école"],
}

BENEFIT_PATTERNS = [
    "assurance maladie","mutuelle","tickets restaurant","télétravail","voiture de fonction",
    "prime","bonus","participation","intéressement","formation continue","stock options",
    "congés payés","crèche","sport","salle de sport","team building",
]

URGENCY_KW = [
    "urgent","immédiatement","dès que possible","asap","prise de poste immédiate",
    "urgent recruitment","poste à pourvoir rapidement",
]


def _match_dict(text: str, pattern_dict: dict) -> str | None:
    low = text.lower()
    for label, patterns in pattern_dict.items():
        for p in patterns:
            if re.search(p, low):
                return label
    return None

def _match_list(text: str, patterns_re: list) -> list[str]:
    found = []
    for p in patterns_re:
        if p.search(text):
            found.append(p.pattern.replace(r'\b','').replace('\\',''))
    return list(dict.fromkeys(found))  # dédupliqué, ordre conservé

def _match_strings(text: str, lst: list) -> list[str]:
    low = text.lower()
    return [s for s in lst if s.lower() in low]

def _extract_experience(text: str) -> str | None:
    """Extrait la durée d'expérience. Gère: "première expérience", "3ans", "3 à 5 ans"."""
    if re.search(r"premi[eè]re?\s+exp[eé]rience", text, re.IGNORECASE):
        if not re.search(r"\d+\s*ans?\s*d", text, re.IGNORECASE):
            return "Première expérience"
    patterns = [
        r"(\d+)\s*(?:à|a|-)\s*(\d+)\s*ans?\s*d['\u2019]\s*exp[eé]rience",
        r"(\d+)\s*ans?\s*(?:minimum\s*)?(?:et\s+plus\s+)?d['\u2019]\s*exp[eé]rience",
        r"exp[eé]rience\s*(?:de\s*|d['\u2019]\s*au\s*moins\s*|min(?:imum)?\s*(?:de)?\s*)?(\d+)\+?\s*ans?",
        r"(?:minimum|au\s+moins)\s+(\d+)\s*ans?",
        r"\+\s*(\d+)\s*ans?",
        r"(\d+)\s*ans?\s*et\s*plus",
        r"(\d+)\s*years?\s*(?:of\s*)?experience",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            result = m.group(0).strip()
            result = re.sub(r"(\d)ans", r"\1 ans", result)
            return result
    return None

def _extract_salary(text: str) -> str | None:
    patterns = [
        r'(\d[\d\s]*(?:[,\.]\d+)?)\s*(?:k€|k dh|kdh|mad|dh|€|eur)\b',
        r'salaire\s*:?\s*[\d\s,\.kK€]+',
        r'rémunération\s*:?\s*[\d\s,\.kK€]+',
        r'(\d+)\s*(?:à|a|-)\s*(\d+)\s*(?:k€|kdh|mad)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None

# Faux positifs fréquents à ignorer pour company
_COMPANY_BLACKLIST = {
    "bonjour","cher","chers","réseau","nous","je","vous","merci",
    "poste","profil","offre","opportunité","similaire","ici",
    "postule","postulez","candidature","cv","mail","email","adresse",
    "linkedin","hashtag","asap","site","lieu","maroc","france",
    "notre","nos","votre","leur","vos","leurs",
}

def _extract_company_spacy(text: str) -> str | None:
    """Utilise spaCy NER pour détecter le nom de l'entreprise."""
    if not SPACY_OK:
        return None
    # Chercher d'abord dans les 500 premiers chars (titre + intro)
    for nlp in [NLP_FR, NLP_EN]:
        doc = nlp(text[:600])
        for ent in doc.ents:
            if ent.label_ in ("ORG",) and len(ent.text) > 2:
                val = ent.text.strip()
                # Filtrer les faux positifs
                if val.lower() not in _COMPANY_BLACKLIST and not val.lower().startswith("bac"):
                    # Doit contenir au moins une majuscule non-initiale ou être un acronyme connu
                    return val
    return None

def _extract_company_regex(text: str) -> str | None:
    """Détecte le nom de l'entreprise par regex."""
    blacklist = _COMPANY_BLACKLIST | {"atlantic", "maroc composites"}
    patterns = [
        r"(?:site|Le\s+site)\s+((?:[A-Z][A-Za-z\xc0-\xff0-9]+\s*){1,5}?)\s+recrute\b",
        r"(?:^|\n)\s*((?:[A-Z][A-Za-z\xc0-\xff0-9]+[\s&\-]*){1,5}?)\s+recrute\s+(?:ses?|son|sa|un|une)\b",
        r"\b(Airbus\s+Atlantic(?:\s+Maroc)?(?:\s+Composites)?)\b",
        r"\b(Airbus|Boeing|Safran|Stelia|Leyton(?:\s+Maroc)?|Graphensky|MCS[\-\s]Carrier)\b",
        r"(?:chez|pour)\s+((?:[A-Z][A-Za-z\xc0-\xff0-9]+[\s&\-]*){1,4}?)(?:\s*[,\.\n!]|\s+(?:recrute|nous))",
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.MULTILINE | re.IGNORECASE):
            company = m.group(1).strip().rstrip(",.")
            if (len(company) > 2
                    and company.lower() not in blacklist
                    and not company.lower().startswith("bac")):
                return company
    return None

# Villes valides (whitelist)
_VALID_LOCATIONS = {
    "casablanca","rabat","marrakech","agadir","tanger","fès","meknès","oujda",
    "kénitra","témara","salé","mohammedia","settat","beni mellal","nador",
    "el jadida","khémisset","taza","berrechid","nouaceur","sidi bernoussi",
    "ain sebaa","bouskoura","zenata",
    "paris","lyon","marseille","toulouse","bordeaux","nantes","lille",
    "strasbourg","montpellier","rennes","nice","grenoble","sophia antipolis",
    "dubai","abu dhabi","bruxelles","montreal","genève",
}


def _extract_location_spacy(text: str) -> str | None:
    """Utilise spaCy NER pour détecter la localisation, avec whitelist."""
    if not SPACY_OK:
        return None
    for nlp in [NLP_FR, NLP_EN]:
        doc = nlp(text[:800])
        for ent in doc.ents:
            if ent.label_ in ("GPE", "LOC"):
                val = ent.text.strip().lower()
                if val in _VALID_LOCATIONS:
                    return val.title()
    return None

def _extract_location_regex(text: str) -> str | None:
    """Fallback regex : cherche d'abord dans la whitelist, puis les patterns structurés."""
    low = text.lower()

    # 1. Whitelist directe (le plus fiable)
    for loc in sorted(_VALID_LOCATIONS, key=len, reverse=True):  # plus long d'abord
        if loc in low:
            return loc.title()

    # 2. Patterns structurés "Lieu : ...", "basé à ..."
    patterns = [
        r'📍\s*(?:lieu|location)?\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-,]{2,30}?)(?:\.|\n|$)',
        r'(?:lieu|location|ville|city)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{2,25}?)(?:\s*[,\.\n]|$)',
        r'basé(?:e)?\s+à\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{2,20}?)(?:\s*[,\.\n!]|$)',
        r'poste\s+basé\s+à\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{2,20}?)(?:\s*[,\.\n!]|$)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip().rstrip(",.")
            # Valider : doit être dans la whitelist ou être une ville plausible
            if candidate.lower() in _VALID_LOCATIONS or (
                len(candidate) > 3
                and candidate.lower() not in _COMPANY_BLACKLIST
                and not any(c.isdigit() for c in candidate)
            ):
                return candidate.title()
    return None

def _extract_education_field(text: str) -> str | None:
    """
    Champs ordonnés du plus spécifique au plus générique.
    Chaque entrée = (pattern_regex, label_affiché)
    On utilise des regex avec \b pour éviter les faux positifs
    (ex: "ia" dans "industrielle", "it" dans "compétitivité").
    """
    FIELD_PATTERNS = [
        # Spécialités longues d'abord (évite les conflits)
        (r"\bgénie\s+informatique\b",       "Génie Informatique"),
        (r"\bgénie\s+logiciel\b",            "Génie Logiciel"),
        (r"\bgénie\s+industriel\b",          "Génie Industriel"),
        (r"\bgénie\s+mécanique\b",           "Génie Mécanique"),
        (r"\bgénie\s+électrique\b",          "Génie Électrique"),
        (r"\bgénie\s+civil\b",               "Génie Civil"),
        (r"\bgénie\s+thermique\b",           "Génie Thermique"),
        (r"\bgénie\s+des?\s+procédés\b",    "Génie des Procédés"),
        (r"\bdata\s+science\b",              "Data Science"),
        (r"\bintelligence\s+artificielle\b", "Intelligence Artificielle"),
        (r"\bsystèmes\s+informatiques\b",    "Systèmes Informatiques"),
        (r"\binformatique\s+industrielle\b", "Informatique Industrielle"),
        (r"\bsoftware\s+engineering\b",      "Software Engineering"),
        (r"\bcomputer\s+science\b",          "Computer Science"),
        (r"\binformation\s+systems\b",       "Information Systems"),
        (r"\bressources\s+humaines\b",       "Ressources Humaines"),
        (r"\bcontrôle\s+de\s+gestion\b",    "Contrôle de Gestion"),
        (r"\bgestion\s+de\s+(?:production|projet|maintenance)\b", "Gestion Industrielle"),
        (r"\bsupply\s+chain\b",              "Supply Chain"),
        (r"\blogistique\b",                   "Logistique"),
        (r"\bélectromécanique\b",             "Électromécanique"),
        (r"\bélectrotechnique\b",             "Électrotechnique"),
        (r"\btélécommunications?\b",          "Télécommunications"),
        (r"\bcomptabilité\b",                 "Comptabilité"),
        (r"\bfinance\b",                      "Finance"),
        (r"\bmarketing\b",                    "Marketing"),
        (r"\bcommerce\b",                     "Commerce"),
        (r"\béconomie\b",                     "Économie"),
        (r"\bjuridique\b|\bdroit\b",        "Droit"),
        (r"\barchitecture\b",                 "Architecture"),
        (r"\bpharmacologie?\b|\bpharmacie\b", "Pharmacie"),
        (r"\bmédecine\b",                     "Médecine"),
        (r"\bstatistiques?\b",                "Statistiques"),
        (r"\bmathématiques?\b",               "Mathématiques"),
        (r"\bphysique\b",                     "Physique"),
        (r"\bchimie\b",                       "Chimie"),
        (r"\bbiologie\b",                     "Biologie"),
        # Termes courts en dernier (éviter faux positifs)
        (r"\binformatique\b",                 "Informatique"),
        (r"\bmécanique\b",                    "Mécanique"),
        (r"\bgestion\b",                      "Gestion"),
        (r"\bréseaux?\b",                     "Réseaux"),
        (r"\bélectronique\b",                 "Électronique"),
    ]
    low = text.lower()
    for pattern, label in FIELD_PATTERNS:
        if re.search(pattern, low):
            return label
    return None

def _detect_sector(text: str) -> str | None:
    """
    Détection par score : le secteur avec le plus de mots-clés gagne.
    Évite qu'un seul mot court ("it", "data") écrase tout.
    """
    low = text.lower()
    scores = {}
    for sector, keywords in SECTORS.items():
        score = sum(1 for kw in keywords if kw in low)
        if score > 0:
            scores[sector] = score
    if not scores:
        return None
    return max(scores, key=scores.get)

def _compute_relevance(post: dict) -> int:
    score = 50  # base
    if post.get("company"):           score += 10
    if post.get("location"):          score += 10
    if post.get("contract_type"):     score += 10
    if post.get("experience_required"): score += 10
    if post.get("education_level"):   score += 5
    if post.get("tech_skills"):       score += min(len(post["tech_skills"]) * 2, 10)
    if post.get("salary_range"):      score += 5
    return min(score, 100)

def _build_short_description(text: str) -> str:
    """Description courte : 1ère phrase pertinente non-salutation."""
    SKIP_STARTS = (
        "bonjour", "bonsoir", "cher", "prêt", "poste pourvu",
        "offre clôturée", "nous sommes", "je suis", "je recrute",
    )
    EMOJI_PREFIX = re.compile(r"^[\U0001F300-\U0001FFFF\U00002600-\U000027FF]+")

    # 1. Première ligne avec "recrute" ou "recherche" (info centrale)
    for line in text.split("\n"):
        line = line.strip()
        low = line.lower()
        if (40 < len(line) < 280
                and any(k in low for k in ["recrute", "recherche", "recherchons", "accueille"])
                and not any(low.startswith(s) for s in SKIP_STARTS)):
            return line[:250]

    # 2. Première ligne significative sans salutation
    for line in text.split("\n"):
        line = line.strip()
        low = line.lower()
        if (40 < len(line) < 280
                and not any(low.startswith(s) for s in SKIP_STARTS)
                and not EMOJI_PREFIX.match(line)):
            return line[:250]

    return text[:200].strip()


def _extract_job_category(title: str) -> str:
    """Catégorie métier déduite du titre (différent du secteur d'activité)."""
    t = title.lower()
    if any(k in t for k in ["ingénieur","engineer","ingénieure"]):
        return "Ingénierie"
    if any(k in t for k in ["data","machine learning","ia","nlp","bi","analyst"]):
        return "Data / IA"
    if any(k in t for k in ["développeur","developer","software","fullstack","frontend","backend"]):
        return "Développement"
    if any(k in t for k in ["devops","cloud","infrastructure","réseau","système","sécurité"]):
        return "Infra / Cloud"
    if any(k in t for k in ["comptable","comptabilité","finance","contrôleur","audit","fiscal"]):
        return "Finance / Compta"
    if any(k in t for k in ["rh","ressources humaines","recruteur","hrbp","talent","people"]):
        return "Ressources Humaines"
    if any(k in t for k in ["commercial","vente","account","business development"]):
        return "Commercial"
    if any(k in t for k in ["marketing","communication","seo","brand"]):
        return "Marketing"
    if any(k in t for k in ["logistique","supply chain","approvisionneur","ordonnanceur","planificateur"]):
        return "Logistique / Supply Chain"
    if any(k in t for k in ["qualité","quality","inspecteur","auditeur","hse","qhse"]):
        return "Qualité / HSE"
    if any(k in t for k in ["maintenance","technicien","électromécanique","automatisme"]):
        return "Maintenance / Technique"
    if any(k in t for k in ["chef de projet","project manager","coordinateur","responsable"]):
        return "Management / Gestion de projet"
    if any(k in t for k in ["stage","stagiaire","pfe","alternance"]):
        return "Stage / Alternance"
    return "Autre"

# ── Fonction principale de parsing ─────────────────────────
def parse_post(text: str, profile_url: str, profile_slug: str, raw_text: str = "") -> dict:
    """
    Transforme un texte brut de post LinkedIn en dictionnaire
    prêt pour l'insertion en base de données.
    """
    post_id = generate_post_id(text)

    # ── Titre ──────────────────────────────────────────────
    title = _extract_title_nlp(text)

    # ── Entreprise : spaCy d'abord, regex en fallback ──────
    company = _extract_company_spacy(text) or _extract_company_regex(text)

    # ── Localisation ───────────────────────────────────────
    location = _extract_location_spacy(text) or _extract_location_regex(text)
    # Fallback : si Airbus Atlantic Maroc détecté et pas de lieu → Casablanca (siège)
    if not location and company and "airbus atlantic maroc" in (company or "").lower():
        location = "Casablanca"

    # ── Champs structurés ──────────────────────────────────
    contract_type        = _match_dict(text, CONTRACT_PATTERNS)
    work_mode            = _match_dict(text, WORK_MODE_PATTERNS)
    seniority_level      = _match_dict(text, SENIORITY_PATTERNS)
    education_level      = _extract_education_level_smart(text)
    education_field      = _extract_education_field(text)
    experience_required  = _extract_experience(text)
    salary_range         = _extract_salary(text)
    sector               = _detect_sector(text)
    tech_skills          = _match_list(text, TECH_SKILLS_RE)
    soft_skills          = _match_strings(text, SOFT_SKILLS_LIST)
    languages            = _match_strings(text, LANGUAGES_LIST)
    benefits             = _match_strings(text, BENEFIT_PATTERNS)
    is_urgent            = any(kw in text.lower() for kw in URGENCY_KW)
    short_description    = _build_short_description(text)

    # ── Job category = domaine métier propre au titre ───────
    # On déduit la catégorie métier depuis le titre parsé,
    # pas depuis le sector (qui est le secteur d'activité).
    job_category = _extract_job_category(title)

    # ── Email de contact — chercher dans raw_text (avant nettoyage) puis text ──
    _search_in = raw_text if raw_text else text
    m_email = re.search(r'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}', _search_in, re.IGNORECASE)
    contact_email = m_email.group(0) if m_email else None

    post = {
        "title":               title,
        "description":         text,
        "short_description":   short_description,
        "source":              profile_url,
        "linkedin_profile":    profile_slug,
        "linkedin_post_id":    post_id,
        "company":             company,
        "job_category":        job_category,
        "contract_type":       contract_type,
        "location":            location,
        "work_mode":           work_mode,
        "experience_required": experience_required,
        "education_level":     education_level,
        "education_field":     education_field,
        "tech_skills":         tech_skills,
        "soft_skills":         soft_skills,
        "languages":           languages,
        "salary_range":        salary_range,
        "sector":              sector,
        "benefits":            benefits,
        "seniority_level":     seniority_level,
        "is_urgent":           is_urgent,
        "contact_email":       contact_email,
    }
    post["relevance_score"] = _compute_relevance(post)
    return post


def _extract_title_nlp(text: str) -> str:
    """
    Extraction du titre du poste — ordre de priorité :
    1. Patterns métier connus
    2. Ligne contenant un mot-clé de poste
    3. Première ligne significative
    """
    JOB_TITLE_PATTERNS = [
        # Format Airbus/LinkedIn : recrute ses/son futur(e) "Titre"
        r'recrute\s+(?:ses?|son|sa|leur)\s+future?s?\s+[\u201c\u201d"\'"]([^\u201c\u201d"\'\"]{3,60})[\u201c\u201d"\'\"]',
        r'recrute\s+(?:un[e]?\s+)?[\u201c\u201d"\'"]([^\u201c\u201d"\'\"]{3,60})[\u201c\u201d"\'\"]',
        # accueille son futur stagiaire dans le domaine de X
        r'accueille\s+(?:ses?|son|sa)\s+futur[e]?\s+stagiaires?\s+dans\s+le\s+domaine\s+(?:de\s+(?:la?\s+)?)?([A-Za-z\xc0-\xff\s\-/]{3,40}?)(?:\s*[!,\.\n]|$)',
        # en tant que "Titre" / en tant que Titre
        r'en\s+tant\s+que\s+[\u201c\u201d"\'"]([^\u201c\u201d"\'\"]{3,60})[\u201c\u201d"\'\"]',
        r'en\s+tant\s+que\s+([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/]{4,55}?)(?:\s*[!,\.\n]|$)',
        # Offre : Titre / Offre de Recrutement : Titre
        r'offre\s+(?:d[e\']\s*)?(?:recrutement|emploi)\s*:?\s*([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/\(\)]{4,60}?)(?:\s*[!\n]|$)',
        # nous recrutons / je recrute un(e) Titre
        r'(?:nous\s+recrutons|on\s+recrute|je\s+recrute)\s+(?:un[e]?\s+)?([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/\(\)]{4,55}?)(?:\s*[!\n,\.]|$)',
        # à la recherche d'un(e) Titre
        r'(?:\xc0\s+la\s+recherche\s+d[eu\']n?[e]?\s+(?:\([HFhf]/[FHhf]\)\s*)?)([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/\(\)]{4,55}?)(?=\s+(?:avec|pour|ayant|titulaire))',
        # Rejoignez-nous en tant que Titre
        r'[Rr]ejoignez.nous\s+en\s+tant\s+que\s+([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/]{4,55}?)(?:\s*[!\n,\.]|$)',
        # Poste : Titre
        r'(?:^|\n)\s*[Pp]oste\s*:\s*([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff\s\-/]{4,55}?)(?:\s*[,\.\n]|$)',
    ]
    KNOWN_TITLES = [
        # ── IT / Data ──
        r"data\s+scientist", r"data\s+engineer", r"data\s+analyst", r"data\s+architect",
        r"data\s+steward", r"machine\s+learning\s+engineer", r"ai\s+engineer", r"nlp\s+engineer",
        r"devops\s+engineer", r"site\s+reliability\s+engineer", r"sre",
        r"développeur?\s+(?:fullstack|full.stack|frontend|backend|web|mobile|react|angular|python|java|php|node)",
        r"software\s+engineer", r"software\s+developer",
        r"ingénieur?\s+(?:logiciel|informatique|systèmes?|réseaux?|cloud|devops|data|r&d|études?)",
        r"chef\s+de\s+projet\s+(?:it|digital|informatique|technique)",
        r"product\s+(?:manager|owner|designer)",
        r"ux\s+(?:designer|researcher|lead)", r"scrum\s+master", r"agile\s+coach",
        r"business\s+(?:analyst|developer|intelligence)",
        r"consultant?\s+(?:technique|fonctionnel|sap|erp|crm|cloud|data|bi|digital)",
        r"technicien?\s+(?:informatique|réseaux?|systèmes?|support)",
        r"administrateur?\s+(?:systèmes?|réseaux?|bases?\s+de\s+données?|linux|windows)",
        # ── Aéronautique / Industrie ──
        r"ingénieur?\s+(?:qualité|méthodes?|production|maintenance|amélioration\s+continue|industriel|mécaniqu|procédés?|r&d|pc&l|coordinateur)",
        r"ingénieur?\s+(?:assurance\s+qualité|qualité\s+système|qualité\s+produit|qualité\s+opérations?)",
        r"responsable\s+(?:qualité|maintenance|production|méthodes?|industriel|hse|rh|comptabilité|logistique|export|unité)",
        r"responsable\s+(?:comptabilité\s+fournisseurs?|comptabilité\s+générale|contrôle\s+de\s+gestion)",
        r"directeur?\s+(?:technique|it|digital|informatique|commercial|marque)",
        r"chef\s+(?:de\s+projet|d[e\'\']équipe|d[e\'\']atelier|d[e\'\']unité)",
        r"coordinateur?(?:ice)?\s+(?:hse|pic.?pdp|pic|pdp|mod|logistique|qualité)",
        r"technicien?\s+(?:maintenance|qualité|méthodes?|moyens?\s+généraux?|cnc|usinage)",
        r"conducteur?\s+(?:machine|cnc|5\s*axes?|3\s*axes?)",
        r"machiniste\s+cnc", r"ajusteur.monteur", r"opérateur\s+(?:de\s+saisie|production|cnc)",
        r"préparateur?\s+méthodes?", r"gestionnaire\s+(?:production|commandes?|ioc)",
        r"ordonnanceur", r"planificateur",
        r"approvisionneur", r"agent\s+(?:logistique|méthodes?|qualité)",
        r"inspecteur?(?:ice)?\s+qualité", r"surveillant\s+qualité", r"auditeur\s+qualité",
        r"reap|ruap", r"hrbp",
        r"chargé[e]?\s+(?:de\s+recrutement|d[e\'\']assurance\s+qualité|affaires?|maintenance|conformité|études?)",
        # ── Finance / RH ──
        r"talent\s+acquisition", r"recruteur", r"recruteuse",
        r"hr\s+(?:manager|specialist|generalist|business\s+partner)",
        r"comptable\s+(?:fournisseurs?|général[e]?)?",
        r"contrôleur?\s+de\s+gestion",
        r"analyste\s+(?:financier|comptable|crédit|risques?)",
        r"gestionnaire\s+de\s+commandes?",
        r"assistant[e]?\s+(?:administratif|comptable|rh)",
        # ── Commercial ──
        r"commercial[e]?(?:\s+(?:b2b|b2c|terrain|sédentaire))?",
        r"account\s+(?:manager|executive|director)",
        r"business\s+(?:developer|unit\s+manager)",
        # ── Générique ──
        r"chef\s+de\s+projet", r"project\s+manager",
        r"stage\s+(?:de\s+fin\s+d[e\'\']études?)?",
        r"stagiaire\s+(?:en\s+)?[A-Za-zÀ-ÿ]{3,30}",
        r"alternance\s+(?:en\s+)?[A-Za-zÀ-ÿ]{3,30}",
    ]

    low = text.lower()

    # 1. Patterns structurés (ex: "Nous recrutons un Data Engineer")
    for p in JOB_TITLE_PATTERNS:
        m = re.search(p, text, re.IGNORECASE | re.MULTILINE)
        if m:
            candidate = m.group(1).strip()
            if 4 < len(candidate) < 80:
                return candidate.title()

    # 2. Titre métier connu dans le texte
    for p in KNOWN_TITLES:
        m = re.search(p, low, re.IGNORECASE)
        if m:
            return m.group(0).strip().title()

    # 3. Première ligne significative contenant un mot de poste
    for line in text.split('\n'):
        line = line.strip()
        low_line = line.lower()
        if 8 < len(line) < 100 and any(
            kw in low_line for kw in
            ["ingénieur","développeur","engineer","analyst","manager","responsable","consultant","technicien","chef","coordinateur","stage","alternance"]
        ):
            return line[:80].title()

    # 4. Fallback : première ligne significative qui n'est pas une salutation
    SALUTATION_PREFIXES = (
        "bonjour", "bonsoir", "cher", "✈️", "🚀", "👋", "📢",
        "je recrute", "nous recrutons", "je suis", "nous sommes",
        "prêt(e)", "poste pourvu", "offre clôturée",
    )
    for line in text.split('\n'):
        line = line.strip()
        low_l = line.lower()
        if 8 < len(line) < 80 and not any(low_l.startswith(p) for p in SALUTATION_PREFIXES):
            return line[:80].title()

    return "Offre d'emploi"


# =========================================================
# CHROME DRIVER
# =========================================================
def _get_cached_driver() -> str:
    """
    Retourne le chemin du chromedriver.
    - Cherche d'abord dans DRIVER_CACHE_DIR (cache local, évite re-téléchargement)
    - Sinon télécharge via ChromeDriverManager() et copie dans le cache
    Compatible avec toutes versions de webdriver-manager (l'arg 'path' a été supprimé).
    """
    import glob
    import shutil

    # 1. Vérifier le cache local
    cached = glob.glob(os.path.join(DRIVER_CACHE_DIR, "chromedriver*.exe"))
    if cached:
        print(f"Chromedriver cache : {os.path.basename(cached[0])}", flush=True)
        return cached[0]

    # 2. Télécharger avec webdriver-manager (dans son cache par défaut)
    print("Téléchargement chromedriver (1 seule fois)...", flush=True)
    downloaded_path = ChromeDriverManager().install()
    print(f"Chromedriver téléchargé : {downloaded_path}", flush=True)

    # 3. Copier dans notre cache local pour les prochains lancements
    try:
        dest = os.path.join(DRIVER_CACHE_DIR, os.path.basename(downloaded_path))
        shutil.copy2(downloaded_path, dest)
        print(f"Chromedriver mis en cache : {dest}", flush=True)
        return dest
    except Exception as e:
        # Si la copie échoue, utiliser directement le chemin téléchargé
        print(f"Cache non disponible ({e}), utilisation directe", flush=True)
        return downloaded_path

def create_driver() -> webdriver.Chrome:
    import tempfile
    print("Lancement Chrome...", flush=True)
    options = webdriver.ChromeOptions()

    # ── Profil temporaire isolé : aucune session/cookie persistant ──
    tmp_profile = tempfile.mkdtemp(prefix="chrome_linkedin_")
    options.add_argument(f"--user-data-dir={tmp_profile}")

    # Anti-détection
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # Stabilité & performance
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--start-maximized")
    options.add_argument("--lang=fr-FR,fr")
    options.add_argument("--disable-extensions")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    # Désactiver images (accélère le chargement)
    prefs = {
        "profile.default_content_setting_values.notifications": 2,
    }
    options.add_experimental_option("prefs", prefs)

    driver_path = _get_cached_driver()
    driver = webdriver.Chrome(
        service=Service(driver_path),
        options=options,
    )
    driver.set_page_load_timeout(45)
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    print("Chrome lance", flush=True)
    return driver

def linkedin_login(driver):
    import random

    def human_type(field, text):
        """Frappe humaine : caractère par caractère avec délai aléatoire."""
        field.click()
        time.sleep(random.uniform(0.2, 0.4))
        field.clear()
        for char in text:
            field.send_keys(char)
            time.sleep(random.uniform(0.05, 0.18))

    print("Ouverture de LinkedIn...", flush=True)

    wait = WebDriverWait(driver, 30)

    # Aller directement sur la page login (profil isolé = jamais connecté)
    driver.get("https://www.linkedin.com/login")
    time.sleep(4)

    current_url = driver.current_url
    print(f"URL actuelle : {current_url}", flush=True)

    # ==========================
    # Déjà connecté (sécurité)
    # ==========================
    if any(x in current_url for x in ["/feed", "/mynetwork", "/jobs"]):
        print("Session LinkedIn déjà active ✓", flush=True)
        return

    print(f"Page login : {current_url}", flush=True)

    # ==========================
    # Champ email
    # ==========================
    email_selectors = [
        (By.ID, "username"),
        (By.NAME, "session_key"),
        (By.CSS_SELECTOR, "input[name='session_key']"),
        (By.CSS_SELECTOR, "input[type='email']"),
        (By.CSS_SELECTOR, "input[autocomplete='username']"),
    ]

    email_input = None
    for selector in email_selectors:
        try:
            # element_to_be_clickable > presence_of_element_located
            email_input = WebDriverWait(driver, 8).until(
                EC.element_to_be_clickable(selector)
            )
            print(f"Champ email trouvé : {selector}", flush=True)
            break
        except:
            # Vérifier si LinkedIn a redirigé pendant l'attente
            if any(x in driver.current_url for x in ["/feed", "/mynetwork", "/jobs"]):
                print("Redirigé vers feed pendant attente champ — déjà connecté ✓", flush=True)
                return
            pass

    # Vérification finale après la boucle
    if any(x in driver.current_url for x in ["/feed", "/mynetwork", "/jobs"]):
        print("Redirigé vers feed — déjà connecté ✓", flush=True)
        return

    if email_input is None:
        driver.save_screenshot("linkedin_email_error.png")
        raise RuntimeError(
            f"Champ email introuvable : {driver.current_url}"
        )

    # Frappe humaine de l'email
    human_type(email_input, LINKEDIN_EMAIL)
    time.sleep(random.uniform(0.4, 0.8))

    # ==========================
    # Champ password
    # ==========================
    password_input = wait.until(
        EC.element_to_be_clickable((By.ID, "password"))
    )

    # Frappe humaine du mot de passe
    human_type(password_input, LINKEDIN_PASSWORD)
    time.sleep(random.uniform(0.4, 0.8))

    # ==========================
    # Submit
    # ==========================
    try:
        submit_btn = driver.find_element(
            By.CSS_SELECTOR,
            "button[type='submit'], button[data-litms-control-urn='login-submit']"
        )
        submit_btn.click()
    except:
        # Fallback : Entrée depuis le champ password
        password_input.send_keys(Keys.RETURN)

    print("Connexion envoyée...", flush=True)

    # ==========================
    # Attendre redirection
    # ==========================
    try:
        wait.until(
            EC.any_of(
                EC.url_contains("/feed"),
                EC.url_contains("/jobs"),
                EC.url_contains("/mynetwork"),
                EC.url_contains("/checkpoint"),  # 2FA
            )
        )
    except TimeoutException:
        driver.save_screenshot("linkedin_login_timeout.png")
        raise RuntimeError(
            f"Timeout après soumission login : {driver.current_url}"
        )

    final_url = driver.current_url
    if "/checkpoint" in final_url:
        print(
            "⚠ Vérification 2FA requise — résolvez manuellement dans les 30s.",
            flush=True
        )
        # Attendre que l'utilisateur résolve le 2FA manuellement
        for _ in range(30):
            time.sleep(1)
            if any(x in driver.current_url for x in ["/feed", "/mynetwork", "/jobs"]):
                break
        if not any(x in driver.current_url for x in ["/feed", "/mynetwork", "/jobs"]):
            raise RuntimeError("2FA non résolu dans le délai imparti.")

    print("Connexion LinkedIn réussie ✓", flush=True)

# =========================================================
# SCRAPE — sélecteurs LinkedIn 2024/2025 corrigés
# =========================================================

# Sélecteurs testés dans l'ordre (LinkedIn change souvent ses classes)
POST_SELECTORS = [
    # Sélecteur principal 2024-2025
    "div.feed-shared-update-v2",
    # Alternative avec data-urn (posts avec URN LinkedIn)
    "div[data-urn^='urn:li:activity']",
    # Conteneur de l'activité récente
    "li.profile-creator-shared-feed-update__container",
    # Sélecteur générique occludable
    "div.occludable-update",
    # Nouveau sélecteur 2025
    "div.update-components-text",
    # Ultra-générique : tout article ou div de post
    "article.feed-shared-update-v2__content",
    "div.fie-impression-container",
]

# Sélecteurs pour extraire le texte à l'intérieur d'un article
TEXT_SELECTORS = [
    "div.feed-shared-update-v2__description-wrapper",
    "div.feed-shared-text-view",
    "span.break-words",
    "div.update-components-text",
    "div[class*='commentary']",
    "span[dir='ltr']",
]


def _extract_text_from_article(article) -> str:
    """
    Extrait le texte d'un article LinkedIn en essayant
    plusieurs sous-sélecteurs avant de tomber sur .text.
    """
    for sel in TEXT_SELECTORS:
        try:
            el = article.find_element(By.CSS_SELECTOR, sel)
            t = el.text.strip()
            if len(t) > 30:
                return t
        except Exception:
            continue
    return article.text.strip()


def scrape_profile(driver: webdriver.Chrome, profile_slug: str) -> list[str]:
    """
    Scrape les posts récents d'un profil LinkedIn.
    Retourne une liste de textes bruts (non filtrés).
    """
    posts_text = []

    # On essaie les deux URL possibles
    urls_to_try = [
        f"https://www.linkedin.com/in/{profile_slug}/recent-activity/all/",
        f"https://www.linkedin.com/in/{profile_slug}/recent-activity/posts/",
        f"https://www.linkedin.com/in/{profile_slug}/",
    ]

    for url in urls_to_try:
        print(f"\n  URL : {url}", flush=True)
        try:
            driver.get(url)
        except TimeoutException:
            print("  Timeout chargement → window.stop()", flush=True)
            driver.execute_script("window.stop();")

        time.sleep(4)

        # Vérifier qu'on n'est pas redirigé sur une page d'erreur
        current = driver.current_url
        if "authwall" in current or "login" in current:
            print("  Redirige vers login — session expirée ?", flush=True)
            return posts_text

        # ── Scroll progressif pour charger les posts ────────
        last_height = 0
        for i in range(8):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            print(f"  Scroll {i+1}/8 (h={new_height})", flush=True)
            if new_height == last_height:
                break
            last_height = new_height

        # ── Trouver les articles ────────────────────────────
        articles = []
        matched_selector = None
        for sel in POST_SELECTORS:
            found = driver.find_elements(By.CSS_SELECTOR, sel)
            if found:
                articles = found
                matched_selector = sel
                print(f"  {len(found)} articles ({sel})", flush=True)
                break

        if not articles:
            # Dernière tentative : chercher tout texte long dans la page
            print("  Aucun article CSS — tentative texte brut page...", flush=True)
            page_text = driver.find_element(By.TAG_NAME, "body").text
            if len(page_text) > 200:
                posts_text.append(page_text[:3000])
            continue

        # ── Extraire les textes ─────────────────────────────
        seen_hashes = set()
        for article in articles:
            try:
                raw = _extract_text_from_article(article)
                if len(raw) < 40:
                    continue
                h = generate_post_id(raw)
                if h in seen_hashes:
                    continue
                seen_hashes.add(h)
                posts_text.append(raw)
            except Exception as e:
                print(f"  Erreur lecture article : {e}", flush=True)

        if posts_text:
            print(f"  {len(posts_text)} textes bruts recuperes", flush=True)
            break  # inutile d'essayer les autres URLs

    return posts_text


# =========================================================
# INSERT EN BASE
# =========================================================
def insert_job(cursor, conn, post: dict) -> bool:
    """Insère un job parsé. Retourne True si inséré, False si doublon."""
    try:
        cursor.execute("""
            INSERT INTO job (
                title, description, short_description, source,
                linkedin_profile, linkedin_post_id,
                company, job_category, contract_type, location, work_mode,
                experience_required, education_level, education_field,
                tech_skills, soft_skills, languages, salary_range,
                sector, benefits, seniority_level, is_urgent, relevance_score,
                contact_email
            ) VALUES (
                %(title)s, %(description)s, %(short_description)s, %(source)s,
                %(linkedin_profile)s, %(linkedin_post_id)s,
                %(company)s, %(job_category)s, %(contract_type)s, %(location)s, %(work_mode)s,
                %(experience_required)s, %(education_level)s, %(education_field)s,
                %(tech_skills)s, %(soft_skills)s, %(languages)s, %(salary_range)s,
                %(sector)s, %(benefits)s, %(seniority_level)s, %(is_urgent)s, %(relevance_score)s,
                %(contact_email)s
            )
            ON CONFLICT (linkedin_post_id) DO NOTHING
        """, {
            **post,
            "tech_skills": post["tech_skills"] or None,
            "soft_skills": post["soft_skills"] or None,
            "languages":   post["languages"] or None,
            "benefits":    post["benefits"] or None,
        })
        return cursor.rowcount > 0
    except Exception as e:
        print(f"  Erreur INSERT : {e}", flush=True)
        conn.rollback()
        return False

# =========================================================
# MAIN
# =========================================================
def main():
    print("=== LINKEDIN SCRAPER START ===", flush=True)

    if not LINKEDIN_EMAIL or not LINKEDIN_PASSWORD:
        print("ERREUR : LINKEDIN_EMAIL ou LINKEDIN_PASSWORD absents du .env", flush=True)
        sys.exit(1)

    inserted = 0
    skipped  = 0
    conn = cursor = driver = None

    try:
        # ── DB ─────────────────────────────────────────────
        conn   = connect_db()
        ensure_schema(conn)
        cursor = conn.cursor()

        # ── Browser ────────────────────────────────────────
        driver = create_driver()
        linkedin_login(driver)

        # ── Charger profiles.json ──────────────────────────
        profiles_path = os.path.join(BASE_DIR, "../profiles.json")
        if not os.path.exists(profiles_path):
            print(f"profiles.json introuvable — creation exemple à {profiles_path}", flush=True)
            with open(profiles_path, "w", encoding="utf-8") as f:
                json.dump([
                    {"url": "https://www.linkedin.com/in/exemple-recruteur/"},
                ], f, indent=2, ensure_ascii=False)
            print("Editez profiles.json et relancez.", flush=True)
            return

        with open(profiles_path, encoding="utf-8") as f:
            profiles = json.load(f)

        print(f"{len(profiles)} profil(s) a scraper", flush=True)

        # ── Scraping ───────────────────────────────────────
        for item in profiles:
            profile_url = item.get("url", "").strip()
            slug = extract_profile_slug(profile_url)
            if not slug:
                print(f"URL invalide : {profile_url}", flush=True)
                continue

            print(f"\n--- Profil : {slug} ---", flush=True)
            raw_posts = scrape_profile(driver, slug)
            print(f"  {len(raw_posts)} texte(s) brut(s) recuperes", flush=True)

            recruitment_count = 0
            for raw in raw_posts:
                cleaned = clean_text(raw)

                # Filtre recrutement (permissif)
                if not is_recruitment_post(cleaned):
                    print(f"  [IGNORE] non-recrutement : {cleaned[:80]}", flush=True)
                    continue

                recruitment_count += 1

                # Parser NLP
                post = parse_post(cleaned, profile_url, slug, raw_text=raw)

                print(
                    f"  [PARSED] {post['title']} | "
                    f"company={post['company']} | loc={post['location']} | "
                    f"contract={post['contract_type']} | score={post['relevance_score']}",
                    flush=True
                )

                # Insérer en base
                ok = insert_job(cursor, conn, post)
                if ok:
                    inserted += 1
                    print(f"  + Insere : {post['title']}", flush=True)
                else:
                    skipped += 1
                    print(f"  ~ Doublon : {post['title']}", flush=True)

            print(f"  {recruitment_count} post(s) de recrutement detectes pour {slug}", flush=True)
            conn.commit()

            # Pause entre profils pour ne pas se faire bloquer
            time.sleep(3)

    except Exception as e:
        print(f"ERREUR SCRAPER : {e}", flush=True)
        traceback.print_exc()

    finally:
        for obj in [cursor, conn]:
            if obj:
                try: obj.close()
                except: pass
        if driver:
            try:
                driver.quit()
                print("Chrome ferme.", flush=True)
            except: pass

    print(f"\n{inserted} job(s) insere(s)", flush=True)
    print(f"{skipped} doublon(s) ignore(s)", flush=True)
    print("=== LINKEDIN SCRAPER END ===", flush=True)


if __name__ == "__main__":
    main()