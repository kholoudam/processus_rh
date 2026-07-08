# -*- coding: utf-8 -*-
"""
embedding_service.py — Microservice Flask pour le matching sémantique
=======================================================================
Librairies utilisées :
  - sentence-transformers : Génération d'embeddings de phrases
  - Flask                 : Exposition API REST locale (appelée par Node.js)
  - numpy                 : Calcul de la Cosine Similarity

Modèle :
  paraphrase-multilingual-MiniLM-L12-v2
    Famille : Sentence Transformers
    Domaine : NLP
    Tâche   : Génération d'embeddings de phrases
    Usage   : Représentation vectorielle des CV et des offres d'emploi
              afin de calculer leur similarité sémantique via Cosine Similarity.
    Multilingue (fr/en) — adapté aux CV et offres rédigés en français.

Installation :
  pip install flask sentence-transformers numpy

Lancement :
  python embedding_service.py
  → écoute sur http://localhost:5003
"""

import os
import traceback

import numpy as np
from flask import Flask, request, jsonify

# ── Sentence Transformers ──────────────────────────────────
MODEL = None
MODEL_OK = False
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


def load_model():
    """
    Charge le modèle Sentence Transformers en mémoire.
    Appelé une seule fois au démarrage du serveur Flask (comme cv_parser.py).
    """
    global MODEL, MODEL_OK

    print(f"[Embedding Service] Chargement du modèle {MODEL_NAME}...", flush=True)

    try:
        from sentence_transformers import SentenceTransformer
        MODEL = SentenceTransformer(MODEL_NAME, device="cpu")
        MODEL_OK = True
        print(f"[Embedding Service] ✓ {MODEL_NAME} chargé", flush=True)
    except Exception as e:
        print(f"[Embedding Service] ✗ Modèle non disponible : {e}", flush=True)

    print("[Embedding Service] Prêt.", flush=True)


# =========================================================
# COSINE SIMILARITY
# =========================================================
def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Cosine Similarity entre deux vecteurs d'embeddings.
    Retourne une valeur entre -1 et 1 (en pratique 0 à 1 pour du texte
    professionnel similaire), qu'on reprojette ensuite sur 0-100.
    """
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def similarity_to_score(sim: float) -> float:
    """
    Reprojette la cosine similarity (-1 à 1, en pratique ~0.1 à ~0.9 pour
    du texte pro) sur une échelle 0-100 plus lisible pour le frontend.
    Clamp à [0, 100] par sécurité.
    """
    score = ((sim + 1) / 2) * 100
    return round(max(0.0, min(100.0, score)), 2)


# =========================================================
# CONSTRUCTION DU TEXTE CANDIDAT / OFFRE
# =========================================================
def build_candidate_text(payload: dict) -> str:
    """
    Concatène skills + expérience + éducation du candidat en un seul
    texte, dans un ordre stable, pour l'encodage par le modèle.
    """
    parts = []

    skills = payload.get("skills") or []
    if skills:
        parts.append("Compétences : " + ", ".join(skills))

    experience = payload.get("experience") or []
    for exp in experience:
        position = exp.get("position") or ""
        company = exp.get("company") or ""
        duration = exp.get("duration") or ""
        line = " ".join(filter(None, [position, company, duration]))
        if line.strip():
            parts.append(line)

    education = payload.get("education") or []
    for edu in education:
        degree = edu.get("degree") or ""
        institution = edu.get("institution") or ""
        line = " ".join(filter(None, [degree, institution]))
        if line.strip():
            parts.append(line)

    return " . ".join(parts).strip()


def build_job_text(payload: dict) -> str:
    """
    Concatène titre + description + skills requis + niveau requis
    de l'offre en un seul texte.
    """
    parts = []

    title = payload.get("title") or ""
    if title:
        parts.append(title)

    description = payload.get("description") or ""
    if description:
        parts.append(description)

    skills = payload.get("skills") or []
    if skills:
        parts.append("Compétences requises : " + ", ".join(skills))

    experience_required = payload.get("experience_required") or ""
    if experience_required:
        parts.append(f"Expérience requise : {experience_required}")

    education_level = payload.get("education_level") or ""
    if education_level:
        parts.append(f"Niveau requis : {education_level}")

    return " . ".join(parts).strip()


# =========================================================
# API FLASK
# =========================================================

app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    """Page d'accueil — confirme que le service tourne."""
    return jsonify({
        "service": "Embedding Matching Service",
        "model": MODEL_NAME,
        "version": "1.0",
        "status": "running",
        "endpoints": {
            "health": "GET /health",
            "match": "POST /match  (body: {candidate: {...}, job: {...}})",
            "match_batch": "POST /match_batch  (body: {candidate: {...}, jobs: [{...}]})",
        }
    })


