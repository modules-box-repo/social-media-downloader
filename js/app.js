/* Main application - event handlers, navigation, and initialization */

$("#theme").onclick = () => {
  document.body.classList.toggle("light");
  $("#theme").textContent = document.body.classList.contains("light") ? "☾" : "☼";
};

document.querySelectorAll(".mode").forEach(button =>
  button.onclick = () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll(".mode").forEach(item =>
      item.classList.toggle("active", item === button)
    );
    $("#audio-fields").classList.toggle("hidden", state.mode !== "audio");
    $("#formatPicker").classList.toggle("hidden", state.mode === "audio");

    if (state.mode === "audio") {
      $("#muteSection").classList.add("hidden");
      $("#audioMergeSection").classList.add("hidden");
      $("#formatDetails").classList.add("hidden");
      renderAudioModePicker();
    } else {
      const selectedId = $("#format").value;
      const format = selectedId ? state.info?.formats.find(f => f.formatId === selectedId) : null;
      if (format) {
        $("#formatDetails").classList.remove("hidden");
        const hasAudio = format.hasAudio;
        $("#muteSection").classList.toggle("hidden", !hasAudio);
        $("#audioMergeSection").classList.toggle("hidden", hasAudio);
        if (!hasAudio && $("#audioMergeToggle").checked) {
          $(".audio-format-field").classList.remove("hidden");
        }
      } else {
        $("#muteSection").classList.remove("hidden");
        $("#audioMergeSection").classList.add("hidden");
        $("#formatDetails").classList.add("hidden");
      }
    }
  }
);

$("#formatTrigger").onclick = () => {
  $("#formatMenu").classList.toggle("hidden");
};

$("#audioFormatTrigger").onclick = () => {
  $("#audioFormatMenu").classList.toggle("hidden");
};

$("#muteToggle").onchange = () => {
  state.mute = $("#muteToggle").checked;
};

$("#audioMergeToggle").onchange = () => {
  const enabled = $("#audioMergeToggle").checked;
  $(".audio-format-field").classList.toggle("hidden", !enabled);
};

$("#audioMergeTrigger").onclick = () => {
  $("#audioMergeMenu").classList.toggle("hidden");
};

$("#toggleFormats").onclick = () => {
  state.formatsVisible = !state.formatsVisible;
  $("#formats").parentElement.parentElement.classList.toggle("hidden", !state.formatsVisible);
  $("#toggleFormats").textContent = state.formatsVisible ? "Hide formats" : "Show formats";
};

$("#verify").onclick = async () => {
  try {
    setVerifyLoading(true);
    const data = await api("/api/verify", {
      method: "POST",
      body: JSON.stringify({ url: $("#url").value })
    });
    renderInfo(data.info);
    message("Metadata loaded. Formats are hidden until you choose Show formats.");
  } catch (error) {
    message(error.message, true);
  } finally {
    setVerifyLoading(false);
  }
};

$("#advanced").onclick = () => {
  const box = $("#advancedBox");
  box.classList.toggle("hidden");
  $("#advanced").textContent = box.classList.contains("hidden") ? "Show" : "Hide";
  $(".advanced-icon").textContent = box.classList.contains("hidden") ? "+" : "−";
};

$("#download").onclick = async () => {
  try {
    setDownloadLoading(true);
    const data = {
      url: $("#url").value,
      mode: state.mode,
      formatId: state.mode === "video" ? ($("#format").value || undefined) : ($("#audioFormatId").value || undefined),
      mute: state.mute,
      audioMerge: $("#audioMergeToggle").checked,
      audioMergeFormat: $("#audioMergeFormat").value || undefined,
      subtitles: $("#subs").value.split(",").map(item => item.trim()).filter(Boolean),
      embedMetadata: $("#metadata").checked,
      embedThumbnail: $("#thumbnail").checked,
      playlist: $("#playlist").checked,
      outputTemplate: $("#template").value,
      downloadPath: $("#downloadPath").value,
      thumbnail: state.info?.thumbnail || null,
      mediaTitle: state.info?.title || null
    };

    await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify(data)
    });

    $("#downloadBar").style.width = "100%";
    message("Download queued in the local worker.");
    showActivityView();
  } catch (error) {
    message(error.message, true);
  } finally {
    setTimeout(() => setDownloadLoading(false), 500);
  }
};

