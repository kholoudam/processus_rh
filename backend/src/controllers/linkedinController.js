const { exec } = require("child_process");

const path = require("path");

exports.syncLinkedin = async (req, res) => {

  try {

    console.log("\n[LinkedIn] Synchronisation démarrée...\n");

    const scraperPath = path.join(
      __dirname,
      "../../linkedin_scraper/scraper.py"
    );

    const pythonPath =
      "C:\\Users\\kholo\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";

    const command =
      `"${pythonPath}" "${scraperPath}"`;

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

            message:
              "Erreur synchronisation LinkedIn",

            error: error.message,

            stderr

          });

        }

        return res.json({

          success: true,

          message:
            "Synchronisation LinkedIn terminée",

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

};