@app.route("/health", methods=["GET"])
def health():
    """Point de contrôle : vérifie que le service est vivant."""
    return jsonify({
        "status": "ok",
        "model_loaded": MODEL_OK,
        "model_name": MODEL_NAME,
    })


@app.route("/match", methods=["POST"])
def match_endpoint():
    """
    POST /match
    Body JSON :
    {
      "candidate": { "skills": [...], "experience": [...], "education": [...] },
      "job":       { "title": "...", "description": "...", "skills": [...],
                     "experience_required": "...", "education_level": "..." }
    }

    Retourne : { "score": 0-100, "similarity": -1..1,
                 "candidate_text": "...", "job_text": "..." }
    """
    if not MODEL_OK:
        return jsonify({"error": "Modèle non chargé"}), 503

    try:
        data = request.get_json(force=True)
        if not data or "candidate" not in data or "job" not in data:
            return jsonify({"error": "Champs 'candidate' et 'job' requis"}), 400

        candidate_text = build_candidate_text(data["candidate"])
        job_text = build_job_text(data["job"])

        if not candidate_text or not job_text:
            return jsonify({
                "score": 0.0,
                "similarity": 0.0,
                "candidate_text": candidate_text,
                "job_text": job_text,
                "warning": "Texte candidat ou offre vide",
            }), 200

        embeddings = MODEL.encode([candidate_text, job_text], convert_to_numpy=True)
        sim = cosine_similarity(embeddings[0], embeddings[1])
        score = similarity_to_score(sim)

        return jsonify({
            "score": score,
            "similarity": round(sim, 4),
            "candidate_text": candidate_text,
            "job_text": job_text,
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/match_batch", methods=["POST"])
def match_batch_endpoint():
    """
    POST /match_batch
    Body JSON :
    {
      "candidate": { "skills": [...], "experience": [...], "education": [...] },
      "jobs": [ { "id": 1, "title": "...", ... }, { "id": 2, ... } ]
    }

    Encode le candidat une seule fois et compare à N offres en un seul
    appel — utile quand un candidat doit être comparé à plusieurs jobs
    dans la même requête (évite N appels réseau successifs).

    Retourne : { "results": [ { "job_id": 1, "score": 0-100, "similarity": -1..1 }, ... ] }
    """
    if not MODEL_OK:
        return jsonify({"error": "Modèle non chargé"}), 503

    try:
        data = request.get_json(force=True)
        if not data or "candidate" not in data or "jobs" not in data:
            return jsonify({"error": "Champs 'candidate' et 'jobs' requis"}), 400

        candidate_text = build_candidate_text(data["candidate"])
        jobs = data["jobs"]

        if not candidate_text or not jobs:
            return jsonify({"results": []}), 200

        job_texts = [build_job_text(j) for j in jobs]

        all_texts = [candidate_text] + job_texts
        embeddings = MODEL.encode(all_texts, convert_to_numpy=True)

        candidate_emb = embeddings[0]
        results = []
        for i, job in enumerate(jobs):
            job_emb = embeddings[i + 1]
            sim = cosine_similarity(candidate_emb, job_emb)
            results.append({
                "job_id": job.get("id"),
                "score": similarity_to_score(sim),
                "similarity": round(sim, 4),
            })

        return jsonify({"results": results}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# =========================================================
# DÉMARRAGE
# =========================================================

if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("EMBEDDING_SERVICE_PORT", 5003))
    print(f"[Embedding Service] Serveur Flask démarré sur http://localhost:{port}", flush=True)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)