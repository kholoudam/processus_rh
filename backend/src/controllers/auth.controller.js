const pool = require("../config/db");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT *
      FROM "user"
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur introuvable"
      });
    }

    const user = result.rows[0];

    if (password !== user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Mot de passe incorrect"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        fullname: user.fullname,
        role: user.role
      },
      process.env.JWT_SECRET || "secretRH",
      {
        expiresIn: "8h"
      }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const profile = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
      id,
      fullname,
      email,
      role,
      created_at
      FROM "user"
      WHERE id = $1
      `,
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

module.exports = {
  login,
  profile
};