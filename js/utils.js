/* State, API, and utility functions */

const $ = selector => document.querySelector(selector);

const state = {
  mode: "video",
  info: null,
  formatsVisible: false,
  pickerOpen: null,
  mute: false
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
};

const bytes = value => {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size > 1024 && index < 3) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
};

const message = (text, error = false) => {
  $("#message").innerHTML = `<div class="notice">${error ? "ERROR / " : "OK / "}${text}</div>`;
};

function showToast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

const setVerifyLoading = loading => {
  $("#verify").disabled = loading;
  $("#verify .button-label").classList.toggle("hidden", loading);
  $("#verify .spinner").classList.toggle("hidden", !loading);
};

const setDownloadLoading = loading => {
  $("#download").disabled = loading;
  $("#download .download-label").classList.toggle("hidden", loading);
  $("#downloadBar").classList.toggle("hidden", !loading);
  if (loading) $("#downloadBar").style.width = "22%";
};

const formatLabel = format => {
  const raw = format.resolution || "Audio";
  const match = raw.match(/x(\d+)/i);
  const height = format.height || (match ? match[1] : "");
  const resolution = height ? `${height}p` : (raw === "audio only" ? "Audio" : raw);
  return `${format.formatId} : ${resolution} ${format.ext.toUpperCase()}`;
};
