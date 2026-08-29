const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const app = express();
const port = Number(process.env.PORT || 3000);
const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
const downloadsDir = path.resolve(process.env.DOWNLOADS_DIR || "/sdcard/Download/");
const jobs = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function validUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { throw new Error("Enter a valid http:// or https:// URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http:// and https:// URLs are supported.");
  return url.toString();
}

function runJson(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlp, args, { shell: false, windowsHide: true });
    let out = ""; let err = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });
    child.on("error", error => reject(new Error(`Could not start yt-dlp: ${error.message}`)));
    child.on("close", code => {
      if (code !== 0) return reject(new Error(err.trim() || "yt-dlp could not inspect this URL."));
      try { resolve(JSON.parse(out)); } catch { reject(new Error("yt-dlp returned invalid metadata.")); }
    });
  });
}

function normalizeFormat(format) {
  const video = format.vcodec && format.vcodec !== "none" ? format.vcodec : null;
  const audio = format.acodec && format.acodec !== "none" ? format.acodec : null;
  return { formatId: String(format.format_id || "?"), ext: format.ext || "?", resolution: format.resolution || (format.height ? `${format.height}p` : "audio only"), fps: format.fps || null, videoCodec: video, audioCodec: audio, bitrate: format.tbr || null, fileSize: format.filesize || format.filesize_approx || null, hasVideo: Boolean(video), hasAudio: Boolean(audio), note: format.format_note || "" };
}

