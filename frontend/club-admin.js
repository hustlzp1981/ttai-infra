(function () {
  var params = new URLSearchParams(window.location.search);
  var preview = params.get("preview") === "1";
  if (preview) localStorage.setItem("clubAdminPreview", "true");

  var token = localStorage.getItem("token") || "";
  var previewAllowed = localStorage.getItem("clubAdminPreview") === "true";
  var data = window.TTAI_CLUB_DATA ? window.TTAI_CLUB_DATA.admin : null;

  var lockedEl = document.getElementById("admin-locked");
  var lockedText = document.getElementById("admin-locked-text");
  var dashboardEl = document.getElementById("admin-dashboard");
  var clubNameEl = document.getElementById("admin-club-name");
  var metaEl = document.getElementById("admin-meta");
  var overviewEl = document.getElementById("admin-overview");
  var funnelEl = document.getElementById("lead-funnel");
  var weaknessEl = document.getElementById("weakness-list");
  var memberTableEl = document.getElementById("member-table");
  var leadListEl = document.getElementById("lead-list");
  var activityListEl = document.getElementById("activity-list");

  var showLocked = function (message) {
    if (lockedEl) lockedEl.style.display = "block";
    if (dashboardEl) dashboardEl.style.display = "none";
    if (lockedText) lockedText.textContent = message;
  };

  var statusLabel = function (status) {
    var map = {
      new: "新线索",
      contacted: "已联系",
      visited: "已到店",
      enrolled: "已报名",
      lost: "流失"
    };
    return map[status] || status || "待处理";
  };

  var renderOverview = function () {
    if (!overviewEl) return;
    var overview = data.overview || {};
    var cards = [
      { label: "会员数", value: overview.members },
      { label: "本周活跃", value: overview.activeThisWeek },
      { label: "本月 AI 分析", value: overview.analysesThisMonth },
      { label: "新增线索", value: overview.newLeads }
    ];
    overviewEl.innerHTML = cards.map(function (item) {
      return '<div class="stat-card"><h4>' + item.label + '</h4><p>' + item.value + '</p></div>';
    }).join("");
  };

  var renderFunnel = function () {
    if (!funnelEl) return;
    funnelEl.innerHTML = (data.funnel || []).map(function (item) {
      return '<div class="metric-row"><span>' + item.label + '</span><strong>' + item.count + '</strong></div>';
    }).join("");
  };

  var renderWeaknesses = function () {
    if (!weaknessEl) return;
    weaknessEl.innerHTML = (data.weaknesses || []).map(function (item) {
      return '' +
        '<div class="weakness-row">' +
          '<div class="metric-row"><span>' + item.label + '</span><strong>' + item.value + '%</strong></div>' +
          '<div class="thin-bar"><span style="width: ' + item.value + '%"></span></div>' +
        '</div>';
    }).join("");
  };

  var renderMembers = function () {
    if (!memberTableEl) return;
    memberTableEl.innerHTML = (data.members || []).map(function (member) {
      return '' +
        '<tr>' +
          '<td>' + member.name + '</td>' +
          '<td>' + member.ageGroup + '</td>' +
          '<td>' + member.lastActive + '</td>' +
          '<td>' + member.analyses + ' 次</td>' +
          '<td>' + member.weakness + '</td>' +
          '<td><span class="status-badge ' + (member.authorized ? 'ok' : 'muted') + '">' + (member.authorized ? '已授权' : '未授权') + '</span></td>' +
          '<td>' + member.score + '</td>' +
        '</tr>';
    }).join("");
  };

  var renderLeads = function () {
    if (!leadListEl) return;
    leadListEl.innerHTML = (data.leads || []).map(function (lead) {
      return '' +
        '<div class="mini-card">' +
          '<div class="metric-row"><strong>' + lead.name + '</strong><span class="status-badge">' + statusLabel(lead.status) + '</span></div>' +
          '<p>' + lead.phone + ' · ' + lead.target + '</p>' +
          '<p class="muted">' + lead.source + ' · ' + lead.createdAt + '</p>' +
        '</div>';
    }).join("");
  };

  var renderActivities = function () {
    if (!activityListEl) return;
    activityListEl.innerHTML = (data.activities || []).map(function (activity) {
      return '' +
        '<div class="mini-card">' +
          '<div class="metric-row"><strong>' + activity.user + '</strong><span>' + activity.time + '</span></div>' +
          '<p>' + activity.action + '</p>' +
          '<p class="muted">' + activity.detail + '</p>' +
        '</div>';
    }).join("");
  };

  var renderDashboard = function () {
    if (!data) {
      showLocked("缺少前端预览数据。");
      return;
    }
    if (lockedEl) lockedEl.style.display = "none";
    if (dashboardEl) dashboardEl.style.display = "block";
    if (clubNameEl) clubNameEl.textContent = data.currentAdmin.clubName;
    if (metaEl) {
      metaEl.textContent = data.currentAdmin.name + " · 前端预览数据 · 更新时间 " + data.overview.updatedAt;
    }
    renderOverview();
    renderFunnel();
    renderWeaknesses();
    renderMembers();
    renderLeads();
    renderActivities();
  };

  if (!token && !previewAllowed) {
    showLocked("请先扫码登录。俱乐部管理员权限后续由后端角色接口确认。");
    return;
  }

  if (!previewAllowed) {
    showLocked("当前账号暂未确认俱乐部管理员权限。后续接入后端后，会按账号角色开放管理后台。");
    return;
  }

  renderDashboard();
})();
