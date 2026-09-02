/* Format rendering and selection */

function audioBadge(format) {
  if (format.hasAudio) return "";
  return `<span class="no-audio-badge" title="No audio track"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg></span>`;
}

function renderFormatDetails(format) {
  if (!format) return "";
  const values = [
    `<span>${format.ext.toUpperCase()}</span>`,
    `<span>${format.resolution}</span>`,
    `<span>${audioBadge(format)} ${format.hasAudio ? "Has audio" : "No audio"}</span>`
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

  const hasAudio = format.hasAudio;
  $("#muteSection").classList.toggle("hidden", !hasAudio);
  $("#audioMergeSection").classList.toggle("hidden", hasAudio);

  if (!hasAudio) {
    renderAudioMergePicker();
    if ($("#audioMergeToggle").checked) {
      $(".audio-format-field").classList.remove("hidden");
    }
  }

  document.querySelectorAll("#formatMenu .format-option").forEach(item =>
    item.classList.toggle("selected", item.dataset.id === formatId)
  );
  document.querySelectorAll("#formats tr").forEach(row =>
    row.classList.toggle("selected", row.dataset.id === formatId)
  );
  $("#formatMenu").classList.add("hidden");
}

function renderAudioMergePicker() {
  const audioFormats = state.info?.formats.filter(f => f.hasAudio && !f.hasVideo) || [];

  if (!audioFormats.length) {
    $("#audioMergePicker").classList.add("hidden");
    $(".audio-format-field").classList.add("hidden");
    return;
  }

  $("#audioMergePicker").classList.remove("hidden");
  $("#audioMergeFormat").value = "";
  $("#audioMergeTrigger").innerHTML = "Best audio <span>⌄</span>";
  $("#audioFormatDetails").classList.add("hidden");
  $("#audioMergeMenu").innerHTML = `
    <button type="button" class="format-option best" data-id="">
      <span class="format-main">Best audio</span>
      <small>Automatically pick the best audio track</small>
    </button>
    ${audioFormats.map(f =>
      `<button type="button" class="format-option" data-id="${f.formatId}">
        <span class="format-main">${f.formatId} : ${f.ext.toUpperCase()} ${f.resolution !== "audio only" ? f.resolution : ""}</span>
        <small>${f.audioCodec || "Audio"}${f.bitrate ? ` · ${Math.round(f.bitrate)}k` : ""}${f.fileSize ? ` · ${bytes(f.fileSize)}` : ""}</small>
      </button>`
    ).join("")}
  `;

  $("#audioMergeMenu").querySelectorAll(".format-option").forEach(item =>
    item.onclick = () => {
      $("#audioMergeFormat").value = item.dataset.id;
      const label = item.dataset.id ? item.querySelector(".format-main").textContent : "Best audio";
      $("#audioMergeTrigger").innerHTML = `${label} <span>⌄</span>`;

      if (item.dataset.id) {
        const af = audioFormats.find(f => f.formatId === item.dataset.id);
        if (af) {
          $("#audioFormatDetails").innerHTML = `
            <b>Selected audio format</b>
            <div class="format-detail-grid">
              <span>${af.ext.toUpperCase()}</span>
              <span>${af.audioCodec || "Audio"}</span>
              ${af.bitrate ? `<span>${Math.round(af.bitrate)}k</span>` : ""}
              ${af.fileSize ? `<span>${bytes(af.fileSize)}</span>` : ""}
            </div>
          `;
          $("#audioFormatDetails").classList.remove("hidden");
        }
      } else {
        $("#audioFormatDetails").classList.add("hidden");
      }

      $("#audioMergeMenu").querySelectorAll(".format-option").forEach(o =>
        o.classList.toggle("selected", o.dataset.id === item.dataset.id)
      );
      $("#audioMergeMenu").classList.add("hidden");
    }
  );
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
        <span class="format-main">${formatLabel(format)} ${audioBadge(format)}</span>
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
        const hasAudioFormats = state.info?.formats.some(f => f.hasAudio && !f.hasVideo);
        $("#muteSection").classList.toggle("hidden", !hasAudioFormats);
        $("#audioMergeSection").classList.add("hidden");
        $("#formatMenu").classList.add("hidden");
      }
    }
  );
}

function renderAudioModePicker() {
  const audioFormats = state.info?.formats.filter(f => f.hasAudio && !f.hasVideo) || [];

  if (!audioFormats.length) {
    $("#audioFormatMenu").innerHTML = '<p class="empty">No audio formats available.</p>';
    return;
  }

  $("#audioFormatMenu").innerHTML = `
    <button type="button" class="format-option best" data-id="">
      <span class="format-main">Best audio</span>
      <small>Automatically pick the best audio track</small>
    </button>
    ${audioFormats.map(f =>
      `<button type="button" class="format-option" data-id="${f.formatId}">
        <span class="format-main">${f.formatId} : ${f.ext.toUpperCase()}</span>
        <small>${f.audioCodec || "Audio"}${f.bitrate ? ` · ${Math.round(f.bitrate)}k` : ""}${f.fileSize ? ` · ${bytes(f.fileSize)}` : ""}</small>
      </button>`
    ).join("")}
  `;

  $("#audioFormatMenu").querySelectorAll(".format-option").forEach(item =>
    item.onclick = () => {
      $("#audioFormatId").value = item.dataset.id;
      const label = item.dataset.id ? item.querySelector(".format-main").textContent : "Best audio";
      $("#audioFormatTrigger").innerHTML = `${label} <span>⌄</span>`;

      if (item.dataset.id) {
        const af = audioFormats.find(f => f.formatId === item.dataset.id);
        if (af) {
          $("#audioModeDetails").innerHTML = `
            <b>Selected format</b>
            <div class="format-detail-grid">
              <span>${af.ext.toUpperCase()}</span>
              <span>${af.resolution}</span>
              <span>${af.audioCodec || "Audio"}</span>
              ${af.bitrate ? `<span>${Math.round(af.bitrate)}k</span>` : ""}
              ${af.fileSize ? `<span>${bytes(af.fileSize)}</span>` : ""}
            </div>
          `;
          $("#audioModeDetails").classList.remove("hidden");
        }
      } else {
        $("#audioModeDetails").classList.add("hidden");
      }

      $("#audioFormatMenu").querySelectorAll(".format-option").forEach(o =>
        o.classList.toggle("selected", o.dataset.id === item.dataset.id)
      );
      $("#audioFormatMenu").classList.add("hidden");
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
      <td>${format.hasVideo ? "VIDEO" : "AUDIO"} / ${format.ext.toUpperCase()} ${!format.hasAudio && format.hasVideo ? `<span class="no-audio-badge" title="No audio track"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg></span>` : ""}</td>
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
