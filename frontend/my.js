(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const token = localStorage.getItem("token") || "";

  const profileName = document.getElementById("profile-name");
  const profileEmpty = document.getElementById("profile-empty");
  const quotaInfo = document.getElementById("quota-info");
  const quotaEmpty = document.getElementById("quota-empty");

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

  const fetchProfile = async () => {
    if (profileEmpty) {
      profileEmpty.textContent = "加载中...";
      profileEmpty.classList.add("loading");
      profileEmpty.style.display = "block";
    }
    const response = await fetch(apiBase + "/user", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      if (profileEmpty) profileEmpty.textContent = "加载失败，请稍后重试。";
      return;
    }
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    if (data && data.user && profileName) {
      profileName.textContent = `你好，${data.user.nickname || "球友"}`;
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
    if (quotaInfo) {
      const tierName = data.tierName || data.tier || "普通用户";
      const remaining = typeof data.remainingAnalyses === "number" ? data.remainingAnalyses : "--";
      const max = typeof data.maxAnalyses === "number" ? data.maxAnalyses : "--";
      quotaInfo.textContent = `${tierName} · 本月剩余 ${remaining} / ${max}`;
    }
    if (quotaEmpty) quotaEmpty.style.display = "none";
    if (quotaEmpty) quotaEmpty.classList.remove("loading");
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
