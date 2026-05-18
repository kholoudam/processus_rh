# -*- coding: utf-8 -*-

import os
import re
import json
import time
import hashlib
import psycopg2

from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException, WebDriverException
)
from webdriver_manager.chrome import ChromeDriverManager

# =========================================================
# LOAD ENV  — cherche le .env dans backend/
# =========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH  = os.path.join(BASE_DIR, "../.env")
load_dotenv(dotenv_path=ENV_PATH)

# =========================================================
# CONFIG
# =========================================================
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "database": os.getenv("DB_NAME",     "recrutement"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "port":     os.getenv("DB_PORT",     "5432"),
}

LINKEDIN_EMAIL    = os.getenv("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD")

WAIT_TIMEOUT = 30  # secondes max pour chaque wait

# =========================================================
# DATABASE
# =========================================================
def connect_db():
    conn = psycopg2.connect(**DB_CONFIG)
    print("Connexion PostgreSQL reussie")
    return conn

def ensure_columns(conn):
    """Ajoute les colonnes linkedin si elles n'existent pas."""
    cursor = conn.cursor()
    cursor.execute("""
        ALTER TABLE job
        ADD COLUMN IF NOT EXISTS linkedin_profile TEXT,
        ADD COLUMN IF NOT EXISTS linkedin_post_id TEXT;
    """)
    # Contrainte unique sur linkedin_post_id pour ON CONFLICT
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'job_linkedin_post_id_unique'
            ) THEN
                ALTER TABLE job
                ADD CONSTRAINT job_linkedin_post_id_unique
                UNIQUE (linkedin_post_id);
            END IF;
        END
        $$;
    """)
    conn.commit()
    cursor.close()
    print("Colonnes LinkedIn verifiees.")

# =========================================================
# FILTRES
# =========================================================
def is_recent_post(text):
    t = text.lower()
    if re.search(r"(heure|heures|minute|minutes|jour|jours|semaine|semaines)", t):
        return True
    m = re.search(r"(\d+)\s*mois", t)
    if m:
        return int(m.group(1)) <= 2
    return False

def is_recruitment_post(text):
    keywords = [
        "recrute","recrutement","hiring","join us","job","stage","cdi","cdd",
        "alternance","opportunité","postulez","apply","ingénieur","developer",
        "développeur","data engineer","data analyst","data scientist","devops",
        "talent acquisition","rh","technicien","coordinateur","responsable",
    ]
    score = sum(1 for kw in keywords if kw in text.lower())
    return score >= 2

def clean_post_text(text):
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"#\S+", "", text)
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

def extract_title(content):
    patterns = [
        r"data\s+engineer", r"data\s+scientist", r"data\s+analyst",
        r"devops\s+engineer", r"développeur\s+\w+", r"developer\s+\w+",
        r"ingénieur\s+\w+", r"technicien\s+\w+", r"consultant\s+\w+",
        r"talent acquisition", r"responsable\s+\w+", r"coordinateur\s+\w+",
    ]
    lower = content.lower()
    for pattern in patterns:
        match = re.search(pattern, lower, re.IGNORECASE)
        if match:
            return match.group(0).title()
    # Fallback : première ligne non vide
    for line in content.split('\n'):
        line = line.strip()
        if len(line) > 5 and len(line) < 80:
            return line[:80]
    return "Offre d'emploi"

def generate_post_id(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()

def extract_profile_slug(url):
    match = re.search(r'linkedin\.com/in/([^/?#]+)', url)
    return match.group(1) if match else None

# =========================================================
# CHROME DRIVER
# =========================================================
def create_driver():
    options = webdriver.ChromeOptions()

    # Désactiver la détection d'automatisation
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # Stabilité
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--start-maximized")
    options.add_argument("--window-size=1440,900")

    # User-agent réaliste
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    # Masquer webdriver property
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )

    print("Chrome lance")
    return driver

# =========================================================
# LOGIN LINKEDIN — robuste avec WebDriverWait
# =========================================================
def linkedin_login(driver):
    print("\nOuverture de la page LinkedIn...")

    driver.get("https://www.linkedin.com/login")

    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    # Attendre que le champ email soit présent ET visible
    try:
        email_input = wait.until(
            EC.visibility_of_element_located((By.ID, "username"))
        )
        print("Champ email trouve.")
    except TimeoutException:
        # Essayer le sélecteur alternatif
        print("ID 'username' introuvable, essai avec name='session_key'...")
        try:
            email_input = wait.until(
                EC.visibility_of_element_located((By.NAME, "session_key"))
            )
            print("Champ email trouve via name.")
        except TimeoutException:
            # Sauvegarder screenshot pour debug
            driver.save_screenshot("login_debug.png")
            print("ERREUR : champ email introuvable. Screenshot sauve : login_debug.png")
            print("Page source (500 chars) :", driver.page_source[:500])
            raise

    # Saisie email lente (simuler humain)
    email_input.clear()
    for char in LINKEDIN_EMAIL:
        email_input.send_keys(char)
        time.sleep(0.05)

    # Attendre champ password
    try:
        password_input = wait.until(
            EC.visibility_of_element_located((By.ID, "password"))
        )
    except TimeoutException:
        password_input = wait.until(
            EC.visibility_of_element_located((By.NAME, "session_password"))
        )

    password_input.clear()
    for char in LINKEDIN_PASSWORD:
        password_input.send_keys(char)
        time.sleep(0.05)

    time.sleep(1)

    # Cliquer sur le bouton de connexion
    try:
        submit_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, '//button[@type="submit"]'))
        )
        submit_btn.click()
    except TimeoutException:
        # Fallback : ENTER
        password_input.send_keys(Keys.RETURN)

    print("Formulaire soumis, attente redirection...")

    # Attendre que le feed ou la page d'accueil soit chargée
    try:
        wait.until(
            EC.any_of(
                EC.url_contains("feed"),
                EC.url_contains("mynetwork"),
                EC.url_contains("jobs"),
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.feed-shared-update-v2")),
            )
        )
        print("Connexion LinkedIn reussie. URL :", driver.current_url)
    except TimeoutException:
        current = driver.current_url
        print("Attention : redirection inattendue vers", current)
        # Vérifier si c'est un challenge (captcha, vérification)
        if "checkpoint" in current or "challenge" in current:
            print("VERIFICATION REQUISE (captcha/2FA) — attente 30s pour intervention manuelle...")
            time.sleep(30)
        elif "feed" not in current:
            driver.save_screenshot("login_result.png")
            print("Screenshot sauve : login_result.png")

# =========================================================
# SCRAPE UN PROFIL
# =========================================================
def scrape_profile(driver, profile_slug):
    posts = []
    url   = f"https://www.linkedin.com/in/{profile_slug}/recent-activity/all/"

    print(f"\nOuverture : {url}")
    driver.get(url)

    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    # Attendre que la page charge
    try:
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "main")))
    except TimeoutException:
        print(f"Timeout chargement profil {profile_slug}")
        return posts

    time.sleep(3)

    # Scroll progressif pour charger les posts
    for i in range(5):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        print(f"Scroll {i+1}/5")
        time.sleep(2)

    # Sélecteurs possibles pour les posts LinkedIn
    selectors = [
        "div.feed-shared-update-v2",
        "div[data-urn]",
        "li.profile-creator-shared-feed-update__container",
        "div.occludable-update",
    ]

    articles = []
    for selector in selectors:
        articles = driver.find_elements(By.CSS_SELECTOR, selector)
        if articles:
            print(f"{len(articles)} posts trouves avec '{selector}'")
            break

    if not articles:
        print(f"Aucun post trouve pour {profile_slug}")
        return posts

    seen = set()

    for article in articles:
        try:
            raw_text = article.text.strip()
            if len(raw_text) < 50:
                continue
            if not is_recent_post(raw_text):
                continue
            cleaned = clean_post_text(raw_text)
            if not is_recruitment_post(cleaned):
                continue
            hash_text = generate_post_id(cleaned)
            if hash_text in seen:
                continue
            seen.add(hash_text)
            posts.append(cleaned)
            print(f"\nPOST DETECTE :\n{cleaned[:200]}\n")
        except Exception as e:
            print(f"Erreur lecture post : {e}")

    return posts

# =========================================================
# MAIN
# =========================================================
def main():
    print("\n=== LINKEDIN SCRAPER START ===\n")

    if not LINKEDIN_EMAIL or not LINKEDIN_PASSWORD:
        print("ERREUR : LINKEDIN_EMAIL ou LINKEDIN_PASSWORD manquants dans .env")
        return

    conn   = connect_db()
    ensure_columns(conn)
    cursor = conn.cursor()

    driver = create_driver()

    try:
        linkedin_login(driver)

        # Charger les profils à scraper
        profiles_path = os.path.join(BASE_DIR, "../profiles.json")

        if not os.path.exists(profiles_path):
            print(f"ERREUR : profiles.json introuvable à {profiles_path}")
            # Créer un fichier exemple
            with open(profiles_path, "w", encoding="utf-8") as f:
                json.dump([
                    {"url": "https://www.linkedin.com/in/exemple-recruteur/"}
                ], f, indent=2, ensure_ascii=False)
            print("Fichier profiles.json exemple cree. Ajoutez vos profils et relancez.")
            return

        with open(profiles_path, "r", encoding="utf-8") as f:
            profiles = json.load(f)

        print(f"\n{len(profiles)} profil(s) a scraper\n")

        inserted = 0
        skipped  = 0

        for item in profiles:
            profile_url = item.get("url", "").strip()
            if not profile_url:
                continue

            profile_slug = extract_profile_slug(profile_url)
            if not profile_slug:
                print(f"URL invalide : {profile_url}")
                continue

            print(f"\n--- Profil : {profile_slug} ---")

            posts = scrape_profile(driver, profile_slug)
            print(f"{len(posts)} post(s) de recrutement detectes")

            for post in posts:
                title   = extract_title(post)
                post_id = generate_post_id(post)

                try:
                    cursor.execute("""
                        INSERT INTO job (title, description, source, linkedin_profile, linkedin_post_id)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (linkedin_post_id) DO NOTHING
                    """, (title, post, profile_url, profile_slug, post_id))

                    if cursor.rowcount > 0:
                        inserted += 1
                        print(f"  + Insere : {title}")
                    else:
                        skipped += 1
                        print(f"  ~ Doublon ignore : {title}")

                except Exception as e:
                    print(f"Erreur INSERT : {e}")
                    conn.rollback()
                    continue

            conn.commit()

    except Exception as e:
        print(f"\nERREUR SCRAPER : {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Toujours fermer proprement
        try:
            cursor.close()
            conn.close()
        except:
            pass
        try:
            driver.quit()
            print("\nChrome ferme.")
        except:
            pass

    print(f"\n{inserted} job(s) insere(s)")
    print(f"{skipped} doublon(s) ignore(s)")
    print("\n=== LINKEDIN SCRAPER END ===\n")

# =========================================================
if __name__ == "__main__":
    main()