async function refreshJobs() {
  try {
    const data = await api("/api/jobs");
    const failed = data.jobs.filter(j => j.status === "failed");
    failed.forEach(j => {
      if (!j._toastShown) {
        j._toastShown = true;
        showToast(`Download failed: ${j.title || j.url}`);
        api(`/api/jobs/${j.id}`, { method: "DELETE" });
      }
    });

    const active = data.jobs.filter(j => j.status !== "failed");
    $("#jobs").innerHTML = active.length ? active.map(job => {
      const isDownloading = ["downloading", "queued", "preparing"].includes(job.status);
      const isPaused = job.status === "paused";
      const downloaded = job.downloaded && job.filesize
        ? `${job.downloaded} / ${job.filesize}`
        : job.filesize || "";

      return `
        <article class="job">
          ${job.thumbnail
            ? `<img class="job-thumb" src="${job.thumbnail}" alt="">`
            : `<div class="job-thumb job-thumb-placeholder">↓</div>`
          }
          <div class="job-body">
            <div class="job-top">
              <strong class="job-title">${job.title || job.url}</strong>
              <span class="job-status ${job.status}">${job.status.toUpperCase()}</span>
            </div>
            ${job.filepath ? `<span class="job-path">${job.filepath}</span>` : ""}
            <div class="job-meta">
              ${downloaded ? `<span class="job-downloaded">${downloaded}</span>` : ""}
              ${job.speed && !isPaused ? `<span class="job-speed">${job.speed}</span>` : ""}
            </div>
            ${(isDownloading || isPaused) ? `
              <div class="meter">
                <div class="progress"><i style="width:${job.progress || 0}%"></i></div>
                <span>${Math.round(job.progress || 0)}%</span>
              </div>
              <div class="job-controls">
                ${isPaused
                  ? `<button class="resume" data-id="${job.id}">▶ Resume</button>`
                  : `<button class="pause" data-id="${job.id}">= Pause</button>`
                }
                <button class="cancel" data-id="${job.id}">■ Stop</button>
              </div>
            ` : ""}
            ${job.status === "completed" ? `
              <div class="job-actions">
                <button class="job-delete" data-id="${job.id}">delete</button>
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }).join("") : '<p class="empty">No downloads yet. Your queue will appear here.</p>';

    document.querySelectorAll(".pause").forEach(btn =>
      btn.onclick = () => api(`/api/jobs/${btn.dataset.id}/pause`, { method: "POST" }).then(refreshJobs)
    );
    document.querySelectorAll(".resume").forEach(btn =>
      btn.onclick = () => api(`/api/jobs/${btn.dataset.id}/resume`, { method: "POST" }).then(refreshJobs)
    );
    document.querySelectorAll(".cancel").forEach(btn =>
      btn.onclick = () => api(`/api/jobs/${btn.dataset.id}`, { method: "DELETE" }).then(refreshJobs)
    );
    document.querySelectorAll(".job-delete").forEach(btn =>
      btn.onclick = () => api(`/api/jobs/${btn.dataset.id}`, { method: "DELETE" }).then(refreshJobs)
    );
  } catch (error) {
    console.error("Failed to refresh jobs:", error);
  }
}

$("#refresh").onclick = refreshJobs;
refreshJobs();
setInterval(refreshJobs, 1200);

function showActivityView() {
  document.body.classList.add("activity-view");
  $("#navActivity").classList.add("active");
  $("#navHome").classList.remove("active");
  refreshJobs();
}

function showHomeView() {
  document.body.classList.remove("activity-view");
  $("#navHome").classList.add("active");
  $("#navActivity").classList.remove("active");
}

$("#navActivity").onclick = e => {
  e.preventDefault();
  showActivityView();
};

$("#navHome").onclick = e => {
  e.preventDefault();
  showHomeView();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

$(".brand").onclick = e => {
  e.preventDefault();
  showHomeView();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

if (location.hash === "#activity") showActivityView(); else showHomeView();

if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  $(".bottom-nav").style.display = "none";
  document.body.style.paddingBottom = "0";
}
