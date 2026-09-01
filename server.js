// YouTube Downloader - Express server

const express = require("express");
const path = require("node:path");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");

const { validUrl, normalizeFormat, argsFor, friendlyError, publicJob } = require("./lib/utils");
const { spawnYtdlp, spawnYtdlpForJob } = require("./lib/ytdlp");
const { jobs, saveJobs } = require("./lib/jobs");

const app = express();
const port = Number(process.env.PORT || 3000);
const downloadsDir = path.resolve(process.env.DOWNLOADS_DIR || "/sdcard/Download/");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/verify", async (req, res) => {
  try {
    const url = validUrl(req.body.url);
    const data = await spawnYtdlp(["--dump-single-json", "--no-warnings", "--no-playlist", "--no-check-certificates", url]);
    res.json({
      info: {
        id: data.id,
        title: data.title || "Untitled media",
        uploader: data.uploader || "Unknown uploader",
        duration: data.duration || null,
        thumbnail: data.thumbnail || null,
        isPlaylist: data._type === "playlist",
        formats: (data.formats || []).map(normalizeFormat).filter(item => (item.hasVideo || item.hasAudio) && item.fileSize)
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const options = { ...req.body, url: validUrl(req.body.url) };
    const jobDownloadsDir = path.resolve(String(req.body.downloadPath || downloadsDir));
    await fsp.mkdir(jobDownloadsDir, { recursive: true });

    const id = crypto.randomUUID();
    const job = {
      id,
      url: options.url,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      thumbnail: req.body.thumbnail || null,
      title: req.body.mediaTitle || null,
      filepath: null,
      filename: null,
      filesize: null,
      downloaded: null,
      speed: null,
      eta: null,
      error: null
    };

    jobs.set(id, job);
    saveJobs();
    console.log("[JOB " + id + "] Created:", options.url);
    const cmdArgs = argsFor(options, downloadsDir);
    console.log("[JOB " + id + "] Running:", "yt-dlp", cmdArgs.join(" "));

    const { child, getStderr } = spawnYtdlpForJob(cmdArgs, job);
    job.status = "preparing";

    child.on("error", error => {
      job.status = "failed";
      job.error = friendlyError(`${getStderr()}\n${error.message}`);
      jobs.set(id, job);
      saveJobs();
    });

    child.on("close", code => {
      if (job.status === "cancelled") return;
      if (code === 0) {
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
      } else {
        job.status = "failed";
        job.error = friendlyError(getStderr());
      }
      jobs.set(id, job);
      saveJobs();
    });

    job.process = child;
    res.status(202).json({ job: publicJob(job) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/jobs", (_req, res) => {
  res.json({ jobs: [...jobs.values()].map(publicJob).reverse() });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ job: publicJob(job) });
});

app.post("/api/jobs/:id/cancel", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.process) return res.status(404).json({ error: "Job cannot be cancelled." });
  job.status = "cancelled";
  job.process.kill("SIGTERM");
  jobs.set(job.id, job);
  saveJobs();
  res.json({ job: publicJob(job) });
});

app.post("/api/jobs/:id/pause", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.process) return res.status(404).json({ error: "Job cannot be paused." });
  if (job.status !== "downloading") return res.status(400).json({ error: "Job is not downloading." });
  job.process.kill("SIGSTOP");
  job.status = "paused";
  jobs.set(job.id, job);
  saveJobs();
  res.json({ job: publicJob(job) });
});

app.post("/api/jobs/:id/resume", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.process) return res.status(404).json({ error: "Job cannot be resumed." });
  if (job.status !== "paused") return res.status(400).json({ error: "Job is not paused." });
  job.process.kill("SIGCONT");
  job.status = "downloading";
  jobs.set(job.id, job);
  saveJobs();
  res.json({ job: publicJob(job) });
});

app.delete("/api/jobs/:id", async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  if (job.filepath) {
    try { await fsp.unlink(job.filepath); } catch {}
  }
  jobs.delete(req.params.id);
  saveJobs();
  res.json({ ok: true });
});

app.get("/api/files/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename) return res.status(400).json({ error: "Invalid filename." });
  res.download(path.join(downloadsDir, filename), filename, error => {
    if (error && !res.headersSent) res.status(404).json({ error: "File not found." });
  });
});

app.listen(port, () => console.log(`DL//LOCAL listening on port ${port}`));
