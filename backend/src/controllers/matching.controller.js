const { matchCandidates } = require("../services/match.service")

exports.getAllMatches = async (req, res) => {
  try {
    const matches = await matchCandidates()
    res.json(matches)
  } catch (err) {
    console.error("MATCH CONTROLLER ERROR:", err)
    res.status(500).json({ error: "Erreur matching" })
  }
}