// yt-dlp wrapper

const path = require("node:path");
const { spawn } = require("node:child_process");

const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
const denoPath = path.join(process.env.HOME || "/root", ".deno", "bin");

function spawnYtdlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlp, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PATH: `${denoPath}:${process.env.PATH}` }
    });
    let out = "";
    let err = "";

    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });

    child.on("error", error => reject(new Error(`Could not start yt-dlp: ${error.message}`)));

    child.on("close", code => {
      if (code !== 0) return reject(new Error(err.trim() || "yt-dlp failed."));
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error("yt-dlp returned invalid JSON.")); }
    });
  });
}

function spawnYtdlpForJob(args, job) {
  const child = spawn(ytdlp, args, {
    shell: false,
    windowsHide: true,
    env: { ...process.env, PATH: `${denoPath}:${process.env.PATH}` }
  });

  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", chunk => {
    const line = String(chunk);
    const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?(\d+(?:\.\d+)?\s*[KMG]iB)\s+at\s+(\d+(?:\.\d+)?\s*[KMG]iB\/s)\s+ETA\s+(\S+)/i);
    if (match) {
      Object.assign(job, {
        status: "downloading",
        progress: Math.min(100, Number(match[1])),
        filesize: match[2],
        downloaded: `${(Number(match[1]) / 100 * parseFloat(match[2])).toFixed(1)} ${match[2].replace(/[\d.]+/, "").trim()}`,
        speed: match[3],
        eta: match[4]
      });
    } else {
      const simple = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
      if (simple) {
        Object.assign(job, { status: "downloading", progress: Math.min(100, Number(simple[1])) });
      }
    }

    const destination = line.match(/Destination:\s+(.+)/i);
    if (destination) { job.filepath = destination[1].trim(); job.filename = path.basename(job.filepath); }

    const merge = line.match(/Merging formats into "(.+)"/i);
    if (merge) { job.filepath = merge[1].trim(); job.filename = path.basename(job.filepath); }

    const already = line.match(/\[download\]\s+(.+)\s+has already been downloaded/i);
    if (already) { job.filepath = already[1].trim(); job.filename = path.basename(job.filepath); }
  });

  child.stderr.on("data", chunk => { stderr += chunk; });

  return { child, getStderr: () => stderr };
}

module.exports = { ytdlp, denoPath, spawnYtdlp, spawnYtdlpForJob };
