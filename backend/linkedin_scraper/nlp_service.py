from transformers import pipeline
from flask import Flask, request, jsonify


app = Flask(__name__)



classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)



@app.route("/nlp", methods=["POST"])
def nlp():


    data=request.json


    message=data["message"]



    labels=[

        "recommend_candidate",

        "compare_experience",

        "explain_candidate",

        "search_job"

    ]



    result=classifier(

        message,

        labels

    )



    return jsonify({

        "intent":
        result["labels"][0]

    })




if __name__=="__main__":


    app.run(

        port=5002

    )