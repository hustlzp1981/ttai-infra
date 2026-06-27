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
  const immersiveBtn = document.getElementById("btn-immersive");
  const immersivePlayer = document.getElementById("immersive-player");
  const immersiveClose = document.getElementById("immersive-close");
  const immersiveTitle = document.getElementById("immersive-title");
  const immersiveSubtitle = document.getElementById("immersive-subtitle");
  const immersiveListToggle = document.getElementById("immersive-list-toggle");
  const immersiveCurrentTitle = document.getElementById("immersive-current-title");
  const immersiveCurrentSubtitle = document.getElementById("immersive-current-subtitle");
  const immersiveStats = document.getElementById("immersive-stats");
  const immersiveVideo = document.getElementById("immersive-video");
  const immersiveActions = document.getElementById("immersive-actions");
  const immersiveRecordPanel = document.getElementById("immersive-record-panel");
  const immersiveRecordTitle = document.getElementById("immersive-record-title");
  const immersiveClipList = document.getElementById("immersive-clip-list");
  const immersiveFavorite = document.getElementById("immersive-favorite");
  const immersiveSpeed = document.getElementById("immersive-speed");
  const immersiveSpeedLabel = document.getElementById("immersive-speed-label");
  const immersiveDownload = document.getElementById("immersive-download");
  const immersiveShare = document.getElementById("immersive-share");
  const immersiveFullscreen = document.getElementById("immersive-fullscreen");
  const immersiveShareStatus = document.getElementById("immersive-share-status");
  const immersiveSortButtons = document.querySelectorAll("[data-player-sort]");

  let currentData = null;
  let overlayUrls = {};
  let currentVideoUrl = "";
  const speedRates = [0.5, 1, 1.5, 2];
  let playerState = {
    open: false,
    view: "play",
    clips: [],
    sort: "all",
    currentClipId: "",
    currentUrl: "",
    speedIndex: 1,
    favorite: false
  };

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

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatDuration = (seconds) => {
    const value = Number(seconds);
    if (!value || value <= 0) return "--";
    return value >= 10 ? `${Math.round(value)}秒` : `${value.toFixed(1)}秒`;
  };

  const formatClock = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const mm = String(Math.floor(value / 60)).padStart(2, "0");
    const ss = String(value % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const resolveVideoMediaBasePath = (video) => {
    if (!video) return "";
    const realId = video.realTaskId || video.taskId || video.task_id || "";
    if (realId) return `${apiBase}/download-media/${encodeURIComponent(realId)}/`;
    const url = video.videoUrl || video.downloadLink || video.mergedUrl || video.mergedVideoUrl || "";
    return url.lastIndexOf("/") >= 0 ? url.substring(0, url.lastIndexOf("/") + 1) : "";
  };

  const resolveMediaUrl = (value, basePath) => {
    if (!value) return "";
    if (String(value).startsWith("http") || String(value).startsWith("/")) return resolveUrl(String(value));
    if (basePath) return resolveUrl(basePath + String(value));
    return resolveUrl(String(value));
  };

  const favoriteKey = () => {
    const clipKey = playerState.currentClipId || "full";
    return `ttai-web-video-favorite:${videoId}:${clipKey}`;
  };

  const readFavorite = () => {
    try {
      return localStorage.getItem(favoriteKey()) === "1";
    } catch (err) {
      return false;
    }
  };

  const writeFavorite = (value) => {
    try {
      if (value) localStorage.setItem(favoriteKey(), "1");
      else localStorage.removeItem(favoriteKey());
    } catch (err) {}
  };

  const buildMatchClipItems = (video) => {
    const clipsData = Array.isArray(video && video.clips) ? video.clips : [];
    const basePath = resolveVideoMediaBasePath(video);
    if (clipsData.length > 0) {
      return clipsData.map((clip, index) => {
        const start = parseFloat(clip.start) || 0;
        const end = parseFloat(clip.end) || 0;
        const duration = parseFloat(clip.duration) || Math.max(0, end - start);
        const rating = clip.rating || clip.score || clip.overall || "";
        return {
          id: `clip_${index + 1}`,
          index,
          rallyNo: clip.index || index + 1,
          downloadLink: resolveMediaUrl(clip.videoUrl || clip.downloadLink || clip.url || clip.video || "", basePath),
          thumbnailUrl: resolveMediaUrl(clip.thumbnailUrl || clip.thumbnail || clip.thumb || "", basePath),
          timeLabel: start ? formatClock(start) : "时间未知",
          durationLabel: formatDuration(duration),
          shotCount: clip.shots || clip.shotCount || "",
          speedLabel: clip.peakSpeed || clip.speed ? `${clip.peakSpeed || clip.speed}m/s` : "",
          rating,
          displayName: start || end ? `${start.toFixed(1)}s ~ ${end.toFixed(1)}s` : ""
        };
      });
    }

    const totalClips = Number(video && video.clipCount) || 0;
    if (!totalClips || !basePath) return [];
    return Array.from({ length: totalClips }, (_, index) => ({
      id: `clip_${index + 1}`,
      index,
      rallyNo: index + 1,
      downloadLink: resolveMediaUrl(`clip_${index + 1}.mp4`, basePath),
      thumbnailUrl: resolveMediaUrl(`clip_${index + 1}_thumb.jpg`, basePath),
      timeLabel: "时间未知",
      durationLabel: "--",
      shotCount: "",
      speedLabel: "",
      rating: "",
      displayName: ""
    }));
  };

  const buildPlayerCurrent = (clip, video) => {
    if (!clip) {
      const clipCount = video && (video.clipCount || (Array.isArray(video.clips) ? video.clips.length : 0));
      return {
        title: video && video.mode === "match_clip" ? "完整比赛" : "完整视频",
        subtitle: video && video.mode === "match_clip" ? "全部有效回合" : "当前分析视频",
        stats: [
          { label: "回合", value: clipCount ? String(clipCount) : "--" },
          { label: "时长", value: video && video.duration ? formatDuration(video.duration) : "--" },
          { label: "大小", value: video && video.size ? `${(video.size / 1024 / 1024).toFixed(1)}MB` : "--" },
          { label: "评分", value: video && video.scores && video.scores.overall ? String(video.scores.overall) : "无评级" }
        ]
      };
    }
    return {
      title: `回合 ${clip.rallyNo}`,
      subtitle: clip.timeLabel || "时间未知",
      stats: [
        { label: "时长", value: clip.durationLabel || "--" },
        { label: "拍数", value: clip.shotCount ? String(clip.shotCount) : "--" },
        { label: "球速", value: clip.speedLabel || "--" },
        { label: "评分", value: clip.rating ? String(clip.rating) : "无评级" }
      ]
    };
  };

  const sortedClips = () => {
    const list = playerState.clips.slice();
    if (playerState.sort === "score") {
      list.sort((a, b) => (Number(b.rating) || -1) - (Number(a.rating) || -1));
    }
    return list;
  };

  const setShareStatus = (text) => {
    if (!immersiveShareStatus) return;
    immersiveShareStatus.textContent = text || "";
    if (text) {
      setTimeout(() => {
        if (immersiveShareStatus.textContent === text) immersiveShareStatus.textContent = "";
      }, 2600);
    }
  };

  const renderPlayerCurrent = (clip) => {
    const current = buildPlayerCurrent(clip || null, currentData || {});
    if (immersiveCurrentTitle) immersiveCurrentTitle.textContent = current.title;
    if (immersiveCurrentSubtitle) immersiveCurrentSubtitle.textContent = current.subtitle;
    if (immersiveStats) {
      immersiveStats.innerHTML = current.stats.map((item) => `
        <div class="immersive-stat">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("");
    }
  };

  const renderClipList = () => {
    if (!immersiveClipList) return;
    const list = sortedClips();
    if (immersiveRecordTitle) immersiveRecordTitle.textContent = `共${list.length}条记录`;
    immersiveClipList.innerHTML = "";
    if (!list.length) {
      immersiveClipList.innerHTML = "<div class=\"immersive-empty\">暂无回合记录</div>";
      return;
    }
    list.forEach((clip) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "immersive-record-card" + (playerState.currentClipId === clip.id ? " active" : "") + (!clip.downloadLink ? " disabled" : "");
      item.innerHTML = `
        ${clip.thumbnailUrl ? `<img class="immersive-record-thumb" src="${escapeHtml(clip.thumbnailUrl)}" alt="">` : "<div class=\"immersive-record-thumb empty\">回合</div>"}
        <span class="immersive-record-info">
          <strong>回合${escapeHtml(clip.rallyNo)}</strong>
          <span>${escapeHtml(clip.timeLabel || "时间未知")} · ${escapeHtml(clip.durationLabel || "--")}</span>
          <span>${clip.rating ? escapeHtml(clip.rating + "分") : "无评级"}</span>
        </span>
        <span class="immersive-record-state">${clip.downloadLink ? "播放" : "准备中"}</span>
      `;
      item.addEventListener("click", () => selectClip(clip));
      immersiveClipList.appendChild(item);
    });
  };

  const renderImmersive = () => {
    if (!playerState.clips.length && playerState.view === "list") playerState.view = "play";
    const isList = playerState.view === "list";
    if (immersivePlayer) immersivePlayer.classList.toggle("list-mode", isList);
    if (immersiveListToggle) {
      immersiveListToggle.textContent = isList ? "返回播放" : "记录列表";
      immersiveListToggle.hidden = playerState.clips.length === 0;
    }
    if (immersiveRecordPanel) immersiveRecordPanel.hidden = !isList;
    if (immersiveActions) immersiveActions.hidden = isList;
    if (immersiveFavorite) {
      const icon = immersiveFavorite.querySelector(".immersive-action-icon");
      if (icon) icon.textContent = playerState.favorite ? "★" : "☆";
    }
    if (immersiveSpeedLabel) immersiveSpeedLabel.textContent = `${speedRates[playerState.speedIndex]}倍`;
    immersiveSortButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.playerSort === playerState.sort);
    });
    renderClipList();
  };

  const setImmersiveSource = (url) => {
    playerState.currentUrl = url || "";
    if (!immersiveVideo || !url) return;
    immersiveVideo.src = url;
    immersiveVideo.playbackRate = speedRates[playerState.speedIndex];
    immersiveVideo.play().catch(() => {});
  };

  const openImmersivePlayer = () => {
    if (!currentData) return;
    const clips = buildMatchClipItems(currentData);
    const url = currentVideoUrl || resolveMediaUrl(currentData.videoUrl || currentData.downloadLink || "", "") || (clips[0] && clips[0].downloadLink) || "";
    if (!url) {
      alert("视频暂未就绪");
      return;
    }
    playerState = {
      open: true,
      view: "play",
      clips,
      sort: "all",
      currentClipId: "",
      currentUrl: url,
      speedIndex: 1,
      favorite: false
    };
    playerState.favorite = readFavorite();
    if (immersiveTitle) immersiveTitle.textContent = currentData.title || (currentData.mode === "match_clip" ? "比赛回放" : "训练分析");
    if (immersiveSubtitle) {
      const clipText = currentData.mode === "match_clip" ? `已剪出 ${clips.length || currentData.clipCount || 0} 个有效回合` : "训练分析视频";
      immersiveSubtitle.textContent = currentData.date || currentData.createdAt || clipText;
    }
    renderPlayerCurrent(null);
    if (immersivePlayer) immersivePlayer.hidden = false;
    document.body.classList.add("modal-open");
    setImmersiveSource(url);
    renderImmersive();
  };

  const closeImmersivePlayer = () => {
    if (immersiveVideo) {
      immersiveVideo.pause();
      immersiveVideo.removeAttribute("src");
      immersiveVideo.load();
    }
    if (immersivePlayer) immersivePlayer.hidden = true;
    document.body.classList.remove("modal-open");
    playerState.open = false;
  };

  const selectClip = (clip) => {
    if (!clip || !clip.downloadLink) {
      setShareStatus("片段准备中");
      return;
    }
    playerState.currentClipId = clip.id;
    playerState.view = "play";
    playerState.favorite = readFavorite();
    renderPlayerCurrent(clip);
    setImmersiveSource(clip.downloadLink);
    renderImmersive();
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

  if (immersiveBtn) {
    immersiveBtn.addEventListener("click", openImmersivePlayer);
  }

  if (immersiveClose) {
    immersiveClose.addEventListener("click", closeImmersivePlayer);
  }

  if (immersiveListToggle) {
    immersiveListToggle.addEventListener("click", () => {
      playerState.view = playerState.view === "list" ? "play" : "list";
      renderImmersive();
      if (playerState.view === "list" && immersiveRecordPanel) {
        setTimeout(() => immersiveRecordPanel.scrollIntoView({ block: "nearest" }), 0);
      }
    });
  }

  immersiveSortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      playerState.sort = btn.dataset.playerSort || "all";
      renderImmersive();
    });
  });

  if (immersiveFavorite) {
    immersiveFavorite.addEventListener("click", () => {
      playerState.favorite = !playerState.favorite;
      writeFavorite(playerState.favorite);
      setShareStatus(playerState.favorite ? "已收藏" : "已取消收藏");
      renderImmersive();
    });
  }

  if (immersiveSpeed) {
    immersiveSpeed.addEventListener("click", () => {
      playerState.speedIndex = (playerState.speedIndex + 1) % speedRates.length;
      if (immersiveVideo) immersiveVideo.playbackRate = speedRates[playerState.speedIndex];
      renderImmersive();
    });
  }

  const downloadCurrentImmersiveVideo = () => {
    if (!playerState.currentUrl) return;
    const link = document.createElement("a");
    link.href = playerState.currentUrl;
    link.download = playerState.currentClipId ? `${playerState.currentClipId}.mp4` : "video.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (immersiveDownload) {
    immersiveDownload.addEventListener("click", downloadCurrentImmersiveVideo);
  }

  const shareCurrentImmersiveVideo = async () => {
    const shareUrl = playerState.currentUrl || window.location.href;
    const title = currentData && currentData.title ? currentData.title : "TT AI 视频";
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("已复制播放链接");
        return;
      }
      setShareStatus("当前浏览器不支持分享");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setShareStatus("分享失败，请稍后重试");
    }
  };

  if (immersiveShare) {
    immersiveShare.addEventListener("click", shareCurrentImmersiveVideo);
  }

  if (immersiveFullscreen) {
    immersiveFullscreen.addEventListener("click", () => {
      const target = immersiveVideo || immersivePlayer;
      if (target && target.requestFullscreen) {
        target.requestFullscreen().catch(() => setShareStatus("当前浏览器不支持全屏"));
      } else {
        setShareStatus("当前浏览器不支持全屏");
      }
    });
  }

  if (immersiveVideo) {
    immersiveVideo.addEventListener("ended", () => {
      if (!playerState.currentClipId) return;
      immersiveVideo.currentTime = 0;
      immersiveVideo.play().catch(() => {});
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && playerState.open) closeImmersivePlayer();
  });

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
