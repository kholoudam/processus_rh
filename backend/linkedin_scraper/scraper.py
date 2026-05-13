# -*- coding: utf-8 -*-

import sys
import io

# =========================================================
# UTF-8 WINDOWS
# =========================================================

sys.stdout = io.TextIOWrapper(
    sys.stdout.buffer,
    encoding="utf-8",
    errors="replace"
)

sys.stderr = io.TextIOWrapper(
    sys.stderr.buffer,
    encoding="utf-8",
    errors="replace"
)

# =========================================================
# IMPORTS
# =========================================================

import os
import re
import json
import time
import hashlib
import psycopg2

from selenium import webdriver

from selenium.webdriver.common.by import By

from selenium.webdriver.support.ui import WebDriverWait

from selenium.webdriver.support import expected_conditions as EC

from selenium.webdriver.chrome.service import Service

# =========================================================
# DATABASE
# =========================================================

DB_CONFIG = {

    "host": "localhost",

    "database": "recrutement",

    "user": "postgres",

    "password": "Kholoudam**12**"
}

# =========================================================
# CHROMEDRIVER LOCAL
# =========================================================

CHROMEDRIVER_PATH = r"C:\chromedriver\chromedriver.exe"

# =========================================================
# CONNEXION POSTGRESQL
# =========================================================

def connect_db():

    try:

        conn = psycopg2.connect(**DB_CONFIG)

        print("Connexion PostgreSQL réussie")

        return conn

    except Exception as e:

        print("Erreur PostgreSQL :", e)

        raise e

# =========================================================
# POSTS RECENTS (2 derniers mois)
# =========================================================

def is_recent_post(article_text):

    text = article_text.lower()

    if re.search(
        r"(heure|heures|minute|minutes|jour|jours|semaine|semaines)",
        text
    ):
        return True

    months = re.search(
        r"(\d+)\s*mois",
        text
    )

    if months:

        nb = int(months.group(1))

        return nb <= 2

    return False

# =========================================================
# POSTS RECRUTEMENT UNIQUEMENT
# =========================================================

def is_recruitment_post(text):

    text = text.lower()

    recruitment_keywords = [

        "recrute",
        "recrutement",
        "hiring",
        "we are hiring",
        "join us",
        "rejoignez-nous",
        "offre d'emploi",
        "opportunité",
        "job",
        "stage",
        "alternance",
        "cdi",
        "cdd",

        "postulez",
        "postuler",
        "apply",

        "ingénieur",
        "technicien",
        "préparateur méthodes",
        "responsable",
        "manager",
        "développeur",
        "developer",
        "consultant",
        "commercial",
        "comptable",
        "supply chain",
        "logistique",
        "maintenance",
        "talent acquisition",
        "rh"
    ]

    score = 0

    for keyword in recruitment_keywords:

        if keyword in text:
            score += 1

    return score >= 2

# =========================================================
# NETTOYAGE TEXTE LINKEDIN
# =========================================================

def clean_post_text(text, profile_name=None):

    # supprimer URLs
    text = re.sub(
        r"http\S+",
        "",
        text
    )

    # supprimer hashtags
    text = re.sub(
        r"#\S+",
        "",
        text
    )

    patterns_to_remove = [

        r"Post du fil d’actualité numéro \d+",
        r"Post du fil d'actualité numéro \d+",

        r"Visible de tous sur LinkedIn et en dehors",

        r"J’aime",
        r"J'aime",

        r"Commenter",
        r"Republier",
        r"Envoyer",
        r"Suivre",

        r"• 2e",
        r"2e",

        r"\d+\scommentaires?",
        r"\d+\srepublications?",
        r"\d+\sréactions?",

        r"Il y a \d+\s(mois|jour|jours|heure|heures|semaine|semaines)",

        r"… plus",
        r"\.\.\. plus"
    ]

    cleaned = text

    for pattern in patterns_to_remove:

        cleaned = re.sub(
            pattern,
            "",
            cleaned,
            flags=re.IGNORECASE
        )

    # supprimer nom RH
    if profile_name:

        cleaned = re.sub(
            re.escape(profile_name),
            "",
            cleaned,
            flags=re.IGNORECASE
        )

    # nettoyage espaces
    cleaned = re.sub(
        r"\n+",
        "\n",
        cleaned
    )

    cleaned = re.sub(
        r"[ \t]+",
        " ",
        cleaned
    )

    lines = []

    blacklist = [

        "linkedin",
        "commenter",
        "republier",
        "suivre",
        "visible de tous"
    ]

    for line in cleaned.split("\n"):

        line = line.strip()

        if len(line) < 5:
            continue

        lower = line.lower()

        if any(b in lower for b in blacklist):
            continue

        lines.append(line)

    # supprimer doublons
    final_lines = []

    seen = set()

    for line in lines:

        if line not in seen:

            final_lines.append(line)

            seen.add(line)

    return "\n".join(final_lines).strip()

