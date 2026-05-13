const express = require("express");

const router = express.Router();

const path = require("path");

const { exec } = require("child_process");

/* =====================================================
   SYNCHRONISATION LINKEDIN
===================================================== */

router.post("/sync", async (req, res) => {

  try {

    console.log("\n[LinkedIn] Synchronisation démarrée...\n");

    const scraperPath = path.join(
      __dirname,
      "../../linkedin_scraper/scraper.py"
    );

    const command = `python "${scraperPath}"`;

    exec(

      command,

      {
        maxBuffer: 1024 * 1024 * 20
      },

      (error, stdout, stderr) => {

        console.log(stdout);

        if (stderr) {

          console.error(stderr);

        }

        if (error) {

          console.error(
            "[LinkedIn ERROR]",
            error
          );

          return res.status(500).json({

            success: false,

            message: "Erreur synchronisation LinkedIn",

            error: error.message,

            stderr

          });

        }

        return res.json({

          success: true,

          message: "Synchronisation LinkedIn terminée",

          output: stdout

        });

      }

    );

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Erreur serveur",

      error: err.message

    });

  }

});

module.exports = router;