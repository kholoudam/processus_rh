const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

exports.getJobsFromCSV = () => {
  return new Promise((resolve, reject) => {
    const results = [];

    const filePath = path.join(__dirname, "../../data/jobs.csv");

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", reject);
  });
};