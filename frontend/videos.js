(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  const token = localStorage.getItem("token") || "";

  const listEl = document.getElementById("video-list");
  const emptyEl = document.getElementById("video-empty");
  const filterButtons = document.querySelectorAll("[data-mode]");
  const loadMoreBtn = document.getElementById("load-more");
  const searchInput = document.getElementById("video-search");
  const opponentSelect = document.getElementById("video-opponent");
  const manageToggle = document.getElementById("manage-toggle");
  const batchActions = document.getElementById("batch-actions");
  const selectAllBtn = document.getElementById("select-all");
  const deleteSelectedBtn = document.getElementById("delete-selected");
  const selectedCountEl = document.getElementById("selected-count");
  const listNote = document.getElementById("video-list-note");
  const totalEl = document.getElementById("video-total");
  const loadedEl = document.getElementById("video-loaded");
  const visibleEl = document.getElementById("video-visible");

  let currentMode = "";
  let currentPage = 1;
  let totalCount = 0;
  let isLoading = false;
  let manageMode = false;
  let searchTimer = null;
  let allItems = [];
  let visibleItems = [];
  const selectedIds = new Set();
  const pageSize = 12;

  const ensureLogin = () => {
    if (!token) {
      if (emptyEl) emptyEl.textContent = "请先登录以查看视频库。";
      updateSummary();
      return false;
    }
    return true;
  };

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
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

  const getId = (item) => String(item.id || item._id || "");

  const modeLabel = (mode) => {
    if (mode === "match_clip") return "比赛剪辑";
    if (mode === "training_analysis") return "训练分析";
    return "视频";
  };

  const updateSummary = () => {
    if (totalEl) totalEl.textContent = totalCount ? String(totalCount) : (allItems.length ? String(allItems.length) : "--");
    if (loadedEl) loadedEl.textContent = String(allItems.length || 0);
    if (visibleEl) visibleEl.textContent = String(visibleItems.length || 0);
    if (listNote) {
      const search = searchInput ? searchInput.value.trim() : "";
      const opponent = opponentSelect && opponentSelect.value
        ? opponentSelect.options[opponentSelect.selectedIndex].text
        : "";
      const mode = currentMode ? modeLabel(currentMode) : "全部";
      const filters = [mode, search ? `搜索“${search}”` : "", opponent ? `对手 ${opponent}` : ""].filter(Boolean);
      listNote.textContent = filters.join(" · ") + " · 服务端筛选结果";
    }
  };

  const updateBatchState = () => {
    if (batchActions) batchActions.hidden = !manageMode;
    if (manageToggle) manageToggle.textContent = manageMode ? "完成" : "管理";
    if (selectedCountEl) selectedCountEl.textContent = `已选 ${selectedIds.size} 个`;
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = selectedIds.size === 0;
  };

  const applyClientFilter = () => {
    visibleItems = allItems.slice();
    renderList();
    updateSummary();
    updateBatchState();
  };

  const renderList = () => {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!visibleItems.length) {
      if (emptyEl) {
        emptyEl.textContent = allItems.length ? "当前搜索没有匹配视频。" : "暂无更多视频记录。";
        emptyEl.style.display = "block";
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    visibleItems.forEach((item) => {
      const id = getId(item);
      const li = document.createElement("li");
      li.className = manageMode ? "video-item video-item-manage" : "video-item";
      li.dataset.id = id;

      const thumb = resolveThumbnailUrl(item.thumbnailUrl || item.thumbnail || "");
      const title = item.title || modeLabel(item.mode);
      const duration = item.duration ? `${Math.round(item.duration)} 秒` : "";
      const size = item.size ? `${(item.size / 1024 / 1024).toFixed(1)}MB` : "";
      const date = formatDate(item.date || item.createdAt);
      const score = item.scores && item.scores.overall ? `${item.scores.overall} 分` : "";
      const opponent = item.opponentName ? `vs ${item.opponentName}` : "";
      const clipCount = item.clipCount || (Array.isArray(item.clips) ? item.clips.length : (typeof item.clips === "number" ? item.clips : 0));
      const clips = clipCount ? `${clipCount} 片段` : "";
      const meta = [modeLabel(item.mode), date, duration, size, clips].filter(Boolean).join(" · ");
      const tags = [score, opponent].filter(Boolean);

      li.innerHTML = `
        <div class="thumbnail-container">
          ${manageMode ? `<label class="video-check"><input type="checkbox" data-id="${escapeHtml(id)}" ${selectedIds.has(id) ? "checked" : ""}><span></span></label>` : ""}
          <img class="thumbnail" src="${thumb}" alt="thumbnail">
          <div>
            <a class="download-link" href="video-detail.html?id=${encodeURIComponent(id)}">${escapeHtml(title)}</a>
            <span class="video-clips">${escapeHtml(meta || "视频记录")}</span>
            <div class="video-tag-row">
              ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </div>
      `;

      const checkbox = li.querySelector("input[type='checkbox']");
      if (checkbox) {
        checkbox.addEventListener("change", (event) => {
          const checkedId = event.target.dataset.id;
          if (event.target.checked) selectedIds.add(checkedId);
          else selectedIds.delete(checkedId);
          updateBatchState();
        });
      }

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
      loadMoreBtn.style.display = "inline-flex";
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
    const keyword = searchInput ? searchInput.value.trim() : "";
    const opponentId = opponentSelect ? opponentSelect.value : "";
    if (keyword) params.set("keyword", keyword);
    if (opponentId) params.set("opponentId", opponentId);

    try {
      const response = await fetch(`${apiBase}/videos/list?${params.toString()}`, {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) throw new Error("加载失败");

      const payload = await response.json();
      const data = payload && payload.data ? payload.data : payload;
      const nextItems = data.items || [];
      totalCount = Number(data.total) || 0;
      allItems = append ? allItems.concat(nextItems) : nextItems;
      selectedIds.clear();
      applyClientFilter();
      updateLoadMore();
    } catch (err) {
      if (emptyEl) {
        emptyEl.textContent = "加载失败，请稍后重试。";
        emptyEl.style.display = "block";
      }
      if (loadMoreBtn) loadMoreBtn.textContent = "加载更多";
    } finally {
      if (emptyEl) emptyEl.classList.remove("loading");
      isLoading = false;
      updateSummary();
      updateBatchState();
    }
  };

  const resetAndFetch = () => {
    currentPage = 1;
    totalCount = 0;
    allItems = [];
    visibleItems = [];
    selectedIds.clear();
    fetchList(false);
  };

  const loadOpponents = async () => {
    if (!opponentSelect || !token) return;
    try {
      const response = await fetch(`${apiBase}/opponents/list?page=1&pageSize=100`, {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) return;
      const payload = await response.json();
      const data = payload && payload.data ? payload.data : payload;
      const items = data.items || [];
      items.forEach((item) => {
        const id = item.id || item._id || "";
        if (!id) return;
        const option = document.createElement("option");
        option.value = id;
        option.textContent = item.name || "未命名对手";
        opponentSelect.appendChild(option);
      });
    } catch (err) {
      console.warn("load opponents failed", err);
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`确认删除 ${selectedIds.size} 个视频？`)) return;
    const ids = Array.from(selectedIds);
    if (deleteSelectedBtn) {
      deleteSelectedBtn.disabled = true;
      deleteSelectedBtn.textContent = "删除中...";
    }

    try {
      for (const id of ids) {
        const response = await fetch(apiBase + "/videos/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error("delete failed");
      }
      allItems = allItems.filter((item) => !selectedIds.has(getId(item)));
      totalCount = Math.max(0, totalCount - ids.length);
      selectedIds.clear();
      applyClientFilter();
    } catch (err) {
      alert("删除失败，请稍后重试。");
    } finally {
      if (deleteSelectedBtn) deleteSelectedBtn.textContent = "删除所选";
      updateBatchState();
      updateSummary();
    }
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      currentMode = btn.dataset.mode || "";
      currentPage = 1;
      totalCount = 0;
      allItems = [];
      visibleItems = [];
      selectedIds.clear();
      fetchList(false);
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(resetAndFetch, 350);
    });
    searchInput.addEventListener("search", resetAndFetch);
  }

  if (opponentSelect) {
    opponentSelect.addEventListener("change", resetAndFetch);
  }

  if (manageToggle) {
    manageToggle.addEventListener("click", () => {
      manageMode = !manageMode;
      if (!manageMode) selectedIds.clear();
      renderList();
      updateBatchState();
    });
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      visibleItems.forEach((item) => {
        const id = getId(item);
        if (id) selectedIds.add(id);
      });
      renderList();
      updateBatchState();
    });
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener("click", deleteSelected);
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage += 1;
      fetchList(true);
    });
  }

  updateSummary();
  updateBatchState();
  loadOpponents();
  fetchList(false);
})();
