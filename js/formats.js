/* Format rendering and selection */

function renderFormatDetails(format) {
  if (!format) return "";
  const values = [
    `<span>${format.ext.toUpperCase()}</span>`,
    `<span>${format.resolution}</span>`
  ];
  if (format.videoCodec) values.push(`<span>${format.videoCodec}</span>`);
  if (format.audioCodec) values.push(`<span>${format.audioCodec}</span>`);
  if (format.bitrate) values.push(`<span>${Math.round(format.bitrate)}k</span>`);
  if (format.fileSize) values.push(`<span>${bytes(format.fileSize)}</span>`);
  return values.join("");
}

function selectFormat(formatId) {
  const format = state.info?.formats.find(item => item.formatId === formatId);
  if (!format) return;

  $("#format").value = formatId;
  $("#formatTrigger").innerHTML = `${formatLabel(format)} <span>⌄</span>`;
  $("#formatDetails").innerHTML = `
    <b>Selected format</b>
    <div class="format-detail-grid">${renderFormatDetails(format)}</div>
  `;
  $("#formatDetails").classList.remove("hidden");

  document.querySelectorAll("#formatMenu .format-option").forEach(item =>
    item.classList.toggle("selected", item.dataset.id === formatId)
  );
  document.querySelectorAll("#formats tr").forEach(row =>
    row.classList.toggle("selected", row.dataset.id === formatId)
  );
  $("#formatMenu").classList.add("hidden");
}

function renderFormatPicker(info) {
  const choices = info.formats.filter(format => format.hasVideo);

  $("#formatMenu").innerHTML = `
    <button type="button" class="format-option best" data-id="">
      <span class="format-main">Best quality</span>
      <small>Automatic video + audio</small>
    </button>
    ${choices.map(format =>
      `<button type="button" class="format-option" data-id="${format.formatId}">
        <span class="format-main">${formatLabel(format)}</span>
        <small>${format.videoCodec || "Video"}${format.audioCodec ? ` + ${format.audioCodec}` : ""}${format.bitrate ? ` · ${Math.round(format.bitrate)}k` : ""}${format.fileSize ? ` · ${bytes(format.fileSize)}` : ""}</small>
      </button>`
    ).join("")}
  `;

  document.querySelectorAll("#formatMenu .format-option").forEach(item =>
    item.onclick = () => {
      if (item.dataset.id) {
        selectFormat(item.dataset.id);
      } else {
        $("#format").value = "";
        $("#formatTrigger").innerHTML = "Best quality <span>⌄</span>";
        $("#formatDetails").classList.add("hidden");
        $("#formatMenu").classList.add("hidden");
      }
    }
  );
}

function renderInfo(info) {
  state.info = info;
  $("#title").textContent = info.title;
  $("#details").textContent = `${info.uploader || "Unknown uploader"} / ${info.duration ? new Date(info.duration * 1000).toISOString().slice(11, 19) : "—"}`;
  $("#formatCount").textContent = `${info.formats.length} FORMATS`;
  $("#thumb").src = info.thumbnail || "";
  $("#thumb").classList.toggle("hidden", !info.thumbnail);

  $("#formats").innerHTML = info.formats.map(format =>
    `<tr data-id="${format.formatId}">
      <td>${format.formatId}</td>
      <td>${format.hasVideo ? "VIDEO" : "AUDIO"} / ${format.ext.toUpperCase()}</td>
      <td>${format.resolution}${format.fps ? ` / ${format.fps} FPS` : ""}</td>
      <td>${format.videoCodec || "—"} ${format.audioCodec ? `+ ${format.audioCodec}` : ""}</td>
      <td>${format.bitrate ? `${Math.round(format.bitrate)}k` : "—"}</td>
      <td>${bytes(format.fileSize)}</td>
    </tr>`
  ).join("");

  renderFormatPicker(info);

  document.querySelectorAll("#formats tr").forEach(row =>
    row.onclick = () => selectFormat(row.dataset.id)
  );

  $("#formats").parentElement.parentElement.classList.toggle("hidden", !state.formatsVisible);
  $("#toggleFormats").textContent = state.formatsVisible ? "Hide formats" : "Show formats";
}
