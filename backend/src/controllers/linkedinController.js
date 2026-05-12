const { exec } = require("child_process");
const path = require("path");

exports.syncLinkedin = (req, res) => {
  const scraperPath = path.join(
    __dirname,
    "../../linkedin_scraper/scraper.py"
  );

  const pythonPath =
    "C:\\Users\\kholo\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";

  exec(`"${pythonPath}" "${scraperPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);

      return res.status(500).json({
        success: false,
        error: stderr
      });
    }

    res.json({
      success: true,
      message: stdout
    });
  });
};