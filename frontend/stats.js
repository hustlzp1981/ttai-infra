(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const token = localStorage.getItem("token") || "";
  const dayButtons = document.querySelectorAll("[data-days]");

  const statDays = document.getElementById("stat-days");
  const statHours = document.getElementById("stat-hours");
  const statStreak = document.getElementById("stat-streak");
  const statScore = document.getElementById("stat-score");
  const tagList = document.getElementById("tag-list");
  const tagEmpty = document.getElementById("tag-empty");
  const scoreTrend = document.getElementById("score-trend");
  const scoreCanvas = document.getElementById("score-canvas");
  const trendSummary = document.getElementById("trend-summary");

  let currentDays = 30;
  let lastTrend = [];

  const ensureLogin = () => {
    if (!token) {
      if (tagEmpty) tagEmpty.textContent = "请先登录查看训练统计。";
      return false;
    }
    return true;
  };

  const renderTags = (tags) => {
    if (!tagList) return;
    if (!tags || tags.length === 0) {
      tagList.textContent = "";
      if (tagEmpty) tagEmpty.style.display = "block";
      return;
    }
    if (tagEmpty) tagEmpty.style.display = "none";
    tagList.innerHTML = tags.map((item) => {
      return `${item.tag} ${item.pct || 0}%`;
    }).join(" · ");
  };

  const renderTrend = (trend) => {
    if (!scoreCanvas || !scoreTrend) return;
    lastTrend = trend || [];
    if (!trend || trend.length < 2) {
      scoreTrend.style.display = "block";
      if (trendSummary) trendSummary.textContent = "最近暂无评分趋势数据。";
      return;
    }
    scoreTrend.style.display = "none";
    const ctx = scoreCanvas.getContext("2d");
    const width = scoreCanvas.clientWidth;
    const height = scoreCanvas.clientHeight;
    scoreCanvas.width = width * window.devicePixelRatio;
    scoreCanvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 16, right: 16, bottom: 24, left: 28 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const scores = trend.map((item) => item.score || 0);
    const maxScore = 100;
    const minScore = 0;

    ctx.strokeStyle = "#e6e9ef";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    const points = scores.map((score, index) => {
      const x = padding.left + (chartW * index) / Math.max(scores.length - 1, 1);
      const y = padding.top + chartH - ((score - minScore) / (maxScore - minScore)) * chartH;
      return { x, y };
    });

    ctx.strokeStyle = "#00aa00";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    ctx.fillStyle = "#00aa00";
    points.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px 'IBM Plex Sans', sans-serif";
    trend.forEach((item, idx) => {
      const label = item.date ? item.date.slice(5) : "";
      const x = padding.left + (chartW * idx) / Math.max(trend.length - 1, 1);
      ctx.fillText(label, x - 12, height - 6);
    });

    if (trendSummary) {
      const first = scores[0] || 0;
      const last = scores[scores.length - 1] || 0;
      const diff = last - first;
      const diffText = diff >= 0 ? `↑${diff}` : `↓${Math.abs(diff)}`;
      trendSummary.innerHTML = `最近评分 <strong>${last}</strong> · 变化 ${diffText}`;
    }
  };

  const renderStats = (data) => {
    const training = data.training || {};
    const ai = data.ai || {};

    if (statDays) statDays.textContent = training.thisMonth ? `${training.thisMonth.days || 0} 天` : `${training.totalDays || 0} 天`;
    if (statHours) statHours.textContent = training.totalHours ? `${training.totalHours}h` : "--";
    if (statStreak) statStreak.textContent = training.streak ? `${training.streak} 天` : "--";
    if (statScore) statScore.textContent = ai.avgScore ? `${ai.avgScore}` : "--";

    renderTags(training.tagDistribution || []);
    renderTrend(ai.scoreTrend || []);
  };

  const fetchStats = async () => {
    if (!ensureLogin()) return;
    if (tagEmpty) {
      tagEmpty.textContent = "加载中...";
      tagEmpty.classList.add("loading");
      tagEmpty.style.display = "block";
    }
    if (scoreTrend) {
      scoreTrend.textContent = "加载中...";
      scoreTrend.classList.add("loading");
      scoreTrend.style.display = "block";
    }
    const response = await fetch(`${apiBase}/stats?days=${currentDays}`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      if (tagEmpty) tagEmpty.textContent = "加载失败，请稍后重试。";
      if (tagEmpty) tagEmpty.classList.remove("loading");
      if (scoreTrend) {
        scoreTrend.textContent = "加载失败，请稍后重试。";
        scoreTrend.classList.remove("loading");
        scoreTrend.style.display = "block";
      }
      return;
    }
    const payload = await response.json();
    const data = payload && payload.data ? payload.data : payload;
    renderStats(data);
    if (tagEmpty) tagEmpty.classList.remove("loading");
    if (scoreTrend) scoreTrend.classList.remove("loading");
  };

  dayButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dayButtons.forEach((b) => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      currentDays = parseInt(btn.dataset.days, 10) || 30;
      fetchStats();
    });
  });

  fetchStats();

  window.addEventListener("resize", () => {
    if (lastTrend && lastTrend.length > 1) {
      renderTrend(lastTrend);
    }
  });
})();
