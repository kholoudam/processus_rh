const pool = require("../config/db");

exports.matchCandidates = async () => {
  const jobs = await pool.query("SELECT * FROM jobs");
  const candidates = await pool.query("SELECT * FROM candidates");

  const results = [];

  for (let job of jobs.rows) {
    for (let candidate of candidates.rows) {
      let score = 0;

      const jobText = job.description.toLowerCase();

      candidate.skills?.forEach(skill => {
        if (jobText.includes(skill.toLowerCase())) {
          score += 10;
        }
      });

      if (score > 0) {
        results.push({
          job: job.title,
          candidate: candidate.email,
          score
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
};