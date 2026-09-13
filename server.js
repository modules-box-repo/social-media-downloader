const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const { validUrl, normalizeFormat, argsFor, friendlyError, publicJob } = require("./lib/utils");
const { spawnYtdlp, spawnYtdlpForJob } = require("./lib/ytdlp");
const { jobs, saveJobs } = require("./lib/jobs");

const port = Number(process.env.PORT || 3000);
const downloadsDir = path.resolve(process.env.DOWNLOADS_DIR || "/sdcard/Download/");
const root = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Request body too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function contentTypeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function isBlockedPublicPath(filePath) {
  const rel = path.relative(root, filePath);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return true;
  const parts = rel.split(path.sep);
  if (parts.some(p => p.startsWith("."))) return true;
  if (rel === "server.js" || rel === "setup.sh") return true;
  if (rel === "lib" || rel.startsWith("lib" + path.sep)) return true;
  return false;
}

async function serveStatic(req, res, pathname) {
  let rel = pathname;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request.");
    return;
  }
  if (rel === "/") rel = "/index.html";
  const filePath = path.normalize(path.join(root, rel));
  if (!filePath.startsWith(root) || isBlockedPublicPath(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found.");
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found.");
    return;
  }
  let finalPath = filePath;
  if (stat.isDirectory()) {
    finalPath = path.join(filePath, "index.html");
    try {
      stat = await fsp.stat(finalPath);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found.");
      return;
    }
    if (!stat.isFile() || isBlockedPublicPath(finalPath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found.");
      return;
    }
  }
  if (!stat.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentTypeFor(finalPath),
    "Content-Length": stat.size
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(finalPath).on("error", () => {
    if (!res.headersSent) res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end();
  }).pipe(res);
}

async function serveDownload(req, res, rawName) {
  let filename = rawName;
  try {
    filename = decodeURIComponent(rawName);
  } catch {
    return sendJson(res, 400, { error: "Invalid filename." });
  }
  if (!filename || filename !== path.basename(filename)) {
    return sendJson(res, 400, { error: "Invalid filename." });
  }
  const full = path.join(downloadsDir, filename);
  if (!full.startsWith(downloadsDir)) {
    return sendJson(res, 400, { error: "Invalid filename." });
  }
  let stat;
  try {
    stat = await fsp.stat(full);
  } catch {
    return sendJson(res, 404, { error: "File not found." });
  }
  if (!stat.isFile()) return sendJson(res, 404, { error: "File not found." });
  const safe = filename.replace(/"/g, "");
  const headers = {
    "Content-Type": contentTypeFor(full),
    "Content-Disposition": `attachment; filename="${safe}"`,
    "Accept-Ranges": "bytes"
  };
  const range = req.headers.range;
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      let start = m[1] === "" ? null : Number(m[1]);
      let end = m[2] === "" ? null : Number(m[2]);
      if (start === null && end !== null) {
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else {
        if (start === null || Number.isNaN(start)) start = 0;
        if (end === null || Number.isNaN(end) || end >= stat.size) end = stat.size - 1;
      }
      if (start < 0 || start >= stat.size || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      headers["Content-Length"] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(full, { start, end }).pipe(res);
      return;
    }
  }
  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(full).on("error", () => {
    if (!res.headersSent) sendJson(res, 404, { error: "File not found." });
    else res.end();
  }).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const method = (req.method || "GET").toUpperCase();

    if (method === "POST" && pathname === "/api/verify") {
      try {
        const body = await readJsonBody(req, 1024 * 1024);
        const verifiedUrl = validUrl(body.url);
        const data = await spawnYtdlp(["--dump-single-json", "--no-warnings", "--no-playlist", "--no-check-certificates", verifiedUrl]);
        return sendJson(res, 200, {
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
        return sendJson(res, error.status || 400, { error: error.message });
      }
    }

    if (method === "POST" && pathname === "/api/jobs") {
      try {
        const body = await readJsonBody(req, 1024 * 1024);
        const options = { ...body, url: validUrl(body.url) };
        const jobDownloadsDir = path.resolve(String(body.downloadPath || downloadsDir));
        await fsp.mkdir(jobDownloadsDir, { recursive: true });
        const id = crypto.randomUUID();
        const job = {
          id,
          url: options.url,
          status: "queued",
          progress: 0,
          createdAt: new Date().toISOString(),
          thumbnail: body.thumbnail || null,
          title: body.mediaTitle || null,
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
        return sendJson(res, 202, { job: publicJob(job) });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: error.message });
      }
    }

    if (method === "GET" && pathname === "/api/jobs") {
      return sendJson(res, 200, { jobs: [...jobs.values()].map(publicJob).reverse() });
    }

    if (pathname.startsWith("/api/files/") && (method === "GET" || method === "HEAD")) {
      return serveDownload(req, res, pathname.slice("/api/files/".length));
    }

    const jobAction = pathname.match(/^\/api\/jobs\/([^/]+)\/(cancel|pause|resume)$/);
    if (jobAction && method === "POST") {
      const jobId = decodeURIComponent(jobAction[1]);
      const action = jobAction[2];
      const job = jobs.get(jobId);
      if (action === "cancel") {
        if (!job || !job.process) return sendJson(res, 404, { error: "Job cannot be cancelled." });
        job.status = "cancelled";
        job.process.kill("SIGTERM");
        jobs.set(job.id, job);
        saveJobs();
        return sendJson(res, 200, { job: publicJob(job) });
      }
      if (action === "pause") {
        if (!job || !job.process) return sendJson(res, 404, { error: "Job cannot be paused." });
        if (job.status !== "downloading") return sendJson(res, 400, { error: "Job is not downloading." });
        job.process.kill("SIGSTOP");
        job.status = "paused";
        jobs.set(job.id, job);
        saveJobs();
        return sendJson(res, 200, { job: publicJob(job) });
      }
      if (action === "resume") {
        if (!job || !job.process) return sendJson(res, 404, { error: "Job cannot be resumed." });
        if (job.status !== "paused") return sendJson(res, 400, { error: "Job is not paused." });
        job.process.kill("SIGCONT");
        job.status = "downloading";
        jobs.set(job.id, job);
        saveJobs();
        return sendJson(res, 200, { job: publicJob(job) });
      }
    }

    const jobById = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobById) {
      const jobId = decodeURIComponent(jobById[1]);
      if (method === "GET") {
        const job = jobs.get(jobId);
        if (!job) return sendJson(res, 404, { error: "Job not found." });
        return sendJson(res, 200, { job: publicJob(job) });
      }
      if (method === "DELETE") {
        const job = jobs.get(jobId);
        if (!job) return sendJson(res, 404, { error: "Job not found." });
        if (job.filepath) {
          try { await fsp.unlink(job.filepath); } catch {}
        }
        jobs.delete(jobId);
        saveJobs();
        return sendJson(res, 200, { ok: true });
      }
    }

    if (pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found." });
    }

    if (method === "GET" || method === "HEAD") {
      return serveStatic(req, res, pathname);
    }

    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed.");
  } catch (error) {
    if (!res.headersSent) sendJson(res, 500, { error: "Internal server error." });
    else res.end();
  }
});

server.listen(port, () => console.log(`DL//LOCAL listening on port ${port}`));
