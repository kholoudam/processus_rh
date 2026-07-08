from transformers import pipeline
from flask import Flask, request, jsonify

app = Flask(__name__)

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

# Labels alignés sur les intents gérés par chatbot_service.js.
# Ce service n'est consulté QUE pour les questions ambiguës (score du
# scoring mots-clés < 8) : sur les intents à signal fort (email, contact,
# postulé, admis, refusé, combien...), chatbot_service.js répond déjà
# directement sans jamais appeler ce endpoint. Le rôle de ce classifieur
# est donc uniquement de départager les formulations sans mot-clé net —
# d'où l'intérêt de couvrir le même éventail d'intents que le scoring JS,
# et non plus seulement 4 catégories.
LABELS = [
    "recommend_candidate",   # recommander / meilleurs profils pour un poste
    "compare_experience",    # comparer ou classer les candidats par expérience
    "candidate_detail",      # voir le profil complet d'un candidat
    "candidate_contact",     # email, téléphone, adresse d'un candidat
    "applications",          # candidatures reçues / en attente / qui a postulé
    "admis",                 # candidats admis / acceptés
    "refuses",                # candidats refusés / rejetés
    "stats",                 # statistiques globales, nombres, pourcentages
    "search_job",            # rechercher un poste / une offre
]


@app.route("/nlp", methods=["POST"])
def nlp():
    data = request.json
    message = (data or {}).get("message", "")

    if not message or not message.strip():
        return jsonify({"intent": None, "error": "message vide"}), 400

    result = classifier(message, LABELS)

    return jsonify({
        "intent": result["labels"][0],
        "score": round(result["scores"][0], 3)
    })


if __name__ == "__main__":
    app.run(port=5002)