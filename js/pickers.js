/* Custom dropdown pickers */

function setupSimplePicker(inputId, triggerId, menuId, options) {
  const input = $(`#${inputId}`);
  const trigger = $(`#${triggerId}`);
  const menu = $(`#${menuId}`);

  menu.innerHTML = options.map(option =>
    `<button type="button" class="format-option" data-value="${option.value}">
      <span class="format-main">${option.label}</span>
      <small>${option.note}</small>
    </button>`
  ).join("");

  trigger.onclick = () => {
    document.querySelectorAll(".format-menu").forEach(item => {
      if (item !== menu) item.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
  };

  menu.querySelectorAll(".format-option").forEach(item =>
    item.onclick = () => {
      input.value = item.dataset.value;
      trigger.innerHTML = `${item.dataset.value.toUpperCase()} <span>⌄</span>`;
      menu.classList.add("hidden");
    }
  );
}

setupSimplePicker("audioFormat", "audioFormatTrigger", "audioFormatMenu", [
  { value: "mp3", label: "MP3", note: "Universal audio format" },
  { value: "m4a", label: "M4A", note: "AAC audio, compact size" },
  { value: "opus", label: "OPUS", note: "Efficient modern codec" },
  { value: "wav", label: "WAV", note: "Uncompressed audio" },
  { value: "flac", label: "FLAC", note: "Lossless audio" }
]);

setupSimplePicker("audioQuality", "audioQualityTrigger", "audioQualityMenu", [
  { value: "320K", label: "320K", note: "Highest quality" },
  { value: "256K", label: "256K", note: "Very high quality" },
  { value: "192K", label: "192K", note: "Balanced quality" },
  { value: "128K", label: "128K", note: "Smaller file" },
  { value: "96K", label: "96K", note: "Smallest file" }
]);