# =========================================================
# EXTRACTION TITRE POSTE
# =========================================================

def extract_title(content):

    content_lower = content.lower()

    title_patterns = [

        r"préparateur\s*\(?(ice)?\)?s?\s*méthodes",

        r"data\s+engineer",

        r"data\s+scientist",

        r"data\s+analyst",

        r"software\s+engineer",

        r"devops\s+engineer",

        r"développeur\s+\w+",

        r"developer\s+\w+",

        r"ingénieur\s+\w+",

        r"technicien\s+\w+",

        r"responsable\s+\w+",

        r"manager\s+\w+",

        r"consultant\s+\w+",

        r"comptable\s+\w+",

        r"commercial\s+\w+",

        r"chef\s+de\s+projet",

        r"talent acquisition",

        r"rh",

        r"stage\s+\w+",

        r"alternance\s+\w+"
    ]

    for pattern in title_patterns:

        match = re.search(
            pattern,
            content_lower,
            re.IGNORECASE
        )

        if match:

            title = match.group(0)

            title = re.sub(
                r"\(ice\)",
                "",
                title,
                flags=re.IGNORECASE
            )

            return title.title()

    # fallback intelligent
    for line in content.split("\n"):

        line = line.strip()

        if len(line) > 15 and len(line) < 120:

            return line[:120]

    return "Offre d'emploi"

# =========================================================
# GENERATE POST ID
# =========================================================

def generate_post_id(text):

    return hashlib.md5(
        text.encode("utf-8")
    ).hexdigest()

# =========================================================
# DELETE OLD POSTS PROFILE
# =========================================================

def delete_old_jobs(cursor, profile):

    cursor.execute("""

        DELETE FROM job
        WHERE linkedin_profile = %s

    """, (profile,))

# =========================================================
# EXTRAIRE SLUG
# =========================================================

def extract_profile_slug(url):

    match = re.search(
        r'linkedin\.com/in/([^/?#]+)',
        url
    )

    if match:
        return match.group(1)

    return None

# =========================================================
# GET PROFILE NAME
# =========================================================

def get_profile_name(driver):

    try:

        element = WebDriverWait(driver, 10).until(

            EC.presence_of_element_located((
                By.TAG_NAME,
                "h1"
            ))

        )

        return element.text.strip()

    except:

        return None

# =========================================================
# SCRAPER PROFILE
# =========================================================

def scrape_profile(driver, profile_slug):

    posts = []

    url = f"https://www.linkedin.com/in/{profile_slug}/recent-activity/all/"

    print(f"\nOuverture : {url}")

    driver.get(url)

    print("\nConnecte-toi à LinkedIn...")
    print("Attente 30 secondes...\n")

    time.sleep(30)

    try:

        # scroll
        for i in range(8):

            driver.execute_script(
                "window.scrollTo(0, document.body.scrollHeight);"
            )

            print(f"Scroll {i+1}")

            time.sleep(4)

        profile_name = get_profile_name(driver)

        print(f"Profil : {profile_name}")

        selectors = [

            "div.feed-shared-update-v2",

            "div[data-urn*='activity']",

            "div.occludable-update",

            "div[class*='feed-shared-update']"
        ]

        articles = []

        for selector in selectors:

            articles = driver.find_elements(
                By.CSS_SELECTOR,
                selector
            )

            if articles:

                print(f"{len(articles)} blocs trouvés")

                break

        seen = set()

        for article in articles:

            try:

                raw_text = article.text.strip()

                if len(raw_text) < 50:
                    continue

                # récent ?
                if not is_recent_post(raw_text):
                    continue

                cleaned = clean_post_text(
                    raw_text,
                    profile_name
                )

                if len(cleaned) < 80:
                    continue

                # recrutement ?
                if not is_recruitment_post(cleaned):
                    continue

                hash_text = hashlib.md5(
                    cleaned.encode()
                ).hexdigest()

                if hash_text in seen:
                    continue

                seen.add(hash_text)

                posts.append(cleaned)

                print("\nPOST DETECTE")
                print(cleaned[:300])

            except Exception as e:

                print("Erreur post :", e)

    except Exception as e:

        print("Erreur scraping :", e)

    return posts

