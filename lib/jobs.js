// Job persistence and management

const fs = require("node:fs");
const path = require("node:path");

const jobsFile = path.join(__dirname, "..", ".jobs.json");
const jobs = new Map();

function loadJobs() {
  try {
    if (fs.existsSync(jobsFile)) {
      const data = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
      for (const job of data) {
        if (job.status === "downloading" || job.status === "queued" || job.status === "preparing" || job.status === "paused") {
          job.status = "failed";
          job.error = "Server was restarted";
        }
        jobs.set(job.id, job);
      }
    }
  } catch {}
}

function saveJobs() {
  try {
    const data = [...jobs.values()].map(job => {
      const { process: _, ...safe } = job;
      return safe;
    });
    fs.writeFileSync(jobsFile, JSON.stringify(data, null, 2));
  } catch {}
}

loadJobs();

module.exports = { jobs, saveJobs };
