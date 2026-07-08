from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util
import torch

app = Flask(__name__)

print("=" * 60)
print("Chargement du modèle Sentence Transformer...")
print("=" * 60)

# Modèle multilingue (Français + Anglais)
model = SentenceTransformer(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

print("Modèle chargé avec succès.")
print("=" * 60)


# ----------------------------------------------------
# Nettoyage du texte
# ----------------------------------------------------
def clean_text(text):

    if not text:
        return ""

    return " ".join(str(text).split())


# ----------------------------------------------------
# Calcul Similarité
# ----------------------------------------------------
def compute_similarity(candidate_text, job_text):

    candidate_text = clean_text(candidate_text)
    job_text = clean_text(job_text)

    if candidate_text == "" or job_text == "":
        return 0

    embeddings = model.encode(
        [candidate_text, job_text],
        convert_to_tensor=True,
        normalize_embeddings=True
    )

    similarity = util.cos_sim(
        embeddings[0],
        embeddings[1]
    )

    score = float(similarity.item()) * 100

    score = max(0, min(score, 100))

    return round(score, 2)


# ----------------------------------------------------
# Health Check
# ----------------------------------------------------
@app.route("/", methods=["GET"])
def index():

    return jsonify({

        "status": "running",

        "service": "Semantic Matching",

        "model": "paraphrase-multilingual-MiniLM-L12-v2"

    })


# ----------------------------------------------------
# Similarité
# ----------------------------------------------------
@app.route("/similarity", methods=["POST"])
def similarity():

    try:

        data = request.get_json()

        if not data:

            return jsonify({

                "success": False,

                "message": "JSON manquant"

            }), 400

        candidate_text = data.get("candidate_text", "")

        job_text = data.get("job_text", "")

        score = compute_similarity(

            candidate_text,

            job_text

        )

        return jsonify({

            "success": True,

            "similarity": score

        })

    except Exception as e:

        return jsonify({

            "success": False,

            "message": str(e)

        }), 500


# ----------------------------------------------------
# Batch Matching (optionnel mais très utile)
# ----------------------------------------------------
@app.route("/batch_similarity", methods=["POST"])
def batch_similarity():

    try:

        data = request.get_json()

        candidate_text = data.get("candidate_text", "")

        jobs = data.get("jobs", [])

        if not jobs:

            return jsonify({

                "success": False,

                "message": "Liste des jobs vide"

            }), 400

        candidate_embedding = model.encode(

            clean_text(candidate_text),

            convert_to_tensor=True,

            normalize_embeddings=True

        )

        results = []

        for job in jobs:

            job_embedding = model.encode(

                clean_text(job["text"]),

                convert_to_tensor=True,

                normalize_embeddings=True

            )

            score = util.cos_sim(

                candidate_embedding,

                job_embedding

            ).item()

            results.append({

                "job_id": job["job_id"],

                "similarity": round(score * 100, 2)

            })

        results.sort(

            key=lambda x: x["similarity"],

            reverse=True

        )

        return jsonify({

            "success": True,

            "results": results

        })

    except Exception as e:

        return jsonify({

            "success": False,

            "message": str(e)

        }), 500


# ----------------------------------------------------
# Lancement
# ----------------------------------------------------
if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=5003,

        debug=True

    )