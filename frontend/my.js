(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const urlParams = new URLSearchParams(window.location.search);
  const loginToken = urlParams.get("token");
  const loginOpenId = urlParams.get("openid");
  if (loginToken) localStorage.setItem("token", loginToken);
  if (loginOpenId) localStorage.setItem("openid", loginOpenId);
  const token = localStorage.getItem("token") || "";

  const profileName = document.getElementById("profile-name");
  const profileEmpty = document.getElementById("profile-empty");
  const profileSummary = document.getElementById("profile-summary");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileNickname = document.getElementById("profile-nickname");
  const profileTags = document.getElementById("profile-tags");
  const quotaInfo = document.getElementById("quota-info");
  const quotaEmpty = document.getElementById("quota-empty");
  const membershipSummary = document.getElementById("membership-summary");
  const membershipTier = document.getElementById("membership-tier");
  const membershipExpiry = document.getElementById("membership-expiry");
  const analysisUsage = document.getElementById("analysis-usage");
  const analysisMeter = document.getElementById("analysis-meter");
  const storageMeterRow = document.getElementById("storage-meter-row");
  const storageUsage = document.getElementById("storage-usage");
  const storageMeter = document.getElementById("storage-meter");
  const storageStatus = document.getElementById("storage-status");

  const statDays = document.getElementById("stat-days");
  const statHours = document.getElementById("stat-hours");
  const statScore = document.getElementById("stat-score");
  const statOpponents = document.getElementById("stat-opponents");

  const ensureLogin = () => {
    if (!token) {
      if (profileEmpty) profileEmpty.textContent = "请先登录以同步你的训练数据。";
      if (quotaEmpty) quotaEmpty.textContent = "请先登录以获取配额。";
      return false;
    }
    return true;
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const formatBytes = (value) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
    const gib = 1024 * 1024 * 1024;
    const mib = 1024 * 1024;
    if (bytes < gib) return `${Math.max(1, Math.round(bytes / mib))} MB`;
    return `${Math.round(bytes / gib * 10) / 10} GB`;
  };

  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

  const renderQuota = (data) => {
    const tierName = data.tierName || data.tier || "乒乓新星";
    const remaining = Number(data.remainingAnalyses);
    const max = Number(data.maxAnalyses);
    const unlimited = max < 0;
    const used = Number.isFinite(max) && Number.isFinite(remaining) && max > 0
      ? Math.max(0, max - remaining)
      : 0;

    if (membershipTier) membershipTier.textContent = tierName;
    if (analysisUsage) {
      analysisUsage.textContent = unlimited ? "不限次" : `${used} / ${Number.isFinite(max) ? max : "--"}`;
    }
    if (analysisMeter) {
      analysisMeter.style.width = `${unlimited ? 100 : clampPercent(max > 0 ? used * 100 / max : 0)}%`;
    }

    let expiryText = "长期有效";
    if (data.isTrial && data.trialExpiresAt) {
      expiryText = `黄金试用至 ${formatDate(data.trialExpiresAt)}`;
    } else if (data.membershipExpiresAt) {
      expiryText = `有效期至 ${formatDate(data.membershipExpiresAt)}`;
    } else if (data.nextTierName) {
      expiryText = `下一段位：${data.nextTierName}`;
    }
    if (membershipExpiry) membershipExpiry.textContent = expiryText;

    const storage = data.storage || {};
    const metered = storage.meteringAvailable === true && Number.isFinite(Number(storage.usedBytes)) &&
      Number.isFinite(Number(storage.limitBytes)) && Number(storage.limitBytes) > 0;
    if (storageMeterRow) storageMeterRow.hidden = !metered;
    if (metered) {
      const usedBytes = Number(storage.usedBytes);
      const limitBytes = Number(storage.limitBytes);
      const percent = clampPercent(Number.isFinite(Number(storage.usagePercent))
        ? Number(storage.usagePercent)
        : usedBytes * 100 / limitBytes);
      if (storageUsage) storageUsage.textContent = `${formatBytes(usedBytes)} / ${formatBytes(limitBytes)}`;
      if (storageMeter) {
        storageMeter.style.width = `${percent}%`;
        storageMeter.classList.toggle("near", storage.isNearLimit === true && storage.isFull !== true);
        storageMeter.classList.toggle("full", storage.isFull === true);
      }
      if (storageStatus) {
        storageStatus.textContent = storage.isFull
          ? "空间已满"
          : (storage.isNearLimit ? "空间即将用满" : "");
        storageStatus.className = `membership-storage-status${storage.isFull ? " full" : (storage.isNearLimit ? " near" : "")}`;
      }
    }

    if (quotaInfo) quotaInfo.hidden = true;
    if (membershipSummary) membershipSummary.hidden = false;
    if (quotaEmpty) {
      quotaEmpty.style.display = "none";
      quotaEmpty.classList.remove("loading");
    }
  };

  const fetchProfile = async () => {
    if (profileEmpty) {
      profileEmpty.textContent = "加载中...";
      profileEmpty.classList.add("loading");
      profileEmpty.style.display = "block";
    }
    const openid = localStorage.getItem("openid") || "";
    const url = openid ? apiBase + "/user?openid=" + encodeURIComponent(openid) : apiBase + "/user";
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      if (profileEmpty) profileEmpty.textContent = "加载失败，请稍后重试。";
      return;
    }
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    if (data && data.user) {
      const user = data.user;
      localStorage.setItem("userInfo", JSON.stringify(user));
      if (profileName) profileName.textContent = `你好，${user.nickname || "球友"}`;
      if (profileNickname) profileNickname.textContent = user.nickname || "球友";
      if (profileAvatar) {
        profileAvatar.src = user.avatarUrl || user.avatar || "images/main.png";
        profileAvatar.style.display = "block";
      }
      if (profileTags) {
        const tags = user.tags || user.trainingTags || user.labels || [];
        profileTags.innerHTML = "";
        (Array.isArray(tags) ? tags : []).slice(0, 6).forEach((tag) => {
          const tagEl = document.createElement("span");
          tagEl.className = "tag-chip";
          tagEl.textContent = tag;
          profileTags.appendChild(tagEl);
        });
        if (!profileTags.childElementCount) {
          const tagEl = document.createElement("span");
          tagEl.className = "tag-chip";
          tagEl.textContent = "暂无标签";
          profileTags.appendChild(tagEl);
        }
      }
      if (profileSummary) profileSummary.style.display = "flex";
      if (profileEmpty) profileEmpty.style.display = "none";
      if (profileEmpty) profileEmpty.classList.remove("loading");
    }
  };

  const fetchQuota = async () => {
    if (quotaEmpty) {
      quotaEmpty.textContent = "加载中...";
      quotaEmpty.classList.add("loading");
      quotaEmpty.style.display = "block";
    }
    const response = await fetch(apiBase + "/user/quota", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      if (quotaEmpty) quotaEmpty.textContent = "加载失败，请稍后重试。";
      return;
    }
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    if (!data || payload.code && payload.code !== 0) {
      if (quotaEmpty) quotaEmpty.textContent = payload.message || "暂无配额数据。";
      return;
    }
    renderQuota(data);
  };

  const fetchStats = async () => {
    const response = await fetch(apiBase + "/stats?days=30", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) return;
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    const training = data.training || {};
    const ai = data.ai || {};

    if (statDays) statDays.textContent = training.thisMonth ? `${training.thisMonth.days || 0} 天` : `${training.totalDays || 0} 天`;
    if (statHours) statHours.textContent = training.totalHours ? `${training.totalHours}h` : "--";
    if (statScore) statScore.textContent = ai.avgScore ? `${ai.avgScore}` : "--";
  };

  const fetchOpponents = async () => {
    const response = await fetch(apiBase + "/opponents/list?page=1&pageSize=1", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) return;
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    if (statOpponents) statOpponents.textContent = data.total || 0;
  };

  if (!ensureLogin()) return;

  fetchProfile();
  fetchQuota();
  fetchStats();
  fetchOpponents();
})();
