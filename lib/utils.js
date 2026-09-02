// Utility functions

const path = require("node:path");

function validUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid http:// or https:// URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  return url.toString();
}

function normalizeFormat(format) {
  const video = format.vcodec && format.vcodec !== "none" ? format.vcodec : null;
  const audio = format.acodec && format.acodec !== "none" ? format.acodec : null;
  return {
    formatId: String(format.format_id || "?"),
    ext: format.ext || "?",
    resolution: format.resolution || (format.height ? `${format.height}p` : "audio only"),
    fps: format.fps || null,
    videoCodec: video,
    audioCodec: audio,
    bitrate: format.tbr || null,
    fileSize: format.filesize || format.filesize_approx || null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    note: format.format_note || ""
  };
}

function argsFor(options, downloadsDir) {
  const targetDir = path.resolve(String(options.downloadPath || downloadsDir));
  const outputTpl = options.outputTemplate || "%(title)s [%(format_id)s %(resolution)s %(tbr)sk].%(ext)s";
  const hasFormat = outputTpl.includes("%(format_id)s") || outputTpl.includes("%(format)s");
  const finalTpl = hasFormat ? outputTpl : "%(title)s [%(format_id)s %(resolution)s %(tbr)sk].%(ext)s";

  const args = [
    "--newline", "--no-warnings", "--no-cache-dir",
    "--paths", targetDir, "-o", finalTpl
  ];

  args.push(options.playlist ? "--yes-playlist" : "--no-playlist");

  if (options.mode === "audio") {
    if (options.formatId) {
      args.push("-f", options.formatId);
    } else {
      args.push("-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "192K");
    }
  } else if (options.formatId) {
    if (options.mute) {
      args.push("-f", options.formatId);
    } else if (options.audioMerge) {
      const audioId = options.audioMergeFormat || "bestaudio";
      args.push("-f", `${options.formatId}+${audioId}/best`, "--merge-output-format", "mp4");
    } else {
      args.push("-f", options.formatId);
    }
  } else {
    args.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4");
  }

  if (options.embedThumbnail) args.push("--embed-thumbnail");
  if (options.embedMetadata) args.push("--embed-metadata");
  if (Array.isArray(options.subtitles) && options.subtitles.length) {
    args.push("--write-subs", "--sub-langs", options.subtitles.join(","), "--sub-format", "vtt");
  }

  args.push(options.url);
  return args;
}

function friendlyError(text) {
  const lower = text.toLowerCase();
  if (lower.includes("ffmpeg")) return "FFmpeg is required for this operation.";
  if (lower.includes("unsupported url")) return "This URL is not supported by yt-dlp.";
  if (lower.includes("login required")) return "This media requires authentication.";
  return text.trim().split(/\r?\n/).filter(Boolean).pop() || "The download failed.";
}

function publicJob(job) {
  const { process: _, ...safe } = job;
  return safe;
}

module.exports = { validUrl, normalizeFormat, argsFor, friendlyError, publicJob };