# =========================================================
# MAIN
# =========================================================

def main():

    print("\n=== LINKEDIN SCRAPER START ===\n")

    conn = connect_db()

    cursor = conn.cursor()

    # =====================================================
    # CHROME OPTIONS
    # =====================================================

    options = webdriver.ChromeOptions()

    options.add_argument("--start-maximized")

    options.add_argument(
        "--disable-blink-features=AutomationControlled"
    )

    options.add_argument("--disable-dev-shm-usage")

    options.add_argument("--no-sandbox")

    options.add_argument("--disable-gpu")

    options.add_experimental_option(
        "excludeSwitches",
        ["enable-automation"]
    )

    options.add_experimental_option(
        "useAutomationExtension",
        False
    )

    options.add_argument(
        "user-agent=Mozilla/5.0 "
        "(Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 "
        "(KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    # =====================================================
    # DRIVER
    # =====================================================

    driver = webdriver.Chrome(

        service=Service(CHROMEDRIVER_PATH),

        options=options
    )

    # masquer webdriver
    driver.execute_script("""

        Object.defineProperty(
            navigator,
            'webdriver',
            {
                get: () => undefined
            }
        )

    """)

    # =====================================================
    # LOAD profiles.json
    # =====================================================

    BASE_DIR = os.path.dirname(
        os.path.abspath(__file__)
    )

    profiles_path = os.path.join(
        BASE_DIR,
        "../profiles.json"
    )

    with open(
        profiles_path,
        "r",
        encoding="utf-8"
    ) as f:

        profiles = json.load(f)

    inserted = 0

    skipped = 0

    # =====================================================
    # LOOP PROFILES
    # =====================================================

    for item in profiles:

        profile_url = item.get("url")

        if not profile_url:
            continue

        profile_slug = extract_profile_slug(
            profile_url
        )

        if not profile_slug:
            continue

        print(f"\nSynchronisation : {profile_slug}")

        posts = scrape_profile(
            driver,
            profile_slug
        )

        print(f"\n{len(posts)} posts recrutement détectés")

        # supprimer anciens si nouveaux trouvés
        if len(posts) > 0:

            delete_old_jobs(
                cursor,
                profile_slug
            )

        for post in posts:

            title = extract_title(post)

            post_id = generate_post_id(post)

            cursor.execute("""

                INSERT INTO job (
                    title,
                    description,
                    source,
                    linkedin_profile,
                    linkedin_post_id
                )

                VALUES (%s, %s, %s, %s, %s)

                ON CONFLICT (linkedin_post_id)
                DO NOTHING

                RETURNING id

            """, (

                title,
                post,
                profile_url,
                profile_slug,
                post_id

            ))

            result = cursor.fetchone()

            if result:

                inserted += 1

                print(f"\nINSERTION : {title}")

            else:

                skipped += 1

        conn.commit()

    # =====================================================
    # END
    # =====================================================

    cursor.close()

    conn.close()

    print(
        f"\n{inserted} jobs insérés"
    )

    print(
        f"{skipped} doublons ignorés"
    )

    print(
        "\nNavigateur laissé ouvert "
        "pour conserver la session LinkedIn"
    )

    print("\n=== LINKEDIN SCRAPER END ===\n")

# =========================================================
# START
# =========================================================

if __name__ == "__main__":

    main()