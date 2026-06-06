(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const token = localStorage.getItem("token") || "";
  const baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get("id") || "";

  const titleEl = document.getElementById("video-title");
  const metaEl = document.getElementById("video-meta");
  const videoEl = document.getElementById("video-player");
  const infoEl = document.getElementById("video-info");
  const scoreGrid = document.getElementById("score-grid");
  const overlayBox = document.getElementById("overlay-box");
  const overlayButtons = document.querySelectorAll("[data-overlay]");
  const overlayStatus = document.getElementById("overlay-status");
  const downloadBtn = document.getElementById("btn-download");
  const editBtn = document.getElementById("btn-edit");
  const deleteBtn = document.getElementById("btn-delete");

  let currentData = null;
  let overlayUrls = {};
  let currentVideoUrl = "";

  const ensureLogin = () => {
    if (!token) {
      if (metaEl) metaEl.textContent = "请先登录以查看视频详情。";
      return false;
    }
    return true;
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  };

  const resolveUrl = (value) => {
    if (!value) return "";
    if (value.startsWith("http")) return value;
    if (value.startsWith("/")) return baseUrl + value;
    return baseUrl + "/" + value;
  };

  const setActiveOverlay = (type) => {
    overlayButtons.forEach((btn) => {
      btn.classList.toggle("btn-primary", btn.dataset.overlay === type);
    });
  };

  const setOverlayStatus = (text, loading) => {
    if (!overlayStatus) return;
    overlayStatus.textContent = text;
    overlayStatus.classList.toggle("loading", Boolean(loading));
  };

  const renderScores = (scores) => {
    if (!scoreGrid) return;
    if (!scores) {
      scoreGrid.innerHTML = "<div class=\"empty-state\">暂无评分数据。</div>";
      return;
    }
    const entries = [
      { label: "综合评分", value: scores.overall },
      { label: "正手", value: scores.forehand },
      { label: "反手", value: scores.backhand },
      { label: "步伐", value: scores.footwork }
    ];
    scoreGrid.innerHTML = entries.map((item) => {
      return `
        <div class="stat-card">
          <h4>${item.label}</h4>
          <p>${item.value != null ? item.value : "--"}</p>
        </div>
      `;
    }).join("");
  };

  const fetchDetail = async () => {
    if (!ensureLogin()) return;
    if (!videoId) {
      if (metaEl) metaEl.textContent = "缺少视频 ID";
      return;
    }

    if (metaEl) metaEl.textContent = "加载中...";
    if (scoreGrid) scoreGrid.innerHTML = "<div class=\"empty-state loading\">加载中...</div>";

    const response = await fetch(`${apiBase}/videos/detail?id=${encodeURIComponent(videoId)}`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!response.ok) {
      if (metaEl) metaEl.textContent = "加载失败，请稍后重试。";
      if (scoreGrid) scoreGrid.innerHTML = "<div class=\"empty-state\">加载失败，请稍后重试。</div>";
      return;
    }

    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;

    currentData = data;
    if (titleEl) titleEl.textContent = data.title || "视频详情";
    if (metaEl) {
      metaEl.textContent = `${data.mode === "match_clip" ? "比赛剪辑" : "训练分析"} · ${formatDate(data.date || data.createdAt)}`;
    }

    const duration = data.duration ? `${Math.round(data.duration)} 秒` : "--";
    const size = data.size ? `${(data.size / 1024 / 1024).toFixed(1)}MB` : "--";
    const clipCount = data.clipCount || (Array.isArray(data.clips) ? data.clips.length : (typeof data.clips === 'number' ? data.clips : 0));
    const clips = clipCount ? `${clipCount} 段` : "--";
    if (infoEl) {
      infoEl.textContent = `时长 ${duration} · 大小 ${size} · 片段 ${clips}`;
    }

    currentVideoUrl = resolveUrl(data.videoUrl || "");
    if (videoEl && currentVideoUrl) {
      videoEl.src = currentVideoUrl;
    }

    renderScores(data.scores);

    if (overlayBox) {
      overlayBox.style.display = data.mode === "training_analysis" ? "block" : "none";
    }

    overlayUrls = {};
    if (data.overlayVideos) {
      Object.keys(data.overlayVideos).forEach((key) => {
        overlayUrls[key] = resolveUrl(data.overlayVideos[key]);
      });
    }

    if (data.mode === "training_analysis") {
      const defaultOverlay = overlayUrls.all || currentVideoUrl;
      if (defaultOverlay) {
        currentVideoUrl = defaultOverlay;
        if (videoEl) videoEl.src = currentVideoUrl;
      }
      setActiveOverlay("all");
      if (!overlayUrls.all && Object.keys(overlayUrls).length === 0) {
        setOverlayStatus("暂无覆盖层资源，默认展示原视频。", false);
      } else {
        setOverlayStatus("选择覆盖层即可切换训练视图。", false);
      }
    } else {
      setOverlayStatus("仅训练分析模式支持覆盖层。", false);
    }
  };

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!currentVideoUrl) return;
      const link = document.createElement("a");
      link.href = currentVideoUrl;
      link.download = "video.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      if (!currentData) return;
      const nextTitle = prompt("输入新的标题", currentData.title || "");
      if (!nextTitle) return;
      const response = await fetch(apiBase + "/videos/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ id: currentData.id || currentData._id || videoId, title: nextTitle })
      });
      if (response.ok) {
        if (titleEl) titleEl.textContent = nextTitle;
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!currentData) return;
      if (!confirm("确认删除该视频？")) return;
      const response = await fetch(apiBase + "/videos/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ id: currentData.id || currentData._id || videoId })
      });
      if (response.ok) {
        window.location.href = "videos.html";
      }
    });
  }

  overlayButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.overlay;
      const nextUrl = overlayUrls[type] || "";
      if (!nextUrl) {
        setOverlayStatus("该覆盖层尚未生成，请稍后再试。", false);
        return;
      }
      if (videoEl) {
        setOverlayStatus("覆盖层加载中...", true);
        videoEl.src = nextUrl;
        currentVideoUrl = nextUrl;
        setActiveOverlay(type);
      }
    });
  });

  if (videoEl) {
    videoEl.addEventListener("canplay", () => {
      if (overlayBox && overlayBox.style.display !== "none") {
        setOverlayStatus("覆盖层已就绪。", false);
      }
    });
    videoEl.addEventListener("loadstart", () => {
      if (overlayBox && overlayBox.style.display !== "none") {
        setOverlayStatus("覆盖层加载中...", true);
      }
    });
  }

  fetchDetail();
})();
