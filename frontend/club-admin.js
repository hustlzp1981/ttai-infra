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
    classes: [],
    staff: [],
    availability: [],
    resources: [],
    sessions: [],
    scheduleFilters: {},
    availabilityFilters: {}
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
    return branch ? branch.name : (branchId || "-");
  };

  var teacherName = function (teacherId) {
    var teacher = (eduState.staff || []).find(function (item) {
      return String(idOf(item)) === String(teacherId);
    });
    return teacher ? teacher.name : (teacherId || "-");
  };

  var courseName = function (courseId) {
    var course = findById(eduState.courses, courseId);
    return course ? course.name : (courseId || "-");
  };

  var className = function (classId) {
    var klass = findById(eduState.classes, classId);
    return klass ? klass.className : (classId || "-");
  };

  var studentName = function (studentId) {
    var student = findById(eduState.students, studentId);
    return student ? student.name : (studentId || "-");
  };

  var packageName = function (templateId) {
    var template = findById(eduState.packageTemplates, templateId);
    return template ? template.name : (templateId || "-");
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

  var labelOf = function (map, value) {
    return map[value] || value || "-";
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
      teacher: "老师",
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
    if (!list.length) return "老师";
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
      inactive: "停用"
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

  var badgeClass = function (type) {
    if (["active", "approved", "scheduled", "purchase", "ok", "none"].indexOf(type) >= 0) return "ok";
    if (["pending", "pending_attendance", "attendance"].indexOf(type) >= 0) return "warn";
    if (["cancelled", "inactive", "archived", "rejected", "revoked", "revoke"].indexOf(type) >= 0) return "muted";
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
        clubData.eduResources(selectedClubId, params),
        clubData.eduSessions(selectedClubId, params)
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
      eduState.resources = eduList(parts[8]);
      eduState.sessions = eduList(parts[9]);
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
    return '<option value="">选择老师</option>' + teachers.map(function (item) {
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
    return '<div class="edu-list-toolbar">' +
      '<div class="club-actions">' + createButton + deleteButton + '<button class="club-action" type="button" data-edu-export="' + type + '">导出</button></div>' +
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
      '<button class="edu-subtab ' + (active === 'sessions' ? 'active' : '') + '" type="button" data-edu-schedule-tab="sessions">详细课表</button>' +
      '<button class="edu-subtab ' + (active === 'availability' ? 'active' : '') + '" type="button" data-edu-schedule-tab="availability">老师可排时间管理</button>' +
    '</div>';
  };

  var filterBranchOptions = function (selected) {
    return '<option value="">全部校区</option>' + branchOptions(selected);
  };

  var filterTeacherOptions = function (selected) {
    return '<option value="">全部老师</option>' + teacherOptions(selected).replace('<option value="">选择老师</option>', '');
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
    return '<div class="edu-page-path">当前位置：教务管理 / 排课管理 / 详细课表</div>' +
      '<form class="edu-filter-panel" id="edu-schedule-filter-form">' +
        '<div class="edu-filter-grid">' +
          '<label>班级名称<input class="form-input" name="keyword" value="' + escapeHtml(filters.keyword || '') + '" placeholder="班级/课程"></label>' +
          '<label>上课时间<select class="form-input" name="range"><option value="all">不限</option><option value="today">今天</option><option value="thisWeek">本周</option><option value="lastWeek">上周</option><option value="nextWeek">下周</option><option value="thisMonth">本月</option><option value="lastMonth">上月</option></select></label>' +
          '<label>日段<select class="form-input" name="dayPart"><option value="">全部</option><option value="上午">上午</option><option value="下午">下午</option><option value="晚上">晚上</option></select></label>' +
          '<label>班级状态<select class="form-input" name="classStatus"><option value="">全部</option><option value="active">未结业班级的排课</option><option value="graduated">已结业班级的排课</option></select></label>' +
          '<label>所属校区<select class="form-input" name="branchId">' + filterBranchOptions(filters.branchId) + '</select></label>' +
          '<label>任课老师<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>' +
          '<label>助教<input class="form-input" name="assistant" value="' + escapeHtml(filters.assistant || '') + '" placeholder="暂按备注检索"></label>' +
          '<label>班主任<input class="form-input" name="headTeacher" value="' + escapeHtml(filters.headTeacher || '') + '" placeholder="暂按备注检索"></label>' +
          '<label>上课教室<input class="form-input" name="roomId" value="' + escapeHtml(filters.roomId || '') + '" placeholder="教室/球台"></label>' +
          '<label>课程属性<select class="form-input" name="teachingMode"><option value="">全部</option><option value="group">集体班</option><option value="private">一对一</option><option value="semi_private">一对多</option><option value="trial">体验课</option></select></label>' +
          '<label>班级标签<input class="form-input" name="classTag" value="' + escapeHtml(filters.classTag || '') + '" placeholder="标签"></label>' +
          '<div class="edu-filter-actions"><button class="club-action primary" type="submit">查询</button><button class="club-action" type="button" data-edu-filter-reset="schedule">重置</button><button class="club-action" type="button" data-edu-export="sessions">导出</button></div>' +
        '</div>' +
      '</form>';
  };

  var scheduleToolbarHtml = function () {
    return '<div class="edu-schedule-toolbar">' +
      '<div class="club-actions">' +
        '<button class="club-action primary" type="button" data-edu-create="sessions">集体班排课</button>' +
        '<button class="club-action" type="button" data-edu-create="sessions">一对一排课</button>' +
        '<button class="club-action" type="button" data-edu-create="sessions">可视化排课</button>' +
        '<button class="club-action" type="button" data-edu-schedule-tool="copy">复制/移动排课</button>' +
        '<button class="club-action" type="button" data-edu-schedule-tab="availability">查看老师空闲时间</button>' +
        '<button class="club-action" type="button" data-edu-room-free="1">查看教室空闲时间</button>' +
        '<button class="club-action" type="button" data-edu-schedule-tool="progress">查看排课进度</button>' +
        '<button class="club-action" type="button" data-edu-delete="sessions">批量操作</button>' +
        '<button class="club-action" type="button" data-edu-schedule-tool="columns">选择列</button>' +
      '</div>' +
    '</div>';
  };

  var scheduleViewSwitchHtml = function () {
    return '<div class="edu-view-switch">' +
      '<button class="active" type="button">按列表显示</button>' +
      '<button type="button">按月显示</button>' +
      '<button type="button">按周显示</button>' +
      '<button type="button">按周+老师显示</button>' +
      '<button type="button">按周+教室显示</button>' +
      '<button type="button">按天显示</button>' +
    '</div>';
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
      if (filters.classStatus === "active" && String(klass.graduationStatus || "active") === "graduated") return false;
      if (filters.classStatus === "graduated" && String(klass.graduationStatus || "") !== "graduated") return false;
      if (filters.roomId && text.indexOf(String(filters.roomId).toLowerCase()) < 0) return false;
      if (filters.teachingMode && String(course.teachingMode || "") !== String(filters.teachingMode)) return false;
      return true;
    });
  };

  var scheduleRowsHtml = function () {
    var rows = filteredSessions();
    if (!rows.length) return '<tr><td colspan="25">暂无课表记录</td></tr>';
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
        '<td>' + escapeHtml(course.termName || course.termCode || '-') + '</td>' +
        '<td>' + escapeHtml(course.gradeName || course.gradeCode || '-') + '</td>' +
        '<td>' + escapeHtml(course.subjectName || course.subjectCode || '-') + '</td>' +
        '<td>' + escapeHtml(course.typeName || course.courseLevelCode || '-') + '</td>' +
        '<td>' + escapeHtml(course.classTypeName || course.classTypeCode || '-') + '</td>' +
        '<td>' + escapeHtml(branchName(session.branchId)) + '</td>' +
        '<td>' + escapeHtml(session.teacherName || teacherName(session.teacherId)) + '</td>' +
        '<td>' + escapeHtml(session.assistantName || '-') + '</td>' +
        '<td>' + escapeHtml(session.headTeacherName || '-') + '</td>' +
        '<td>' + escapeHtml(employmentStatusLabel((findById(eduState.staff, session.teacherId) || {}).employmentStatus)) + '</td>' +
        '<td>' + escapeHtml(place) + '</td>' +
        '<td>' + escapeHtml(session.chapterTitle || '-') + '</td>' +
        '<td>' + escapeHtml(session.content || session.lessonContent || '-') + '</td>' +
        '<td><strong>' + escapeHtml(formatCST(session.startAt)) + '</strong><br><span class="muted">' + escapeHtml(dayPartText(session.startAt)) + ' · ' + escapeHtml(timeOnlyText(session.startAt)) + '-' + escapeHtml(timeOnlyText(session.endAt)) + '</span></td>' +
        '<td>' + escapeHtml(durationText(session.startAt, session.endAt)) + '</td>' +
        '<td>' + badgeHtml(sessionStatusLabel(session.status), session.status) + '</td>' +
        '<td>' + escapeHtml(session.remark || '-') + '</td>' +
        '<td>' + escapeHtml((session.attendedCount != null ? session.attendedCount : '-') + '/' + (session.expectedCount || klass.capacity || '-')) + '</td>' +
        '<td>' + escapeHtml(session.studentNames || '-') + '</td>' +
        '<td>' + escapeHtml(session.checkinCount != null ? session.checkinCount : '-') + '</td>' +
        '<td>' + escapeHtml(session.billingCount != null ? session.billingCount : '-') + '</td>' +
        '<td>' + escapeHtml(billed) + '</td>' +
        '<td><button class="club-action" data-edit-session="' + escapeHtml(id) + '">编辑</button><button class="club-action" data-cancel-session="' + escapeHtml(id) + '">取消</button></td>' +
      '</tr>';
    }).join("");
  };

  var availabilityFilterHtml = function () {
    var filters = eduState.availabilityFilters || {};
    return '<div class="edu-page-path">当前位置：教务管理 / 排课管理 / 老师可排时间管理</div>' +
      '<form class="edu-filter-panel" id="edu-availability-filter-form">' +
        '<div class="edu-filter-grid compact">' +
          '<label>老师<select class="form-input" name="teacherId">' + filterTeacherOptions(filters.teacherId) + '</select></label>' +
          '<label>校区<select class="form-input" name="branchId">' + filterBranchOptions(filters.branchId) + '</select></label>' +
          '<label>状态<select class="form-input" name="status"><option value="">全部</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝</option></select></label>' +
          '<label>星期<select class="form-input" name="weekday"><option value="">全部</option><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="7">周日</option></select></label>' +
          '<label>指定日期<input class="form-input" type="date" name="date" value="' + escapeHtml(filters.date || '') + '"></label>' +
          '<div class="edu-filter-actions"><button class="club-action primary" type="submit">查询</button><button class="club-action" type="button" data-edu-filter-reset="availability">重置</button><button class="club-action" type="button" data-edu-export="availability">导出</button></div>' +
        '</div>' +
      '</form>';
  };

  var filteredAvailability = function () {
    var filters = eduState.availabilityFilters || {};
    return (eduState.availability || []).filter(function (item) {
      if (filters.teacherId && String(item.teacherId) !== String(filters.teacherId)) return false;
      if (filters.branchId && String(item.branchId) !== String(filters.branchId)) return false;
      if (filters.status && String(item.status || "") !== String(filters.status)) return false;
      if (filters.weekday && String(item.weekday || "") !== String(filters.weekday)) return false;
      if (filters.date && String(item.date || "") !== String(filters.date)) return false;
      return true;
    });
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
      '<label>类型<input class="form-input" name="typeName" value="' + escapeHtml(item.typeName || item.courseLevelCode || '') + '"></label>' +
      '<label>班型<input class="form-input" name="classTypeName" value="' + escapeHtml(item.classTypeName || item.classTypeCode || '') + '"></label>' +
      '<label>期段<input class="form-input" name="termName" value="' + escapeHtml(item.termName || item.termCode || '') + '"></label>' +
      '<label>年份<input class="form-input" name="year" value="' + escapeHtml(item.year || '') + '"></label>' +
      '<label>按期收费<input class="form-input" name="termFeeText" value="' + escapeHtml(priceRules.termFeeText || '') + '"></label>' +
      '<label>默认扣课<input class="form-input" name="defaultDeductUnits10" type="number" min="0" step="0.1" value="' + escapeHtml(lessonInputValue(item.defaultDeductUnits10, '1')) + '"></label>' +
      '<label>计划排课数<input class="form-input" name="plannedSessionCount" type="number" min="0" value="' + escapeHtml(item.plannedSessionCount || 0) + '"></label>' +
      '<label>容量<input class="form-input" name="capacity" type="number" min="0" value="' + escapeHtml(item.capacity || 0) + '"></label>' +
      '<label>动态消课<select class="form-input" name="dynamicDeduct"><option value="false">否</option><option value="true">是</option></select></label>' +
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
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>课程</th><th>单价</th><th>类型/班型</th><th>期段/年份</th><th>课程类型</th><th>按期收费</th><th>动态消课</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.courses.length ? eduState.courses.map(function (course) {
          var rules = course.priceRules || {};
          return '<tr><td>' + rowCheck('courses', idOf(course)) + ' <strong>' + escapeHtml(course.name) + '</strong><br><span class="muted">' + escapeHtml(course.unit || '-') + '</span></td><td>' + escapeHtml(moneyText(course.standardPriceCents)) + '</td><td>' + escapeHtml(course.typeName || course.courseLevelCode || '-') + '<br><span class="muted">' + escapeHtml(course.classTypeName || course.classTypeCode || '-') + '</span></td><td>' + escapeHtml(course.termName || course.termCode || '-') + '<br><span class="muted">' + escapeHtml(course.year || '-') + '</span></td><td>' + escapeHtml(teachingModeLabel(course.teachingMode)) + '</td><td>' + escapeHtml(rules.termFeeText || '-') + '</td><td>' + badgeHtml(course.dynamicDeduct ? '是' : '否', course.dynamicDeduct ? 'pending' : 'none') + '</td><td>' + badgeHtml(course.status === 'active' ? '启用' : '停用', course.status) + '</td><td><button class="club-action" data-edit-course="' + escapeHtml(idOf(course)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="9">暂无课程</td></tr>') +
      '</tbody></table></div>' +
      eduActionBar("packageTemplates", "新增收费/课时规格") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>规格</th><th>课程</th><th>课时</th><th>有效天数</th><th>默认价格</th><th>默认扣课</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.packageTemplates.length ? eduState.packageTemplates.map(function (tpl) {
          return '<tr><td>' + rowCheck('packageTemplates', idOf(tpl)) + ' <strong>' + escapeHtml(tpl.name) + '</strong></td><td>' + escapeHtml(courseName(tpl.courseProductId)) + '</td><td>' + escapeHtml(lessonText(tpl.lessonUnits10)) + '</td><td>' + (tpl.validDays || 0) + '</td><td>' + escapeHtml(moneyText(tpl.defaultPriceCents)) + '</td><td>' + escapeHtml(lessonText(tpl.deductUnits10)) + '</td><td>' + badgeHtml(tpl.status === 'active' ? '启用' : tpl.status, tpl.status) + '</td><td><button class="club-action" data-edit-package-template="' + escapeHtml(idOf(tpl)) + '">编辑</button></td></tr>';
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
      '<label>水平<input class="form-input" name="level" value="' + escapeHtml(item.level || '') + '"></label>' +
      '<label>状态<select class="form-input" name="status"><option value="active">在读</option><option value="inactive">停用</option><option value="archived">归档</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存学员</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openStudentModal = function (item) {
    renderEduModal(idOf(item) ? "编辑学员" : "新增学员", studentFormHtml(item));
    setSelectValue("status", item && item.status || "active");
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
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>学员</th><th>分店</th><th>手机号</th><th>家长</th><th>水平</th><th>剩余课时</th><th>最近到期</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.students.length ? eduState.students.map(function (student) {
          var summary = studentWalletSummary(idOf(student));
          var balanceType = summary.remainingUnits10 > 10 ? "ok" : (summary.remainingUnits10 > 0 ? "pending" : "none");
          return '<tr><td>' + rowCheck('students', idOf(student)) + ' <strong>' + escapeHtml(student.name) + '</strong><br><span class="muted">' + escapeHtml(student.source || '-') + '</span></td><td>' + escapeHtml(branchName(student.branchId)) + '</td><td>' + escapeHtml(student.phone || '-') + '</td><td>' + escapeHtml(student.parentName || '-') + '</td><td>' + escapeHtml(student.level || '-') + '</td><td>' + badgeHtml(lessonText(summary.remainingUnits10), balanceType) + '</td><td>' + escapeHtml(dateText(summary.nearestExpireAt)) + '</td><td>' + badgeHtml(student.status === 'active' ? '在读' : student.status, student.status) + '</td><td><button class="club-action" data-edit-student="' + escapeHtml(idOf(student)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="9">暂无学员</td></tr>') +
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
      '<label>任课老师<select class="form-input" name="teacherId">' + teacherOptions(item.teacherId) + '</select></label>' +
      '<label>容量<input class="form-input" name="capacity" type="number" min="0" value="' + escapeHtml(item.capacity || 0) + '"></label>' +
      '<label>计划课次<input class="form-input" name="plannedSessionCount" type="number" min="0" value="' + escapeHtml(item.plannedSessionCount || 0) + '"></label>' +
      '<label>默认教室<input class="form-input" name="defaultRoomId" value="' + escapeHtml(item.defaultRoomId || '') + '"></label>' +
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
      eduFrameStart("班级管理", "班级是长期教学组织，关联课程、老师、容量和默认资源。") +
      eduActionBar("classes", "新增班级") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班级</th><th>分店</th><th>课程</th><th>老师</th><th>容量</th><th>计划</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.classes.length ? eduState.classes.map(function (klass) {
          return '<tr><td>' + rowCheck('classes', idOf(klass)) + ' <strong>' + escapeHtml(klass.className) + '</strong><br><span class="muted">' + escapeHtml(klass.graduationStatus || '-') + '</span></td><td>' + escapeHtml(branchName(klass.branchId)) + '</td><td>' + escapeHtml(klass.courseNameSnapshot || courseName(klass.courseProductId)) + '</td><td>' + escapeHtml(klass.teacherName || teacherName(klass.teacherId)) + '</td><td>' + (klass.capacity || 0) + '</td><td>' + (klass.plannedSessionCount || 0) + '</td><td>' + badgeHtml(klass.status === 'active' ? '启用' : klass.status, klass.status) + '</td><td><button class="club-action" data-edit-class="' + escapeHtml(idOf(klass)) + '">编辑</button></td></tr>';
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
      '<div class="club-actions"><button class="club-action primary" type="submit">保存老师</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var openStaffModal = function (item) {
    renderEduModal(idOf(item) ? "编辑老师" : "新增老师", staffFormHtml(item));
    setSelectValue("employmentStatus", item && item.employmentStatus || "active");
  };

  var renderEduTeachers = function () {
    if (!canManageTeachers()) {
      eduState.activeTab = "courses";
      syncEduTabsAccess();
      return renderEduCourses();
    }
    eduPanelEl.innerHTML =
      eduFrameStart("老师管理", "维护老师档案；排课和老师可排时间管理都会引用这里的数据。") +
      eduActionBar("teachers", "新增老师") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>老师</th><th>分店</th><th>手机号</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        (eduState.staff.length ? eduState.staff.map(function (item) {
          return '<tr><td>' + rowCheck('teachers', idOf(item)) + ' <strong>' + escapeHtml(item.name) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(item.phone || '-') + '</td><td>' + escapeHtml(staffRolesText(item.roles)) + '</td><td>' + badgeHtml(employmentStatusLabel(item.employmentStatus), item.employmentStatus) + '</td><td><button class="club-action" data-edit-staff="' + escapeHtml(idOf(item)) + '">编辑</button></td></tr>';
        }).join("") : '<tr><td colspan="6">暂无老师</td></tr>') +
      '</tbody></table></div>';
    bindEduPanelEvents();
  };

  var availabilityFormHtml = function () {
    return '<form class="edu-form" id="edu-availability-form">' +
      '<label>老师<select class="form-input" name="teacherId" required>' + teacherOptions() + '</select></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions() + '</select></label>' +
      '<label>星期<select class="form-input" name="weekday"><option value="">按日期</option><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="7">周日</option></select></label>' +
      '<label>指定日期<input class="form-input" name="date" type="date"></label>' +
      '<label>开始<input class="form-input" name="startTime" type="time" required></label>' +
      '<label>结束<input class="form-input" name="endTime" type="time" required></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存可排时间</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var renderEduAvailability = function () {
    return availabilityFilterHtml() +
      eduActionBar("availability", "新增可排时间") +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>老师</th><th>所属校区</th><th>日期类型</th><th>星期</th><th>指定日期</th><th>开始时间</th><th>结束时间</th><th>状态</th><th>审核</th><th>操作</th></tr></thead><tbody>' +
        (filteredAvailability().length ? filteredAvailability().map(function (item) {
          var dateType = item.date ? "指定日期" : (item.weekday ? "每周重复" : "-");
          var actions = item.status === 'pending' ? '<button class="club-action primary" data-approve-availability="' + escapeHtml(idOf(item)) + '">通过</button><button class="club-action" data-reject-availability="' + escapeHtml(idOf(item)) + '">拒绝</button>' : '-';
          return '<tr><td>' + rowCheck('availability', idOf(item)) + ' <strong>' + escapeHtml(teacherName(item.teacherId)) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(dateType) + '</td><td>' + escapeHtml(weekdayText(item.weekday)) + '</td><td>' + escapeHtml(item.date || '-') + '</td><td>' + escapeHtml(item.startTime || '-') + '</td><td>' + escapeHtml(item.endTime || '-') + '</td><td>' + badgeHtml(availabilityStatusLabel(item.status), item.status) + '</td><td>' + actions + '</td><td>-</td></tr>';
        }).join("") : '<tr><td colspan="10">暂无可排时间</td></tr>') +
      '</tbody></table></div>';
  };

  var resourceFormHtml = function () {
    return '<form class="edu-form" id="edu-resource-form">' +
      '<label>资源名称<input class="form-input" name="name" required></label>' +
      '<label>分店<select class="form-input" name="branchId" required>' + branchOptions() + '</select></label>' +
      '<label>类型<select class="form-input" name="type"><option value="table">球台</option><option value="room">教室</option></select></label>' +
      '<label>编号<input class="form-input" name="tableNo" placeholder="球台号"></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存资源</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var resourceListHtml = function () {
    return '<div class="admin-table-wrap compact"><table class="admin-table"><thead><tr><th>资源</th><th>分店</th><th>类型</th><th>编号</th><th>状态</th></tr></thead><tbody>' +
      (eduState.resources.length ? eduState.resources.map(function (item) {
        return '<tr><td><strong>' + escapeHtml(item.name) + '</strong></td><td>' + escapeHtml(branchName(item.branchId)) + '</td><td>' + escapeHtml(item.type === 'room' ? '教室' : '球台') + '</td><td>' + escapeHtml(item.tableNo || item.roomId || '-') + '</td><td>' + badgeHtml(item.status === 'active' ? '启用' : item.status, item.status) + '</td></tr>';
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
      '<label>老师<select class="form-input" name="teacherId" required>' + teacherOptions(item.teacherId) + '</select></label>' +
      '<label>开始<input class="form-input" name="startAt" type="datetime-local" value="' + escapeHtml(formatDateTimeLocal(item.startAt)) + '" required></label>' +
      '<label>结束<input class="form-input" name="endAt" type="datetime-local" value="' + escapeHtml(formatDateTimeLocal(item.endAt)) + '" required></label>' +
      '<label>教室<input class="form-input" name="roomId" value="' + escapeHtml(item.roomId || '') + '"></label>' +
      '<label>球台<input class="form-input" name="tableNos" value="' + escapeHtml((item.tableNos || []).join(',')) + '" placeholder="1,2"></label>' +
      '<label>跳过冲突<select class="form-input" name="skipConflict"><option value="">不跳过</option><option value="1">管理员确认跳过</option></select></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">保存课次</button><button class="club-action" type="button" data-edu-modal-close="1">取消</button></div>' +
    '</form>';
  };

  var renderEduSessions = function () {
    var active = eduState.scheduleTab || "sessions";
    eduPanelEl.innerHTML =
      eduFrameStart("排课管理", "详细课表负责课次；老师可排时间管理负责排课前置时间约束。") +
      eduScheduleTabs() +
      (active === "availability" ? renderEduAvailability() :
      scheduleFilterHtml() +
      scheduleToolbarHtml() +
      scheduleViewSwitchHtml() +
      '<div class="admin-table-wrap wide"><table class="admin-table"><thead><tr><th>班级名称</th><th>课程名称</th><th>课程所属期段</th><th>课程所属年级</th><th>课程所属科目</th><th>课程所属类型</th><th>课程所属班型</th><th>所属校区</th><th>任课老师</th><th>助教</th><th>班主任</th><th>任课老师在职类型</th><th>上课教室</th><th>章节内容</th><th>上课内容</th><th>上课时间</th><th>上课时长</th><th>状态</th><th>备注</th><th>实到/应到</th><th>上课学员</th><th>扫码/签到人数</th><th>计费人数</th><th>计费数量</th><th>操作</th></tr></thead><tbody>' +
        scheduleRowsHtml() +
      '</tbody></table></div>');
    if (active === "sessions") {
      var sf = eduState.scheduleFilters || {};
      setFormValue("edu-schedule-filter-form", "range", sf.range || "all");
      setFormValue("edu-schedule-filter-form", "dayPart", sf.dayPart || "");
      setFormValue("edu-schedule-filter-form", "classStatus", sf.classStatus || "");
      setFormValue("edu-schedule-filter-form", "teachingMode", sf.teachingMode || "");
    } else {
      var af = eduState.availabilityFilters || {};
      setFormValue("edu-availability-filter-form", "status", af.status || "");
      setFormValue("edu-availability-filter-form", "weekday", af.weekday || "");
    }
    bindEduPanelEvents();
  };

  var attendanceFormHtml = function () {
    var walletOptions = '<option value="">选择课包</option>' + (eduState.attendanceWallets || []).map(function (wallet) {
      var id = idOf(wallet);
      var label = packageName(wallet.packageTemplateId) + ' · 剩余 ' + lessonText(wallet.remainingUnits10);
      return '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    return '<form class="edu-form" id="edu-attendance-form">' +
      '<label>课次<select class="form-input" name="sessionId" required>' + (eduState.sessions || []).map(function (session) {
        var id = idOf(session);
        return '<option value="' + escapeHtml(id) + '">' + escapeHtml(formatCST(session.startAt) + ' · ' + (session.classNameSnapshot || session.courseNameSnapshot || id)) + '</option>';
      }).join('') + '</select></label>' +
      '<label>学员<select class="form-input" name="studentId" id="edu-attendance-student" required>' + studentOptions(eduState.attendanceStudentId) + '</select></label>' +
      '<label>课包<select class="form-input" name="walletId">' + walletOptions + '</select></label>' +
      '<label>状态<select class="form-input" name="status"><option value="attended">出勤扣课</option><option value="leave">请假</option><option value="absent">缺席</option></select></label>' +
      '<label>扣课课时<input class="form-input" name="deductUnits10" type="number" min="0" step="0.1" value="1"></label>' +
      '<label class="wide">课堂备注<input class="form-input" name="coachNote"></label>' +
      '<div class="club-actions"><button class="club-action primary" type="submit">确认点名</button><button class="club-action" type="button" id="edu-load-attendance-wallets">加载可用课时</button></div>' +
    '</form>';
  };

  var renderEduAttendance = function () {
    eduPanelEl.innerHTML =
      eduFrameStart("点名账本", "出勤扣课生成流水；撤销会返还课时，请假/缺席不扣课。") +
      eduActionBar("ledgers", "", '<div class="club-actions"><button class="club-action primary" type="button" data-edu-create="attendance">点名划课</button></div>') +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>时间</th><th>类型</th><th>学员</th><th>课包</th><th>变动</th><th>余额</th><th>原因</th><th>操作</th></tr></thead><tbody>' +
        (eduState.ledgers.length ? eduState.ledgers.map(function (ledger) {
          var canRevoke = ledger.type === 'attendance' && ledger.relatedAttendanceId;
          return '<tr><td>' + escapeHtml(formatCST(ledger.createdAt)) + '</td><td>' + badgeHtml(ledgerTypeLabel(ledger.type), ledger.type) + '</td><td><strong>' + escapeHtml(studentName(ledger.studentId)) + '</strong></td><td><span class="muted">' + escapeHtml(ledger.walletId || '-') + '</span></td><td><strong>' + escapeHtml(lessonText(ledger.unitsDelta10)) + '</strong></td><td>' + escapeHtml(lessonText(ledger.balanceAfter10)) + '</td><td>' + escapeHtml(ledger.reason || '-') + '</td><td>' + (canRevoke ? '<button class="club-action" data-revoke-attendance="' + escapeHtml(ledger.relatedAttendanceId) + '">撤销</button>' : '-') + '</td></tr>';
        }).join("") : '<tr><td colspan="8">暂无账本流水</td></tr>') +
      '</tbody></table></div>';
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

  var saveEduAvailability = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSaveAvailability(selectedClubId, {
      teacherId: data.teacherId,
      branchId: data.branchId,
      weekday: data.weekday,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime
    }));
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

  var loadAttendanceWallets = function (studentId) {
    if (!studentId) {
      eduState.attendanceStudentId = "";
      eduState.attendanceWallets = [];
      if (document.getElementById("edu-modal-root")) {
        renderEduModal("点名划课", attendanceFormHtml());
      } else {
        renderEduAttendance();
      }
      return Promise.resolve();
    }
    eduState.attendanceStudentId = studentId;
    return clubData.eduStudentWallets(selectedClubId, studentId, { status: "active" }).then(function (data) {
      eduState.attendanceWallets = eduList(data);
      if (document.getElementById("edu-modal-root")) {
        renderEduModal("点名划课", attendanceFormHtml());
        setSelectValue("studentId", studentId);
      } else {
        renderEduAttendance();
      }
    }).catch(function (err) {
      eduPanelEl.insertAdjacentHTML("afterbegin", eduErrorHtml(err));
    });
  };

  var submitEduAttendance = function (form) {
    var data = formData(form);
    return withEduSaving(clubData.eduSubmitAttendance(selectedClubId, data.sessionId, [{
      studentId: data.studentId,
      walletId: data.walletId,
      status: data.status || "attended",
      deductUnits10: lessonInputUnits10(data.deductUnits10),
      coachNote: data.coachNote
    }]));
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

  var exportEduData = function (type) {
    var exporters = {
      courses: {
        name: "课程管理",
        rows: eduState.courses,
        columns: [
          { label: "课程", value: function (row) { return row.name; } },
          { label: "单价", value: function (row) { return moneyText(row.standardPriceCents); } },
          { label: "类型", value: function (row) { return row.typeName || row.courseLevelCode || ""; } },
          { label: "班型", value: function (row) { return row.classTypeName || row.classTypeCode || ""; } },
          { label: "课程类型", value: function (row) { return teachingModeLabel(row.teachingMode); } },
          { label: "状态", value: function (row) { return row.status || ""; } }
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
          { label: "剩余课时", value: function (row) { return lessonText(studentWalletSummary(idOf(row)).remainingUnits10); } },
          { label: "状态", value: function (row) { return row.status || ""; } }
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
        name: "老师管理",
        rows: eduState.staff,
        columns: [
          { label: "老师", value: function (row) { return row.name; } },
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
          { label: "老师", value: function (row) { return row.teacherName || teacherName(row.teacherId); } },
          { label: "状态", value: function (row) { return row.status || ""; } }
        ]
      },
      resources: {
        name: "教学资源",
        rows: eduState.resources,
        columns: [
          { label: "资源", value: function (row) { return row.name; } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "类型", value: function (row) { return row.type || ""; } },
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
          { label: "老师", value: function (row) { return row.teacherName || teacherName(row.teacherId); } },
          { label: "状态", value: function (row) { return sessionStatusLabel(row.status); } }
        ]
      },
      availability: {
        name: "老师可排时间",
        rows: eduState.availability,
        columns: [
          { label: "老师", value: function (row) { return teacherName(row.teacherId); } },
          { label: "分店", value: function (row) { return branchName(row.branchId); } },
          { label: "日期/星期", value: function (row) { return row.date || (row.weekday ? '周' + '一二三四五六日'.charAt(Number(row.weekday) - 1) : ''); } },
          { label: "开始", value: function (row) { return row.startTime || ""; } },
          { label: "结束", value: function (row) { return row.endTime || ""; } },
          { label: "状态", value: function (row) { return row.status || ""; } }
        ]
      },
      ledgers: {
        name: "点名账本",
        rows: eduState.ledgers,
        columns: [
          { label: "时间", value: function (row) { return formatCST(row.createdAt); } },
          { label: "类型", value: function (row) { return ledgerTypeLabel(row.type); } },
          { label: "学员", value: function (row) { return studentName(row.studentId); } },
          { label: "变动", value: function (row) { return lessonText(row.unitsDelta10); } },
          { label: "余额", value: function (row) { return lessonText(row.balanceAfter10); } },
          { label: "原因", value: function (row) { return row.reason || ""; } }
        ]
      }
    };
    var item = exporters[type];
    if (!item) return;
    downloadCsv(item.name, item.rows || [], item.columns);
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
    var scheduleFilterForm = document.getElementById("edu-schedule-filter-form");
    var availabilityFilterForm = document.getElementById("edu-availability-filter-form");
    if (courseForm) courseForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduCourse(courseForm); });
    if (studentForm) studentForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduStudent(studentForm); });
    if (packageForm) packageForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduPackageTemplate(packageForm); });
    if (walletForm) walletForm.addEventListener("submit", function (e) { e.preventDefault(); createEduWallet(walletForm); });
    if (classForm) classForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduClass(classForm); });
    if (staffForm) staffForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduStaff(staffForm); });
    if (availabilityForm) availabilityForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduAvailability(availabilityForm); });
    if (resourceForm) resourceForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduResource(resourceForm); });
    if (sessionForm) sessionForm.addEventListener("submit", function (e) { e.preventDefault(); saveEduSession(sessionForm); });
    if (attendanceForm) attendanceForm.addEventListener("submit", function (e) { e.preventDefault(); submitEduAttendance(attendanceForm); });
    if (scheduleFilterForm) scheduleFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.scheduleFilters = formData(scheduleFilterForm);
      renderEduSessions();
    });
    if (availabilityFilterForm) availabilityFilterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      eduState.availabilityFilters = formData(availabilityFilterForm);
      renderEduSessions();
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
        if (type === "attendance") return renderEduModal("点名划课", attendanceFormHtml());
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
    eduPanelEl.querySelectorAll("[data-edu-filter-reset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-edu-filter-reset");
        if (type === "schedule") eduState.scheduleFilters = {};
        if (type === "availability") eduState.availabilityFilters = {};
        renderEduSessions();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-schedule-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        eduState.scheduleTab = button.getAttribute("data-edu-schedule-tab") || "sessions";
        renderEduSessions();
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-room-free]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderEduModal("教室/球台资源", resourceListHtml());
      });
    });
    eduPanelEl.querySelectorAll("[data-edu-schedule-tool]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-edu-schedule-tool");
        if (type === "columns") return window.alert("已显示详细课表常用列。");
        if (type === "progress") return window.alert("请先选择班级或按班级名称查询后查看排课进度。");
        if (type === "copy") return window.alert("请先勾选要复制/移动的课次。");
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
    var loadWalletButton = document.getElementById("edu-load-attendance-wallets");
    var attendanceStudent = document.getElementById("edu-attendance-student");
    if (loadWalletButton && attendanceStudent) {
      loadWalletButton.addEventListener("click", function () {
        loadAttendanceWallets(attendanceStudent.value);
      });
      attendanceStudent.addEventListener("change", function () {
        loadAttendanceWallets(attendanceStudent.value);
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
