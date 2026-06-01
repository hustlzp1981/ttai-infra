(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  const token = localStorage.getItem("token") || "";
  const listEl = document.getElementById("video-list");
  const emptyEl = document.getElementById("video-empty");
  const filterButtons = document.querySelectorAll("[data-mode]");
  const loadMoreBtn = document.getElementById("load-more");
  let currentMode = "";
  let currentPage = 1;
  let totalCount = 0;
  let isLoading = false;
  const pageSize = 12;

  const ensureLogin = () => {
    if (!token) {
      if (emptyEl) emptyEl.textContent = "请先登录以查看视频库。";
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

  const resolveUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return baseUrl + path;
    return baseUrl + "/" + path;
  };

  const resolveThumbnailUrl = (value) => {
    if (!value) return "images/main.png";
    if (value.startsWith("http") || value.startsWith("/")) return resolveUrl(value);
    if (value.includes("/")) return resolveUrl(value);
    return resolveUrl(`/download/${encodeURIComponent(value)}`);
  };

  const renderList = (items, append) => {
    if (!listEl) return;
    if (!append) listEl.innerHTML = "";

    if (!items || items.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "video-item";

      const thumb = resolveThumbnailUrl(item.thumbnailUrl || item.thumbnail || "");
      const title = item.title || (item.mode === "match_clip" ? "比赛剪辑" : "训练分析");
      const duration = item.duration ? `${Math.round(item.duration)} 秒` : "";
      const size = item.size ? `${(item.size / 1024 / 1024).toFixed(1)}MB` : "";
      const modeLabel = item.mode === "match_clip" ? "比赛剪辑" : "训练分析";
      const date = formatDate(item.date || item.createdAt);

      li.innerHTML = `
        <div class="thumbnail-container">
          <img class="thumbnail" src="${thumb}" alt="thumbnail">
          <div>
            <a class="download-link" href="video-detail.html?id=${encodeURIComponent(item.id || item._id || "")}">${title}</a>
            <span class="video-duration">${duration}</span>
            <span class="video-size">${size}</span>
            <span class="video-clips">${modeLabel}${date ? " · " + date : ""}</span>
          </div>
        </div>
      `;
      listEl.appendChild(li);
    });
  };

  const updateLoadMore = () => {
    if (!loadMoreBtn) return;
    const loaded = currentPage * pageSize;
    if (totalCount && loaded >= totalCount) {
      loadMoreBtn.textContent = "已加载全部";
      loadMoreBtn.disabled = true;
    } else {
      loadMoreBtn.textContent = "加载更多";
      loadMoreBtn.disabled = false;
    }
  };

  const fetchList = async (append) => {
    if (!ensureLogin()) return;
    if (isLoading) return;
    isLoading = true;
    if (emptyEl && !append) {
      emptyEl.textContent = "加载中...";
      emptyEl.classList.add("loading");
      emptyEl.style.display = "block";
    }
    if (loadMoreBtn) loadMoreBtn.textContent = "加载中...";

    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
    if (currentMode) params.set("mode", currentMode);

    const response = await fetch(`${apiBase}/videos/list?${params.toString()}`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!response.ok) {
      if (emptyEl) emptyEl.textContent = "加载失败，请稍后重试。";
      if (emptyEl) emptyEl.classList.remove("loading");
      if (loadMoreBtn) loadMoreBtn.textContent = "加载更多";
      isLoading = false;
      return;
    }

    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    totalCount = data.total || 0;
    renderList(data.items || [], append);
    if (emptyEl) emptyEl.classList.remove("loading");
    updateLoadMore();
    isLoading = false;
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      currentMode = btn.dataset.mode || "";
      currentPage = 1;
      totalCount = 0;
      if (loadMoreBtn) {
        loadMoreBtn.style.display = "inline-flex";
        loadMoreBtn.disabled = false;
      }
      fetchList(false);
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage += 1;
      fetchList(true);
    });
  }

  fetchList(false);
})();
