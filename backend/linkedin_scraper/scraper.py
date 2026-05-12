import json
import os
import psycopg2
from datetime import datetime, timedelta
from linkedin_scraper import Person
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# ==========================
# CONFIG
# ==========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILES_FILE = os.path.join(BASE_DIR, "profiles.json")

DB_CONFIG = {
    "host": "localhost",
    "database": "recrutement",
    "user": "postgres",
    "password": "Kholoudam**12**"
}

LIMIT_DAYS = 30


# ==========================
# DB
# ==========================
def connect_db():
    return psycopg2.connect(**DB_CONFIG)


def job_exists(cursor, title):
    cursor.execute(
        "SELECT id FROM job WHERE title = %s",
        (title,)
    )
    return cursor.fetchone() is not None


def insert_job(cursor, title, description, source):
    cursor.execute("""
        INSERT INTO job (title, description, source)
        VALUES (%s, %s, %s)
    """, (title, description, source))


# ==========================
# DATE CHECK
# ==========================
def is_recent(post_date):
    try:
        if not post_date:
            return False

        post_datetime = datetime.strptime(
            str(post_date)[:10],
            "%Y-%m-%d"
        )

        return post_datetime >= datetime.now() - timedelta(days=LIMIT_DAYS)

    except:
        return False


# ==========================
# SCRAPING
# ==========================
def scrape_profile(driver, profile_url, cursor):
    print(f"Scraping : {profile_url}")

    inserted = 0

    try:
        person = Person(profile_url, driver=driver, scrape=False)
        person.scrape(close_on_complete=False)

        if not hasattr(person, "posts"):
            return 0

        for post in person.posts:

            title = (
                post.text[:150].strip()
                if post.text else "Post LinkedIn"
            )

            description = post.text if post.text else ""
            source = profile_url
            post_date = getattr(post, "posted_at", None)

            if not is_recent(post_date):
                continue

            if job_exists(cursor, title):
                continue

            insert_job(cursor, title, description, source)
            inserted += 1

            print("Inséré :", title)

    except Exception as e:
        print("Erreur profil :", str(e))

    return inserted


# ==========================
# MAIN
# ==========================
def main():
    try:
        with open(PROFILES_FILE, "r", encoding="utf-8") as f:
            profiles = json.load(f)

        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")

        driver = webdriver.Chrome(options=chrome_options)

        conn = connect_db()
        cursor = conn.cursor()

        total = 0

        for profile in profiles:
            inserted = scrape_profile(
                driver,
                profile["url"],
                cursor
            )

            total += inserted
            conn.commit()

        print(f"Total insérés : {total}")

        cursor.close()
        conn.close()
        driver.quit()

    except Exception as e:
        print("Erreur générale :", str(e))


if __name__ == "__main__":
    main()