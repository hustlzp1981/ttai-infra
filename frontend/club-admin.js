(function () {
  var params = new URLSearchParams(window.location.search);
  var requestedClubId = params.get("clubId") || "";
  var clubData = window.TTAI_CLUB_DATA || {};
  var profile = null;
  var selectedClubId = "";
  var dashboard = { overview: {}, members: [], leads: [] };

  var lockedEl = document.getElementById("admin-locked");
  var lockedText = document.getElementById("admin-locked-text");
  var dashboardEl = document.getElementById("admin-dashboard");
  var clubNameEl = document.getElementById("admin-club-name");
  var clubSelectEl = document.getElementById("admin-club-select");
  var metaEl = document.getElementById("admin-meta");
  var overviewEl = document.getElementById("admin-overview");
  var funnelEl = document.getElementById("lead-funnel");
  var weaknessEl = document.getElementById("weakness-list");
  var memberTableEl = document.getElementById("member-table");
  var memberDetailEl = document.getElementById("member-detail");
  var leadListEl = document.getElementById("lead-list");
  var activityListEl = document.getElementById("activity-list");

  var escapeHtml = function (value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  };

  var formatCST = function (isoStr) {
    if (!isoStr || isoStr === '-') return '-'
    var d = new Date(isoStr)
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  };

  var showLocked = function (message, loginRequired) {
    if (lockedEl) lockedEl.style.display = "block";
    if (dashboardEl) dashboardEl.style.display = "none";
    if (lockedText) lockedText.textContent = message;
    var loginButton = lockedEl ? lockedEl.querySelector(".btn-primary") : null;
    if (loginButton) loginButton.style.display = loginRequired ? "inline-flex" : "none";
  };

  var showDashboard = function () {
    if (lockedEl) lockedEl.style.display = "none";
    if (dashboardEl) dashboardEl.style.display = "block";
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

  var statusOptions = ["new", "contacted", "visited", "enrolled", "lost"];

  var adminInfo = function () {
    var info = (profile && profile.clubAdmin) || {};
    var topClubs = (profile && profile.clubs) || [];
    return {
      isAdmin: info.isAdmin === true || (profile && (profile.isClubAdmin === true || profile.isAdmin === true)),
      clubs: Array.isArray(info.clubs) ? info.clubs : topClubs,
      defaultClubId: info.defaultClubId || (profile && profile.defaultClubId) || ""
    };
  };

  var adminClubs = function () {
    var info = adminInfo();
    return Array.isArray(info.clubs) ? info.clubs : [];
  };

  var clubKey = function (club) {
    return club && (club.id || club._id || club.slug || "");
  };

  var findClub = function (value) {
    var clubs = adminClubs();
    return clubs.find(function (club) {
      return String(club.id || "") === String(value) ||
        String(club._id || "") === String(value) ||
        String(club.slug || "") === String(value);
    });
  };

  var currentClub = function () {
    var clubs = adminClubs();
    return findClub(selectedClubId) || clubs[0] || {};
  };

  var normalizeOverview = function () {
    var data = dashboard.overview || {};
    return data.overview || data;
  };

  var renderClubSelect = function () {
    var clubs = adminClubs();
    if (!clubSelectEl) return;
    clubSelectEl.innerHTML = "";
    if (clubs.length <= 1) {
      clubSelectEl.style.display = "none";
      return;
    }
    clubs.forEach(function (club) {
      var option = document.createElement("option");
      option.value = clubKey(club);
      option.textContent = club.name || "俱乐部";
      clubSelectEl.appendChild(option);
    });
    clubSelectEl.value = selectedClubId;
    clubSelectEl.style.display = "inline-flex";
  };

  var renderOverview = function () {
    if (!overviewEl) return;
    var overview = normalizeOverview();
    var cards = [
      { label: "会员数", value: overview.members || 0 },
      { label: "本周活跃", value: overview.activeThisWeek || 0 },
      { label: "本月 AI 分析", value: overview.analysesThisMonth || 0 },
      { label: "新增线索", value: overview.newLeads || 0 }
    ];
    overviewEl.innerHTML = cards.map(function (item) {
      return '<div class="stat-card"><h4>' + item.label + '</h4><p>' + item.value + '</p></div>';
    }).join("");
  };

  var renderFunnel = function () {
    if (!funnelEl) return;
    var overview = normalizeOverview();
    var funnel = overview.funnel || dashboard.funnel || [];
    funnelEl.innerHTML = funnel.length ? funnel.map(function (item) {
      return '<div class="metric-row"><span>' + statusLabel(item.status) + '</span><strong>' + (item.count || 0) + '</strong></div>';
    }).join("") : '<div class="empty-state compact">暂无线索漏斗数据</div>';
  };

  var renderWeaknesses = function () {
    if (!weaknessEl) return;
    var overview = normalizeOverview();
    var weaknesses = overview.weaknesses || dashboard.weaknesses || [];
    weaknessEl.innerHTML = weaknesses.length ? weaknesses.map(function (item) {
      var value = Number(item.value || item.percent || 0);
      return '' +
        '<div class="weakness-row">' +
          '<div class="metric-row"><span>' + escapeHtml(item.label) + '</span><strong>' + value + '%</strong></div>' +
          '<div class="thin-bar"><span style="width: ' + Math.max(0, Math.min(100, value)) + '%"></span></div>' +
        '</div>';
    }).join("") : '<div class="empty-state compact">暂无弱项统计</div>';
  };

  var renderMembers = function () {
    if (!memberTableEl) return;
    var members = dashboard.members || [];
    memberTableEl.innerHTML = members.length ? members.map(function (member) {
      var authorized = member.authorized === true;
      return '' +
        '<tr>' +
          '<td>' + escapeHtml(member.name || member.nickname || "会员") + '</td>' +
          '<td>' + escapeHtml(member.ageGroup || member.group || "-") + '</td>' +
          '<td>' + escapeHtml(member.lastActive || "-") + '</td>' +
          '<td>' + (member.analyses || member.analysisCount || 0) + ' 次</td>' +
          '<td>' + escapeHtml(member.weakness || member.weakPoint || "-") + '</td>' +
          '<td><span class="status-badge ' + (authorized ? "ok" : "muted") + '">' + (authorized ? "已授权" : "未授权") + '</span></td>' +
          '<td>' + (member.score || "-") + '</td>' +
          '<td><button class="club-action" type="button" data-member-id="' + escapeHtml(member.id || member.openid) + '">详情</button></td>' +
        '</tr>';
    }).join("") : '<tr><td colspan="8">暂无会员数据</td></tr>';

    memberTableEl.querySelectorAll("[data-member-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        loadMemberDetail(button.getAttribute("data-member-id"));
      });
    });
  };

  var renderLeads = function () {
    if (!leadListEl) return;
    var leads = dashboard.leads || [];
    leadListEl.innerHTML = leads.length ? leads.map(function (lead) {
      var current = lead.status || "new";
      var options = statusOptions.map(function (status) {
        return '<option value="' + status + '"' + (status === current ? " selected" : "") + '>' + statusLabel(status) + '</option>';
      }).join("");
      return '' +
        '<div class="mini-card">' +
          '<div class="metric-row"><strong>' + escapeHtml(lead.name || "线索") + '</strong><span class="status-badge">' + statusLabel(current) + '</span></div>' +
          '<p>' + escapeHtml(lead.phoneMasked || lead.phone || "-") + ' · ' + escapeHtml(lead.target || "课程咨询") + '</p>' +
          '<p class="muted">' + escapeHtml(lead.source || "-") + ' · ' + escapeHtml(lead.createdAt || "-") + '</p>' +
          '<div class="inline-form"><select class="filter-select" data-lead-status="' + escapeHtml(lead.id || lead._id) + '">' + options + '</select></div>' +
        '</div>';
    }).join("") : '<div class="empty-state compact">暂无线索</div>';

    leadListEl.querySelectorAll("[data-lead-status]").forEach(function (select) {
      select.addEventListener("change", function () {
        updateLeadStatus(select.getAttribute("data-lead-status"), select.value);
      });
    });
  };

  var renderActivities = function () {
    if (!activityListEl) return;
    var overview = normalizeOverview();
    var activities = overview.activities || dashboard.activities || [];
    activityListEl.innerHTML = activities.length ? activities.map(function (activity) {
      return '' +
        '<div class="mini-card">' +
          '<div class="metric-row"><strong>' + escapeHtml(activity.user || activity.name || "会员") + '</strong><span>' + escapeHtml(activity.time || "") + '</span></div>' +
          '<p>' + escapeHtml(activity.action || "") + '</p>' +
          '<p class="muted">' + escapeHtml(activity.detail || "") + '</p>' +
        '</div>';
    }).join("") : '<div class="empty-state compact">暂无训练动态</div>';
  };

  var renderDashboard = function () {
    showDashboard();
    var club = currentClub();
    var admin = (profile && profile.admin) || (profile && profile.user) || {};
    var overview = normalizeOverview();
    if (clubNameEl) clubNameEl.textContent = club.name || "俱乐部管理后台";
    if (metaEl) {
      metaEl.textContent = (admin.name || admin.nickname || "俱乐部管理员") + " · 线上数据 · 更新时间 " + formatCST(overview.updatedAt);
    }
    renderClubSelect();
    renderOverview();
    renderFunnel();
    renderWeaknesses();
    renderMembers();
    renderLeads();
    renderActivities();
  };

  var loadDashboard = function () {
    if (!selectedClubId) return;
    showDashboard();
    if (metaEl) metaEl.textContent = "正在加载真实运营数据...";
    return clubData.loadAdmin(selectedClubId).then(function (result) {
      dashboard = result || { overview: {}, members: [], leads: [] };
      renderDashboard();
    }).catch(function (err) {
      showLocked(clubData.errorMessage ? clubData.errorMessage(err) : "加载管理数据失败。", false);
    });
  };

  var loadMemberDetail = function (memberId) {
    if (!memberDetailEl || !memberId) return;
    var member = (dashboard.members || []).find(function (item) {
      return String(item.id || item.openid) === String(memberId);
    });
    memberDetailEl.style.display = "block";
    if (member && member.authorized === false) {
      memberDetailEl.innerHTML = '<div class="empty-state compact">该会员尚未授权俱乐部查看训练摘要。</div>';
      return;
    }
    memberDetailEl.innerHTML = '<div class="empty-state compact">正在加载会员训练摘要...</div>';
    clubData.adminMemberActivity(selectedClubId, memberId).then(function (data) {
      var logs = data.trainingLogs || [];
      var summaries = data.analysisSummary || [];
      memberDetailEl.innerHTML =
        '<h3 class="card-title">' + escapeHtml((data.member && (data.member.name || data.member.nickname)) || (member && member.name) || "会员详情") + '</h3>' +
        '<div class="grid-2">' +
          '<div><h4>训练日志</h4>' + (logs.length ? logs.map(function (item) {
            return '<div class="mini-card"><p>' + escapeHtml(item.summary || item.content || "") + '</p><p class="muted">' + escapeHtml(item.date || item.createdAt || "") + '</p></div>';
          }).join("") : '<div class="empty-state compact">暂无训练日志</div>') + '</div>' +
          '<div><h4>AI 分析摘要</h4>' + (summaries.length ? summaries.map(function (item) {
            return '<div class="mini-card"><p>' + escapeHtml(item.summary || item.weakness || "") + '</p><p class="muted">评分 ' + escapeHtml(item.score || "-") + ' · ' + escapeHtml(item.createdAt || "") + '</p></div>';
          }).join("") : '<div class="empty-state compact">暂无 AI 分析摘要</div>') + '</div>' +
        '</div>';
    }).catch(function (err) {
      memberDetailEl.innerHTML = '<div class="empty-state compact">' + (clubData.errorMessage ? clubData.errorMessage(err) : "会员详情加载失败") + '</div>';
    });
  };

  var updateLeadStatus = function (leadId, status) {
    if (!leadId) return;
    clubData.updateLeadStatus(selectedClubId, leadId, status).then(function () {
      return loadDashboard();
    }).catch(function (err) {
      if (leadListEl) {
        var warning = document.createElement("div");
        warning.className = "empty-state compact";
        warning.textContent = clubData.errorMessage ? clubData.errorMessage(err) : "线索状态更新失败";
        leadListEl.prepend(warning);
      }
    });
  };

  var initProfile = function () {
    if (!clubData.hasToken || !clubData.hasToken()) {
      showLocked("请先扫码登录。", true);
      return;
    }
    clubData.adminProfile().then(function (data) {
      profile = data || {};
      var info = adminInfo();
      var clubs = adminClubs();
      if (!info.isAdmin) {
        showLocked("当前账号不是俱乐部管理员。普通用户可以浏览俱乐部并授权训练摘要。", false);
        return;
      }
      if (!clubs.length) {
        showLocked("当前管理员账号尚未绑定俱乐部，请联系平台开通。", false);
        return;
      }
      selectedClubId = clubKey(findClub(requestedClubId) || findClub(info.defaultClubId) || clubs[0]);
      renderClubSelect();
      loadDashboard();
    }).catch(function (err) {
      showLocked(clubData.errorMessage ? clubData.errorMessage(err) : "管理员权限校验失败。", err && err.isAuthError);
    });
  };

  if (clubSelectEl) {
    clubSelectEl.addEventListener("change", function () {
      selectedClubId = clubSelectEl.value;
      if (memberDetailEl) memberDetailEl.style.display = "none";
      loadDashboard();
    });
  }

  initProfile();
})();
