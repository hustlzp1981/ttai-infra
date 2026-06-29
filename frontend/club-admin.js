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
  var branchQrListEl = document.getElementById("branch-qr-list");
  var branchQrPreviewEl = document.getElementById("branch-qr-preview");
  var qrPreviewImg = document.getElementById("qr-preview-img");
  var qrPreviewAddr = document.getElementById("qr-preview-addr");
  var qrPreviewTitle = document.getElementById("qr-preview-title");
  var qrPreviewDownload = document.getElementById("qr-preview-download");
  var eduPanelEl = document.getElementById("edu-panel");
  var eduTabsEl = document.getElementById("edu-tabs");
  var eduBranchFilterEl = document.getElementById("edu-branch-filter");
  var eduRefreshEl = document.getElementById("edu-refresh");
  var _qrBranchData = null;
  var _clubDetail = null;
  var eduState = {
    activeTab: "courses",
    branchId: "",
    meta: null,
    courses: [],
    students: [],
    packageTemplates: [],
    wallets: [],
    ledgers: [],
    attendanceStudentId: "",
    attendanceWallets: [],
    attendanceSessionId: "",
    attendanceData: null,
    classes: [],
    staff: [],
    availability: [],
    bookingAvailability: [],
    bookings: [],
    resources: [],
    sessions: [],
    scheduleView: "day",
    scheduleFilters: {},
    scheduleExports: [],
    scheduleExportSettings: { enabled: false, timeOfDay: "22:00", range: "day" },
    scheduleExportForm: { date: "", range: "day" },
    availabilityFilters: {},
    reportTab: "fee",
    reportFilters: {}
  };
  eduState.scheduleTab = "sessions";

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

  var formatDateTimeLocal = function (value) {
    if (!value) return "";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };

  var idOf = function (item) {
    return item && (item.id || item._id || "");
  };

  var findById = function (list, id) {
    return (list || []).find(function (item) {
      return String(idOf(item)) === String(id);
    }) || null;
  };

  var branchName = function (branchId) {
    var branches = (eduState.meta && eduState.meta.branches) || [];
    var branch = branches.find(function (item) {
      return String(item.id) === String(branchId);
    });
    if (branch) return branch.name;
    return branchId ? "未知分店" : "-";
  };

  var teacherName = function (teacherId) {
    var teacher = (eduState.staff || []).find(function (item) {
      return String(idOf(item)) === String(teacherId);
    });
    if (teacher) return teacher.name;
    return teacherId ? "已删除教练" : "-";
  };

  var isLikelyOpenid = function (value) {
    return /^o[A-Za-z0-9_-]{20,}$/.test(String(value || ""));
  };

  var putOperatorAlias = function (map, key, label) {
    key = String(key || "").trim();
    label = String(label || "").trim();
    if (key && label && label !== key) map[key] = label;
  };

  var operatorAliasMap = function () {
    var map = {};
    var admin = (profile && profile.admin) || (profile && profile.user) || {};
    var adminName = admin.nickname || admin.name || "俱乐部管理员";
    putOperatorAlias(map, admin.openid, adminName);
    putOperatorAlias(map, admin.id, adminName);
    (eduState.staff || []).forEach(function (item) {
      var label = item.name || item.nickname || "";
      putOperatorAlias(map, item.openid || item.wechatOpenid, label);
      putOperatorAlias(map, idOf(item), label);
    });
    (dashboard.members || []).forEach(function (item) {
      var label = item.name || item.nickname || "";
      putOperatorAlias(map, item.openid || item.id, label);
    });
    return map;
  };

  var operatorName = function (value, explicitName) {
    var text = String(value || "").trim();
    if (explicitName) return explicitName;
    if (!text) return "-";
    var alias = operatorAliasMap()[text];
    if (alias) return alias;
    return isLikelyOpenid(text) ? "微信用户" : text;
  };

  var availabilitySubmitterName = function (item) {
    return operatorName(
      item.submittedBy || item.createdBy,
      item.submittedByName || item.createdByName || item.creatorName
    );
  };

  var availabilityReviewerName = function (item) {
    return operatorName(
      item.approvedBy || item.rejectedBy || item.publishedBy,
      item.approvedByName || item.rejectedByName || item.publishedByName || item.reviewerName
    );
  };

  var courseName = function (courseId) {
    var course = findById(eduState.courses, courseId);
    if (course) return course.name;
    return courseId ? "已删除课程" : "-";
  };

  var className = function (classId) {
    var klass = findById(eduState.classes, classId);
    if (klass) return klass.className;
    return classId ? "已删除班级" : "-";
  };

  var studentName = function (studentId) {
    var student = findById(eduState.students, studentId);
    if (student) return student.name;
    return studentId ? "已删除学员" : "-";
  };

  var packageName = function (templateId) {
    var template = findById(eduState.packageTemplates, templateId);
    if (template) return template.name;
    return templateId ? "已删除课包" : "-";
  };

  var walletStatusLabel = function (value) {
    return labelOf({
      active: "有效",
      inactive: "停用",
      expired: "已过期",
      archived: "归档"
    }, value);
  };

  var lessonText = function (units10) {
    var value = Number(units10 || 0) / 10;
    return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + " 课时";
  };

  var lessonInputUnits10 = function (value) {
    var lessons = Number(value || 0);
    if (!Number.isFinite(lessons) || lessons < 0) return 0;
    return Math.round(lessons * 10);
  };

  var lessonInputValue = function (units10, fallbackLessons) {
    var value = Number(units10);
    if (!Number.isFinite(value)) return fallbackLessons;
    var lessons = value / 10;
    return Number.isInteger(lessons) ? String(lessons) : String(Number(lessons.toFixed(1)));
  };

  var dateText = function (value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  var moneyText = function (cents) {
    return cents ? "¥" + (Number(cents || 0) / 100).toFixed(2) : "-";
  };

  var moneyInputValue = function (cents) {
    var value = Number(cents || 0) / 100;
    return value ? String(Number(value.toFixed(2))) : "";
  };

  var moneyInputCents = function (value) {
    var amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return Math.round(amount * 100);
  };

  var labelOf = function (map, value, emptyText) {
    if (!value) return emptyText || "-";
    return map[value] || "其他";
  };

  var namedCodeLabel = function (name, code, map) {
    if (name) return name;
    if (!code) return "-";
    return (map || {})[code] || "其他";
  };

  var courseStatusLabel = function (value) {
    return labelOf({
      active: "启用",
      inactive: "停用",
      archived: "归档"
    }, value);
  };

  var studentStatusLabel = function (value) {
    return labelOf({
      active: "在读",
      inactive: "停用",
      archived: "归档"
    }, value);
  };

  var studentLevelLabel = function (value) {
    var text = String(value || "").trim();
    if (!text) return "-";
    var map = {
      beginner: "初级",
      novice: "入门",
      intermediate: "中级",
      advanced: "高级",
      pro: "专业",
      elite: "精英"
    };
    return map[text] || text;
  };

  var studentLevelOptions = function (selected) {
    var options = [
      ["", "未设置"],
      ["beginner", "初级"],
      ["intermediate", "中级"],
      ["advanced", "高级"],
      ["pro", "专业"],
      ["elite", "精英"]
    ];
    var exists = options.some(function (item) { return String(item[0]) === String(selected || ""); });
    if (selected && !exists) options.push([selected, studentLevelLabel(selected)]);
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (String(item[0]) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join("");
  };

  var studentWechatBindHtml = function (student) {
    var bound = !!(student && (student.openid || student.wechatOpenid || student.boundOpenid));
    return badgeHtml(bound ? "已绑定" : "未绑定", bound ? "ok" : "none");
  };

  var classStatusLabel = function (value) {
    return labelOf({
      active: "启用",
      inactive: "停用",
      graduated: "结业",
      archived: "归档"
    }, value);
  };

  var graduationStatusLabel = function (value) {
    return labelOf({
      active: "未结业",
      not_graduated: "未结业",
      graduated: "已结业"
    }, value, "未结业");
  };

  var resourceTypeLabel = function (value) {
    return labelOf({
      table: "球台",
      room: "场地"
    }, value);
  };

  var resourceStatusLabel = function (value) {
    return labelOf({
      active: "启用",
      inactive: "停用",
      archived: "归档"
    }, value);
  };

  var attendanceStatusLabel = function (value) {
    return labelOf({
      attended: "出勤扣课",
      leave: "请假",
      absent: "缺席",
      revoked: "已撤销"
    }, value);
  };

  var subjectLabel = function (name, code) {
    return namedCodeLabel(name, code, {
      table_tennis: "乒乓球",
      pingpong: "乒乓球",
      physical: "体能"
    });
  };

  var courseLevelLabel = function (name, code) {
    return namedCodeLabel(name, code, {
      beginner: "启蒙",
      basic: "基础",
      intermediate: "进阶",
      advanced: "提高",
      competition: "竞赛",
      private: "一对一"
    });
  };

  var termLabel = function (name, code) {
    return namedCodeLabel(name, code, {
      spring: "春季",
      summer: "暑期",
      autumn: "秋季",
      fall: "秋季",
      winter: "寒假",
      term: "常规期"
    });
  };

  var gradeLabel = function (name, code) {
    return namedCodeLabel(name, code, {
      preschool: "学龄前",
      primary: "小学",
      junior: "初中",
      senior: "高中",
      adult: "成人"
    });
  };

  var classTypeLabel = function (name, code) {
    return namedCodeLabel(name, code, {
      group: "集体班",
      small_group: "小班",
      private: "一对一",
      semi_private: "一对多",
      camp: "训练营",
      trial: "体验课"
    });
  };

  var teachingModeLabel = function (value) {
    return labelOf({
      group: "集体班",
      private: "一对一",
      semi_private: "一对多",
      camp: "训练营",
      trial: "体验课"
    }, value);
  };

  var staffRoleLabel = function (value) {
    var map = {
      teacher: "教练",
      coach: "教练",
      assistant: "助教",
      head_teacher: "班主任",
      reception: "前台",
      admin: "管理员",
      club_admin: "俱乐部管理员",
      owner: "负责人",
      branch_manager: "店长"
    };
    return map[value] || "其他";
  };

  var staffRolesText = function (roles) {
    var list = Array.isArray(roles) ? roles : [];
    if (!list.length) return "教练";
    return list.map(staffRoleLabel).join("、");
  };

  var employmentStatusLabel = function (value) {
    return labelOf({
      active: "在职",
      inactive: "停用",
      left: "离职"
    }, value);
  };

  var billingModeLabel = function (value) {
    return labelOf({
      lesson: "课时",
      term: "按期",
      month: "按月",
      day: "按天"
    }, value);
  };

  var sessionStatusLabel = function (value) {
    return labelOf({
      scheduled: "待上课",
      pending_attendance: "待点名",
      completed: "已点名",
      cancelled: "已取消"
    }, value);
  };

  var availabilityStatusLabel = function (value) {
    return labelOf({
      pending: "待审核",
      approved: "已通过",
      rejected: "已拒绝",
      draft: "草稿",
      published: "已发布",
      paused: "已暂停",
      inactive: "停用"
    }, value);
  };

  var bookingStatusLabel = function (value) {
    return labelOf({
      requested: "待确认",
      confirmed: "已确认",
      alternative_proposed: "改期中",
      change_requested: "改期申请",
      rejected: "已拒绝",
      cancelled: "已取消",
      expired: "已过期"
    }, value);
  };

  var ledgerTypeLabel = function (value) {
    return labelOf({
      purchase: "开课包",
      attendance: "出勤扣课",
      revoke: "撤销返课",
      adjust: "手动调整"
    }, value);
  };

  var ledgerReasonLabel = function (value) {
    var text = String(value || "").trim();
    if (!text) return "-";
    var map = {
      "seed offline recharge": "线下充值导入",
      "offline recharge": "线下充值",
      "seed recharge": "初始化充值",
      "seed attendance": "初始化点名",
      "manual adjust": "手动调整",
      "revoke attendance": "撤销点名"
    };
    return map[text.toLowerCase()] || text;
  };

  var badgeClass = function (type) {
    if (["draft", "published", "paused", "requested", "confirmed", "alternative_proposed", "change_requested", "rejected", "cancelled", "expired"].indexOf(type) >= 0) return type;
    if (["active", "approved", "published", "confirmed", "scheduled", "purchase", "ok", "none"].indexOf(type) >= 0) return "ok";
    if (["pending", "draft", "requested", "alternative_proposed", "pending_attendance", "attendance"].indexOf(type) >= 0) return "warn";
    if (["cancelled", "inactive", "archived", "paused", "rejected", "expired", "revoked", "revoke"].indexOf(type) >= 0) return "muted";
    if (["completed"].indexOf(type) >= 0) return "info";
    return "muted";
  };

  var badgeHtml = function (text, type) {
    return '<span class="status-badge ' + badgeClass(type || text) + '">' + escapeHtml(text || "-") + '</span>';
  };

  var eduKpiHtml = function () {
    var activeStudents = (eduState.students || []).filter(function (item) { return item.status === "active"; }).length;
    var activeCourses = (eduState.courses || []).filter(function (item) { return item.status === "active"; }).length;
    var pendingSessions = (eduState.sessions || []).filter(function (item) { return item.status === "pending_attendance"; }).length;
    var branchScope = eduState.meta && eduState.meta.branchScope;
    var scopeText = branchScope && branchScope.all ? "全部分店" : ((branchScope && branchScope.ids || []).map(branchName).join("、") || "当前分店");
    var items = [
      ["课程", activeCourses + "/" + (eduState.courses || []).length],
      ["在读学员", activeStudents],
      ["班级", (eduState.classes || []).length],
      ["待点名课次", pendingSessions],
      ["权限范围", scopeText]
    ];
    return '<div class="edu-kpi-grid">' + items.map(function (item) {
      return '<div class="edu-kpi"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></div>';
    }).join("") + '</div>';
  };

  var eduFrameStart = function (title, note) {
    return eduKpiHtml() +
      '<div class="edu-section-head"><div><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(note || "") + '</span></div></div>';
  };

  var selectedEduBranch = function () {
    return eduBranchFilterEl ? eduBranchFilterEl.value : "";
  };

  var eduErrorHtml = function (err) {
    var msg = clubData.errorMessage ? clubData.errorMessage(err) : "教务数据处理失败";
    if (err && err.payload && Array.isArray(err.payload.conflicts) && err.payload.conflicts.length) {
      msg += "：" + err.payload.conflicts.map(function (item) {
        return item.type + " " + (item.label || item.sessionId);
      }).join("、");
    }
    return '<div class="edu-warning">' + escapeHtml(msg) + '</div>';
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

  var currentClubRole = function () {
    var club = currentClub();
    return String(club.role || club.adminRole || club.permissionRole || "").toLowerCase();
  };

  var canManageTeachers = function () {
    var role = currentClubRole();
    if (!role) return adminInfo().isAdmin === true;
    return role === "owner" || role === "admin" || role === "club_admin";
  };

  var syncEduTabsAccess = function () {
    if (!eduTabsEl) return;
    var teacherAllowed = canManageTeachers();
    if (!teacherAllowed && eduState.activeTab === "teachers") {
      eduState.activeTab = "courses";
    }
    eduTabsEl.querySelectorAll("[data-edu-tab]").forEach(function (tab) {
      var tabName = tab.getAttribute("data-edu-tab");
      if (tabName === "teachers") tab.style.display = teacherAllowed ? "" : "none";
      tab.classList.toggle("active", tabName === eduState.activeTab);
    });
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
                    '<p class="muted">' + escapeHtml(lead.source || "-") + (lead.branchName ? ' &middot; ' + escapeHtml(lead.branchName) : '') + ' &middot; ' + escapeHtml(lead.createdAt || "-") + '</p>' +
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

  var renderEduBranchFilter = function () {
    if (!eduBranchFilterEl) return;
    var branches = (eduState.meta && eduState.meta.branches) || [];
    eduBranchFilterEl.innerHTML = '<option value="">全部分店</option>' + branches.map(function (branch) {
      return '<option value="' + escapeHtml(branch.id) + '">' + escapeHtml(branch.name || branch.id) + '</option>';
    }).join("");
    eduBranchFilterEl.value = eduState.branchId || "";
    eduBranchFilterEl.style.display = branches.length ? "inline-flex" : "none";
  };

  var eduList = function (result) {
    return (result && (result.items || result.data && result.data.items)) || [];
  };

  var loadEduData = function () {
    if (!selectedClubId || !eduPanelEl) return Promise.resolve();
    eduPanelEl.innerHTML = '<div class="empty-state compact">正在加载教务数据...</div>';
    var branchId = selectedEduBranch();
    eduState.branchId = branchId || "";
    return clubData.eduMeta(selectedClubId).then(function (meta) {
      eduState.meta = meta || {};
      renderEduBranchFilter();
      var params = branchId ? { branchId: branchId } : {};
      return Promise.all([
        clubData.eduCourseProducts(selectedClubId, params),
        clubData.eduStudents(selectedClubId, params),
        clubData.eduPackageTemplates(selectedClubId, {}),
        clubData.eduWallets(selectedClubId, params),
        clubData.eduLedgers(selectedClubId, params),
        clubData.eduClasses(selectedClubId, params),
        clubData.eduStaff(selectedClubId, params),
        clubData.eduAvailability(selectedClubId, params),
        clubData.eduBookingAvailability ? clubData.eduBookingAvailability(selectedClubId, params).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
        clubData.eduResources(selectedClubId, params),
        clubData.eduSessions(selectedClubId, params),
        clubData.eduBookings ? clubData.eduBookings(selectedClubId, Object.assign({ pageSize: 300 }, params)).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
        clubData.eduScheduleExports ? clubData.eduScheduleExports(selectedClubId, params).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
        clubData.eduScheduleExportSettings ? clubData.eduScheduleExportSettings(selectedClubId, branchId).catch(function () { return { enabled: false, timeOfDay: "22:00", range: "day" }; }) : Promise.resolve({ enabled: false, timeOfDay: "22:00", range: "day" })
      ]);
    }).then(function (parts) {
      eduState.courses = eduList(parts[0]);
      eduState.students = eduList(parts[1]);
      eduState.packageTemplates = eduList(parts[2]);
      eduState.wallets = eduList(parts[3]);
      eduState.ledgers = eduList(parts[4]);
      eduState.classes = eduList(parts[5]);
      eduState.staff = eduList(parts[6]);
      eduState.availability = eduList(parts[7]);
      eduState.bookingAvailability = eduList(parts[8]);
      eduState.resources = eduList(parts[9]);
      eduState.sessions = eduList(parts[10]);
      eduState.bookings = eduList(parts[11]);
      eduState.scheduleExports = eduList(parts[12]);
      eduState.scheduleExportSettings = parts[13] || { enabled: false, timeOfDay: "22:00", range: "day" };
      renderEduPanel();
    }).catch(function (err) {
      eduPanelEl.innerHTML = eduErrorHtml(err);
    });
  };

  var branchOptions = function (selected) {
    var branches = (eduState.meta && eduState.meta.branches) || [];
    var selectedList = Array.isArray(selected) ? selected.map(String) : [String(selected || eduState.branchId || "")];
    return branches.map(function (branch) {
      return '<option value="' + escapeHtml(branch.id) + '"' + (selectedList.indexOf(String(branch.id)) >= 0 ? ' selected' : '') + '>' + escapeHtml(branch.name || branch.id) + '</option>';
    }).join("");
  };

  var teacherOptions = function (selected) {
    var teachers = (eduState.staff || []).filter(function (item) {
      var roles = item.roles || [];
      return roles.indexOf("teacher") >= 0 || roles.indexOf("coach") >= 0 || roles.length === 0;
    });
    return '<option value="">选择教练</option>' + teachers.map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.name || id) + '</option>';
    }).join("");
  };

  var courseOptions = function (selected) {
    return '<option value="">选择课程</option>' + (eduState.courses || []).map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.name || id) + '</option>';
    }).join("");
  };

  var bookingCourseOptions = function (selected) {
    return '<option value="">不限课程</option>' + (eduState.courses || []).map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.name || id) + '</option>';
    }).join("");
  };

  var resourceOptions = function (selected) {
    return '<option value="">不指定球台</option>' + (eduState.resources || []).map(function (item) {
      var id = idOf(item);
      var label = item.name || item.tableNo || item.roomId || id;
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join("");
  };

  var classOptions = function (selected) {
    return '<option value="">可不选班级</option>' + (eduState.classes || []).map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.className || id) + '</option>';
    }).join("");
  };

  var studentOptions = function (selected) {
    return '<option value="">选择学员</option>' + (eduState.students || []).map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.name || id) + '</option>';
    }).join("");
  };

  var packageOptions = function (selected) {
    return '<option value="">选择收费/课时规格</option>' + (eduState.packageTemplates || []).map(function (item) {
      var id = idOf(item);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(item.name || id) + '</option>';
    }).join("");
  };

  var renderEduPanel = function () {
    if (!eduPanelEl) return;
    syncEduTabsAccess();
    if (eduState.activeTab === "courses") return renderEduCourses();
    if (eduState.activeTab === "students") return renderEduStudents();
    if (eduState.activeTab === "teachers") return renderEduTeachers();
    if (eduState.activeTab === "classes") return renderEduClasses();
    if (eduState.activeTab === "attendance") return renderEduAttendance();
    if (eduState.activeTab === "reports") return renderEduReports();
    return renderEduSessions();
  };

  var setSelectValue = function (name, value) {
    var input = document.querySelector('[name="' + name + '"]');
    if (input) input.value = value || "";
  };

  var setFormValue = function (formId, name, value) {
    var form = document.getElementById(formId);
    if (!form || !form.elements[name]) return;
    form.elements[name].value = value || "";
  };

  var closeEduModal = function () {
    var root = document.getElementById("edu-modal-root");
    if (root) root.remove();
  };

  var renderEduModal = function (title, bodyHtml) {
    closeEduModal();
    var root = document.createElement("div");
    root.id = "edu-modal-root";
    root.className = "edu-modal-root";
    root.innerHTML =
      '<div class="edu-modal-backdrop" data-edu-modal-close="1"></div>' +
      '<div class="edu-modal">' +
        '<div class="edu-modal-head"><strong>' + escapeHtml(title) + '</strong><button class="edu-modal-close" type="button" data-edu-modal-close="1">×</button></div>' +
        '<div class="edu-modal-body">' + bodyHtml + '</div>' +
      '</div>';
    document.body.appendChild(root);
    bindEduPanelEvents();
  };

  var eduActionBar = function (type, createLabel, extraHtml) {
    var createButton = createLabel ? '<button class="club-action primary" type="button" data-edu-create="' + type + '">' + escapeHtml(createLabel) + '</button>' : '';
    var deleteButton = createLabel ? '<button class="club-action" type="button" data-edu-delete="' + type + '">删除</button>' : '';
    var exportLabel = type === "students" ? "导出EXCEL" : "导出";
    var importButton = type === "students"
      ? '<button class="club-action" type="button" data-edu-import-students title="支持导出相同格式的 Excel 导入，导入前会按手机号和学员信息去重">导入</button><input type="file" accept=".xlsx,.xlsm,.csv" data-edu-import-students-file hidden>'
      : '';
    return '<div class="edu-list-toolbar">' +
      '<div class="club-actions">' + createButton + deleteButton + '<button class="club-action" type="button" data-edu-export="' + type + '">' + exportLabel + '</button>' + importButton + '</div>' +
      (extraHtml || '') +
    '</div>';
  };

  var rowCheck = function (type, id) {
    return '<input type="checkbox" data-edu-select="' + escapeHtml(type) + '" value="' + escapeHtml(id) + '">';
  };

  var selectedEduIds = function (type) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-edu-select="' + type + '"]:checked')).map(function (input) {
      return input.value;
    }).filter(Boolean);
  };

  var eduScheduleTabs = function () {
    var active = eduState.scheduleTab || "sessions";
    return '<div class="edu-subtabs">' +
      '<button class="edu-subtab ' + (active === 'sessions' ? 'active' : '') + '" type="button" data-edu-schedule-tab="sessions">课表</button>' +
      '<button class="edu-subtab ' + (active === 'availability' ? 'active' : '') + '" type="button" data-edu-schedule-tab="availability">放号排课</button>' +
      '<button class="edu-subtab ' + (active === 'bookings' ? 'active' : '') + '" type="button" data-edu-schedule-tab="bookings">约课确认</button>' +
      '<button class="edu-subtab ' + (active === 'exports' ? 'active' : '') + '" type="button" data-edu-schedule-tab="exports">导出</button>' +
    '</div>';
  };

  var filterBranchOptions = function (selected) {
    return '<option value="">全部分店</option>' + branchOptions(selected);
  };

  var filterTeacherOptions = function (selected) {
    return '<option value="">全部教练</option>' + teacherOptions(selected).replace('<option value="">选择教练</option>', '');
  };

  var weekdayText = function (value) {
    var index = Number(value);
    if (!index || index < 1 || index > 7) return "-";
    return "周" + "一二三四五六日".charAt(index - 1);
  };

  var dateOnlyText = function (value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  var timeOnlyText = function (value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  };

  var durationText = function (startAt, endAt) {
    var start = new Date(startAt);
    var end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    var minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    return minutes ? minutes + " 分钟" : "-";
  };

  var dayPartText = function (startAt) {
    var d = new Date(startAt);
    if (Number.isNaN(d.getTime())) return "-";
    var hour = d.getHours();
    if (hour < 12) return "上午";
    if (hour < 18) return "下午";
    return "晚上";
  };

  var dateRangeMatch = function (value, range) {
    if (!range || range === "all") return true;
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var end = new Date(start);
    if (range === "today") {
      end.setDate(start.getDate() + 1);
    } else if (range === "thisWeek" || range === "lastWeek" || range === "nextWeek") {
      var mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - mondayOffset + (range === "lastWeek" ? -7 : range === "nextWeek" ? 7 : 0));
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (range === "thisMonth" || range === "lastMonth") {
      start = new Date(today.getFullYear(), today.getMonth() + (range === "lastMonth" ? -1 : 0), 1);
      end = new Date(today.getFullYear(), today.getMonth() + (range === "lastMonth" ? 0 : 1), 1);
    } else {
      return true;
    }
    return d >= start && d < end;
  };

  var sessionCourse = function (session) {
    return findById(eduState.courses, session.courseProductId) || findById(eduState.courses, (findById(eduState.classes, session.classId) || {}).courseProductId) || {};
  };

  var sessionClass = function (session) {
    return findById(eduState.classes, session.classId) || {};
  };

  var scheduleFilterHtml = function () {
    var filters = eduState.scheduleFilters || {};
    return '<div class="edu-page-path">当前位置：管理功能 / 排课管理 / 详细课表</div>' +
      '<form class="edu-filter-panel" id="edu-schedule-filter-form">' +
        '<div class="edu-filter-grid">' +
          '<label>班级名称<input class="form-input" name="keyword" value="' + escapeHtml(filters.keyword || '') + '" placeholder="班级/课程"></label>' +
          '<label>上课时间<select class="form-input" name="range"><option value="all">不限</option><option value="today">今天</option><option value="thisWeek">本周</option><option value="lastWeek">上周</option><option value="nextWeek">下周</option><option value="thisMonth">本月</option><option value="lastMonth">上月</option></select></label>' +
          '<label>日段<select class="form-input" name="dayPart"><option value="">全部</option><option value="上午">上午</option><option value="下午">下午</option><option value="晚上">晚上</option></select></label>' +
          '<label>上课场地<input class="form-input" name="roomId" value="' + escapeHtml(filters.roomId || '') + '" placeholder="场地/球台"></label>' +
          '<label>课程属性<select class="form-input" name="teachingMode"><option value="">全部</option><option value="group">集体班</option><option value="private">一对一</option><option value="semi_private">一对多</option><option value="trial">体验课</option></select></label>' +
          '<div class="edu-filter-actions"><button class="club-action primary" type="submit">查询</button><button class="club-action" type="button" data-edu-filter-reset="schedule">重置</button></div>' +
        '</div>' +
      '</form>';
  };

  var scheduleToolbarHtml = function () {
    return '';
  };

  var todayDateValue = function () {
    var d = new Date();
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  var monthStartDateValue = function (date) {
    var d = new Date(date || Date.now());
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01";
  };

  var monthEndDateValue = function (date) {
    var d = new Date(date || Date.now());
    d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  var defaultReportFilters = function () {
    return {
      startDate: monthStartDateValue(),
      endDate: monthEndDateValue()
    };
  };

  var currentReportFilters = function () {
    return Object.assign(defaultReportFilters(), eduState.reportFilters || {});
  };

  var monthInputValue = function (date) {
    var d = new Date(date || Date.now());
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  };

  var downloadBlobFile = function (result, fallbackName) {
    var url = URL.createObjectURL(result.blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = result.filename || fallbackName || "约课表.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  var scheduleExportPanelHtml = function () {
    var form = Object.assign({ date: todayDateValue(), range: "day" }, eduState.scheduleExportForm || {});
    var settings = Object.assign({ enabled: false, timeOfDay: "22:00", range: "day" }, eduState.scheduleExportSettings || {});
    var exports = eduState.scheduleExports || [];
    var rows = exports.length ? exports.slice(0, 6).map(function (item) {
      return '<tr>' +
        '<td>' + escapeHtml(item.date || '-') + '</td>' +
        '<td>' + escapeHtml(item.range === 'week' ? '本周' : '当天') + '</td>' +
        '<td>' + escapeHtml(item.status === 'failed' ? '失败' : '成功') + '</td>' +
        '<td>' + escapeHtml(formatCST(item.generatedAt)) + '</td>' +
        '<td>' + escapeHtml(item.rowsCount || 0) + '</td>' +
        '<td><button class="club-action" type="button" data-schedule-export-saved-download="' + escapeHtml(idOf(item)) + '">下载</button></td>' +
      '</tr>';
    }).join("") : '<tr><td colspan="6">暂无保存记录</td></tr>';
    return '<section class="edu-export-panel">' +
      '<form class="edu-filter-panel compact" id="schedule-export-form">' +
        '<div class="edu-filter-grid">' +
          '<label>导出日期<input class="form-input" name="date" type="date" value="' + escapeHtml(form.date || todayDateValue()) + '"></label>' +
          '<label>范围<select class="form-input" name="range"><option value="day">当天</option><option value="week">本周</option></select></label>' +
          '<div class="edu-filter-actions"><button class="club-action primary" type="button" data-schedule-export-download="1" title="按日期、时间和教练生成彩色约课表">下载 Excel</button><button class="club-action" type="button" data-schedule-export-save="1">保存到导出记录</button></div>' +
        '</div>' +
      '</form>' +
      '<form class="edu-filter-panel compact" id="schedule-export-settings-form">' +
        '<div class="edu-filter-grid">' +
          '<label>定时保存<select class="form-input" name="enabled"><option value="false">关闭</option><option value="true">开启</option></select></label>' +
          '<label>保存时间<input class="form-input" name="timeOfDay" type="time" value="' + escapeHtml(settings.timeOfDay || '22:00') + '"></label>' +
          '<label>保存范围<select class="form-input" name="range"><option value="day">当天</option><option value="week">本周</option></select></label>' +
          '<div class="edu-filter-actions"><button class="club-action" type="submit">保存定时设置</button></div>' +
        '</div>' +
      '</form>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>日期</th><th>范围</th><th>状态</th><th>生成时间</th><th>人数</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</section>';
  };

  var scheduleViewSwitchHtml = function () {
    var view = eduState.scheduleView || "day";
    var button = function (key, label) {
      return '<button class="' + (view === key ? 'active' : '') + '" type="button" data-edu-schedule-view="' + escapeHtml(key) + '">' + escapeHtml(label) + '</button>';
    };
    return '<div class="edu-view-switch">' +
      button("list", "列表") +
      button("day", "按天") +
      button("week", "按周") +
      button("month", "按月") +
    '</div>';
  };

  var scheduleViewControlsHtml = function () {
    var view = eduState.scheduleView || "day";
    var filters = eduState.scheduleFilters || {};
    var teacher = '<label>教练<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>';
    var content = "";
    if (view === "day") {
      content = '<label>日期<input class="form-input" name="dayDate" type="date" value="' + escapeHtml(filters.dayDate || todayDateValue()) + '"></label>' + teacher;
    } else if (view === "week") {
      content = '<label>周次<input class="form-input" name="weekValue" type="week" value="' + escapeHtml(filters.weekValue || weekInputValue(new Date())) + '"></label>' + teacher;
    } else if (view === "month") {
      content = '<label>月份<input class="form-input" name="monthValue" type="month" value="' + escapeHtml(filters.monthValue || monthInputValue(new Date())) + '"></label>' + teacher;
    } else if (view === "teacher-free") {
      content = '<label>周次<input class="form-input" name="weekValue" type="week" value="' + escapeHtml(filters.weekValue || weekInputValue(new Date())) + '"></label>' + teacher;
    } else if (view === "room-free") {
      content = '<label>周次<input class="form-input" name="weekValue" type="week" value="' + escapeHtml(filters.weekValue || weekInputValue(new Date())) + '"></label>';
    }
    if (!content) return "";
    var exportButton = (view === "day" || view === "week")
      ? '<button class="club-action" type="button" data-schedule-view-export="1">导出 Excel</button>'
      : '';
    return '<form class="edu-view-controls" id="edu-schedule-view-filter-form">' +
      content +
      '<div class="edu-filter-actions"><button class="club-action primary" type="submit">应用</button>' + exportButton + '</div>' +
    '</form>';
  };

  var filteredSessions = function () {
    var filters = eduState.scheduleFilters || {};
    return (eduState.sessions || []).filter(function (session) {
      var klass = sessionClass(session);
      var course = sessionCourse(session);
      var keyword = String(filters.keyword || "").trim().toLowerCase();
      var text = [
        session.classNameSnapshot,
        klass.className,
        session.courseNameSnapshot,
        course.name,
        session.remark,
        session.roomId,
        (session.tableNos || []).join(",")
      ].join(" ").toLowerCase();
      if (keyword && text.indexOf(keyword) < 0) return false;
      if (filters.branchId && String(session.branchId) !== String(filters.branchId)) return false;
      if (filters.teacherId && String(session.teacherId) !== String(filters.teacherId)) return false;
      if (filters.range && !dateRangeMatch(session.startAt, filters.range)) return false;
      if (filters.dayPart && dayPartText(session.startAt) !== filters.dayPart) return false;
      if (filters.roomId && text.indexOf(String(filters.roomId).toLowerCase()) < 0) return false;
      if (filters.teachingMode && String(course.teachingMode || "") !== String(filters.teachingMode)) return false;
      return true;
    });
  };

  var addDays = function (date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  };

  var addMinutes = function (date, minutes) {
    var d = new Date(date);
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d;
  };

  var startOfWeek = function (date) {
    var d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  };

  var pad2 = function (n) {
    return n < 10 ? "0" + n : "" + n;
  };

  var weekInputValue = function (date) {
    var d = new Date(date || Date.now());
    var utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    var week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return utc.getUTCFullYear() + "-W" + pad2(week);
  };

  var parseWeekInputValue = function (value) {
    var match = String(value || "").match(/^(\d{4})-W(\d{2})$/);
    if (!match) return startOfWeek(Date.now());
    var year = Number(match[1]);
    var week = Number(match[2]);
    var simple = new Date(year, 0, 1 + (week - 1) * 7);
    var day = simple.getDay() || 7;
    simple.setDate(simple.getDate() + (day <= 4 ? 1 - day : 8 - day));
    simple.setHours(0, 0, 0, 0);
    return simple;
  };

  var parseMonthInputValue = function (value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      var today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  };

  var scheduleWeekDays = function (baseDate) {
    var base = startOfWeek(baseDate || Date.now());
    return [0, 1, 2, 3, 4, 5, 6].map(function (offset) {
      return addDays(base, offset);
    });
  };

  var scheduleMonthDays = function (monthDate) {
    var start = parseMonthInputValue(monthDate || monthInputValue(new Date()));
    var end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    var days = [];
    for (var d = new Date(start); d < end; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  var scheduleViewRange = function (view) {
    var filters = eduState.scheduleFilters || {};
    if (view === "day") {
      var day = new Date((filters.dayDate || todayDateValue()) + "T00:00:00");
      if (Number.isNaN(day.getTime())) day = new Date(todayDateValue() + "T00:00:00");
      return { start: day, end: addDays(day, 1), dayKey: dateOnlyText(day) };
    }
    if (view === "month") {
      var monthStart = parseMonthInputValue(filters.monthValue || monthInputValue(new Date()));
      return { start: monthStart, end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1), monthValue: monthInputValue(monthStart) };
    }
    var weekStart = parseWeekInputValue(filters.weekValue || weekInputValue(new Date()));
    return { start: weekStart, end: addDays(weekStart, 7), weekValue: weekInputValue(weekStart) };
  };

  var inScheduleViewRange = function (session, range) {
    var d = new Date(session && session.startAt);
    if (Number.isNaN(d.getTime())) return false;
    return d >= range.start && d < range.end;
  };

  var sessionDateKey = function (session) {
    return dateOnlyText(session && session.startAt);
  };

  var sessionTitle = function (session) {
    var klass = sessionClass(session);
    var course = sessionCourse(session);
    return session.classNameSnapshot || klass.className || session.courseNameSnapshot || course.name || "课次";
  };

  var canAttendanceSession = function (session) {
    return session && ["cancelled", "completed"].indexOf(String(session.status || "")) < 0;
  };

  var sessionPayload = function (session, patch) {
    var teacher = findById(eduState.staff, session.teacherId);
    var course = sessionCourse(session);
    var klass = sessionClass(session);
    return Object.assign({
      id: idOf(session),
      branchId: session.branchId,
      classId: session.classId,
      classNameSnapshot: session.classNameSnapshot || klass.className,
      courseProductId: session.courseProductId || klass.courseProductId,
      courseNameSnapshot: session.courseNameSnapshot || course.name,
      teacherId: session.teacherId,
      teacherName: session.teacherName || (teacher && teacher.name),
      startAt: formatDateTimeLocal(session.startAt),
      endAt: formatDateTimeLocal(session.endAt),
      roomId: session.roomId,
      tableNos: session.tableNos || [],
      skipConflict: false
    }, patch || {});
  };

  var shiftedSessionPayload = function (session, data, copy) {
    var dayOffset = Number(data.dayOffset || 0);
    var minuteOffset = Number(data.minuteOffset || 0);
    var start = addMinutes(addDays(session.startAt, dayOffset), minuteOffset);
    var end = addMinutes(addDays(session.endAt, dayOffset), minuteOffset);
    return sessionPayload(session, {
      id: copy ? "" : idOf(session),
      startAt: formatDateTimeLocal(start),
      endAt: formatDateTimeLocal(end),
      skipConflict: data.skipConflict === "1"
    });
  };

  var sessionsByIds = function (ids) {
    return (ids || []).map(function (id) {
      return findById(eduState.sessions, id);
    }).filter(Boolean);
  };

  var selectedSessions = function () {
    return sessionsByIds(selectedEduIds("sessions"));
  };

  var sessionCardHtml = function (session, withCheck) {
    var id = idOf(session);
    var place = (session.roomId || '') + ((session.tableNos || []).length ? ' / ' + session.tableNos.join(',') : '');
    return '<div class="edu-schedule-card">' +
      '<div class="edu-schedule-card-title">' + (withCheck ? rowCheck('sessions', id) : '') + '<strong>' + escapeHtml(sessionTitle(session)) + '</strong></div>' +
      '<div>' + escapeHtml(timeOnlyText(session.startAt)) + '-' + escapeHtml(timeOnlyText(session.endAt)) + ' · ' + escapeHtml(session.teacherName || teacherName(session.teacherId)) + '</div>' +
      '<div class="muted">' + escapeHtml(place || branchName(session.branchId)) + '</div>' +
      '<div class="club-actions"><button class="club-action" type="button" data-edit-session="' + escapeHtml(id) + '">编辑</button>' + (canAttendanceSession(session) ? '<button class="club-action primary" type="button" data-attendance-session="' + escapeHtml(id) + '">点名</button>' : '') + '<button class="club-action" type="button" data-cancel-session="' + escapeHtml(id) + '">取消</button></div>' +
    '</div>';
  };

  var scheduleDayTeacherKey = function (session) {
    if (session.teacherId) return "id:" + String(session.teacherId);
    return "name:" + String(session.teacherName || teacherName(session.teacherId) || "未指定教练");
  };

  var scheduleDayTeacherGroups = function (dayRows) {
    var order = {};
    (eduState.staff || []).forEach(function (item, index) {
      order["id:" + idOf(item)] = index;
    });
    var groups = {};
    dayRows.forEach(function (session) {
      var key = scheduleDayTeacherKey(session);
      if (!groups[key]) {
        groups[key] = {
          key,
          name: session.teacherName || teacherName(session.teacherId) || "未指定教练",
          order: order[key] != null ? order[key] : 9999
        };
      }
    });
    return Object.keys(groups).map(function (key) { return groups[key]; }).sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
    });
  };

  var scheduleDaySlotKey = function (session) {
    return timeOnlyText(session.startAt) + "-" + timeOnlyText(session.endAt);
  };

  var scheduleDayClassNo = function (value) {
    return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][value] || String(value);
  };

  var scheduleDaySessionHtml = function (session) {
    var id = idOf(session);
    var course = sessionCourse(session);
    var place = (session.roomId || '') + ((session.tableNos || []).length ? ' / ' + session.tableNos.join(',') : '');
    return '<div class="edu-day-session">' +
      '<strong>' + escapeHtml(session.studentNames || sessionTitle(session)) + '</strong>' +
      '<span>' + escapeHtml(session.courseNameSnapshot || course.name || sessionTitle(session)) + '</span>' +
      '<span>' + escapeHtml(place || branchName(session.branchId)) + '</span>' +
      '<div class="edu-day-session-actions"><button class="club-action" type="button" data-edit-session="' + escapeHtml(id) + '">编辑</button>' +
        (canAttendanceSession(session) ? '<button class="club-action primary" type="button" data-attendance-session="' + escapeHtml(id) + '">点名</button>' : '') +
      '</div>' +
    '</div>';
  };

  var scheduleDayPreviewHtml = function (rows, dayKey) {
    var byDate = {};
    rows.forEach(function (session) {
      var key = sessionDateKey(session);
      if (!key || key === "-") return;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(session);
    });
    var keys = Object.keys(byDate).sort();
    var selectedDayKey = dayKey || dateOnlyText(new Date());
    var dayRows = (byDate[selectedDayKey] || []).slice().sort(function (a, b) {
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
    var groups = scheduleDayTeacherGroups(dayRows);
    var slotKeys = Array.from(new Set(dayRows.map(scheduleDaySlotKey))).sort();
    var dayDate = new Date(selectedDayKey + "T12:00:00");
    var dayTitle = selectedDayKey + " " + weekdayText(dayDate.getDay() || 7);
    if (!keys.length || !dayRows.length) {
      return '<div class="edu-visual-board day"><div class="edu-day-summary"><strong>' + escapeHtml(dayTitle) + '</strong><span>0 节课</span></div><div class="empty-state compact">当天暂无课次</div></div>';
    }
    var gridColumns = '92px 118px repeat(' + Math.max(groups.length, 1) + ', minmax(190px, 1fr))';
    var minWidth = 210 + Math.max(groups.length, 1) * 190;

    return '<div class="edu-visual-board day">' +
      '<div class="edu-day-summary"><strong>' + escapeHtml(dayTitle) + '</strong><span>' + escapeHtml(dayRows.length + ' 节课 · ' + groups.length + ' 位教练') + '</span></div>' +
      '<div class="edu-day-grid" style="grid-template-columns:' + gridColumns + ';min-width:' + minWidth + 'px">' +
        '<div class="edu-day-head">班次</div><div class="edu-day-head">时间</div>' +
        groups.map(function (group) { return '<div class="edu-day-head teacher">' + escapeHtml(group.name || "-") + '</div>'; }).join("") +
        slotKeys.map(function (slot, index) {
          var slotRows = dayRows.filter(function (session) { return scheduleDaySlotKey(session) === slot; });
          return '<div class="edu-day-axis"><strong>第' + escapeHtml(scheduleDayClassNo(index + 1)) + '班</strong></div>' +
            '<div class="edu-day-axis time">' + escapeHtml(slot) + '</div>' +
            groups.map(function (group) {
              var cellRows = slotRows.filter(function (session) { return scheduleDayTeacherKey(session) === group.key; });
              return '<div class="edu-day-cell' + (cellRows.length ? '' : ' empty') + '">' +
                (cellRows.length ? cellRows.map(scheduleDaySessionHtml).join("") : '<span>空</span>') +
              '</div>';
            }).join("");
        }).join("") +
      '</div>' +
    '</div>';
  };

  var scheduleVisualHtml = function () {
    var view = eduState.scheduleView || "day";
    var baseRows = filteredSessions();
    var range = scheduleViewRange(view);
    var rows = ["day", "week", "month", "teacher-free", "room-free"].indexOf(view) >= 0
      ? baseRows.filter(function (session) { return inScheduleViewRange(session, range); })
      : baseRows;
    var days = view === "month" ? scheduleMonthDays(range.monthValue) : scheduleWeekDays(range.start);
    if (view === "month") {
      var byDate = {};
      rows.forEach(function (session) {
        var key = sessionDateKey(session);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(session);
      });
      return '<div class="edu-visual-board month">' + days.map(function (day) {
        var key = dateOnlyText(day);
        var dayRows = (byDate[key] || []).sort(function (a, b) { return new Date(a.startAt).getTime() - new Date(b.startAt).getTime(); });
        return '<div class="edu-visual-day"><div class="edu-visual-head">' + escapeHtml(weekdayText(day.getDay() || 7) + ' ' + key) + '</div>' + (dayRows.length ? dayRows.map(function (session) { return sessionCardHtml(session, true); }).join("") : '<div class="muted">无课</div>') + '</div>';
      }).join("") + '</div>';
    }
    if (view === "teacher-free") {
      return teacherFreeHtml(days);
    }
    if (view === "room-free") {
      return roomFreeHtml(days);
    }
    if (view === "day") {
      return scheduleDayPreviewHtml(rows, range.dayKey);
    }
    return '<div class="edu-visual-board week">' + days.map(function (day) {
      var key = dateOnlyText(day);
      var dayRows = rows.filter(function (session) { return sessionDateKey(session) === key; });
      return '<div class="edu-visual-day"><div class="edu-visual-head">' + escapeHtml(weekdayText(day.getDay() || 7) + ' ' + key) + '</div>' + (dayRows.length ? dayRows.map(function (session) { return sessionCardHtml(session, true); }).join("") : '<div class="muted">无课</div>') + '</div>';
    }).join("") + '</div>';
  };

  var scheduleRowsHtml = function () {
    var rows = filteredSessions();
    if (!rows.length) return '<tr><td colspan="13">暂无课表记录</td></tr>';
    return rows.map(function (session) {
      var id = idOf(session);
      var klass = sessionClass(session);
      var course = sessionCourse(session);
      var classTitle = session.classNameSnapshot || klass.className || "-";
      var courseTitle = session.courseNameSnapshot || course.name || courseName(session.courseProductId);
      var place = (session.roomId || '-') + ' / ' + ((session.tableNos || []).join(',') || '-');
      var billed = lessonText(session.deductUnits10 || course.defaultDeductUnits10 || 10);
      return '<tr>' +
        '<td>' + rowCheck('sessions', id) + ' <strong>' + escapeHtml(classTitle) + '</strong></td>' +
        '<td>' + escapeHtml(courseTitle) + '</td>' +
        
                '<td>' + escapeHtml(classTypeLabel(course.classTypeName, course.classTypeCode)) + '</td>' +
        '<td>' + escapeHtml(branchName(session.branchId)) + '</td>' +
        '<td>' + escapeHtml(session.teacherName || teacherName(session.teacherId)) + '</td>' +
                
        '<td>' + escapeHtml(place) + '</td>' +
                '<td><strong>' + escapeHtml(formatCST(session.startAt)) + '</strong><br><span class="muted">' + escapeHtml(dayPartText(session.startAt)) + ' · ' + escapeHtml(timeOnlyText(session.startAt)) + '-' + escapeHtml(timeOnlyText(session.endAt)) + '</span></td>' +
        '<td>' + escapeHtml(durationText(session.startAt, session.endAt)) + '</td>' +
        '<td>' + badgeHtml(sessionStatusLabel(session.status), session.status) + '</td>' +
        '<td>' + escapeHtml(session.remark || '-') + '</td>' +
        
        '<td>' + escapeHtml(session.studentNames || '-') + '</td>' +
        
        
        '<td>' + escapeHtml(billed) + '</td>' +
        '<td><button class="club-action" data-edit-session="' + escapeHtml(id) + '">编辑</button>' + (canAttendanceSession(session) ? '<button class="club-action primary" data-attendance-session="' + escapeHtml(id) + '">点名</button>' : '') + '<button class="club-action" data-cancel-session="' + escapeHtml(id) + '">取消</button></td>' +
      '</tr>';
    }).join("");
  };

  var availabilityCalendarDays = function () {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var weekday = today.getDay() || 7;
    var start = addDays(today, 1 - weekday);
    var days = [];
    for (var i = 0; i < 35; i += 1) {
      var d = addDays(start, i);
      d.setHours(0, 0, 0, 0);
      var dayOfWeek = d.getDay() || 7;
      days.push({
        date: dateOnlyText(d),
        weekday: dayOfWeek,
        disabled: d < today,
        weekend: dayOfWeek >= 6
      });
    }
    return days;
  };

  var availabilityBulkHtml = function () {
    var dayHeads = [1, 2, 3, 4, 5, 6, 7].map(function (day) {
      return '<span>' + escapeHtml(weekdayText(day).replace('周', '')) + '</span>';
    }).join('');
    var dates = availabilityCalendarDays().map(function (day) {
      var cls = "edu-free-date" + (day.weekend ? " weekend" : "") + (day.disabled ? " disabled" : "");
      return '<label class="' + cls + '">' +
        '<input type="checkbox" name="dates" value="' + escapeHtml(day.date) + '" data-weekend="' + (day.weekend ? '1' : '') + '"' + (day.disabled ? ' disabled' : '') + '>' +
        '<strong>' + escapeHtml(day.date.slice(5)) + '</strong><span>' + escapeHtml(weekdayText(day.weekday)) + '</span>' +
      '</label>';
    }).join('');
    var presets = [
      ["08:00", "10:00"],
      ["10:00", "12:00"],
      ["13:00", "15:00"],
      ["15:00", "17:00"],
      ["18:00", "20:00"]
    ].map(function (slot) {
      return '<button class="club-action" type="button" data-availability-preset="' + escapeHtml(slot[0] + '-' + slot[1]) + '">' + escapeHtml(slot[0] + '-' + slot[1]) + '</button>';
    }).join('');
    return '<form class="edu-free-manage" id="edu-availability-bulk-form" data-availability-release-mode="day">' +
      '<div class="edu-free-manage-head">' +
        '<div><strong>放号排课</strong><span>按天临时放号，按周发布常规可约时间。</span></div>' +
        '<div class="edu-release-mode-tabs">' +
          '<button class="active" type="button" data-availability-release-mode="day">按天放号</button>' +
          '<button type="button" data-availability-release-mode="week">按周放号</button>' +
        '</div>' +
      '</div>' +
      '<input type="hidden" name="releaseMode" value="day">' +
      '<div class="edu-filter-grid compact">' +
        '<input type="hidden" name="branchId" value="' + escapeHtml(eduState.branchId || '') + '">' +
        '<label>教练<select class="form-input" name="teacherId" required>' + teacherOptions('') + '</select></label>' +
        '<label>课程<select class="form-input" name="courseProductId">' + bookingCourseOptions('') + '</select></label>' +
        '<label>容量<select class="form-input" name="capacity"><option value="1">一对一</option><option value="2">一对二</option><option value="3">一对三</option><option value="4">一对四</option></select></label>' +
        '<label>座位/球台<select class="form-input" name="resourceId">' + resourceOptions('') + '</select></label>' +
        '<label data-availability-day-field>放号日期<input class="form-input" type="date" name="singleDate" value="' + escapeHtml(todayDateValue()) + '"></label>' +
        '<label>开始时间<input class="form-input text-center" type="time" name="startTime" value="08:00" required></label>' +
        '<label>结束时间<input class="form-input text-center" type="time" name="endTime" value="10:00" required></label>' +
        '<label>每格时长<input class="form-input text-center" type="number" min="15" step="15" name="slotDurationMinutes" value="60"></label>' +
        '<label>发布方式<select class="form-input" name="status"><option value="published">直接发布</option><option value="draft">先存草稿</option></select></label>' +
      '</div>' +
      '<div class="edu-week-release-panel" data-availability-week-panel>' +
        '<div class="edu-free-calendar-head"><span>本周/下周可多选，已选<strong data-availability-selected-count>0</strong>天</span><span class="muted" data-availability-calendar-note>当前周期</span></div>' +
        '<div class="club-actions compact"><button class="club-action" type="button" data-availability-skip="clear">清空</button><button class="club-action" type="button" data-availability-skip="weekend">跳过周末</button><button class="club-action" type="button" data-availability-skip="holiday">跳过节假日</button></div>' +
        '<div class="edu-free-weekdays">' + dayHeads + '</div>' +
        '<div class="edu-free-calendar-grid">' + dates + '</div>' +
      '</div>' +
      '<div class="edu-free-presets"><span>常用时间段</span>' + presets + '</div>' +
      '<div class="edu-release-actions"><button class="club-action primary" type="submit">发布空位</button><span class="muted">发布后会在下方矩阵中显示，学员即可在小程序选择可约格子。</span></div>' +
    '</form>';
  };

  var availabilityFilterHtml = function () {
    var filters = eduState.availabilityFilters || {};
    return '<div class="edu-page-path">当前位置：管理功能 / 排课管理 / 放号排课</div>' +
      '<form class="edu-filter-panel" id="edu-availability-filter-form">' +
        '<div class="edu-filter-grid compact">' +
          '<label>预览方式<select class="form-input" name="matrixRange"><option value="week">按周查看</option><option value="day">按天查看</option></select></label>' +
          '<label>预览日期<input class="form-input" type="date" name="matrixDate" value="' + escapeHtml(filters.matrixDate || todayDateValue()) + '"></label>' +
          '<label>教练<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>' +
          '<label>状态<select class="form-input" name="status"><option value="">全部</option><option value="draft">草稿</option><option value="published">已发布</option><option value="paused">已暂停</option><option value="requested">待确认</option><option value="confirmed">已确认</option><option value="alternative_proposed">改期中</option><option value="rejected">已拒绝</option><option value="cancelled">已取消</option><option value="pending">待审核</option><option value="approved">已通过</option></select></label>' +
          '<label>星期<select class="form-input" name="weekday"><option value="">全部</option><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="7">周日</option></select></label>' +
          '<div class="edu-filter-actions"><button class="club-action primary" type="submit">应用</button><button class="club-action" type="button" data-edu-filter-reset="availability">重置</button></div>' +
        '</div>' +
      '</form>';
  };

  var allAvailabilityRows = function () {
    var map = {};
    (eduState.availability || []).concat(eduState.bookingAvailability || []).forEach(function (item) {
      var id = idOf(item) || [item.teacherId, item.branchId, item.date, item.startTime, item.endTime, item.status].join("|");
      if (!id) return;
      map[id] = Object.assign({}, map[id] || {}, item);
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  };

  var parseDateKey = function (value) {
    var raw = String(value || todayDateValue()).slice(0, 10);
    var d = new Date(raw + "T00:00:00");
    if (Number.isNaN(d.getTime())) d = new Date(todayDateValue() + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  };

  var availabilityMatrixRange = function () {
    var filters = eduState.availabilityFilters || {};
    var mode = filters.matrixRange === "day" ? "day" : "week";
    var base = parseDateKey(filters.matrixDate || todayDateValue());
    var start = mode === "day" ? base : startOfWeek(base);
    var days = [];
    for (var i = 0; i < (mode === "day" ? 1 : 7); i += 1) {
      var day = addDays(start, i);
      days.push({
        date: dateOnlyText(day),
        label: weekdayText(day.getDay() || 7) + " " + dateOnlyText(day).slice(5)
      });
    }
    return {
      mode: mode,
      focusDate: dateOnlyText(base),
      startDate: days[0] && days[0].date,
      endDate: days[days.length - 1] && days[days.length - 1].date,
      weekStartDate: dateOnlyText(start),
      days: days
    };
  };

  var dateInMatrixRange = function (dateKey, range) {
    var key = String(dateKey || "").slice(0, 10);
    return !!key && key >= range.startDate && key <= range.endDate;
  };

  var minutesOfTime = function (value) {
    var parts = String(value || "").split(":");
    var hour = Number(parts[0]);
    var minute = Number(parts[1] || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
    return hour * 60 + minute;
  };

  var timeOfMinutes = function (minutes) {
    var hour = Math.floor(Number(minutes || 0) / 60);
    var minute = Number(minutes || 0) % 60;
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return pad(hour) + ":" + pad(minute);
  };

  var bookingStartDateKey = function (booking) {
    return dateOnlyText(booking && (booking.preferredStartAt || booking.startAt || booking.proposedStartAt));
  };

  var bookingStartTimeKey = function (booking) {
    return timeOnlyText(booking && (booking.preferredStartAt || booking.startAt || booking.proposedStartAt));
  };

  var capacityLabel = function (capacity) {
    var n = Number(capacity || 1);
    if (n === 2) return "一对二";
    if (n === 3) return "一对三";
    if (n === 4) return "一对四";
    return "一对一";
  };

  var bookingTypeForCapacity = function (capacity) {
    var n = Number(capacity || 1);
    if (n === 2) return "one_on_two";
    if (n === 3) return "one_on_three";
    if (n === 4) return "one_on_four";
    return "one_on_one";
  };

  var availabilityStatusVisibleInMatrix = function (status) {
    return ["draft", "published", "paused"].indexOf(String(status || "")) >= 0;
  };

  var statusFilterMatches = function (status) {
    var filters = eduState.availabilityFilters || {};
    return !filters.status || String(status || "") === String(filters.status);
  };

  var bookingAvailabilitySlots = function (range) {
    var filters = eduState.availabilityFilters || {};
    var rows = allAvailabilityRows().filter(function (item) {
      if (!availabilityStatusVisibleInMatrix(item.status || "draft")) return false;
      if (!statusFilterMatches(item.status || "draft")) return false;
      if (filters.teacherId && String(item.teacherId) !== String(filters.teacherId)) return false;
      if (filters.branchId && String(item.branchId) !== String(filters.branchId)) return false;
      return dateInMatrixRange(item.date, range);
    });
    var slots = [];
    rows.forEach(function (item) {
      var start = minutesOfTime(item.startTime);
      var end = minutesOfTime(item.endTime);
      var duration = Number(item.slotDurationMinutes || 60);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      if (!Number.isFinite(duration) || duration <= 0) duration = 60;
      for (var min = start; min + duration <= end; min += duration) {
        slots.push({
          availability: item,
          id: idOf(item),
          date: item.date,
          startTime: timeOfMinutes(min),
          endTime: timeOfMinutes(min + duration),
          teacherId: item.teacherId || "",
          branchId: item.branchId || "",
          courseProductId: item.courseProductId || "",
          courseName: item.courseName || courseName(item.courseProductId) || "不限课程",
          resourceLabel: item.resourceLabel || ((findById(eduState.resources, item.resourceId) || {}).name) || "",
          capacity: Number(item.capacity || 1),
          status: item.status || "draft"
        });
      }
    });
    return slots;
  };

  var filteredBookingsForMatrix = function (range) {
    var filters = eduState.availabilityFilters || {};
    return (eduState.bookings || []).filter(function (item) {
      var dateKey = bookingStartDateKey(item);
      if (!dateInMatrixRange(dateKey, range)) return false;
      if (!statusFilterMatches(item.status || "requested")) return false;
      if (filters.teacherId && String(item.teacherId || "") !== String(filters.teacherId)) return false;
      if (filters.branchId && String(item.branchId || "") !== String(filters.branchId)) return false;
      return true;
    }).sort(function (a, b) {
      return String(a.preferredStartAt || a.createdAt || "").localeCompare(String(b.preferredStartAt || b.createdAt || ""));
    });
  };

  var teacherRowsForAvailabilityMatrix = function (slots, bookings) {
    var filters = eduState.availabilityFilters || {};
    var activeIds = {};
    slots.forEach(function (slot) { activeIds[String(slot.teacherId || "")] = true; });
    bookings.forEach(function (booking) { activeIds[String(booking.teacherId || "")] = true; });
    var staffTeachers = (eduState.staff || []).filter(function (item) {
      var roles = item.roles || [];
      var id = idOf(item);
      if (filters.teacherId && String(id) !== String(filters.teacherId)) return false;
      if (filters.branchId && item.branchId && String(item.branchId) !== String(filters.branchId)) return false;
      return roles.indexOf("teacher") >= 0 || roles.indexOf("coach") >= 0 || roles.length === 0;
    });
    var rows = staffTeachers.filter(function (item) {
      return staffTeachers.length <= 8 || activeIds[String(idOf(item))];
    }).map(function (item) {
      return { id: idOf(item), name: item.name || idOf(item), branchId: item.branchId || "" };
    });
    Object.keys(activeIds).forEach(function (id) {
      if (!id) return;
      if (rows.some(function (row) { return String(row.id) === String(id); })) return;
      rows.push({ id: id, name: teacherName(id), branchId: "" });
    });
    if (activeIds[""] && !filters.teacherId) rows.push({ id: "", name: "待安排教练", branchId: "" });
    return rows;
  };

  var availabilityMatrixTimeRows = function (range, slots, bookings) {
    var timeSet = {};
    slots.forEach(function (slot) { timeSet[slot.startTime] = true; });
    bookings.forEach(function (booking) { timeSet[bookingStartTimeKey(booking)] = true; });
    var times = Object.keys(timeSet).filter(Boolean).sort();
    var rows = [];
    range.days.forEach(function (day) {
      times.forEach(function (time) {
        var hasSlot = slots.some(function (slot) { return slot.date === day.date && slot.startTime === time; });
        var hasBooking = bookings.some(function (booking) { return bookingStartDateKey(booking) === day.date && bookingStartTimeKey(booking) === time; });
        if (hasSlot || hasBooking) rows.push({ date: day.date, dayLabel: day.label, time: time });
      });
    });
    return rows;
  };

  var filteredAvailability = function () {
    var filters = eduState.availabilityFilters || {};
    var range = availabilityMatrixRange();
    return allAvailabilityRows().filter(function (item) {
      if (filters.teacherId && String(item.teacherId) !== String(filters.teacherId)) return false;
      if (filters.branchId && String(item.branchId) !== String(filters.branchId)) return false;
      if (filters.status && String(item.status || "") !== String(filters.status)) return false;
      if (filters.weekday && String(item.weekday || "") !== String(filters.weekday)) return false;
      if (filters.matrixDate && item.date && !dateInMatrixRange(item.date, range)) return false;
      return true;
    }).sort(function (a, b) {
      return String(a.date || a.weekday || "").localeCompare(String(b.date || b.weekday || "")) || String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });
  };

  var copyMoveFormHtml = function (ids) {
    var count = (ids || []).length;
    return '<form class="edu-form" id="edu-copy-move-form">' +
      '<input type="hidden" name="ids" value="' + escapeHtml((ids || []).join(',')) + '">' +
      '<label>操作<select class="form-input" name="mode"><option value="copy">复制排课</option><option value="move">移动排课</option></select></label>' +
      '<label>日期偏移<input class="form-input" name="dayOffset" type="number" value="7"><span class="edu-note">例如 7 表示复制/移动到下周同一天</span></label>' +
      '<label>时间偏移(分钟)<input class="form-input" name="minuteOffset" type="number" value="0"></label>' +
      '<label>冲突处理<select class="form-input" name="skipConflict"><option value="">遇到冲突则拦截</option><option value="1">管理员确认跳过</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">执行 ' + count + ' 条</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var batchOperationFormHtml = function (ids) {
    var count = (ids || []).length;
    return '<form class="edu-form" id="edu-batch-session-form">' +
      '<input type="hidden" name="ids" value="' + escapeHtml((ids || []).join(',')) + '">' +
      '<label>批量操作<select class="form-input" name="mode"><option value="move">批量移动</option><option value="copy">批量复制</option><option value="cancel">批量取消</option><option value="delete">批量删除</option></select></label>' +
      '<label>日期偏移<input class="form-input" name="dayOffset" type="number" value="7"></label>' +
      '<label>时间偏移(分钟)<input class="form-input" name="minuteOffset" type="number" value="0"></label>' +
      '<label>冲突处理<select class="form-input" name="skipConflict"><option value="">遇到冲突则拦截</option><option value="1">管理员确认跳过</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">执行 ' + count + ' 条</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openCopyMoveModal = function () {
    var ids = selectedEduIds("sessions");
    if (!ids.length) return window.alert("请先勾选要复制/移动的课次。");
    renderEduModal("复制/移动排课", copyMoveFormHtml(ids));
  };

  var openBatchSessionModal = function () {
    var ids = selectedEduIds("sessions");
    if (!ids.length) return window.alert("请先勾选要批量处理的课次。");
    renderEduModal("批量操作", batchOperationFormHtml(ids));
  };

  var applyCopyMoveSessions = function (form) {
    var data = formData(form);
    var ids = splitList(data.ids);
    var rows = sessionsByIds(ids);
    if (!rows.length) return window.alert("没有可处理的课次。");
    var copy = data.mode === "copy";
    return withEduSaving(Promise.all(rows.map(function (session) {
      return clubData.eduSaveSession(selectedClubId, shiftedSessionPayload(session, data, copy));
    })));
  };

  var applyBatchSessions = function (form) {
    var data = formData(form);
    var ids = splitList(data.ids);
    var rows = sessionsByIds(ids);
    if (!rows.length) return window.alert("没有可处理的课次。");
    if (data.mode === "cancel") {
      if (!window.confirm("确认取消选中的 " + rows.length + " 节课？")) return;
      return withEduSaving(Promise.all(rows.map(function (session) {
        return clubData.eduCancelSession(selectedClubId, idOf(session), "Web 管理端批量取消");
      })));
    }
    if (data.mode === "delete") {
      if (!window.confirm("确认删除选中的 " + rows.length + " 条课次？删除后历史记录会保留。")) return;
      return withEduSaving(Promise.all(rows.map(function (session) {
        return clubData.eduDeleteSession(selectedClubId, idOf(session), "Web 管理端批量删除");
      })));
    }
    return applyCopyMoveSessions(form);
  };

  var teacherFreeHtml = function (days) {
    days = days || scheduleWeekDays();
    var filters = eduState.scheduleFilters || {};
    var teachers = (eduState.staff || []).filter(function (item) {
      var roles = item.roles || [];
      if (filters.teacherId && String(idOf(item)) !== String(filters.teacherId)) return false;
      return roles.indexOf("teacher") >= 0 || roles.indexOf("coach") >= 0 || !roles.length;
    });
    return '<div class="edu-free-board"><div class="edu-visual-grid">' +
      '<div class="edu-visual-axis"></div>' + days.map(function (day) { return '<div class="edu-visual-head">' + escapeHtml(weekdayText(day.getDay() || 7) + ' ' + dateOnlyText(day)) + '</div>'; }).join("") +
      teachers.map(function (teacher) {
        var teacherId = idOf(teacher);
        return '<div class="edu-visual-axis"><strong>' + escapeHtml(teacher.name || '-') + '</strong><br><span class="muted">' + escapeHtml(branchName(teacher.branchId)) + '</span></div>' +
          days.map(function (day) {
            var key = dateOnlyText(day);
            var weekday = day.getDay() || 7;
            var free = (eduState.availability || []).filter(function (item) {
              return String(item.teacherId) === String(teacherId) && ["approved", "published"].indexOf(String(item.status || "")) >= 0 && (String(item.date || "") === key || (!item.date && String(item.weekday || "") === String(weekday)));
            });
            var busy = (eduState.sessions || []).filter(function (session) {
              return String(session.teacherId) === String(teacherId) && sessionDateKey(session) === key && session.status !== "cancelled";
            });
            return '<div class="edu-visual-cell">' +
              (free.length ? free.map(function (item) { return '<div class="edu-free-slot ok">可排 ' + escapeHtml((item.startTime || '-') + '-' + (item.endTime || '-')) + '</div>'; }).join("") : '<div class="edu-free-slot muted">未设置可排</div>') +
              (busy.length ? busy.map(function (session) { return '<div class="edu-free-slot busy">已排 ' + escapeHtml(timeOnlyText(session.startAt) + '-' + timeOnlyText(session.endAt)) + '</div>'; }).join("") : '') +
            '</div>';
          }).join("");
      }).join("") +
    '</div></div>';
  };

  var roomFreeHtml = function (days) {
    days = days || scheduleWeekDays();
    var resources = eduState.resources || [];
    return '<div class="edu-free-board"><div class="edu-visual-grid">' +
      '<div class="edu-visual-axis"></div>' + days.map(function (day) { return '<div class="edu-visual-head">' + escapeHtml(weekdayText(day.getDay() || 7) + ' ' + dateOnlyText(day)) + '</div>'; }).join("") +
      resources.map(function (resource) {
        var keyValue = resource.roomId || resource.tableNo || resource.name;
        return '<div class="edu-visual-axis"><strong>' + escapeHtml(resource.name || keyValue || '-') + '</strong><br><span class="muted">' + escapeHtml(resourceTypeLabel(resource.type)) + '</span></div>' +
          days.map(function (day) {
            var key = dateOnlyText(day);
            var busy = (eduState.sessions || []).filter(function (session) {
              return sessionDateKey(session) === key && session.status !== "cancelled" && (String(session.roomId || "") === String(keyValue) || (session.tableNos || []).map(String).indexOf(String(keyValue)) >= 0);
            });
            return '<div class="edu-visual-cell">' + (busy.length ? busy.map(function (session) {
              return '<div class="edu-free-slot busy">' + escapeHtml(timeOnlyText(session.startAt) + '-' + timeOnlyText(session.endAt) + ' ' + sessionTitle(session)) + '</div>';
            }).join("") : '<div class="edu-free-slot ok">空闲</div>') + '</div>';
          }).join("");
      }).join("") +
    '</div></div>';
  };

  var scheduleProgressHtml = function () {
    var classes = eduState.classes || [];
    return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班级</th><th>课程</th><th>教练</th><th>计划课次</th><th>已排</th><th>已完成</th><th>待点名</th><th>进度</th></tr></thead><tbody>' +
      (classes.length ? classes.map(function (klass) {
        var classId = idOf(klass);
        var course = findById(eduState.courses, klass.courseProductId) || {};
        var rows = (eduState.sessions || []).filter(function (session) {
          return String(session.classId || "") === String(classId) && session.status !== "cancelled";
        });
        var planned = Number(klass.plannedSessionCount || course.plannedSessionCount || 0);
        var completed = rows.filter(function (session) { return session.status === "completed"; }).length;
        var pending = rows.filter(function (session) { return session.status === "pending_attendance" || session.status === "scheduled"; }).length;
        var percent = planned ? Math.min(100, Math.round(rows.length / planned * 100)) : 0;
        return '<tr><td><strong>' + escapeHtml(klass.className || '-') + '</strong></td><td>' + escapeHtml(klass.courseNameSnapshot || course.name || '-') + '</td><td>' + escapeHtml(klass.teacherName || teacherName(klass.teacherId)) + '</td><td>' + planned + '</td><td>' + rows.length + '</td><td>' + completed + '</td><td>' + pending + '</td><td><div class="edu-progress"><span style="width:' + percent + '%"></span></div><span class="muted">' + percent + '%</span></td></tr>';
      }).join("") : '<tr><td colspan="8">暂无班级</td></tr>') +
    '</tbody></table></div>';
  };

  var courseFormHtml = function (editItem) {
    var item = editItem || {};
    var priceRules = item.priceRules || {};
    return '<form class="edu-form" id="edu-course-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>课程名称<input class="form-input" name="name" value="' + escapeHtml(item.name || '') + '" required></label>' +
      '<label>课程类型<select class="form-input" name="teachingMode"><option value="group">集体班</option><option value="private">一对一</option><option value="semi_private">一对多</option><option value="camp">训练营</option></select></label>' +
      '<label>计费<select class="form-input" name="billingMode"><option value="lesson">课时</option><option value="term">按期</option><option value="month">按月</option><option value="day">按天预留</option></select></label>' +
      '<label>单价(元)<input class="form-input" name="standardPriceYuan" type="number" min="0" step="0.01" value="' + escapeHtml(moneyInputValue(item.standardPriceCents)) + '"></label>' +
      '<label>单位<input class="form-input" name="unit" value="' + escapeHtml(item.unit || '期') + '"></label>' +
      '<label>类型<input class="form-input" name="typeName" value="' + escapeHtml(item.typeName || (item.courseLevelCode ? courseLevelLabel('', item.courseLevelCode) : '')) + '"></label>' +
      '<label>班型<input class="form-input" name="classTypeName" value="' + escapeHtml(item.classTypeName || (item.classTypeCode ? classTypeLabel('', item.classTypeCode) : '')) + '"></label>' +
      '<label>期段<input class="form-input" name="termName" value="' + escapeHtml(item.termName || (item.termCode ? termLabel('', item.termCode) : '')) + '"></label>' +
      '<label>年份<input class="form-input" name="year" value="' + escapeHtml(item.year || '') + '"></label>' +
      '<label>按期收费<input class="form-input" name="termFeeText" value="' + escapeHtml(priceRules.termFeeText || '') + '"></label>' +
      '<label>默认扣课<input class="form-input" name="defaultDeductUnits10" type="number" min="0" step="0.1" value="' + escapeHtml(lessonInputValue(item.defaultDeductUnits10, '1')) + '"></label>' +
      '<label>计划排课数<input class="form-input" name="plannedSessionCount" type="number" min="0" value="' + escapeHtml(item.plannedSessionCount || 0) + '"></label>' +
      '<label>容量<input class="form-input" name="capacity" type="number" min="0" value="' + escapeHtml(item.capacity || 0) + '"></label>' +
      '<label>按实际上课扣课<select class="form-input" name="dynamicDeduct"><option value="false">否</option><option value="true">是</option></select></label>' +
      '<label>状态<select class="form-input" name="status"><option value="active">启用</option><option value="inactive">停用</option></select></label>' +
      '<label class="wide">授权分店<select class="form-input" name="authorizedBranchIds" multiple size="3">' + branchOptions(item.authorizedBranchIds || []) + '</select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存课程</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openCourseModal = function (item) {
    renderEduModal(idOf(item) ? "编辑课程" : "新增课程", courseFormHtml(item));
    setSelectValue("teachingMode", item && item.teachingMode || "group");
    setSelectValue("billingMode", item && item.billingMode || "lesson");
    setSelectValue("status", item && item.status || "active");
    setSelectValue("dynamicDeduct", item && item.dynamicDeduct ? "true" : "false");
  };

  var packageFormHtml = function (item) {
    item = item || {};
    return '<form class="edu-form" id="edu-package-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>规格名称<input class="form-input" name="name" value="' + escapeHtml(item.name || '') + '" required></label>' +
      '<label>关联课程<select class="form-input" name="courseProductId">' + courseOptions(item.courseProductId) + '</select></label>' +
      '<label>课时<input class="form-input" name="lessonUnits10" type="number" min="0.1" step="0.1" value="' + escapeHtml(lessonInputValue(item.lessonUnits10, '10')) + '" required></label>' +
      '<label>有效天数<input class="form-input" name="validDays" type="number" min="0" value="' + escapeHtml(item.validDays || 365) + '"></label>' +
      '<label>默认价格(分)<input class="form-input" name="defaultPriceCents" type="number" min="0" value="' + escapeHtml(item.defaultPriceCents || 0) + '"></label>' +
      '<label>默认扣课<input class="form-input" name="deductUnits10" type="number" min="0.1" step="0.1" value="' + escapeHtml(lessonInputValue(item.deductUnits10, '1')) + '"></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存规格</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openPackageModal = function (item) {
    renderEduModal(idOf(item) ? "编辑收费/课时规格" : "新增收费/课时规格", packageFormHtml(item));
  };

  var renderEduCourses = function () {
    eduPanelEl.innerHTML =
      eduFrameStart("课程管理", "课程定义教学商品、计费方式、授权分店和收费课时规格。") +
      eduActionBar("courses", "新增课程") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>课程</th><th>单价</th><th>类型/班型</th><th>期段/年份</th><th>课程类型</th><th>按期收费</th><th>按实际上课扣课</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.courses.length ? eduState.courses.map(function (course) {
          var rules = course.priceRules || {};
          return '<tr><td>' + rowCheck('courses', idOf(course)) + ' <strong>' + escapeHtml(course.name) + '</strong><br><span class="muted">' + escapeHtml(course.unit || '-') + '</span></td><td>' + escapeHtml(moneyText(course.standardPriceCents)) + '</td><td>' + escapeHtml(courseLevelLabel(course.typeName, course.courseLevelCode)) + '<br><span class="muted">' + escapeHtml(classTypeLabel(course.classTypeName, course.classTypeCode)) + '</span></td><td>' + escapeHtml(termLabel(course.termName, course.termCode)) + '<br><span class="muted">' + escapeHtml(course.year || '-') + '</span></td><td>' + escapeHtml(teachingModeLabel(course.teachingMode)) + '</td><td>' + escapeHtml(rules.termFeeText || '-') + '</td><td>' + badgeHtml(course.dynamicDeduct ? '是' : '否', course.dynamicDeduct ? 'pending' : 'none') + '</td><td>' + badgeHtml(courseStatusLabel(course.status || 'active'), course.status || 'active') + '</td><td><button class="club-action" data-edit-course="' + escapeHtml(idOf(course)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="9">暂无课程</td></tr>') +
      '</tbody></table></div>' +
      eduActionBar("packageTemplates", "新增收费/课时规格") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>规格</th><th>课程</th><th>课时</th><th>有效天数</th><th>默认价格</th><th>默认扣课</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.packageTemplates.length ? eduState.packageTemplates.map(function (tpl) {
          return '<tr><td>' + rowCheck('packageTemplates', idOf(tpl)) + ' <strong>' + escapeHtml(tpl.name) + '</strong></td><td>' + escapeHtml(courseName(tpl.courseProductId)) + '</td><td>' + escapeHtml(lessonText(tpl.lessonUnits10)) + '</td><td>' + (tpl.validDays || 0) + '</td><td>' + escapeHtml(moneyText(tpl.defaultPriceCents)) + '</td><td>' + escapeHtml(lessonText(tpl.deductUnits10)) + '</td><td>' + badgeHtml(courseStatusLabel(tpl.status || 'active'), tpl.status || 'active') + '</td><td><button class="club-action" data-edit-package-template="' + escapeHtml(idOf(tpl)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="8">暂无收费/课时规格</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var walletExpired = function (wallet) {
    if (!wallet || !wallet.expireAt) return false;
    var end = new Date(wallet.expireAt);
    if (Number.isNaN(end.getTime())) return false;
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  };

  var walletsForStudent = function (studentId) {
    return (eduState.wallets || []).filter(function (wallet) {
      return String(wallet.studentId || "") === String(studentId || "");
    });
  };

  var walletUsable = function (wallet) {
    return wallet && wallet.status === "active" && !walletExpired(wallet) && Number(wallet.remainingUnits10 || 0) > 0;
  };

  var walletStatusHtml = function (wallet) {
    if (walletExpired(wallet)) return badgeHtml("已过期", "expired");
    if (wallet.status === "active" && Number(wallet.remainingUnits10 || 0) <= 0) return badgeHtml("余额 0", "pending");
    return badgeHtml(walletStatusLabel(wallet.status || "active"), wallet.status || "active");
  };

  var studentWalletSummary = function (studentId) {
    var wallets = walletsForStudent(studentId);
    var usable = wallets.filter(walletUsable);
    var remainingUnits10 = usable.reduce(function (sum, wallet) {
      return sum + Number(wallet.remainingUnits10 || 0);
    }, 0);
    var nearest = usable.map(function (wallet) {
      return wallet.expireAt ? new Date(wallet.expireAt) : null;
    }).filter(function (date) {
      return date && !Number.isNaN(date.getTime());
    }).sort(function (a, b) {
      return a.getTime() - b.getTime();
    })[0];
    return {
      total: wallets.length,
      usable: usable.length,
      remainingUnits10: remainingUnits10,
      nearestExpireAt: nearest ? nearest.toISOString() : ""
    };
  };

  var studentFormHtml = function (editItem) {
    var item = editItem || {};
    return '<form class="edu-form" id="edu-student-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>姓名<input class="form-input" name="name" value="' + escapeHtml(item.name || '') + '" required></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions(item.branchId) + '</select></label>' +
      '<label>手机号<input class="form-input" name="phone" value="' + escapeHtml(item.phone || '') + '"></label>' +
      '<label>家长<input class="form-input" name="parentName" value="' + escapeHtml(item.parentName || '') + '"></label>' +
      '<label>水平<select class="form-input" name="level">' + studentLevelOptions(item.level || '') + '</select></label>' +
      '<label>状态<select class="form-input" name="status"><option value="active">在读</option><option value="inactive">停用</option><option value="archived">归档</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存学员</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openStudentModal = function (item) {
    renderEduModal(idOf(item) ? "编辑学员" : "新增学员", studentFormHtml(item));
    setSelectValue("status", item && item.status || "active");
  };

  var studentBindQrHtml = function (student, state) {
    state = state || {};
    var apiStudent = state.student || {};
    var displayName = apiStudent.name || student.name || "-";
    var phone = apiStudent.phoneMasked || student.phoneMasked || student.phone || "";
    var boundText = apiStudent.boundLabel || (student.openid ? "已绑定微信" : "未绑定微信");
    var body = "";
    if (state.loading) {
      body = '<div class="empty-state compact">正在生成绑定二维码...</div>';
    } else if (state.error) {
      body = '<div class="edu-warning">' + escapeHtml(state.error) + '</div>';
    } else if (state.qrcodeUrl) {
      body = '<div class="edu-student-bind-qr">' +
        '<img src="' + escapeHtml(state.qrcodeUrl) + '" alt="学员微信绑定二维码">' +
        '<div class="club-actions">' +
          '<a class="club-action" href="' + escapeHtml(state.qrcodeUrl) + '" target="_blank" rel="noreferrer">打开二维码图片</a>' +
        '</div>' +
      '</div>';
    }
    return '<div class="edu-student-bind">' +
      '<div class="edu-student-bind-card">' +
        '<strong>' + escapeHtml(displayName) + '</strong>' +
        '<span>' + escapeHtml(phone || '-') + ' · ' + escapeHtml(boundText) + '</span>' +
      '</div>' +
      '<div class="edu-student-bind-env"><span>正式版小程序绑定二维码</span></div>' +
      body +
      '<p class="edu-note">二维码 7 天内有效。二维码只包含短 token，不直接写入学员姓名或手机号；家长扫码后在小程序填写昵称和手机号，完成 TT AI 注册并绑定学员。</p>' +
    '</div>';
  };

  var openStudentBindQr = function (student) {
    if (!student || !idOf(student)) return;
    renderEduModal("学员微信绑定二维码", studentBindQrHtml(student, { loading: true }));
    clubData.eduStudentBindQrcode(selectedClubId, idOf(student), {
      envVersion: "release"
    }).then(function (data) {
      renderEduModal("学员微信绑定二维码", studentBindQrHtml(student, data || {}));
    }).catch(function (err) {
      renderEduModal("学员微信绑定二维码", studentBindQrHtml(student, {
        error: clubData.errorMessage ? clubData.errorMessage(err) : ((err && err.message) || "二维码生成失败")
      }));
    });
  };

  var walletFormHtml = function () {
    return '<form class="edu-form" id="edu-wallet-form">' +
      '<label>学员<select class="form-input" name="studentId" required>' + studentOptions() + '</select></label>' +
      '<label>收费/课时规格<select class="form-input" name="packageTemplateId">' + packageOptions() + '</select></label>' +
      '<label>课时<input class="form-input" name="totalUnits10" type="number" min="0.1" step="0.1" value="10" required></label>' +
      '<label>实收金额(分)<input class="form-input" name="amountCents" type="number" min="0" value="0"></label>' +
      '<label>有效期至<input class="form-input" name="expireAt" type="date"></label>' +
      '<label class="wide">收款备注<input class="form-input" name="paymentRemark" placeholder="微信转账/现金/团购核销等"></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">确认入账</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var renderEduStudents = function () {
    eduPanelEl.innerHTML =
      eduFrameStart("学员管理", "维护学员档案、剩余课时、报读开课和已购课程明细。") +
      eduActionBar("students", "新增学员", '<div class="club-actions"><button class="club-action primary" type="button" data-edu-create="wallets">报读/开课入账</button></div>') +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>学员</th><th>分店</th><th>手机号</th><th>家长</th><th>水平</th><th>剩余课时</th><th>最近到期</th><th>微信绑定</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.students.length ? eduState.students.map(function (student) {
          var summary = studentWalletSummary(idOf(student));
          var balanceType = summary.remainingUnits10 > 10 ? "ok" : (summary.remainingUnits10 > 0 ? "pending" : "none");
          return '<tr><td>' + rowCheck('students', idOf(student)) + ' <strong>' + escapeHtml(student.name) + '</strong><br><span class="muted">' + escapeHtml(student.source || '-') + '</span></td><td>' + escapeHtml(branchName(student.branchId)) + '</td><td>' + escapeHtml(student.phone || '-') + '</td><td>' + escapeHtml(student.parentName || '-') + '</td><td>' + escapeHtml(studentLevelLabel(student.level)) + '</td><td>' + badgeHtml(lessonText(summary.remainingUnits10), balanceType) + '</td><td>' + escapeHtml(dateText(summary.nearestExpireAt)) + '</td><td>' + studentWechatBindHtml(student) + '</td><td>' + badgeHtml(studentStatusLabel(student.status || 'active'), student.status || 'active') + '</td><td><button class="club-action" data-edit-student="' + escapeHtml(idOf(student)) + '">编辑</button><button class="club-action primary" data-bind-student="' + escapeHtml(idOf(student)) + '">绑定微信</button></td></tr>';
        }).join("") : '<tr><td colspan="10">暂无学员</td></tr>') +
      '</tbody></table></div>' +
      eduActionBar("wallets", "", "") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>学员</th><th>已购课程</th><th>课程</th><th>分店</th><th>总课时</th><th>剩余</th><th>有效期</th><th>状态</th></tr></thead><tbody>' +
        (eduState.wallets.length ? eduState.wallets.map(function (wallet) {
          return '<tr><td><strong>' + escapeHtml(studentName(wallet.studentId)) + '</strong></td><td>' + escapeHtml(packageName(wallet.packageTemplateId)) + '</td><td>' + escapeHtml(courseName(wallet.courseProductId)) + '</td><td>' + escapeHtml(branchName(wallet.branchId)) + '</td><td>' + escapeHtml(lessonText(wallet.totalUnits10)) + '</td><td><strong>' + escapeHtml(lessonText(wallet.remainingUnits10)) + '</strong></td><td>' + escapeHtml(dateText(wallet.expireAt)) + '</td><td>' + walletStatusHtml(wallet) + '</td></tr>';
        }).join("") : '<tr><td colspan="8">暂无已购课程</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var classFormHtml = function (editItem) {
    var item = editItem || {};
    return '<form class="edu-form" id="edu-class-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>班级名称<input class="form-input" name="className" value="' + escapeHtml(item.className || '') + '" required></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions(item.branchId) + '</select></label>' +
      '<label>课程<select class="form-input" name="courseProductId" required>' + courseOptions(item.courseProductId) + '</select></label>' +
      '<label>任课教练<select class="form-input" name="teacherId">' + teacherOptions(item.teacherId) + '</select></label>' +
      '<label>容量<input class="form-input" name="capacity" type="number" min="0" value="' + escapeHtml(item.capacity || 0) + '"></label>' +
      '<label>计划课次<input class="form-input" name="plannedSessionCount" type="number" min="0" value="' + escapeHtml(item.plannedSessionCount || 0) + '"></label>' +
      '<label>默认场地<input class="form-input" name="defaultRoomId" value="' + escapeHtml(item.defaultRoomId || '') + '"></label>' +
      '<label>默认球台<input class="form-input" name="defaultTableNos" value="' + escapeHtml((item.defaultTableNos || []).join(',')) + '" placeholder="1,2"></label>' +
      '<label>状态<select class="form-input" name="status"><option value="active">启用</option><option value="inactive">停用</option><option value="graduated">结业</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存班级</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openClassModal = function (item) {
    renderEduModal(idOf(item) ? "编辑班级" : "新增班级", classFormHtml(item));
    setSelectValue("status", item && item.status || "active");
  };

  var renderEduClasses = function () {
    eduPanelEl.innerHTML =
      eduFrameStart("班级管理", "班级是长期教学组织，关联课程、教练、容量和默认资源。") +
      eduActionBar("classes", "新增班级") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班级</th><th>分店</th><th>课程</th><th>教练</th><th>容量</th><th>计划</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.classes.length ? eduState.classes.map(function (klass) {
          return '<tr><td>' + rowCheck('classes', idOf(klass)) + ' <strong>' + escapeHtml(klass.className) + '</strong><br><span class="muted">' + escapeHtml(graduationStatusLabel(klass.graduationStatus)) + '</span></td><td>' + escapeHtml(branchName(klass.branchId)) + '</td><td>' + escapeHtml(klass.courseNameSnapshot || courseName(klass.courseProductId)) + '</td><td>' + escapeHtml(klass.teacherName || teacherName(klass.teacherId)) + '</td><td>' + (klass.capacity || 0) + '</td><td>' + (klass.plannedSessionCount || 0) + '</td><td>' + badgeHtml(classStatusLabel(klass.status || 'active'), klass.status || 'active') + '</td><td><button class="club-action" data-edit-class="' + escapeHtml(idOf(klass)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="8">暂无班级</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var staffFormHtml = function (editItem) {
    var item = editItem || {};
    return '<form class="edu-form" id="edu-staff-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>姓名<input class="form-input" name="name" value="' + escapeHtml(item.name || '') + '" required></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions(item.branchId) + '</select></label>' +
      '<label>手机号<input class="form-input" name="phone" value="' + escapeHtml(item.phone || '') + '"></label>' +
      '<label>状态<select class="form-input" name="employmentStatus"><option value="active">在职</option><option value="inactive">停用</option><option value="left">离职</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存教练</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openStaffModal = function (item) {
    renderEduModal(idOf(item) ? "编辑教练" : "新增教练", staffFormHtml(item));
    setSelectValue("employmentStatus", item && item.employmentStatus || "active");
  };

  var renderEduTeachers = function () {
    if (!canManageTeachers()) {
      eduState.activeTab = "courses";
      syncEduTabsAccess();
      return renderEduCourses();
    }
    eduPanelEl.innerHTML =
      eduFrameStart("教练管理", "维护教练档案；排课和教练可排时间管理都会引用这里的数据。") +
      eduActionBar("teachers", "新增教练") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>教练</th><th>分店</th><th>手机号</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.staff.length ? eduState.staff.map(function (item) {
          return '<tr><td>' + rowCheck('teachers', idOf(item)) + ' <strong>' + escapeHtml(item.name) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(item.phone || '-') + '</td><td>' + escapeHtml(staffRolesText(item.roles)) + '</td><td>' + badgeHtml(employmentStatusLabel(item.employmentStatus), item.employmentStatus) + '</td><td><button class="club-action" data-edit-staff="' + escapeHtml(idOf(item)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="6">暂无教练</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var availabilityFormHtml = function () {
    return '<form class="edu-form" id="edu-availability-form">' +
      '<label>教练<select class="form-input" name="teacherId" required>' + teacherOptions() + '</select></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions() + '</select></label>' +
      '<label>指定日期<input class="form-input" name="date" type="date"></label>' +
      '<label>课程<select class="form-input" name="courseProductId">' + bookingCourseOptions() + '</select></label>' +
      '<label>容量<select class="form-input" name="capacity"><option value="1">一对一</option><option value="2">一对二</option><option value="3">一对三</option><option value="4">一对四</option></select></label>' +
      '<label>座位/球台<select class="form-input" name="resourceId">' + resourceOptions() + '</select></label>' +
      '<label>开始<input class="form-input" name="startTime" type="time" required></label>' +
      '<label>结束<input class="form-input" name="endTime" type="time" required></label>' +
      '<label>每格时长<input class="form-input" name="slotDurationMinutes" type="number" min="15" step="15" value="60"></label>' +
      '<label>保存状态<select class="form-input" name="status"><option value="draft">保存草稿</option><option value="published">直接发布</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存可约时间</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var availabilityMatrixSummaryHtml = function (slots, bookings, range) {
    var availabilityIds = {};
    slots.forEach(function (slot) {
      if (slot.id) availabilityIds[slot.id] = slot.status;
    });
    var availabilityRows = Object.keys(availabilityIds).map(function (id) { return availabilityIds[id]; });
    var count = function (list, status) {
      return list.filter(function (item) { return String(item.status || item) === status; }).length;
    };
    var title = range.mode === "day"
      ? range.focusDate + " 按日"
      : range.startDate + " 至 " + range.endDate + " 按周";
    return '<div class="edu-booking-summary">' +
      '<div><strong>' + escapeHtml(title) + '</strong><span>时间 × 教练矩阵，发布后学员才能在小程序选择空位。</span></div>' +
      '<div class="edu-booking-kpis">' +
        '<span>草稿 ' + count(availabilityRows, "draft") + '</span>' +
        '<span>已发布 ' + count(availabilityRows, "published") + '</span>' +
        '<span>暂停 ' + count(availabilityRows, "paused") + '</span>' +
        '<span>待确认 ' + count(bookings, "requested") + '</span>' +
        '<span>已确认 ' + count(bookings, "confirmed") + '</span>' +
      '</div>' +
    '</div>';
  };

  var availabilitySlotCardHtml = function (slot) {
    var item = slot.availability || {};
    var canPublish = slot.status === "draft" && slot.id;
    var canPause = slot.status === "published" && slot.id;
    var actionHtml = '';
    if (canPublish) actionHtml += '<button class="club-action mini" type="button" data-booking-publish-availability="' + escapeHtml(slot.id) + '">发布</button>';
    if (canPause) actionHtml += '<button class="club-action mini" type="button" data-booking-pause-availability="' + escapeHtml(slot.id) + '">暂停</button>';
    return '<div class="edu-booking-chip availability ' + escapeHtml(slot.status) + '">' +
      '<div class="edu-booking-chip-head">' +
        '<strong>' + escapeHtml(availabilityStatusLabel(slot.status)) + '</strong>' +
        '<span>' + escapeHtml(slot.startTime + '-' + slot.endTime) + '</span>' +
      '</div>' +
      '<div class="edu-booking-chip-line">' + escapeHtml((slot.courseProductId ? slot.courseName : "不限课程") + ' · ' + capacityLabel(slot.capacity)) + '</div>' +
      '<div class="edu-booking-chip-line">' + escapeHtml(branchName(slot.branchId)) + (slot.resourceLabel ? ' · ' + escapeHtml(slot.resourceLabel) : '') + '</div>' +
      (item.publishedAt ? '<div class="edu-booking-chip-line muted">发布 ' + escapeHtml(formatCST(item.publishedAt)) + '</div>' : '') +
      (actionHtml ? '<div class="edu-booking-chip-actions">' + actionHtml + '</div>' : '') +
    '</div>';
  };

  var bookingCardStudentText = function (booking) {
    return booking.studentNameSnapshot || booking.studentName || booking.name || (booking.student && booking.student.name) || "学员";
  };

  var bookingMatrixCardHtml = function (booking) {
    var id = idOf(booking);
    var actionable = ["requested", "alternative_proposed"].indexOf(String(booking.status || "")) >= 0;
    var actionHtml = actionable
      ? '<div class="edu-booking-chip-actions">' +
          '<button class="club-action mini primary" type="button" data-booking-action="confirm" data-booking-id="' + escapeHtml(id) + '">确认</button>' +
          '<button class="club-action mini" type="button" data-booking-action="propose" data-booking-id="' + escapeHtml(id) + '">改期</button>' +
          '<button class="club-action mini danger" type="button" data-booking-action="reject" data-booking-id="' + escapeHtml(id) + '">拒绝</button>' +
        '</div>'
      : '';
    return '<div class="edu-booking-chip request ' + escapeHtml(booking.status || "requested") + '">' +
      '<div class="edu-booking-chip-head">' +
        '<strong>' + escapeHtml(bookingCardStudentText(booking)) + '</strong>' +
        '<span>' + escapeHtml(bookingStatusLabel(booking.status || "requested")) + '</span>' +
      '</div>' +
      '<div class="edu-booking-chip-line">' + escapeHtml((booking.courseName || courseName(booking.courseProductId) || "待确认课程") + ' · ' + (booking.teacherName || teacherName(booking.teacherId) || "待安排教练")) + '</div>' +
      '<div class="edu-booking-chip-line">' + escapeHtml(branchName(booking.branchId)) + (booking.resourceLabel ? ' · ' + escapeHtml(booking.resourceLabel) : '') + '</div>' +
      (booking.note ? '<div class="edu-booking-chip-line muted">' + escapeHtml(booking.note) + '</div>' : '') +
      actionHtml +
    '</div>';
  };

  var availabilityMatrixCellHtml = function (date, time, teacherId, slots, bookings) {
    var cellSlots = slots.filter(function (slot) {
      return slot.date === date && slot.startTime === time && String(slot.teacherId || "") === String(teacherId || "");
    });
    var cellBookings = bookings.filter(function (booking) {
      return bookingStartDateKey(booking) === date && bookingStartTimeKey(booking) === time && String(booking.teacherId || "") === String(teacherId || "");
    });
    var html = cellSlots.map(availabilitySlotCardHtml).join("") + cellBookings.map(bookingMatrixCardHtml).join("");
    return '<div class="edu-booking-cell ' + (html ? '' : 'empty') + '">' + (html || '<span>无安排</span>') + '</div>';
  };

  var availabilityMatrixHtml = function () {
    var range = availabilityMatrixRange();
    var slots = bookingAvailabilitySlots(range);
    var bookings = filteredBookingsForMatrix(range);
    var teachers = teacherRowsForAvailabilityMatrix(slots, bookings);
    var rows = availabilityMatrixTimeRows(range, slots, bookings);
    var draftIds = {};
    slots.forEach(function (slot) {
      if (slot.status === "draft" && slot.id) draftIds[slot.id] = true;
    });
    var gridStyle = 'grid-template-columns: minmax(120px, 150px) repeat(' + Math.max(teachers.length, 1) + ', minmax(190px, 1fr));';
    var board = !teachers.length || !rows.length
      ? '<div class="empty-state compact">当前范围暂无可约时间或约课申请。</div>'
      : '<div class="edu-booking-board" style="' + gridStyle + '">' +
          '<div class="edu-booking-head axis">时间</div>' +
          teachers.map(function (teacher) {
            return '<div class="edu-booking-head">' + escapeHtml(teacher.name || '-') + '<span>' + escapeHtml(branchName(teacher.branchId)) + '</span></div>';
          }).join("") +
          rows.map(function (row) {
            return '<div class="edu-booking-axis"><strong>' + escapeHtml(row.time) + '</strong><span>' + escapeHtml(row.dayLabel) + '</span></div>' +
              teachers.map(function (teacher) {
                return availabilityMatrixCellHtml(row.date, row.time, teacher.id, slots, bookings);
              }).join("");
          }).join("") +
        '</div>';
    return '<section class="edu-booking-matrix">' +
      availabilityMatrixSummaryHtml(slots, bookings, range) +
      '<div class="edu-list-toolbar">' +
        '<div class="club-actions">' +
          '<button class="club-action primary" type="button" data-booking-publish-range="' + escapeHtml(Object.keys(draftIds).join(",")) + '">发布当前草稿</button>' +
          '<button class="club-action" type="button" data-edu-create="availability">新增单条</button>' +
          '<button class="club-action" type="button" data-copy-booking-availability-week="1">复制上周放号</button>' +
        '</div>' +
      '</div>' +
      board +
    '</section>';
  };

  var renderEduAvailability = function () {
    return availabilityBulkHtml() +
      availabilityFilterHtml() +
      availabilityMatrixHtml() +
      '<details class="edu-detail-drawer">' +
        '<summary>高级：查看原始明细</summary>' +
        '<div class="edu-list-toolbar"><div class="club-actions"><button class="club-action" type="button" data-edu-delete="availability">删除</button><button class="club-action" type="button" data-edu-export="availability">导出明细</button></div><span class="muted">用于核对提交人、审核人和原始记录，日常放号优先看上方矩阵。</span></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>教练</th><th>分店</th><th>日期/星期</th><th>开始时间</th><th>结束时间</th><th>状态</th><th>提交人</th><th>审核人</th><th>审核</th><th>操作</th></tr></thead><tbody>' +
        (filteredAvailability().length ? filteredAvailability().map(function (item) {
          var dateType = item.date ? "指定日期" : (item.weekday ? "每周重复" : "-");
          var actions = item.status === 'pending' ? '<button class="club-action primary" data-approve-availability="' + escapeHtml(idOf(item)) + '">通过</button><button class="club-action" data-reject-availability="' + escapeHtml(idOf(item)) + '">拒绝</button>' : '-';
          var day = item.date ? weekdayText(new Date(item.date + 'T00:00:00').getDay() || 7) : weekdayText(item.weekday);
          var dateTextValue = item.date ? (item.date + ' · ' + day) : (dateType + ' · ' + day);
          return '<tr><td>' + rowCheck('availability', idOf(item)) + ' <strong>' + escapeHtml(teacherName(item.teacherId)) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(dateTextValue) + '</td><td>' + escapeHtml(item.startTime || '-') + '</td><td>' + escapeHtml(item.endTime || '-') + '</td><td>' + badgeHtml(availabilityStatusLabel(item.status), item.status) + '</td><td>' + escapeHtml(availabilitySubmitterName(item)) + '</td><td>' + escapeHtml(availabilityReviewerName(item)) + '</td><td>' + actions + '</td><td>-</td></tr>';
        }).join("") : '<tr><td colspan="10">暂无可排时间</td></tr>') +
      '</tbody></table></div>' +
      '</details>';
  };

  var bookingRequesterText = function (booking) {
    var candidates = [booking.parentName, booking.guardianName, booking.userNickname, booking.nickname, booking.contactName, booking.phone];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = String(candidates[i] || "").trim();
      if (value && !isLikelyOpenid(value)) return value;
    }
    return "微信用户";
  };

  var bookingTimeText = function (booking) {
    var start = booking.preferredStartAt || booking.startAt || booking.proposedStartAt || "";
    var end = booking.preferredEndAt || booking.endAt || booking.proposedEndAt || "";
    if (!start) return "-";
    return formatCST(start) + (end ? " - " + timeOnlyText(end) : "");
  };

  var bookingUpdatedText = function (booking) {
    return booking && (booking.updatedAt || booking.createdAt) ? formatCST(booking.updatedAt || booking.createdAt) : "-";
  };

  var bookingCapacityText = function (booking) {
    if (booking.capacity) return capacityLabel(booking.capacity);
    var type = String(booking.bookingType || "");
    if (type === "one_on_two") return "一对二";
    if (type === "one_on_three") return "一对三";
    if (type === "one_on_four") return "一对四";
    return "一对一";
  };

  var bookingConfirmRows = function () {
    return (eduState.bookings || []).slice().sort(function (a, b) {
      var au = String(a.updatedAt || a.createdAt || a.preferredStartAt || a.startAt || "");
      var bu = String(b.updatedAt || b.createdAt || b.preferredStartAt || b.startAt || "");
      if (au !== bu) return bu.localeCompare(au);
      return String(a.preferredStartAt || a.startAt || "").localeCompare(String(b.preferredStartAt || b.startAt || ""));
    });
  };

  var bookingConfirmSummaryHtml = function (rows) {
    var count = function (status) {
      return rows.filter(function (item) { return String(item.status || "requested") === status; }).length;
    };
    return '<div class="edu-booking-summary">' +
      '<div><strong>约课确认</strong><span>处理学员从小程序提交的约课申请。</span></div>' +
      '<div class="edu-booking-kpis">' +
        '<span>待确认 ' + count("requested") + '</span>' +
        '<span>改期中 ' + count("alternative_proposed") + '</span>' +
        '<span>改期申请 ' + count("change_requested") + '</span>' +
        '<span>已确认 ' + count("confirmed") + '</span>' +
        '<span>已拒绝 ' + count("rejected") + '</span>' +
      '</div>' +
    '</div>';
  };

  var bookingConfirmActionHtml = function (booking) {
    var id = idOf(booking);
    var status = String(booking.status || "requested");
    if (status === "change_requested") {
      return '<button class="club-action primary" type="button" data-booking-action="confirm" data-booking-id="' + escapeHtml(id) + '">接受改期</button>' +
        '<button class="club-action danger" type="button" data-booking-action="reject" data-booking-id="' + escapeHtml(id) + '">拒绝改期</button>';
    }
    if (["requested", "alternative_proposed"].indexOf(status) < 0) return "-";
    return '<button class="club-action primary" type="button" data-booking-action="confirm" data-booking-id="' + escapeHtml(id) + '">确认</button>' +
      '<button class="club-action" type="button" data-booking-action="propose" data-booking-id="' + escapeHtml(id) + '">改期</button>' +
      '<button class="club-action danger" type="button" data-booking-action="reject" data-booking-id="' + escapeHtml(id) + '">拒绝</button>';
  };

  var renderEduBookingConfirmations = function () {
    var rows = bookingConfirmRows();
    return bookingConfirmSummaryHtml(rows) +
      '<div class="admin-table-wrap wide"><table class="admin-table"><thead><tr><th>学员</th><th>提交人</th><th>课程</th><th>教练</th><th>约课时间</th><th>分店/场地</th><th>类型</th><th>状态</th><th>更新时间</th><th>备注</th><th>操作</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (booking) {
          var place = branchName(booking.branchId) + (booking.resourceLabel ? ' / ' + booking.resourceLabel : '');
          return '<tr>' +
            '<td><strong>' + escapeHtml(bookingCardStudentText(booking)) + '</strong></td>' +
            '<td>' + escapeHtml(bookingRequesterText(booking)) + '</td>' +
            '<td>' + escapeHtml(booking.courseName || courseName(booking.courseProductId) || '-') + '</td>' +
            '<td>' + escapeHtml(booking.teacherName || teacherName(booking.teacherId) || '-') + '</td>' +
            '<td>' + escapeHtml(bookingTimeText(booking)) + '</td>' +
            '<td>' + escapeHtml(place) + '</td>' +
            '<td>' + escapeHtml(bookingCapacityText(booking)) + '</td>' +
            '<td>' + badgeHtml(bookingStatusLabel(booking.status || "requested"), booking.status || "requested") + '</td>' +
            '<td>' + escapeHtml(bookingUpdatedText(booking)) + '</td>' +
            '<td>' + escapeHtml(booking.note || booking.adminMessage || booking.rejectReason || '-') + '</td>' +
            '<td><div class="club-actions">' + bookingConfirmActionHtml(booking) + '</div></td>' +
          '</tr>';
        }).join("") : '<tr><td colspan="11">暂无约课申请</td></tr>') +
      '</tbody></table></div>';
  };

  var resourceFormHtml = function () {
    return '<form class="edu-form" id="edu-resource-form">' +
      '<label>资源名称<input class="form-input" name="name" required></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions() + '</select></label>' +
      '<label>类型<select class="form-input" name="type"><option value="table">球台</option><option value="room">场地</option></select></label>' +
      '<label>编号<input class="form-input" name="tableNo" placeholder="球台号"></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存资源</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var resourceListHtml = function () {
    return '<div class="admin-table-wrap compact"><table class="admin-table"><thead><tr><th>资源</th><th>分店</th><th>类型</th><th>编号</th><th>状态</th></tr></thead><tbody>' +
      (eduState.resources.length ? eduState.resources.map(function (item) {
        return '<tr><td><strong>' + escapeHtml(item.name) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(resourceTypeLabel(item.type)) + '</td><td>' + escapeHtml(item.tableNo || item.roomId || '-') + '</td><td>' + badgeHtml(resourceStatusLabel(item.status || 'active'), item.status || 'active') + '</td></tr>';
      }).join("") : '<tr><td colspan="5">暂无教学资源</td></tr>') +
    '</tbody></table></div>' +
    '<div class="club-actions"><button class="club-action" type="button" data-edu-modal-close="1">关闭</button></div>';
  };

  var sessionFormHtml = function (editItem) {
    var item = editItem || {};
    return '<form class="edu-form" id="edu-session-form">' +
      '<input type="hidden" name="id" value="' + escapeHtml(idOf(item)) + '">' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions(item.branchId) + '</select></label>' +
      '<label>班级<select class="form-input" name="classId">' + classOptions(item.classId) + '</select></label>' +
      '<label>课程<select class="form-input" name="courseProductId">' + courseOptions(item.courseProductId) + '</select></label>' +
      '<label>教练<select class="form-input" name="teacherId" required>' + teacherOptions(item.teacherId) + '</select></label>' +
      '<label>开始<input class="form-input" name="startAt" type="datetime-local" value="' + escapeHtml(formatDateTimeLocal(item.startAt)) + '" required></label>' +
      '<label>结束<input class="form-input" name="endAt" type="datetime-local" value="' + escapeHtml(formatDateTimeLocal(item.endAt)) + '" required></label>' +
      '<label>场地<input class="form-input" name="roomId" value="' + escapeHtml(item.roomId || '') + '"></label>' +
      '<label>球台<input class="form-input" name="tableNos" value="' + escapeHtml((item.tableNos || []).join(',')) + '" placeholder="1,2"></label>' +
      '<label>跳过冲突<select class="form-input" name="skipConflict"><option value="">不跳过</option><option value="1">管理员确认跳过</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存课次</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var renderEduSessions = function () {
    var active = eduState.scheduleTab || "sessions";
    if (active === "sessions" && ["list", "day", "week", "month"].indexOf(eduState.scheduleView || "day") < 0) {
      eduState.scheduleView = "day";
    }
    eduPanelEl.innerHTML =
      eduFrameStart("排课管理", "课表查看最终排课，放号排课发布可约时间，约课确认处理申请。") +
      eduScheduleTabs() +
      (active === "availability" ? renderEduAvailability() :
      active === "bookings" ? renderEduBookingConfirmations() :
      active === "exports" ? scheduleExportPanelHtml() :
      scheduleFilterHtml() +
      scheduleToolbarHtml() +
      scheduleViewSwitchHtml() +
      scheduleViewControlsHtml() +
      ((eduState.scheduleView || "day") === "list"
        ? '<div class="admin-table-wrap wide"><table class="admin-table"><thead><tr><th>班级</th><th>课程</th><th>班型</th><th>分店</th><th>教练</th><th>场地</th><th>上课时间</th><th>时长</th><th>状态</th><th>备注</th><th>学员</th><th>计费数量</th><th>操作</th></tr></thead><tbody>' +
          scheduleRowsHtml() +
        '</tbody></table></div>'
        : scheduleVisualHtml()));
    if (active === "sessions") {
      var sf = eduState.scheduleFilters || {};
      setFormValue("edu-schedule-filter-form", "range", sf.range || "all");
      setFormValue("edu-schedule-filter-form", "dayPart", sf.dayPart || "");
      setFormValue("edu-schedule-filter-form", "teachingMode", sf.teachingMode || "");
      setFormValue("edu-schedule-view-filter-form", "teacherId", sf.teacherId || "");
      setFormValue("edu-schedule-view-filter-form", "dayDate", sf.dayDate || todayDateValue());
      setFormValue("edu-schedule-view-filter-form", "weekValue", sf.weekValue || weekInputValue(new Date()));
      setFormValue("edu-schedule-view-filter-form", "monthValue", sf.monthValue || monthInputValue(new Date()));
    }
    if (active === "exports") {
      var exportForm = eduState.scheduleExportForm || {};
      setFormValue("schedule-export-form", "range", exportForm.range || "day");
      var exportSettings = eduState.scheduleExportSettings || {};
      setFormValue("schedule-export-settings-form", "enabled", exportSettings.enabled ? "true" : "false");
      setFormValue("schedule-export-settings-form", "range", exportSettings.range || "day");
    }
    if (active === "availability") {
      var af = eduState.availabilityFilters || {};
      setFormValue("edu-availability-filter-form", "matrixRange", af.matrixRange || "week");
      setFormValue("edu-availability-filter-form", "matrixDate", af.matrixDate || todayDateValue());
      setFormValue("edu-availability-filter-form", "status", af.status || "");
      setFormValue("edu-availability-filter-form", "weekday", af.weekday || "");
    }
    bindEduPanelEvents();
  };

  var attendanceSessionRows = function () {
    return (eduState.sessions || []).filter(canAttendanceSession).sort(function (a, b) {
      return new Date(a.startAt || 0).getTime() - new Date(b.startAt || 0).getTime();
    });
  };

  var defaultAttendanceSessionId = function () {
    var rows = attendanceSessionRows();
    var pending = rows.find(function (session) { return String(session.status || "") === "pending_attendance"; });
    return idOf(pending || rows[0] || {});
  };

  var attendanceSessionOptions = function (selected) {
    var rows = attendanceSessionRows();
    if (!rows.length) return '<option value="">暂无可点名课次</option>';
    return rows.map(function (session) {
      var id = idOf(session);
      var label = formatCST(session.startAt) + ' · ' + sessionTitle(session) + ' · ' + sessionStatusLabel(session.status);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  };

  var walletOptionLabel = function (wallet) {
    var template = findById(eduState.packageTemplates, wallet && wallet.packageTemplateId) || {};
    var course = courseName(wallet && (wallet.courseProductId || template.courseProductId));
    return packageName(wallet && wallet.packageTemplateId) + (course && course !== "-" ? ' · ' + course : '') + ' · 剩余 ' + lessonText(wallet && wallet.remainingUnits10);
  };

  var walletOptionsForAttendance = function (wallets, selected) {
    var rows = (wallets || []).filter(walletUsable);
    if (!rows.length) return '<option value="">无可用课包</option>';
    return '<option value="">未选择课包</option>' + rows.map(function (wallet) {
      var id = idOf(wallet);
      return '<option value="' + escapeHtml(id) + '"' + (String(id) === String(selected || "") ? ' selected' : '') + '>' + escapeHtml(walletOptionLabel(wallet)) + '</option>';
    }).join('');
  };

  var defaultWalletIdForAttendance = function (row) {
    var preferred = row && row.attendance && row.attendance.walletId || row && row.roster && row.roster.walletId || "";
    var rows = ((row && row.wallets) || walletsForStudent(row && row.studentId)).filter(walletUsable);
    if (preferred && rows.some(function (wallet) { return String(idOf(wallet)) === String(preferred); })) return preferred;
    return idOf(rows[0] || {});
  };

  var attendanceRosterTableHtml = function () {
    var data = eduState.attendanceData;
    if (!eduState.attendanceSessionId) return '<div class="empty-state compact full">暂无可点名课次</div>';
    if (!data) return '<div class="empty-state compact full">正在加载课次名单...</div>';
    var roster = data.roster || [];
    if (!roster.length) return '<div class="empty-state compact full">此课次暂无名单，请先维护课次学员名单后再点名。</div>';
    var session = data.session || sessionById(eduState.attendanceSessionId) || {};
    var course = sessionCourse(session);
    return '<div class="admin-table-wrap wide full"><table class="admin-table"><thead><tr><th>学员</th><th>分店</th><th>状态</th><th>课包</th><th>扣课课时</th><th>课堂备注</th><th>已有记录</th></tr></thead><tbody>' +
      roster.map(function (row) {
        var student = row.student || findById(eduState.students, row.studentId) || {};
        var studentId = row.studentId || idOf(student);
        var existing = row.attendance && row.attendance.status && row.attendance.status !== "revoked" ? row.attendance : null;
        var selectedWalletId = defaultWalletIdForAttendance(row);
        var defaultDeductUnits10 = existing && existing.deductUnits10 || row.roster && row.roster.expectedDeductUnits10 || session.deductUnits10 || course.defaultDeductUnits10 || 10;
        var status = existing && existing.status || row.roster && ["leave", "absent"].indexOf(row.roster.status) >= 0 && row.roster.status || "attended";
        var note = existing && existing.coachNote || row.roster && row.roster.notes || "";
        var disabled = existing ? " disabled" : "";
        return '<tr data-attendance-student="' + escapeHtml(studentId) + '"' + (existing ? ' data-attendance-done="1"' : '') + '>' +
          '<td><strong>' + escapeHtml(student.name || studentName(studentId)) + '</strong><br><span class="muted">' + escapeHtml(student.phone || student.studentNo || '-') + '</span></td>' +
          '<td>' + escapeHtml(branchName(student.branchId || row.roster && row.roster.branchId || session.branchId)) + '</td>' +
          '<td><select class="form-input" data-attendance-field="status"' + disabled + '><option value="attended"' + (status === "attended" ? " selected" : "") + '>出勤扣课</option><option value="leave"' + (status === "leave" ? " selected" : "") + '>请假</option><option value="absent"' + (status === "absent" ? " selected" : "") + '>缺席</option></select></td>' +
          '<td><select class="form-input" data-attendance-field="walletId"' + disabled + '>' + walletOptionsForAttendance(row.wallets || walletsForStudent(studentId), selectedWalletId) + '</select></td>' +
          '<td><input class="form-input" data-attendance-field="deductUnits10" type="number" min="0" step="0.1" value="' + escapeHtml(lessonInputValue(defaultDeductUnits10, '1')) + '"' + disabled + '></td>' +
          '<td><input class="form-input" data-attendance-field="coachNote" value="' + escapeHtml(note) + '"' + disabled + '></td>' +
          '<td>' + (existing ? badgeHtml(attendanceStatusLabel(existing.status), existing.status) : '<span class="muted">待点名</span>') + '</td>' +
        '</tr>';
      }).join('') +
    '</tbody></table></div>';
  };

  var attendanceFormHtml = function () {
    var sessionId = eduState.attendanceSessionId || defaultAttendanceSessionId();
    eduState.attendanceSessionId = sessionId || "";
    return '<form class="edu-form" id="edu-attendance-form">' +
      '<label class="full">课次<select class="form-input" name="sessionId" id="edu-attendance-session" required>' + attendanceSessionOptions(sessionId) + '</select></label>' +
      attendanceRosterTableHtml() +
      '<div class="club-actions full"><button class="club-action primary" type="submit"' + (sessionId ? '' : ' disabled') + '>批量确认点名</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var renderEduAttendance = function () {
    eduPanelEl.innerHTML =
      eduFrameStart("点名/课时账本", "出勤扣课生成流水；撤销会返还课时，请假/缺席不扣课。") +
      eduActionBar("ledgers", "", '<div class="club-actions"><button class="club-action primary" type="button" data-edu-create="attendance">按课次点名</button></div>') +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>时间</th><th>类型</th><th>学员</th><th>课包</th><th>变动</th><th>余额</th><th>原因</th><th>操作</th></tr></thead><tbody>' +
        (eduState.ledgers.length ? eduState.ledgers.map(function (ledger) {
          var canRevoke = ledger.type === 'attendance' && ledger.relatedAttendanceId;
          return '<tr><td>' + escapeHtml(formatCST(ledger.createdAt)) + '</td><td>' + badgeHtml(ledgerTypeLabel(ledger.type), ledger.type) + '</td><td><strong>' + escapeHtml(studentName(ledger.studentId)) + '</strong></td><td><span class="muted">' + escapeHtml(walletName(ledger.walletId)) + '</span></td><td><strong>' + escapeHtml(lessonText(ledger.unitsDelta10)) + '</strong></td><td>' + escapeHtml(lessonText(ledger.balanceAfter10)) + '</td><td>' + escapeHtml(ledgerReasonLabel(ledger.reason)) + '</td><td>' + (canRevoke ? '<button class="club-action" data-revoke-attendance="' + escapeHtml(ledger.relatedAttendanceId) + '">撤销</button>' : '-') + '</td></tr>';
        }).join("") : '<tr><td colspan="8">暂无账本流水</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var walletBranchId = function (wallet) {
    var student = findById(eduState.students, wallet && wallet.studentId);
    return wallet && wallet.branchId || student && student.branchId || "";
  };

  var walletAmountCents = function (wallet) {
    var template = findById(eduState.packageTemplates, wallet && wallet.packageTemplateId) || {};
    return Number(wallet && (wallet.amountCents || wallet.paidAmountCents || wallet.defaultPriceCents) || template.defaultPriceCents || 0);
  };

  var walletCourseName = function (walletId) {
    var wallet = findById(eduState.wallets, walletId);
    if (!wallet) return "";
    var template = findById(eduState.packageTemplates, wallet.packageTemplateId) || {};
    return courseName(wallet.courseProductId || template.courseProductId);
  };

  var walletName = function (walletId) {
    if (!walletId) return "未选择课包";
    var wallet = findById(eduState.wallets, walletId);
    if (!wallet) return "已删除课包";
    var label = packageName(wallet.packageTemplateId);
    var course = walletCourseName(walletId);
    return course && course !== "-" ? label + " · " + course : label;
  };

  var sessionById = function (sessionId) {
    return findById(eduState.sessions, sessionId);
  };

  var sessionCourseName = function (sessionId) {
    var session = sessionById(sessionId);
    if (!session) return "";
    return session.courseNameSnapshot || courseName(session.courseProductId || (sessionClass(session).courseProductId));
  };

  var sessionClassName = function (sessionId) {
    var session = sessionById(sessionId);
    if (!session) return "";
    return session.classNameSnapshot || className(session.classId);
  };

  var sessionTeacherName = function (sessionId) {
    var session = sessionById(sessionId);
    if (!session) return "";
    return session.teacherName || teacherName(session.teacherId);
  };

  var sessionDurationText = function (sessionId) {
    var session = sessionById(sessionId);
    if (!session) return "";
    return durationText(session.startAt, session.endAt);
  };

  var feeReportRows = function () {
    var filters = currentReportFilters();
    var groupBy = filters.groupBy || "branch";
    var groups = {};
    (eduState.wallets || []).filter(function (wallet) {
      var text = [packageName(wallet.packageTemplateId), studentName(wallet.studentId)].join(" ").toLowerCase();
      return branchInReportScope(walletBranchId(wallet)) &&
        dateInReportRange(wallet.createdAt || wallet.purchaseAt || wallet.startAt) &&
        (!filters.courseKeyword || text.indexOf(String(filters.courseKeyword).toLowerCase()) >= 0);
    }).forEach(function (wallet) {
      var template = findById(eduState.packageTemplates, wallet.packageTemplateId) || {};
      var course = findById(eduState.courses, template.courseProductId) || {};
      var key = walletBranchId(wallet);
      var name = branchName(key);
      if (groupBy === "course") {
        key = template.courseProductId || wallet.packageTemplateId || "unknown";
        name = course.name || packageName(wallet.packageTemplateId);
      } else if (groupBy === "term") {
        key = termLabel(course.termName, course.termCode);
        name = key;
      } else if (groupBy === "type") {
        key = courseLevelLabel(course.typeName, course.courseLevelCode);
        name = key;
      } else if (groupBy === "classType") {
        key = classTypeLabel(course.classTypeName, course.classTypeCode);
        name = key;
      } else if (groupBy === "year") {
        key = course.year || "-";
        name = key;
      }
      if (!groups[key]) {
        groups[key] = { groupName: name, chargeCount: 0, paidCents: 0, walletCents: 0, refundCount: 0, refundCents: 0, transferCount: 0, transferCents: 0, totalUnits10: 0 };
      }
      groups[key].chargeCount += 1;
      groups[key].paidCents += walletAmountCents(wallet);
      groups[key].totalUnits10 += Number(wallet.totalUnits10 || 0);
    });
    return Object.keys(groups).map(function (key) {
      var row = groups[key];
      row.netCents = row.paidCents - row.refundCents - row.transferCents;
      return row;
    });
  };

  var consumeReportRows = function () {
    var filters = currentReportFilters();
    return (eduState.ledgers || []).filter(function (ledger) {
      var student = findById(eduState.students, ledger.studentId) || {};
      var studentText = [studentName(ledger.studentId), student.studentNo, student.no, student.phone, ledger.reason, ledger.walletId].join(" ").toLowerCase();
      var courseText = [ledger.courseNameSnapshot, ledger.courseProductId, walletName(ledger.walletId)].join(" ").toLowerCase();
      var classText = [ledger.classNameSnapshot, ledger.classId].join(" ").toLowerCase();
      return ["attendance", "revoke", "adjust"].indexOf(ledger.type) >= 0 &&
        branchInReportScope(ledger.branchId || student.branchId) &&
        dateInReportRange(ledger.createdAt) &&
        (!filters.studentKeyword || studentText.indexOf(String(filters.studentKeyword).toLowerCase()) >= 0) &&
        (!filters.courseKeyword || courseText.indexOf(String(filters.courseKeyword).toLowerCase()) >= 0) &&
        (!filters.classKeyword || classText.indexOf(String(filters.classKeyword).toLowerCase()) >= 0) &&
        (!filters.consumeType || String(ledger.type || "") === String(filters.consumeType));
    }).map(function (ledger) {
      var student = findById(eduState.students, ledger.studentId) || {};
      return {
        studentNo: student.studentNo || student.no || "",
        createdAt: ledger.createdAt,
        branchId: ledger.branchId || student.branchId,
        type: ledgerTypeLabel(ledger.type),
        studentName: studentName(ledger.studentId),
        courseName: ledger.courseNameSnapshot || sessionCourseName(ledger.relatedSessionId) || walletCourseName(ledger.walletId) || "暂未记录",
        className: ledger.classNameSnapshot || sessionClassName(ledger.relatedSessionId) || "暂未记录",
        teacherName: ledger.teacherName || sessionTeacherName(ledger.relatedSessionId) || "暂未记录",
        durationText: ledger.durationText || sessionDurationText(ledger.relatedSessionId) || "暂未记录",
        walletName: walletName(ledger.walletId),
        deltaUnits10: Number(ledger.unitsDelta10 || 0),
        consumeAmountCents: Number(ledger.amountCents || 0),
        balanceAfter10: Number(ledger.balanceAfter10 || 0),
        attendanceText: ledger.type === "attendance" ? "出勤" : "-",
        reason: ledgerReasonLabel(ledger.reason || ledger.coachNote)
      };
    });
  };

  var performanceReportRows = function () {
    var filters = currentReportFilters();
    return (eduState.staff || []).filter(function (teacher) {
      var roles = teacher.roles || [];
      return (roles.indexOf("teacher") >= 0 || roles.indexOf("coach") >= 0 || !roles.length) &&
        branchInReportScope(teacher.branchId) &&
        teacherInReportScope(idOf(teacher)) &&
        (!filters.employmentType || String(teacher.employmentType || teacher.employmentStatus || "") === String(filters.employmentType));
    }).map(function (teacher) {
      var tid = idOf(teacher);
      var rows = (eduState.sessions || []).filter(function (session) {
        return String(session.teacherId || "") === String(tid) &&
          branchInReportScope(session.branchId || teacher.branchId) &&
          dateInReportRange(session.startAt);
      });
      var activeRows = rows.filter(function (session) { return session.status !== "cancelled"; });
      var completed = activeRows.filter(function (session) { return session.status === "completed"; });
      var pending = activeRows.filter(function (session) { return session.status === "scheduled" || session.status === "pending_attendance"; });
      var units10 = completed.reduce(function (sum, session) {
        var course = sessionCourse(session);
        return sum + Number(session.deductUnits10 || course.defaultDeductUnits10 || 10);
      }, 0);
      return {
        teacherId: tid,
        teacherName: teacher.name || tid,
        branchId: teacher.branchId,
        scheduledCount: activeRows.length,
        completedCount: completed.length,
        pendingCount: pending.length,
        cancelledCount: rows.length - activeRows.length,
        units10: units10,
        paidCents: 0,
        arrearsCents: 0,
        uncountedUnits10: 0,
        classCount: Array.from(new Set(activeRows.map(function (session) { return session.classId || ""; }).filter(Boolean))).length
      };
    });
  };

  var classReportRows = function () {
    var filters = currentReportFilters();
    return (eduState.classes || []).filter(function (klass) {
      var course = findById(eduState.courses, klass.courseProductId) || {};
      var text = [klass.className, klass.courseNameSnapshot, course.name, klass.defaultRoomId, (klass.defaultTableNos || []).join(",")].join(" ").toLowerCase();
      return branchInReportScope(klass.branchId) &&
        teacherInReportScope(klass.teacherId) &&
        (!filters.courseKeyword || text.indexOf(String(filters.courseKeyword).toLowerCase()) >= 0) &&
        (!filters.classKeyword || text.indexOf(String(filters.classKeyword).toLowerCase()) >= 0) &&
        (!filters.roomKeyword || text.indexOf(String(filters.roomKeyword).toLowerCase()) >= 0) &&
        (filters.includeGraduated === "1" || String(klass.graduationStatus || "active") !== "graduated");
    }).map(function (klass) {
      var classId = idOf(klass);
      var course = findById(eduState.courses, klass.courseProductId) || {};
      var rows = (eduState.sessions || []).filter(function (session) {
        return String(session.classId || "") === String(classId) && dateInReportRange(session.startAt);
      });
      var activeRows = rows.filter(function (session) { return session.status !== "cancelled"; });
      var completed = activeRows.filter(function (session) { return session.status === "completed"; }).length;
      var planned = Number(klass.plannedSessionCount || course.plannedSessionCount || 0);
      var percent = planned ? Math.min(100, Math.round(activeRows.length / planned * 100)) : 0;
      return {
        className: klass.className || classId,
        branchId: klass.branchId,
        courseName: klass.courseNameSnapshot || course.name || courseName(klass.courseProductId),
        classTypeName: classTypeLabel(course.classTypeName, course.classTypeCode),
        teacherName: klass.teacherName || teacherName(klass.teacherId),
        assistantName: klass.assistantName || "-",
        headTeacherName: klass.headTeacherName || "-",
        scheduleText: klass.scheduleText || "-",
        defaultRoom: klass.defaultRoomId || ((klass.defaultTableNos || []).join(",") || "-"),
        studentCount: Number(klass.studentCount || klass.currentStudentCount || 0),
        capacity: Number(klass.capacity || 0),
        plannedCount: planned,
        scheduledCount: activeRows.length,
        completedCount: completed,
        pendingCount: activeRows.length - completed,
        progress: percent,
        status: classStatusLabel(klass.status || "active")
      };
    });
  };

  var reportDefinition = function (type) {
    var reportType = type || eduState.reportTab || "fee";
    if (reportType === "consume") {
      return {
        name: "课消报表",
        rows: consumeReportRows(),
        columns: [
          { label: "学号", value: function (row) { return row.studentNo; } },
          { label: "学员", value: function (row) { return row.studentName; } },
          { label: "课程", value: function (row) { return row.courseName; } },
          { label: "班级", value: function (row) { return row.className; } },
          { label: "上课分店", value: function (row) { return branchName(row.branchId); } },
          { label: "任课教练", value: function (row) { return row.teacherName; } },
          { label: "上课时间", value: function (row) { return formatCST(row.createdAt); } },
          { label: "上课时长", value: function (row) { return row.durationText; } },
          { label: "数量", value: function (row) { return lessonText(row.deltaUnits10); } },
          { label: "课消金额", value: function (row) { return moneyText(row.consumeAmountCents); } },
          { label: "出勤", value: function (row) { return row.attendanceText; } },
          { label: "扣课课包", value: function (row) { return row.walletName; } },
          { label: "备注", value: function (row) { return row.reason; } },
          { label: "操作时间", value: function (row) { return formatCST(row.createdAt); } }
        ]
      };
    }
    if (reportType === "performance") {
      return {
        name: "业绩报表",
        rows: performanceReportRows(),
        columns: [
          { label: "教练", value: function (row) { return row.teacherName; } },
          { label: "班级", value: function (row) { return row.classCount; } },
          { label: "课程", value: function () { return "-"; } },
          { label: "年级", value: function () { return "-"; } },
          { label: "班型", value: function () { return "-"; } },
          { label: "科目", value: function () { return "-"; } },
          { label: "已排课次", value: function (row) { return row.scheduledCount; } },
          { label: "已完成", value: function (row) { return row.completedCount; } },
          { label: "课消总量", value: function (row) { return lessonText(row.units10); } },
          { label: "实收金额", value: function (row) { return moneyText(row.paidCents); } },
          { label: "欠费金额", value: function (row) { return moneyText(row.arrearsCents); } },
          { label: "未计业绩课消", value: function (row) { return lessonText(row.uncountedUnits10); } }
        ]
      };
    }
    if (reportType === "class") {
      return {
        name: "班级报表",
        rows: classReportRows(),
        columns: [
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "课程名称", value: function (row) { return row.courseName; } },
          { label: "班级名称", value: function (row) { return row.className; } },
          { label: "班型", value: function (row) { return row.classTypeName; } },
          { label: "任课教练", value: function (row) { return row.teacherName; } },
          { label: "助教", value: function (row) { return row.assistantName; } },
          { label: "班主任", value: function (row) { return row.headTeacherName; } },
          { label: "上课时间", value: function (row) { return row.scheduleText; } },
          { label: "默认场地", value: function (row) { return row.defaultRoom; } },
          { label: "预招人数", value: function (row) { return row.capacity; } },
          { label: "人数", value: function (row) { return row.studentCount; } }
        ]
      };
    }
    return {
      name: "收费报表",
      rows: feeReportRows(),
      columns: [
        { label: "分店/汇总项", value: function (row) { return row.groupName; } },
        { label: "收费人次数", value: function (row) { return row.chargeCount; } },
        { label: "收费实交金额", value: function (row) { return moneyText(row.paidCents); } },
        { label: "课时余额金额", value: function (row) { return moneyText(row.walletCents); } },
        { label: "退费人次数", value: function (row) { return row.refundCount; } },
        { label: "退费金额", value: function (row) { return moneyText(row.refundCents); } },
        { label: "结转人次数", value: function (row) { return row.transferCount; } },
        { label: "结转金额", value: function (row) { return moneyText(row.transferCents); } },
        { label: "销售净额", value: function (row) { return moneyText(row.netCents); } }
      ]
    };
  };

  var reportTabsHtml = function () {
    var active = eduState.reportTab || "fee";
    var item = function (key, label) {
      return '<button class="edu-subtab ' + (active === key ? 'active' : '') + '" type="button" data-edu-report-tab="' + key + '">' + label + '</button>';
    };
    return '<div class="edu-subtabs">' +
      item("fee", "收费报表") +
      item("consume", "课消报表") +
      item("performance", "业绩报表") +
      item("class", "班级报表") +
    '</div>';
  };

  var reportFilterHtml = function () {
    var filters = currentReportFilters();
    var tab = eduState.reportTab || "fee";
    var extra = "";
    if (tab === "fee") {
      extra =
        '<label>课程名称<input class="form-input" name="courseKeyword" value="' + escapeHtml(filters.courseKeyword || '') + '" placeholder="选择/输入课程"></label>' +
        '<label>汇总方式<select class="form-input" name="groupBy"><option value="branch">分店</option><option value="term">期段</option><option value="type">类型</option><option value="course">课程</option><option value="year">年份</option><option value="classType">班型</option></select></label>';
    } else if (tab === "consume") {
      extra =
        '<label>学员<input class="form-input" name="studentKeyword" value="' + escapeHtml(filters.studentKeyword || '') + '" placeholder="姓名/学号/电话"></label>' +
        '<label>课程<input class="form-input" name="courseKeyword" value="' + escapeHtml(filters.courseKeyword || '') + '" placeholder="选择/输入课程"></label>' +
        '<label>班级<input class="form-input" name="classKeyword" value="' + escapeHtml(filters.classKeyword || '') + '" placeholder="选择/输入班级"></label>' +
        '<label>课消类型<select class="form-input" name="consumeType"><option value="">不限</option><option value="attendance">正常课消</option><option value="adjust">调整课消</option><option value="revoke">冲销/撤销</option></select></label>';
    } else if (tab === "performance") {
      extra =
        '<label>教练姓名<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>' +
        '<label>教练角色<select class="form-input" name="teacherRole"><option value="">主教/助教</option><option value="main">主教</option><option value="assistant">助教</option></select></label>' +
        '<label>在职类型<select class="form-input" name="employmentType"><option value="">全部</option><option value="active">全职/在职</option><option value="part_time">兼职</option><option value="dedicated">专职</option></select></label>' +
        '<label>班型<select class="form-input" name="teachingMode"><option value="">全部</option><option value="group">集体班</option><option value="private">一对一</option><option value="semi_private">一对多</option></select></label>';
    } else {
      extra =
        '<label>课程名称<input class="form-input" name="courseKeyword" value="' + escapeHtml(filters.courseKeyword || '') + '" placeholder="选择/输入课程"></label>' +
        '<label>班级名称<input class="form-input" name="classKeyword" value="' + escapeHtml(filters.classKeyword || '') + '" placeholder="选择/输入班级"></label>' +
        '<label>任课教练<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>' +
        '<label>默认场地<input class="form-input" name="roomKeyword" value="' + escapeHtml(filters.roomKeyword || '') + '" placeholder="场地/球台"></label>' +
        '<label>班级范围<select class="form-input" name="includeGraduated"><option value="">未结业班级</option><option value="1">包含结业班级</option></select></label>';
    }
    return '<form class="edu-filter-panel" id="edu-report-filter-form">' +
      '<div class="edu-filter-grid">' +
        '<label>开始日期<input class="form-input" type="date" name="startDate" value="' + escapeHtml(filters.startDate || '') + '"></label>' +
        '<label>结束日期<input class="form-input" type="date" name="endDate" value="' + escapeHtml(filters.endDate || '') + '"></label>' +
        '<label>所属分店<select class="form-input" name="branchId">' + filterBranchOptions(filters.branchId) + '</select></label>' +
        extra +
        '<div class="edu-filter-actions"><button class="club-action primary" type="submit">查询</button><button class="club-action" type="button" data-edu-filter-reset="reports">重置</button><button class="club-action" type="button" data-edu-export="report-' + escapeHtml(eduState.reportTab || "fee") + '">导出为 Excel</button></div>' +
      '</div>' +
    '</form>';
  };

  var reportSummaryHtml = function (definition) {
    var rows = definition.rows || [];
    var cells = [];
    if ((eduState.reportTab || "fee") === "fee") {
      cells = [
        ["收费人次数", rows.reduce(function (sum, row) { return sum + Number(row.chargeCount || 0); }, 0)],
        ["销售净额", moneyText(rows.reduce(function (sum, row) { return sum + Number(row.netCents || 0); }, 0))],
        ["售出课时", lessonText(rows.reduce(function (sum, row) { return sum + Number(row.totalUnits10 || 0); }, 0))]
      ];
    } else if (eduState.reportTab === "consume") {
      cells = [
        ["流水条数", rows.length],
        ["出勤/调整", rows.filter(function (row) { return row.deltaUnits10 < 0; }).length],
        ["课时变动", lessonText(rows.reduce(function (sum, row) { return sum + Number(row.deltaUnits10 || 0); }, 0))]
      ];
    } else if (eduState.reportTab === "performance") {
      cells = [
        ["教练数", rows.length],
        ["完成课次", rows.reduce(function (sum, row) { return sum + Number(row.completedCount || 0); }, 0)],
        ["课消总量", lessonText(rows.reduce(function (sum, row) { return sum + Number(row.units10 || 0); }, 0))]
      ];
    } else {
      cells = [
        ["班级数", rows.length],
        ["已排课次", rows.reduce(function (sum, row) { return sum + Number(row.scheduledCount || 0); }, 0)],
        ["平均进度", (rows.length ? Math.round(rows.reduce(function (sum, row) { return sum + Number(row.progress || 0); }, 0) / rows.length) : 0) + "%"]
      ];
    }
    return '<div class="edu-report-summary">' + cells.map(function (cell) {
      return '<div><span>' + escapeHtml(cell[0]) + '</span><strong>' + escapeHtml(cell[1]) + '</strong></div>';
    }).join("") + '</div>';
  };

  var reportTableHtml = function (definition) {
    var rows = definition.rows || [];
    var columns = definition.columns || [];
    return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      columns.map(function (col) { return '<th>' + escapeHtml(col.label) + '</th>'; }).join("") +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (row) {
        return '<tr>' + columns.map(function (col) { return '<td>' + escapeHtml(col.value(row)) + '</td>'; }).join("") + '</tr>';
      }).join("") : '<tr><td colspan="' + columns.length + '">暂无报表数据</td></tr>') +
      '</tbody></table></div>';
  };

  var renderEduReports = function () {
    var definition = reportDefinition(eduState.reportTab);
    eduPanelEl.innerHTML =
      eduFrameStart("报表管理", "按收费、课消、业绩和班级维度统计教务经营数据。") +
      reportTabsHtml() +
      '<div class="edu-page-path">当前位置：管理功能 / 报表管理 / ' + escapeHtml(definition.name) + '</div>' +
      reportFilterHtml() +
      reportSummaryHtml(definition) +
      reportTableHtml(definition);
    var filters = currentReportFilters();
    setFormValue("edu-report-filter-form", "groupBy", filters.groupBy || "branch");
    setFormValue("edu-report-filter-form", "consumeType", filters.consumeType || "");
    setFormValue("edu-report-filter-form", "teacherRole", filters.teacherRole || "");
    setFormValue("edu-report-filter-form", "employmentType", filters.employmentType || "");
    setFormValue("edu-report-filter-form", "teachingMode", filters.teachingMode || "");
    setFormValue("edu-report-filter-form", "includeGraduated", filters.includeGraduated || "");
    bindEduPanelEvents();
  };

  var formData = function (form) {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (data[key]) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  };

  var splitList = function (value) {
    return String(value || "").split(",").map(function (item) {
      return item.trim();
    }).filter(Boolean);
  };

  var dateInReportRange = function (value) {
    var filters = currentReportFilters();
    if (!value || (!filters.startDate && !filters.endDate)) return true;
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    if (filters.startDate) {
      var start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
    }
    if (filters.endDate) {
      var end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  };

  var branchInReportScope = function (branchId) {
    var filters = currentReportFilters();
    return !filters.branchId || String(branchId || "") === String(filters.branchId);
  };

  var teacherInReportScope = function (teacherId) {
    var filters = currentReportFilters();
    return !filters.teacherId || String(teacherId || "") === String(filters.teacherId);
  };

  var withEduSaving = function (promise) {
    if (!eduPanelEl) return;
    return promise.then(function () {
      closeEduModal();
      return loadEduData();
    }).catch(function (err) {
      eduPanelEl.insertAdjacentHTML("afterbegin", eduErrorHtml(err));
    });
  };

  var saveEduCourse = function (form) {
    var data = formData(form);
    var selected = Array.prototype.slice.call(form.querySelector('[name="authorizedBranchIds"]').selectedOptions || []).map(function (option) {
      return option.value;
    });
    return withEduSaving(clubData.eduSaveCourseProduct(selectedClubId, {
      id: data.id,
      name: data.name,
      teachingMode: data.teachingMode,
      billingMode: data.billingMode,
      unit: data.unit,
      year: data.year,
      termCode: data.termName,
      termName: data.termName,
      courseLevelCode: data.typeName,
      typeName: data.typeName,
      classTypeCode: data.classTypeName,
      classTypeName: data.classTypeName,
      standardPriceCents: moneyInputCents(data.standardPriceYuan),
      defaultDeductUnits10: lessonInputUnits10(data.defaultDeductUnits10 || 1),
      plannedSessionCount: Number(data.plannedSessionCount || 0),
      capacity: Number(data.capacity || 0),
      dynamicDeduct: data.dynamicDeduct === "true",
      isByTerm: data.billingMode === "term",
      priceRules: {
        termFeeText: data.termFeeText
      },
      status: data.status || "active",
      authorizedBranchIds: selected
    }));
  };

  var saveEduStudent = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSaveStudent(selectedClubId, {
      id: data.id,
      name: data.name,
      branchId: data.branchId,
      phone: data.phone,
      parentName: data.parentName,
      level: data.level,
      status: data.status || "active"
    }));
  };

  var importEduStudents = function (file) {
    if (!file) return;
    if (!clubData.eduImportStudents) {
      window.alert("当前版本暂不支持导入学员");
      return;
    }
    if (!window.confirm("确认导入这个学员表吗？系统会按手机号、学员姓名、分店和家长进行去重，重复学员会自动跳过。")) return;
    return clubData.eduImportStudents(selectedClubId, file).then(function (result) {
      var data = result && result.data ? result.data : result || {};
      window.alert("导入完成：新增 " + (data.createdCount || 0) + " 人，跳过重复 " + (data.skippedCount || 0) + " 人，错误 " + (data.errorCount || 0) + " 行。");
      return loadEduData();
    }).catch(function (err) {
      if (eduPanelEl) eduPanelEl.insertAdjacentHTML("afterbegin", eduErrorHtml(err));
    });
  };

  var saveEduPackageTemplate = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSavePackageTemplate(selectedClubId, {
      id: data.id,
      name: data.name,
      courseProductId: data.courseProductId,
      lessonUnits10: lessonInputUnits10(data.lessonUnits10),
      validDays: Number(data.validDays || 0),
      defaultPriceCents: Number(data.defaultPriceCents || 0),
      deductUnits10: lessonInputUnits10(data.deductUnits10 || 1),
      status: "active"
    }));
  };

  var createEduWallet = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduCreateWallet(selectedClubId, data.studentId, {
      packageTemplateId: data.packageTemplateId,
      totalUnits10: lessonInputUnits10(data.totalUnits10),
      amountCents: Number(data.amountCents || 0),
      expireAt: data.expireAt,
      paymentRemark: data.paymentRemark
    }));
  };

  var saveEduClass = function (form) {
    var data = formData(form);
    var teacher = findById(eduState.staff, data.teacherId);
    var course = findById(eduState.courses, data.courseProductId);
    return withEduSaving(clubData.eduSaveClass(selectedClubId, {
      id: data.id,
      className: data.className,
      branchId: data.branchId,
      courseProductId: data.courseProductId,
      courseNameSnapshot: course && course.name,
      teacherId: data.teacherId,
      teacherName: teacher && teacher.name,
      capacity: Number(data.capacity || 0),
      plannedSessionCount: Number(data.plannedSessionCount || 0),
      defaultRoomId: data.defaultRoomId,
      defaultTableNos: splitList(data.defaultTableNos),
      status: data.status || "active"
    }));
  };

  var saveEduStaff = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSaveStaff(selectedClubId, {
      id: data.id,
      name: data.name,
      branchId: data.branchId,
      phone: data.phone,
      roles: ["teacher"],
      employmentStatus: data.employmentStatus || "active"
    }));
  };

  var bookingAvailabilityPayload = function (data, date) {
    var course = findById(eduState.courses, data.courseProductId);
    var resource = findById(eduState.resources, data.resourceId);
    var capacity = Number(data.capacity || 1);
    var day = date || data.date || todayDateValue();
    return {
      id: data.id,
      teacherId: data.teacherId,
      teacherNameSnapshot: teacherName(data.teacherId),
      branchId: data.branchId || eduState.branchId,
      weekStartDate: dateOnlyText(startOfWeek(parseDateKey(day))),
      date: day,
      startTime: data.startTime,
      endTime: data.endTime,
      courseProductId: data.courseProductId || "",
      courseName: course && course.name || "",
      capacity: capacity,
      bookingType: bookingTypeForCapacity(capacity),
      resourceId: data.resourceId || "",
      resourceLabel: resource && (resource.name || resource.tableNo || resource.roomId) || "",
      slotDurationMinutes: Number(data.slotDurationMinutes || 60),
      status: data.status || "draft"
    };
  };

  var saveEduAvailability = function (form) {
    var data = formData(form);
    if (!data.teacherId) return window.alert("请选择教练。");
    if (!data.branchId && !eduState.branchId) return window.alert("请先在页面顶部选择分店。");
    if (!data.date) return window.alert("请选择日期。");
    if (!data.startTime || !data.endTime) return window.alert("请填写开始和结束时间。");
    if (data.startTime >= data.endTime) return window.alert("开始时间必须早于结束时间。");
    var save = clubData.eduSaveBookingAvailability || clubData.eduSaveAvailability;
    return withEduSaving(save(selectedClubId, bookingAvailabilityPayload(data)));
  };

  var saveEduAvailabilityBulk = function (form) {
    var data = formData(form);
    var dates = data.releaseMode === "day"
      ? [data.singleDate || todayDateValue()]
      : (data.dates ? (Array.isArray(data.dates) ? data.dates : [data.dates]) : []);
    dates = dates.filter(Boolean);
    if (!dates.length) return window.alert(data.releaseMode === "week" ? "请先选择要放号的日期。" : "请选择放号日期。");
    if (!data.teacherId) return window.alert("请选择教练。");
    if (!data.branchId && !eduState.branchId) return window.alert("请先在页面顶部选择分店。");
    if (!data.startTime || !data.endTime) return window.alert("请填写开始和结束时间。");
    if (data.startTime >= data.endTime) return window.alert("开始时间必须早于结束时间。");
    var save = clubData.eduSaveBookingAvailability || clubData.eduSaveAvailability;
    return withEduSaving(Promise.all(dates.map(function (date) {
      return save(selectedClubId, bookingAvailabilityPayload(data, date));
    })));
  };

  var draftBookingAvailabilityIdsInRange = function () {
    var range = availabilityMatrixRange();
    var ids = {};
    bookingAvailabilitySlots(range).forEach(function (slot) {
      if (slot.status === "draft" && slot.id) ids[slot.id] = true;
    });
    return Object.keys(ids);
  };

  var publishBookingAvailabilityRange = function (idsText) {
    if (!clubData.eduPublishBookingAvailabilityWeek) return window.alert("放号发布接口暂不可用。");
    var ids = splitList(idsText).filter(Boolean);
    if (!ids.length) ids = draftBookingAvailabilityIdsInRange();
    if (!ids.length) return window.alert("当前范围没有草稿可发布。");
    var range = availabilityMatrixRange();
    var filters = eduState.availabilityFilters || {};
    return withEduSaving(clubData.eduPublishBookingAvailabilityWeek(selectedClubId, {
      branchId: filters.branchId || eduState.branchId || "",
      weekStartDate: range.weekStartDate,
      availabilityIds: ids
    }));
  };

  var pauseBookingAvailability = function (id) {
    if (!id) return;
    if (!clubData.eduPauseBookingAvailability) return window.alert("暂停放号接口暂不可用。");
    if (!window.confirm("确认暂停这个可约时间？暂停后学员不能继续预约该格子。")) return;
    return withEduSaving(clubData.eduPauseBookingAvailability(selectedClubId, id, { reason: "Web 管理端暂停" }));
  };

  var copyPreviousBookingAvailabilityWeek = function () {
    if (!clubData.eduCopyBookingAvailabilityWeek) return window.alert("复制放号接口暂不可用。");
    var range = availabilityMatrixRange();
    var fromWeek = dateOnlyText(addDays(parseDateKey(range.weekStartDate), -7));
    var filters = eduState.availabilityFilters || {};
    return withEduSaving(clubData.eduCopyBookingAvailabilityWeek(selectedClubId, {
      branchId: filters.branchId || eduState.branchId || "",
      fromWeekStartDate: fromWeek,
      toWeekStartDate: range.weekStartDate
    }));
  };

  var bookingById = function (id) {
    return (eduState.bookings || []).find(function (item) {
      return String(idOf(item)) === String(id || "");
    }) || null;
  };

  var walletCourseId = function (wallet) {
    var template = findById(eduState.packageTemplates, wallet && wallet.packageTemplateId);
    return wallet && (wallet.courseProductId || (template && template.courseProductId) || "");
  };

  var walletLabelForBooking = function (wallet) {
    var template = findById(eduState.packageTemplates, wallet && wallet.packageTemplateId);
    var name = (template && template.name) || wallet.packageName || wallet.name || "课包";
    return name + " · 剩余 " + lessonText(wallet.remainingUnits10);
  };

  var walletUsableForBooking = function (wallet, booking) {
    if (!wallet || String(wallet.status || "active") !== "active") return false;
    if (String(wallet.studentId || "") !== String(booking.studentId || "")) return false;
    if (Number(wallet.remainingUnits10 || 0) <= 0) return false;
    var courseId = walletCourseId(wallet);
    if (booking.courseProductId && courseId && String(courseId) !== String(booking.courseProductId)) return false;
    if (booking.branchId && wallet.branchId && String(wallet.branchId) !== String(booking.branchId)) return false;
    return true;
  };

  var confirmBookingWithWallet = function (booking, wallets) {
    var usable = (wallets || []).filter(function (wallet) {
      return walletUsableForBooking(wallet, booking);
    });
    if (!usable.length) {
      window.alert("该学员暂无可用于本次课程的有效课包，暂不能在 Web 端确认。");
      return Promise.resolve();
    }
    var selected = usable[0];
    if (usable.length > 1) {
      var message = usable.map(function (wallet, index) {
        return (index + 1) + ". " + walletLabelForBooking(wallet);
      }).join("\n");
      var answer = window.prompt("请选择确认约课使用的课包编号：\n" + message, "1");
      if (answer === null) return Promise.resolve();
      selected = usable[Number(answer) - 1];
      if (!selected) return window.alert("课包编号无效，未执行确认。");
    }
    return withEduSaving(clubData.eduConfirmBooking(selectedClubId, idOf(booking), {
      walletId: idOf(selected),
      adminMessage: "Web 矩阵确认约课"
    }));
  };

  var confirmBookingRequest = function (id) {
    if (!clubData.eduConfirmBooking) return window.alert("约课确认接口暂不可用。");
    var booking = bookingById(id);
    if (!booking) return;
    if (!booking.studentId) return window.alert("该约课缺少学员档案，暂不能确认。");
    var localWallets = (eduState.wallets || []).filter(function (wallet) {
      return String(wallet.studentId || "") === String(booking.studentId || "");
    });
    if (localWallets.some(function (wallet) { return walletUsableForBooking(wallet, booking); })) {
      return confirmBookingWithWallet(booking, localWallets);
    }
    if (!clubData.eduStudentWallets) return window.alert("无法加载学员课包，暂不能确认。");
    return clubData.eduStudentWallets(selectedClubId, booking.studentId, { status: "active" }).then(function (data) {
      return confirmBookingWithWallet(booking, eduList(data));
    }).catch(function () {
      window.alert("学员课包加载失败，暂不能确认。");
    });
  };

  var rejectBookingRequest = function (id) {
    if (!clubData.eduRejectBooking) return window.alert("约课拒绝接口暂不可用。");
    var reason = window.prompt("请输入拒绝原因", "暂无法安排");
    if (reason === null) return;
    return withEduSaving(clubData.eduRejectBooking(selectedClubId, id, {
      rejectReason: reason,
      adminMessage: reason
    }));
  };

  var proposeBookingRequest = function (id) {
    if (!clubData.eduProposeBooking) return window.alert("约课改期接口暂不可用。");
    var message = window.prompt("请输入改期建议", "请联系俱乐部确认新的上课时间");
    if (message === null) return;
    return withEduSaving(clubData.eduProposeBooking(selectedClubId, id, {
      adminMessage: message
    }));
  };

  var handleBookingMatrixAction = function (id, action) {
    if (action === "confirm") return confirmBookingRequest(id);
    if (action === "reject") return rejectBookingRequest(id);
    if (action === "propose") return proposeBookingRequest(id);
  };

  var saveEduResource = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSaveResource(selectedClubId, {
      name: data.name,
      branchId: data.branchId,
      type: data.type || "table",
      tableNo: data.tableNo,
      status: "active"
    }));
  };

  var saveEduSession = function (form) {
    var data = formData(form);
    var teacher = findById(eduState.staff, data.teacherId);
    var course = findById(eduState.courses, data.courseProductId);
    var klass = findById(eduState.classes, data.classId);
    return withEduSaving(clubData.eduSaveSession(selectedClubId, {
      id: data.id,
      branchId: data.branchId,
      classId: data.classId,
      classNameSnapshot: klass && klass.className,
      courseProductId: data.courseProductId,
      courseNameSnapshot: course && course.name,
      teacherId: data.teacherId,
      teacherName: teacher && teacher.name,
      startAt: data.startAt,
      endAt: data.endAt,
      roomId: data.roomId,
      tableNos: splitList(data.tableNos),
      skipConflict: data.skipConflict === "1"
    }));
  };

  var openAttendanceModal = function (sessionId) {
    eduState.attendanceSessionId = sessionId || eduState.attendanceSessionId || defaultAttendanceSessionId();
    eduState.attendanceData = null;
    renderEduModal("按课次点名", attendanceFormHtml());
    if (eduState.attendanceSessionId) return loadAttendanceRoster(eduState.attendanceSessionId);
  };

  var loadAttendanceRoster = function (sessionId) {
    eduState.attendanceSessionId = sessionId || "";
    eduState.attendanceData = null;
    renderEduModal("按课次点名", attendanceFormHtml());
    if (!sessionId) return Promise.resolve();
    return clubData.eduAttendance(selectedClubId, sessionId).then(function (data) {
      eduState.attendanceData = data || {};
      renderEduModal("按课次点名", attendanceFormHtml());
    }).catch(function (err) {
      eduState.attendanceData = { roster: [] };
      renderEduModal("按课次点名", attendanceFormHtml());
      window.alert((err && err.message) || "加载课次名单失败");
    });
  };

  var submitEduAttendance = function (form) {
    var sessionId = form.elements.sessionId && form.elements.sessionId.value;
    if (!sessionId) return window.alert("请选择课次。");
    var records = [];
    var missingWallets = [];
    form.querySelectorAll("[data-attendance-student]").forEach(function (row) {
      if (row.getAttribute("data-attendance-done") === "1") return;
      var studentId = row.getAttribute("data-attendance-student");
      var status = (row.querySelector('[data-attendance-field="status"]') || {}).value || "attended";
      var walletId = (row.querySelector('[data-attendance-field="walletId"]') || {}).value || "";
      var deductInput = (row.querySelector('[data-attendance-field="deductUnits10"]') || {}).value || "1";
      var note = (row.querySelector('[data-attendance-field="coachNote"]') || {}).value || "";
      if (status === "attended" && !walletId) {
        missingWallets.push(studentName(studentId));
        return;
      }
      records.push({
        studentId: studentId,
        walletId: walletId,
        status: status,
        deductUnits10: status === "attended" ? lessonInputUnits10(deductInput) : 0,
        coachNote: note
      });
    });
    if (missingWallets.length) return window.alert("以下学员缺少可用课包，无法出勤扣课：" + missingWallets.join("、"));
    if (!records.length) return window.alert("没有可提交的点名记录。");
    return withEduSaving(clubData.eduSubmitAttendance(selectedClubId, sessionId, records));
  };

  var csvCell = function (value) {
    var text = String(value === undefined || value === null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  };

  var downloadCsv = function (name, rows, columns) {
    var lines = [columns.map(function (col) { return csvCell(col.label); }).join(",")];
    rows.forEach(function (row) {
      lines.push(columns.map(function (col) { return csvCell(col.value(row)); }).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = "教务-" + name + "-" + today + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  var downloadEduExcel = function (name, rows, columns) {
    rows = rows || [];
    columns = columns || [];
    var tableRows = rows.length ? rows.map(function (row, rowIndex) {
      return '<tr>' + columns.map(function (col) {
        return '<td style="border:1px solid #d7e2de;padding:8px 10px;mso-number-format:\'\\@\';background:' + (rowIndex % 2 ? '#f7fbf9' : '#ffffff') + ';">' + escapeHtml(col.value(row)) + '</td>';
      }).join("") + '</tr>';
    }).join("") : '<tr><td colspan="' + Math.max(columns.length, 1) + '" style="border:1px solid #d7e2de;padding:14px 10px;text-align:center;color:#66736f;">暂无数据</td></tr>';
    var html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      '<table style="border-collapse:collapse;font-family:Arial,Microsoft YaHei,sans-serif;font-size:13px;">' +
        '<tr>' + columns.map(function (col) {
          return '<th style="border:1px solid #bfd7ce;background:#2f7d68;color:#ffffff;padding:9px 10px;text-align:left;font-weight:700;white-space:nowrap;">' + escapeHtml(col.label) + '</th>';
        }).join("") + '</tr>' +
        tableRows +
      '</table>' +
    '</body></html>';
    var blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var today = todayDateValue().replace(/-/g, "");
    a.href = url;
    a.download = "教务-" + name + "-" + today + ".xls";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  var reportDateRangeText = function () {
    var filters = currentReportFilters();
    if (filters.startDate && filters.endDate) return filters.startDate + " 至 " + filters.endDate;
    if (filters.startDate) return filters.startDate + " 起";
    if (filters.endDate) return filters.endDate + " 止";
    return "全部日期";
  };

  var reportExcelColumnWidth = function (label) {
    label = String(label || "");
    if (/时间|日期/.test(label)) return "180px";
    if (/备注|课程名称|班级名称|扣课课包/.test(label)) return "180px";
    if (/分店|汇总项|课程|班级|教练|学员/.test(label)) return "140px";
    return "110px";
  };

  var reportExcelCellStyle = function (col, rowIndex) {
    return "border:1px solid #d7e2de;padding:8px 10px;color:#19302b;" +
      "width:" + reportExcelColumnWidth(col.label) + ";white-space:nowrap;mso-number-format:\"\\@\";" +
      "background:" + (rowIndex % 2 ? "#f7fbf9" : "#ffffff") + ";";
  };

  var downloadReportExcel = function (name, rows, columns) {
    rows = rows || [];
    columns = columns || [];
    var colCount = Math.max(columns.length, 1);
    var generatedAt = formatCST(new Date().toISOString());
    var tableRows = rows.length ? rows.map(function (row, rowIndex) {
      return '<tr>' + columns.map(function (col) {
        return "<td style='" + reportExcelCellStyle(col, rowIndex) + "'>" + escapeHtml(col.value(row)) + "</td>";
      }).join("") + '</tr>';
    }).join("") : '<tr><td colspan="' + colCount + '" style="border:1px solid #d7e2de;padding:14px 10px;text-align:center;color:#66736f;">暂无报表数据</td></tr>';
    var colGroup = '<colgroup>' + columns.map(function (col) {
      return "<col style='width:" + reportExcelColumnWidth(col.label) + ";mso-width-source:userset;'>";
    }).join("") + '</colgroup>';
    var html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      '<table style="border-collapse:collapse;font-family:Arial,Microsoft YaHei,sans-serif;font-size:13px;min-width:960px;">' +
        colGroup +
        '<tr><td colspan="' + colCount + '" style="background:#173f35;color:#ffffff;font-size:20px;font-weight:700;padding:16px 14px;">教务-' + escapeHtml(name) + '</td></tr>' +
        '<tr><td colspan="' + colCount + '" style="background:#eaf4ef;color:#2b4d45;padding:10px 14px;border:1px solid #c9ddd4;">日期范围：' + escapeHtml(reportDateRangeText()) + '　生成时间：' + escapeHtml(generatedAt) + '</td></tr>' +
        '<tr>' + columns.map(function (col) {
          return "<th style='border:1px solid #bfd7ce;background:#2f7d68;color:#ffffff;padding:9px 10px;text-align:left;font-weight:700;width:" + reportExcelColumnWidth(col.label) + ";white-space:nowrap;'>" + escapeHtml(col.label) + "</th>";
        }).join("") + '</tr>' +
        tableRows +
      '</table>' +
    '</body></html>';
    var blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var today = todayDateValue().replace(/-/g, "");
    a.href = url;
    a.download = "教务-" + name + "-" + today + ".xls";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  var exportEduData = function (type) {
    if (String(type || "").indexOf("report-") === 0) {
      var reportForm = document.getElementById("edu-report-filter-form");
      if (reportForm) eduState.reportFilters = formData(reportForm);
      var report = reportDefinition(String(type).replace("report-", ""));
      return downloadReportExcel(report.name, report.rows || [], report.columns || []);
    }
    var exporters = {
      courses: {
        name: "课程管理",
        rows: eduState.courses,
        columns: [
          { label: "课程", value: function (row) { return row.name; } },
          { label: "单价", value: function (row) { return moneyText(row.standardPriceCents); } },
          { label: "类型", value: function (row) { return courseLevelLabel(row.typeName, row.courseLevelCode); } },
          { label: "班型", value: function (row) { return classTypeLabel(row.classTypeName, row.classTypeCode); } },
          { label: "课程类型", value: function (row) { return teachingModeLabel(row.teachingMode); } },
          { label: "状态", value: function (row) { return courseStatusLabel(row.status || "active"); } }
        ]
      },
      packageTemplates: {
        name: "收费课时规格",
        rows: eduState.packageTemplates,
        columns: [
          { label: "规格", value: function (row) { return row.name; } },
          { label: "课程", value: function (row) { return courseName(row.courseProductId); } },
          { label: "课时", value: function (row) { return lessonText(row.lessonUnits10); } },
          { label: "有效天数", value: function (row) { return row.validDays || 0; } },
          { label: "默认价格", value: function (row) { return moneyText(row.defaultPriceCents); } }
        ]
      },
      students: {
        name: "学员管理",
        rows: eduState.students,
        columns: [
          { label: "学员", value: function (row) { return row.name; } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "手机号", value: function (row) { return row.phone || ""; } },
          { label: "家长", value: function (row) { return row.parentName || ""; } },
          { label: "家长手机号", value: function (row) { return row.parentPhone || ""; } },
          { label: "水平", value: function (row) { return studentLevelLabel(row.level); } },
          { label: "剩余课时", value: function (row) { return lessonText(studentWalletSummary(idOf(row)).remainingUnits10); } },
          { label: "状态", value: function (row) { return studentStatusLabel(row.status || "active"); } }
        ]
      },
      wallets: {
        name: "已购课程",
        rows: eduState.wallets,
        columns: [
          { label: "学员", value: function (row) { return studentName(row.studentId); } },
          { label: "已购课程", value: function (row) { return packageName(row.packageTemplateId); } },
          { label: "总课时", value: function (row) { return lessonText(row.totalUnits10); } },
          { label: "剩余", value: function (row) { return lessonText(row.remainingUnits10); } },
          { label: "有效期", value: function (row) { return dateText(row.expireAt); } }
        ]
      },
      teachers: {
        name: "教练管理",
        rows: eduState.staff,
        columns: [
          { label: "教练", value: function (row) { return row.name; } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "手机号", value: function (row) { return row.phone || ""; } },
          { label: "角色", value: function (row) { return staffRolesText(row.roles); } },
          { label: "状态", value: function (row) { return employmentStatusLabel(row.employmentStatus); } }
        ]
      },
      classes: {
        name: "班级管理",
        rows: eduState.classes,
        columns: [
          { label: "班级", value: function (row) { return row.className; } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "课程", value: function (row) { return row.courseNameSnapshot || courseName(row.courseProductId); } },
          { label: "教练", value: function (row) { return row.teacherName || teacherName(row.teacherId); } },
          { label: "状态", value: function (row) { return classStatusLabel(row.status || "active"); } }
        ]
      },
      resources: {
        name: "教学资源",
        rows: eduState.resources,
        columns: [
          { label: "资源", value: function (row) { return row.name; } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "类型", value: function (row) { return resourceTypeLabel(row.type); } },
          { label: "编号", value: function (row) { return row.tableNo || row.roomId || ""; } }
        ]
      },
      sessions: {
        name: "详细课表",
        rows: eduState.sessions,
        columns: [
          { label: "开始", value: function (row) { return formatCST(row.startAt); } },
          { label: "结束", value: function (row) { return formatCST(row.endAt); } },
          { label: "班级/课程", value: function (row) { return row.classNameSnapshot || className(row.classId) || row.courseNameSnapshot || courseName(row.courseProductId); } },
          { label: "教练", value: function (row) { return row.teacherName || teacherName(row.teacherId); } },
          { label: "状态", value: function (row) { return sessionStatusLabel(row.status); } }
        ]
      },
      availability: {
        name: "教练可排时间",
        rows: eduState.availability,
        columns: [
          { label: "教练", value: function (row) { return teacherName(row.teacherId); } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "日期/星期", value: function (row) { return row.date || (row.weekday ? '周' + '一二三四五六日'.charAt(Number(row.weekday) - 1) : ''); } },
          { label: "开始", value: function (row) { return row.startTime || ""; } },
          { label: "结束", value: function (row) { return row.endTime || ""; } },
          { label: "状态", value: function (row) { return availabilityStatusLabel(row.status); } },
          { label: "提交人", value: availabilitySubmitterName },
          { label: "审核人", value: availabilityReviewerName }
        ]
      },
      ledgers: {
        name: "点名账本",
        rows: eduState.ledgers,
        columns: [
          { label: "时间", value: function (row) { return formatCST(row.createdAt); } },
          { label: "类型", value: function (row) { return ledgerTypeLabel(row.type); } },
          { label: "学员", value: function (row) { return studentName(row.studentId); } },
          { label: "课包", value: function (row) { return walletName(row.walletId); } },
          { label: "变动", value: function (row) { return lessonText(row.unitsDelta10); } },
          { label: "余额", value: function (row) { return lessonText(row.balanceAfter10); } },
          { label: "原因", value: function (row) { return ledgerReasonLabel(row.reason); } }
        ]
      }
    };
    var item = exporters[type];
    if (!item) return;
    if (type === "students") {
      return downloadEduExcel(item.name, item.rows || [], item.columns);
    }
    downloadCsv(item.name, item.rows || [], item.columns);
  };

  var scheduleExportPayload = function () {
    var form = document.getElementById("schedule-export-form");
    var data = form ? formData(form) : {};
    data.date = data.date || todayDateValue();
    data.range = data.range === "week" ? "week" : "day";
    data.branchId = eduState.branchId || "";
    eduState.scheduleExportForm = { date: data.date, range: data.range };
    return data;
  };

  var scheduleViewExportPayload = function () {
    var form = document.getElementById("edu-schedule-view-filter-form");
    var filters = Object.assign({}, eduState.scheduleFilters || {}, form ? formData(form) : {});
    var view = eduState.scheduleView || "day";
    var payload = {
      date: filters.dayDate || todayDateValue(),
      range: "day",
      branchId: eduState.branchId || ""
    };
    if (view === "week") {
      payload.date = dateOnlyText(parseWeekInputValue(filters.weekValue || weekInputValue(new Date())));
      payload.range = "week";
    }
    if (filters.teacherId) payload.teacherId = filters.teacherId;
    eduState.scheduleFilters = filters;
    return payload;
  };

  var downloadScheduleExcelWithPayload = function (payload) {
    if (!clubData.eduDownloadScheduleExport) return window.alert("后端导出接口未上线。");
    clubData.eduDownloadScheduleExport(selectedClubId, payload).then(function (result) {
      downloadBlobFile(result, "约课表.xlsx");
    }).catch(function (err) {
      window.alert(clubData.errorMessage ? clubData.errorMessage(err) : (err.message || "下载失败"));
    });
  };

  var downloadScheduleExcel = function () {
    return downloadScheduleExcelWithPayload(scheduleExportPayload());
  };

  var downloadCurrentScheduleViewExcel = function () {
    var view = eduState.scheduleView || "day";
    if (view !== "day" && view !== "week") return window.alert("当前视图暂不支持导出 Excel。");
    return downloadScheduleExcelWithPayload(scheduleViewExportPayload());
  };

  var saveScheduleExcel = function () {
    var payload = scheduleExportPayload();
    if (!clubData.eduGenerateScheduleExport) return window.alert("后端导出接口未上线。");
    clubData.eduGenerateScheduleExport(selectedClubId, payload).then(function () {
      return loadEduData();
    }).then(function () {
      window.alert("已保存到导出记录。");
    }).catch(function (err) {
      window.alert(clubData.errorMessage ? clubData.errorMessage(err) : (err.message || "保存失败"));
    });
  };

  var saveScheduleExportSettings = function (form) {
    var data = formData(form);
    data.branchId = eduState.branchId || "";
    data.enabled = data.enabled === "true";
    data.range = data.range === "week" ? "week" : "day";
    if (!clubData.eduSaveScheduleExportSettings) return window.alert("后端设置接口未上线。");
    clubData.eduSaveScheduleExportSettings(selectedClubId, data).then(function (settings) {
      eduState.scheduleExportSettings = settings || data;
      renderEduSessions();
      window.alert("定时保存设置已更新。");
    }).catch(function (err) {
      window.alert(clubData.errorMessage ? clubData.errorMessage(err) : (err.message || "保存失败"));
    });
  };

  var downloadSavedScheduleExcel = function (id) {
    if (!clubData.eduDownloadSavedScheduleExport) return window.alert("后端下载接口未上线。");
    clubData.eduDownloadSavedScheduleExport(selectedClubId, id).then(function (result) {
      downloadBlobFile(result, "约课表.xlsx");
    }).catch(function (err) {
      window.alert(clubData.errorMessage ? clubData.errorMessage(err) : (err.message || "下载失败"));
    });
  };

  var deleteEduSelection = function (type) {
    var ids = selectedEduIds(type);
    if (!ids.length) {
      window.alert("请先勾选要删除的数据。");
      return;
    }
    if (!window.confirm("确认删除选中的 " + ids.length + " 条记录？删除后历史记录会保留。")) return;
    var handlers = {
      courses: clubData.eduDeleteCourseProduct,
      packageTemplates: clubData.eduDeletePackageTemplate,
      students: clubData.eduDeleteStudent,
      teachers: clubData.eduDeleteStaff,
      classes: clubData.eduDeleteClass,
      resources: clubData.eduDeleteResource,
      sessions: clubData.eduDeleteSession,
      availability: clubData.eduDeleteAvailability
    };
    var handler = handlers[type];
    if (!handler) return;
    return withEduSaving(Promise.all(ids.map(function (id) {
      return handler.call(clubData, selectedClubId, id, "Web 管理端删除");
    })));
  };

  var syncAvailabilityBulkSelection = function () {
    var form = document.getElementById("edu-availability-bulk-form");
    if (!form) return;
    var checked = 0;
    form.querySelectorAll('input[name="dates"]').forEach(function (input) {
      var label = input.closest(".edu-free-date");
      if (input.checked) checked += 1;
      if (label) label.classList.toggle("selected", input.checked);
    });
    var count = form.querySelector("[data-availability-selected-count]");
    if (count) count.textContent = checked;
  };

  var syncAvailabilityReleaseMode = function (form, mode) {
    if (!form) return;
    var nextMode = mode === "week" ? "week" : "day";
    form.setAttribute("data-availability-release-mode", nextMode);
    var hidden = form.querySelector('[name="releaseMode"]');
    if (hidden) hidden.value = nextMode;
    form.querySelectorAll("button[data-availability-release-mode]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-availability-release-mode") === nextMode);
    });
    syncAvailabilityBulkSelection();
  };

  var bindAvailabilityBulkControls = function (form) {
    if (!form) return;
    form.querySelectorAll("button[data-availability-release-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        syncAvailabilityReleaseMode(form, button.getAttribute("data-availability-release-mode"));
      });
    });
    form.querySelectorAll('input[name="dates"]').forEach(function (input) {
      input.addEventListener("change", syncAvailabilityBulkSelection);
    });
    form.querySelectorAll("[data-availability-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var parts = String(button.getAttribute("data-availability-preset") || "").split("-");
        if (parts.length === 2) {
          form.querySelector('[name="startTime"]').value = parts[0];
          form.querySelector('[name="endTime"]').value = parts[1];
        }
      });
    });
    form.querySelectorAll("[data-availability-skip]").forEach(function (button) {
      button.addEventListener("click", function () {
        var mode = button.getAttribute("data-availability-skip");
        var changed = 0;
        form.querySelectorAll('input[name="dates"]').forEach(function (input) {
          if (mode === "clear" && input.checked) {
            input.checked = false;
            changed += 1;
          }
          if (mode === "weekend" && input.dataset.weekend === "1" && input.checked) {
            input.checked = false;
            changed += 1;
          }
          if (mode === "holiday" && input.dataset.holiday === "1" && input.checked) {
            input.checked = false;
            changed += 1;
          }
        });
        var note = form.querySelector("[data-availability-calendar-note]");
        if (note) {
          note.textContent = mode === "holiday" && !changed ? "无节假日" : "已更新";
        }
        syncAvailabilityBulkSelection();
      });
    });
    syncAvailabilityReleaseMode(form, form.querySelector('[name="releaseMode"]') && form.querySelector('[name="releaseMode"]').value || "day");
    syncAvailabilityBulkSelection();
  };

  var bindEduPanelEvents = function () {
    if (!eduPanelEl) return;
    var courseForm = document.getElementById("edu-course-form");
    var studentForm = document.getElementById("edu-student-form");
    var packageForm = document.getElementById("edu-package-form");
    var walletForm = document.getElementById("edu-wallet-form");
    var classForm = document.getElementById("edu-class-form");
    var staffForm = document.getElementById("edu-staff-form");
    var availabilityForm = document.getElementById("edu-availability-form");
    var resourceForm = document.getElementById("edu-resource-form");
    var sessionForm = document.getElementById("edu-session-form");
    var attendanceForm = document.getElementById("edu-attendance-form");
    var copyMoveForm = document.getElementById("edu-copy-move-form");
    var batchSessionForm = document.getElementById("edu-batch-session-form");
    var availabilityBulkForm = document.getElementById("edu-availability-bulk-form");
    var scheduleFilterForm = document.getElementById("edu-schedule-filter-form");
    var scheduleViewFilterForm = document.getElementById("edu-schedule-view-filter-form");
    var scheduleExportForm = document.getElementById("schedule-export-form");
    var scheduleExportSettingsForm = document.getElementById("schedule-export-settings-form");
    var availabilityFilterForm = document.getElementById("edu-availability-filter-form");
    var reportFilterForm = document.getElementById("edu-report-filter-form");
    if (courseForm) courseForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduCourse(courseForm); });
    if (studentForm) studentForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduStudent(studentForm); });
    if (packageForm) packageForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduPackageTemplate(packageForm); });
    if (walletForm) walletForm.addEventListener("submit", function (e) { e.preventDefault(); createEduWallet(walletForm); });
    if (classForm) classForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduClass(classForm); });
    if (staffForm) staffForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduStaff(staffForm); });
    if (availabilityForm) availabilityForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduAvailability(availabilityForm); });
    if (availabilityBulkForm) {
      bindAvailabilityBulkControls(availabilityBulkForm);
      availabilityBulkForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduAvailabilityBulk(availabilityBulkForm); });
    }
    if (resourceForm) resourceForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduResource(resourceForm); });
    if (sessionForm) sessionForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduSession(sessionForm); });
    if (attendanceForm) attendanceForm.addEventListener("submit", function (e) { e.preventDefault(); submitEduAttendance(attendanceForm); });
    if (copyMoveForm) copyMoveForm.addEventListener("submit", function (e) { e.preventDefault(); applyCopyMoveSessions(copyMoveForm); });
    if (batchSessionForm) batchSessionForm.addEventListener("submit", function (e) { e.preventDefault(); applyBatchSessions(batchSessionForm); });
    if (scheduleFilterForm) scheduleFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.scheduleFilters = Object.assign({}, eduState.scheduleFilters || {}, formData(scheduleFilterForm));
      renderEduSessions();
    });
    if (scheduleViewFilterForm) scheduleViewFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.scheduleFilters = Object.assign({}, eduState.scheduleFilters || {}, formData(scheduleViewFilterForm));
      renderEduSessions();
    });
    if (scheduleExportForm) scheduleExportForm.addEventListener("submit", function (e) {
      e.preventDefault();
      downloadScheduleExcel();
    });
    if (scheduleExportSettingsForm) scheduleExportSettingsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      saveScheduleExportSettings(scheduleExportSettingsForm);
    });
    if (availabilityFilterForm) availabilityFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.availabilityFilters = formData(availabilityFilterForm);
      renderEduSessions();
    });
    if (reportFilterForm) reportFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.reportFilters = formData(reportFilterForm);
      renderEduReports();
    });

    document.querySelectorAll("[data-edu-modal-close]").forEach(function (button) {
      if (button.dataset.eduBound) return;
      button.dataset.eduBound = "1";
      button.addEventListener("click", closeEduModal);
    });
    eduPanelEl.querySelectorAll("[data-edu-create]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-edu-create");
        if (type === "courses") return openCourseModal({});
        if (type === "packageTemplates") return openPackageModal({});
        if (type === "students") return openStudentModal({});
        if (type === "wallets") return renderEduModal("报读/开课入账", walletFormHtml());
        if (type === "teachers") return openStaffModal({});
        if (type === "classes") return openClassModal({});
        if (type === "resources") return renderEduModal("新增教学资源", resourceFormHtml());
        if (type === "sessions") return renderEduModal("新增课次", sessionFormHtml({}));
        if (type === "availability") return renderEduModal("新增可排时间", availabilityFormHtml());
        if (type === "attendance") return openAttendanceModal();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteEduSelection(button.getAttribute("data-edu-delete"));
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-export]").forEach(function (button) {
      button.addEventListener("click", function () {
        exportEduData(button.getAttribute("data-edu-export"));
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-import-students]").forEach(function (button) {
      button.addEventListener("click", function () {
        var input = eduPanelEl.querySelector("[data-edu-import-students-file]");
        if (input) input.click();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-import-students-file]").forEach(function (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        input.value = "";
        importEduStudents(file);
      });
    });
    eduPanelEl.querySelectorAll("[data-schedule-export-download]").forEach(function (button) {
      button.addEventListener("click", downloadScheduleExcel);
    });
    eduPanelEl.querySelectorAll("[data-schedule-view-export]").forEach(function (button) {
      button.addEventListener("click", downloadCurrentScheduleViewExcel);
    });
    eduPanelEl.querySelectorAll("[data-schedule-export-save]").forEach(function (button) {
      button.addEventListener("click", saveScheduleExcel);
    });
    eduPanelEl.querySelectorAll("[data-schedule-export-saved-download]").forEach(function (button) {
      button.addEventListener("click", function () {
        downloadSavedScheduleExcel(button.getAttribute("data-schedule-export-saved-download"));
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-filter-reset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-edu-filter-reset");
        if (type === "schedule") eduState.scheduleFilters = {};
        if (type === "availability") eduState.availabilityFilters = {};
        if (type === "reports") {
          eduState.reportFilters = defaultReportFilters();
          return renderEduReports();
        }
        renderEduSessions();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-report-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        eduState.reportTab = button.getAttribute("data-edu-report-tab") || "fee";
        renderEduReports();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-schedule-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        eduState.scheduleTab = button.getAttribute("data-edu-schedule-tab") || "sessions";
        renderEduSessions();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-schedule-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        eduState.scheduleView = button.getAttribute("data-edu-schedule-view") || "list";
        renderEduSessions();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-room-free]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderEduModal("场地/球台资源", resourceListHtml());
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-schedule-tool]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-edu-schedule-tool");
        
        if (type === "progress") return renderEduModal("查看排课进度", scheduleProgressHtml());
        if (type === "copy") return openCopyMoveModal();
        if (type === "batch") return openBatchSessionModal();
        if (type === "teacher-free") return renderEduModal("查看教练空闲时间", teacherFreeHtml());
        if (type === "room-free") return renderEduModal("查看场地空闲时间", roomFreeHtml());
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-course]").forEach(function (button) {
      button.addEventListener("click", function () {
        openCourseModal(findById(eduState.courses, button.getAttribute("data-edit-course")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-package-template]").forEach(function (button) {
      button.addEventListener("click", function () {
        openPackageModal(findById(eduState.packageTemplates, button.getAttribute("data-edit-package-template")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-student]").forEach(function (button) {
      button.addEventListener("click", function () {
        openStudentModal(findById(eduState.students, button.getAttribute("data-edit-student")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-bind-student]").forEach(function (button) {
      button.addEventListener("click", function () {
        openStudentBindQr(findById(eduState.students, button.getAttribute("data-bind-student")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-staff]").forEach(function (button) {
      button.addEventListener("click", function () {
        openStaffModal(findById(eduState.staff, button.getAttribute("data-edit-staff")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-class]").forEach(function (button) {
      button.addEventListener("click", function () {
        openClassModal(findById(eduState.classes, button.getAttribute("data-edit-class")) || {});
      });
    });
    eduPanelEl.querySelectorAll("[data-edit-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderEduModal("编辑课次", sessionFormHtml(findById(eduState.sessions, button.getAttribute("data-edit-session")) || {}));
      });
    });
    eduPanelEl.querySelectorAll("[data-attendance-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        openAttendanceModal(button.getAttribute("data-attendance-session"));
      });
    });
    eduPanelEl.querySelectorAll("[data-booking-publish-range]").forEach(function (button) {
      button.addEventListener("click", function () {
        publishBookingAvailabilityRange(button.getAttribute("data-booking-publish-range"));
      });
    });
    eduPanelEl.querySelectorAll("[data-booking-publish-availability]").forEach(function (button) {
      button.addEventListener("click", function () {
        publishBookingAvailabilityRange(button.getAttribute("data-booking-publish-availability"));
      });
    });
    eduPanelEl.querySelectorAll("[data-booking-pause-availability]").forEach(function (button) {
      button.addEventListener("click", function () {
        pauseBookingAvailability(button.getAttribute("data-booking-pause-availability"));
      });
    });
    eduPanelEl.querySelectorAll("[data-copy-booking-availability-week]").forEach(function (button) {
      button.addEventListener("click", copyPreviousBookingAvailabilityWeek);
    });
    eduPanelEl.querySelectorAll("[data-booking-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        handleBookingMatrixAction(button.getAttribute("data-booking-id"), button.getAttribute("data-booking-action"));
      });
    });
    eduPanelEl.querySelectorAll("[data-approve-availability]").forEach(function (button) {
      button.addEventListener("click", function () {
        withEduSaving(clubData.eduApproveAvailability(selectedClubId, button.getAttribute("data-approve-availability"), true));
      });
    });
    eduPanelEl.querySelectorAll("[data-reject-availability]").forEach(function (button) {
      button.addEventListener("click", function () {
        withEduSaving(clubData.eduApproveAvailability(selectedClubId, button.getAttribute("data-reject-availability"), false));
      });
    });
    eduPanelEl.querySelectorAll("[data-cancel-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!window.confirm("确认取消这节课？")) return;
        withEduSaving(clubData.eduCancelSession(selectedClubId, button.getAttribute("data-cancel-session"), "Web 管理端取消"));
      });
    });
    var attendanceSession = document.getElementById("edu-attendance-session");
    if (attendanceSession) {
      attendanceSession.addEventListener("change", function () {
        loadAttendanceRoster(attendanceSession.value);
      });
    }
    eduPanelEl.querySelectorAll("[data-revoke-attendance]").forEach(function (button) {
      button.addEventListener("click", function () {
        var reason = window.prompt("请输入撤销原因", "误操作撤销");
        if (reason === null) return;
        withEduSaving(clubData.eduRevokeAttendance(selectedClubId, button.getAttribute("data-revoke-attendance"), reason));
      });
    });
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
    syncEduTabsAccess();
    renderOverview();
    renderFunnel();
    renderWeaknesses();
    renderMembers();
    renderLeads();
    renderActivities();
    loadBranchQRData();
    loadEduData();
  };

  var loadDashboard = function () {
    if (!selectedClubId) return;
    showDashboard();
    if (metaEl) metaEl.textContent = "正在加载真实运营数据...";
    return clubData.loadAdmin(selectedClubId).then(function (result) {
      dashboard = result || { overview: {}, members: [], leads: [] };
      clubData.detailClub(selectedClubId).then(function (data) {
        var detail = data.club || data || {};
        var branches = detail.branches || [];
        _clubDetail = detail;
        dashboard.leads = enrichLeadsWithBranches(dashboard.leads || [], branches, detail);
        renderDashboard();
      }).catch(function () {
        renderDashboard();
      });
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
            var thumb = item.thumbnailUrl || '';
            var videoSrc = item.videoUrl || '';
            var dims = [
              { label: '正手', val: Number(item.forehand) || 0 },
              { label: '反手', val: Number(item.backhand) || 0 },
              { label: '步伐', val: Number(item.footwork) || 0 },
              { label: '平衡', val: Number(item.balance) || 0 }
            ];
            var dimsHtml = dims.map(function (d) {
              return '<div class="admin-dim-row"><span class="admin-dim-label">' + escapeHtml(d.label) + '</span><span class="admin-dim-bar-bg"><span class="admin-dim-bar" style="width:' + Math.min(100, d.val) + '%"></span></span><span class="admin-dim-val">' + d.val + '</span></div>';
            }).join('');
            var thumbHtml = thumb
              ? '<div class="admin-thumb-wrap" onclick="window.open(\'' + escapeHtml(videoSrc) + '\', \'_blank\')" title="点击播放视频"><img class="admin-thumb" src="' + escapeHtml(thumb) + '" alt="缩略图" onerror="this.style.opacity=0"></div>'
              : '';
            return '<div class="mini-card">' + thumbHtml + '<div class="admin-dims">' + dimsHtml + '</div><p class="muted">评分 <strong>' + escapeHtml(item.score || '-') + '</strong> · ' + escapeHtml(item.date || item.createdAt || '') + '</p></div>';
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


  var loadBranchQRData = function () {
    var club = currentClub();
    var clubId = club.id || '';
    if (!clubId || !branchQrListEl) return;
    branchQrListEl.innerHTML = '<div class="empty-state compact">正在加载分店信息...</div>';
    if (_clubDetail) {
      var branches = _clubDetail.branches || [];
      if (!branches.length) branches = makeMainBranch(_clubDetail);
      renderBranchQRCodes(clubId, branches);
      return;
    }
    clubData.detailClub(clubId).then(function (data) {
      _clubDetail = data.club || data || {};
      var branches = _clubDetail.branches || [];
      if (!branches.length) branches = makeMainBranch(_clubDetail);
      renderBranchQRCodes(clubId, branches);
    }).catch(function () {
      branchQrListEl.innerHTML = '<div class="empty-state compact">加载分店失败</div>';
    });
  };

  var makeMainBranch = function (detail) {
    return [{
      name: detail.name || '主店',
      address: detail.address || '',
      lat: detail.lat,
      lng: detail.lng
    }];
  };

  var renderBranchQRCodes = function (clubId, branches) {
    if (!branchQrListEl) return;
    branchQrListEl.innerHTML = branches.map(function (branch, index) {
      return '' +
        '<div class="branch-qr-row">' +
          '<div class="branch-qr-info">' +
            '<strong>' + escapeHtml(branch.name || ('分店 ' + (index + 1))) + '</strong>' +
            '<span class="muted">' + escapeHtml(branch.address || '') + '</span>' +
          '</div>' +
          '<div class="branch-qr-actions">' +
            '<button type="button" class="club-action" data-qr-index="' + index + '">生成二维码</button>' +
          '</div>' +
        '</div>';
    }).join('');

    branchQrListEl.querySelectorAll('[data-qr-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-qr-index'), 10);
        showBranchQRPreview(clubId, branches[idx], idx);
      });
    });
  };

  var showBranchQRPreview = function (clubId, branch, index) {
    if (!branchQrPreviewEl) return;
    var branchName = branch.name || ('分店 ' + (index + 1));
    var branchAddr = branch.address || '';
    var scene = encodeURIComponent('c=' + clubId);
    if (typeof index === 'number' && index >= 0) scene = encodeURIComponent('c=' + clubId + '&b=' + index);
    var page = 'pages/clubs/trial';
    var qrUrl = window.location.origin + '/api/share-qrcode?scene=' + scene + '&page=' + encodeURIComponent(page);

    if (qrPreviewTitle) qrPreviewTitle.textContent = branchName + ' - 预约二维码';
    if (qrPreviewImg) qrPreviewImg.src = qrUrl;
    if (qrPreviewAddr) qrPreviewAddr.textContent = branchAddr;
    branchQrPreviewEl.style.display = 'flex';

    _qrBranchData = {
      clubId: clubId,
      branchName: branchName,
      branchAddr: branchAddr,
      qrUrl: qrUrl
    };
  };

  var hideBranchQRPreview = function () {
    if (branchQrPreviewEl) branchQrPreviewEl.style.display = 'none';
    _qrBranchData = null;
  };

  var downloadBranchPoster = function () {
    var data = _qrBranchData;
    if (!data) return;
    var canvas = document.createElement('canvas');
    var w = 300;
    var h = 450;
    canvas.width = w * 2;
    canvas.height = h * 2;
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    var club = currentClub();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(club.name || 'TT AI 乒乓球俱乐部', w / 2, 40);

    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(data.branchName, w / 2, 70);

    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText(data.branchAddr || '', w / 2, 90);

    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var qrSize = 200;
      var qrX = (w - qrSize) / 2;
      var qrY = 120;
      ctx.fillStyle = '#fff';
      ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('微信扫一扫 预约体验', w / 2, 360);
      ctx.fillText('www.ttcut.com', w / 2, 385);

      canvas.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (data.branchName || '分店') + '_预约二维码.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = function () {
      alert('二维码加载失败，请重试');
    };
    img.src = data.qrUrl;
  };

  var enrichLeadsWithBranches = function (leads, branches, clubDetail) {
    branches = branches || [];
    return leads.map(function (lead) {
      var bi = lead.branchIndex;
      if (bi != null && bi >= 0 && bi < branches.length) {
        lead.branchName = branches[bi].name || '';
      } else if (bi === 0 && !branches.length) {
        lead.branchName = '主店';
      }
      return lead;
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
      syncEduTabsAccess();
      loadDashboard();
    }).catch(function (err) {
      showLocked(clubData.errorMessage ? clubData.errorMessage(err) : "管理员权限校验失败。", err && err.isAuthError);
    });
  };

  if (clubSelectEl) {
    clubSelectEl.addEventListener("change", function () {
      selectedClubId = clubSelectEl.value;
      eduState.branchId = "";
      syncEduTabsAccess();
      if (memberDetailEl) memberDetailEl.style.display = "none";
      loadDashboard();
    });
  }

  if (eduTabsEl) {
    eduTabsEl.querySelectorAll("[data-edu-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        var targetTab = button.getAttribute("data-edu-tab");
        if (targetTab === "teachers" && !canManageTeachers()) return;
        eduState.activeTab = targetTab;
        syncEduTabsAccess();
        renderEduPanel();
      });
    });
  }

  if (eduBranchFilterEl) {
    eduBranchFilterEl.addEventListener("change", function () {
      eduState.branchId = eduBranchFilterEl.value;
      loadEduData();
    });
  }

  if (eduRefreshEl) {
    eduRefreshEl.addEventListener("click", function () {
      loadEduData();
    });
  }

  if (document.getElementById("qr-preview-close")) {
    document.getElementById("qr-preview-close").addEventListener("click", hideBranchQRPreview);
  }
  if (document.getElementById("qr-preview-close-btn")) {
    document.getElementById("qr-preview-close-btn").addEventListener("click", hideBranchQRPreview);
  }
  if (qrPreviewDownload) qrPreviewDownload.addEventListener("click", downloadBranchPoster);
  if (branchQrPreviewEl) {
    branchQrPreviewEl.addEventListener("click", function (e) {
      if (e.target === branchQrPreviewEl) hideBranchQRPreview();
    });
  }

  syncEduTabsAccess();
  initProfile();
})();