app.post("/api/verify", async (req, res) => {
  try {
    const url = validUrl(req.body.url);
    const data = await runJson(["--dump-single-json", "--no-warnings", "--no-playlist", "--no-check-certificates", url]);
    res.json({ info: { id: data.id, title: data.title || "Untitled media", uploader: data.uploader || "Unknown uploader", duration: data.duration || null, thumbnail: data.thumbnail || null, isPlaylist: data._type === "playlist", formats: (data.formats || []).map(normalizeFormat).filter(item => item.hasVideo || item.hasAudio) } });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

function argsFor(options) {
  const targetDir = path.resolve(String(options.downloadPath || downloadsDir));
  const outputTpl = options.outputTemplate || "%(title)s [%(id)s].%(ext)s";
  const hasFormat = outputTpl.includes("%(format_id)s") || outputTpl.includes("%(format)s");
  const finalTpl = hasFormat ? outputTpl : "%(title)s [%(id)s] [%(format_id)s].%(ext)s";
  const args = ["--newline", "--no-warnings", "--no-check-certificates", "--paths", targetDir, "-o", finalTpl];
  args.push(options.playlist ? "--yes-playlist" : "--no-playlist");
  if (options.mode === "audio") args.push("-x", "--audio-format", options.audioFormat || "mp3", "--audio-quality", options.audioQuality || "192K");
  else args.push("-f", options.formatId ? `${options.formatId}+ba/${options.formatId}/bv*+ba/b` : "bv*+ba/b", "--merge-output-format", "mp4");
  if (options.embedThumbnail) args.push("--embed-thumbnail");
  if (options.embedMetadata) args.push("--embed-metadata");
  if (Array.isArray(options.subtitles) && options.subtitles.length) args.push("--write-subs", "--sub-langs", options.subtitles.join(","), "--sub-format", "vtt");
  args.push(options.url);
  return args;
}

function friendlyError(text) { const lower = text.toLowerCase(); if (lower.includes("ffmpeg")) return "FFmpeg is required for this operation."; if (lower.includes("unsupported url")) return "This URL is not supported by yt-dlp."; if (lower.includes("login required")) return "This media requires authentication."; return text.trim().split(/\r?\n/).filter(Boolean).pop() || "The download failed."; }

app.post("/api/jobs", async (req, res) => {
  try {
    const options = { ...req.body, url: validUrl(req.body.url) };
    const jobDownloadsDir = path.resolve(String(req.body.downloadPath || downloadsDir));
    await fsp.mkdir(jobDownloadsDir, { recursive: true });
    const id = crypto.randomUUID();
    const job = { id, url: options.url, status: "queued", progress: 0, createdAt: new Date().toISOString(), thumbnail: req.body.thumbnail || null, title: req.body.mediaTitle || null, filepath: null, filesize: null, downloaded: null, speed: null };
    jobs.set(id, job);
    const child = spawn(ytdlp, argsFor(options), { shell: false, windowsHide: true });
    job.status = "preparing"; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { const line = String(chunk); const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?(\d+(?:\.\d+)?\s*[KMG]iB)\s+at\s+(\d+(?:\.\d+)?\s*[KMG]iB\/s)\s+ETA\s+(\S+)/i); if (match) Object.assign(job, { status: "downloading", progress: Math.min(100, Number(match[1])), filesize: match[2], downloaded: `${(Number(match[1]) / 100 * parseFloat(match[2])).toFixed(1)} ${match[2].replace(/[\d.]+/, "").trim()}`, speed: match[3], eta: match[4] }); else { const simple = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i); if (simple) Object.assign(job, { status: "downloading", progress: Math.min(100, Number(simple[1])) }); } const destination = line.match(/Destination:\s+(.+)/i); if (destination) { job.filepath = destination[1].trim(); job.filename = path.basename(job.filepath); } const merge = line.match(/Merging formats into "(.+)"/i); if (merge) { job.filepath = merge[1].trim(); job.filename = path.basename(job.filepath); } const already = line.match(/\[download\]\s+(.+)\s+has already been downloaded/i); if (already) { job.filepath = already[1].trim(); job.filename = path.basename(job.filepath); } });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => { job.status = "failed"; job.error = friendlyError(`${stderr}\n${error.message}`); jobs.delete(id); jobs.set(id, job); });
    child.on("close", code => { if (job.status === "cancelled") return; if (code === 0) { job.status = "completed"; job.progress = 100; job.completedAt = new Date().toISOString(); } else { job.status = "failed"; job.error = friendlyError(stderr); } jobs.set(id, job); });
    job.process = child;
    res.status(202).json({ job: publicJob(job) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

function publicJob(job) { const { process, ...safe } = job; return safe; }
app.get("/api/jobs", (_req, res) => res.json({ jobs: [...jobs.values()].map(publicJob).reverse() }));
app.get("/api/jobs/:id", (req, res) => { const job = jobs.get(req.params.id); if (!job) return res.status(404).json({ error: "Job not found." }); res.json({ job: publicJob(job) }); });
app.post("/api/jobs/:id/cancel", (req, res) => { const job = jobs.get(req.params.id); if (!job || !job.process) return res.status(404).json({ error: "Job cannot be cancelled." }); job.status = "cancelled"; job.process.kill("SIGTERM"); res.json({ job: publicJob(job) }); });
app.post("/api/jobs/:id/pause", (req, res) => { const job = jobs.get(req.params.id); if (!job || !job.process) return res.status(404).json({ error: "Job cannot be paused." }); if (job.status !== "downloading") return res.status(400).json({ error: "Job is not downloading." }); job.process.kill("SIGSTOP"); job.status = "paused"; res.json({ job: publicJob(job) }); });
app.post("/api/jobs/:id/resume", (req, res) => { const job = jobs.get(req.params.id); if (!job || !job.process) return res.status(404).json({ error: "Job cannot be resumed." }); if (job.status !== "paused") return res.status(400).json({ error: "Job is not paused." }); job.process.kill("SIGCONT"); job.status = "downloading"; res.json({ job: publicJob(job) }); });
app.delete("/api/jobs/:id", async (req, res) => { const job = jobs.get(req.params.id); if (!job) return res.status(404).json({ error: "Job not found." }); if (job.filepath) { try { await fsp.unlink(job.filepath); } catch {} } jobs.delete(req.params.id); res.json({ ok: true }); });
app.get("/api/files/:filename", (req, res) => { const filename = path.basename(req.params.filename); if (filename !== req.params.filename) return res.status(400).json({ error: "Invalid filename." }); res.download(path.join(downloadsDir, filename), filename, error => { if (error && !res.headersSent) res.status(404).json({ error: "File not found." }); }); });

app.listen(port, () => console.log(`DL//LOCAL listening on port ${port}`));
