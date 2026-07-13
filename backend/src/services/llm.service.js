// llm.service.js
const OpenAI = require('openai');

const llm = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

async function askLLM(userQuestion, contextData, conversationHistory = []) {
  try {
    const messages = [
      {
        role: "system",
        content: `Tu es l'assistant RH virtuel de Airbus Atlantic Maroc.
Règles strictes :
- Réponds UNIQUEMENT en français
- Sois concis (3-5 phrases maximum sauf si on demande une liste détaillée)
- Base-toi UNIQUEMENT sur les données JSON fournies ci-dessous, jamais d'invention
- Si les données ne permettent pas de répondre, dis-le clairement
- Ton professionnel mais chaleureux
- Tiens compte de l'historique de conversation pour comprendre les questions de suivi

Données disponibles pour répondre :
${JSON.stringify(contextData, null, 2)}`
      },
      ...conversationHistory,
      { role: "user", content: userQuestion }
    ];

    const completion = await llm.chat.completions.create({
      model: process.env.LLM_MODEL || "llama-3.1-8b-instant",
      messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    return {
      success: true,
      reply: completion.choices[0].message.content,
    };

  } catch (err) {
    console.error("Erreur LLM:", err.message);
    return {
      success: false,
      reply: "Désolé, je rencontre un problème technique. Pouvez-vous reformuler votre question ?",
    };
  }
}

async function classifyIntentLLM(userQuestion) {
  const intents = [
    "candidats_stats", "candidats_liste", "job_details", "matching_score",
    "recommandations", "admis", "refuses", "greeting", "help", "unknown"
  ];

  try {
    const completion = await llm.chat.completions.create({
      model: process.env.LLM_MODEL || "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Classifie la question dans UNE de ces catégories exactement : ${intents.join(", ")}.
Réponds UNIQUEMENT avec le nom exact de la catégorie, rien d'autre.`
        },
        { role: "user", content: userQuestion }
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const detected = completion.choices[0].message.content.trim().toLowerCase();
    return intents.includes(detected) ? detected : "unknown";

  } catch (err) {
    console.error("Erreur classification LLM:", err.message);
    return "unknown";
  }
}

module.exports = { askLLM, classifyIntentLLM };