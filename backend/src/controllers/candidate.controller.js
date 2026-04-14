const pool = require('../config/db');

// 🔹 GET ALL (tableau)
exports.getCandidates = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM candidates ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
};

// 🔹 UPDATE STATUS (boutons RH)
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      "UPDATE candidates SET status=$1 WHERE id=$2",
      [status, id]
    );
    res.send("Status updated");
  } catch (err) {
    res.status(500).send("Erreur update");
  }
};