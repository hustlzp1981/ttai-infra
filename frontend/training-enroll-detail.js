(function () {
  var baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  var clubData = window.TTAI_CLUB_DATA || {};
  var params = new URLSearchParams(window.location.search);
  var clubId = params.get("id") || params.get("slug") || "";
  var club = null;
  var viewer = null;
  var authorizations = [];

  var nameEl = document.getElementById("club-name");
  var subtitleEl = document.getElementById("club-subtitle");
  var loadingEl = document.getElementById("club-loading");
  var emptyEl = document.getElementById("club-empty");
  var detailEl = document.getElementById("club-detail");
  var photosEl = document.getElementById("club-photos");
  var infoEl = document.getElementById("club-info");
  var tagsEl = document.getElementById("club-tags");
  var actionsEl = document.getElementById("club-actions");
  var extraEl = document.getElementById("club-extra");
  var coursesEl = document.getElementById("club-courses");
  var coachesEl = document.getElementById("club-coaches");
  var casesSectionEl = document.getElementById("club-cases-section");
  var casesEl = document.getElementById("club-cases");
  var leadSectionEl = document.getElementById("club-lead-section");
  var leadForm = document.getElementById("club-lead-form");
  var leadResult = document.getElementById("lead-result");
  var authorizationPanel = document.getElementById("authorization-panel");

  var levelLabel = function (key) {
    var map = { "amateur": "业余", "semi_pro": "半专业", "professional": "专业", "national": "国家级" }
    return map[key] || key || "俱乐部"
  }

  var escapeHtml = function (value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  };

  var resolveUrl = function (path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.indexOf("/") === 0) return baseUrl + path;
    return baseUrl + "/" + path;
  };

  var currentClubId = function () {
    return (club && (club.id || club._id || club.slug)) || clubId;
  };

  var currentClubKeys = function () {
    return [club && club.id, club && club._id, club && club.slug, clubId].filter(Boolean).map(String);
  };

  var matchesCurrentClub = function (value) {
    return value !== undefined && value !== null && currentClubKeys().indexOf(String(value)) >= 0;
  };

  var viewerAdminClubs = function () {
    var clubs = viewer && viewer.clubAdmin && viewer.clubAdmin.clubs;
    if (!Array.isArray(clubs) && viewer && viewer.user && viewer.user.clubAdmin) clubs = viewer.user.clubAdmin.clubs;
    if (!Array.isArray(clubs)) clubs = viewer && viewer.clubs;
    if (!Array.isArray(clubs) && viewer && viewer.user) clubs = viewer.user.clubs;
    return Array.isArray(clubs) ? clubs : [];
  };

  var isClubAdminForCurrentClub = function () {
    var clubs = viewerAdminClubs();
    return clubs.some(function (item) {
      return matchesCurrentClub(item.id) || matchesCurrentClub(item._id) || matchesCurrentClub(item.slug);
    });
  };

  var isAuthorizedForCurrentClub = function () {
    return authorizations.some(function (item) {
      return (matchesCurrentClub(item.clubId) || item.club && (
        matchesCurrentClub(item.club.id) ||
        matchesCurrentClub(item.club._id) ||
        matchesCurrentClub(item.club.slug)
      )) &&
        (item.status || "active") === "active";
    });
  };

  var copyWechat = function (button) {
    var wechat = button.getAttribute("data-wechat") || "";
    if (!wechat) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(wechat).then(function () {
        button.textContent = "已复制";
      });
    } else {
      window.prompt("复制微信号", wechat);
    }
  };

  var renderCards = function (container, items, renderItem) {
    if (!container) return;
    container.innerHTML = "";
    (items || []).forEach(function (item) {
      var el = document.createElement("div");
      el.className = "mini-card";
      el.innerHTML = renderItem(item);
      container.appendChild(el);
    });
  };

  var renderAuthorization = function () {
    if (!authorizationPanel || !club) return;
    authorizationPanel.style.display = "block";

    if (!clubData.hasToken || !clubData.hasToken()) {
      authorizationPanel.innerHTML =
        '<div class="empty-state compact">登录后可授权俱乐部查看你的训练摘要。</div>' +
        '<a class="btn btn-secondary" href="login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search) + '">扫码登录</a>';
      return;
    }

    if (!viewer) {
      authorizationPanel.innerHTML =
        '<div class="empty-state compact">登录状态已失效，请重新扫码登录后授权。</div>' +
        '<a class="btn btn-secondary" href="login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search) + '">重新登录</a>';
      return;
    }

    if (isClubAdminForCurrentClub()) {
      authorizationPanel.innerHTML =
        '<div class="empty-state compact">当前账号可管理该俱乐部。</div>' +
        '<a class="btn btn-primary" href="club-admin.html?clubId=' + encodeURIComponent(currentClubId()) + '">进入管理后台</a>';
      return;
    }

    var authorized = isAuthorizedForCurrentClub();
    authorizationPanel.innerHTML =
      '<div class="empty-state compact">' +
        (authorized ? "已授权该俱乐部查看你的训练摘要和 AI 分析摘要。" : "授权后，俱乐部教练可查看你的训练摘要和 AI 分析摘要。") +
      '</div>' +
      '<button class="btn ' + (authorized ? "btn-secondary" : "btn-primary") + '" id="club-auth-toggle" type="button">' +
        (authorized ? "取消授权" : "授权俱乐部查看摘要") +
      '</button>';

    var toggle = document.getElementById("club-auth-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        toggle.disabled = true;
        var action = authorized ? clubData.revokeClubAuthorization(currentClubId()) : clubData.authorizeClub(currentClubId());
        action.then(function () {
          return loadViewer();
        }).then(renderAuthorization).catch(function (err) {
          toggle.disabled = false;
          authorizationPanel.querySelector(".empty-state").textContent = clubData.errorMessage ? clubData.errorMessage(err) : "授权操作失败";
        });
      });
    }
  };

  var renderDetail = function () {
    if (!club) {
      if (loadingEl) loadingEl.style.display = "none";
      if (emptyEl) emptyEl.style.display = "block";
      if (subtitleEl) subtitleEl.textContent = "缺少俱乐部信息";
      return;
    }

    if (loadingEl) loadingEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "none";
    if (detailEl) detailEl.style.display = "grid";
    if (extraEl) extraEl.style.display = "block";
    if (casesSectionEl) casesSectionEl.style.display = "block";
    if (leadSectionEl) leadSectionEl.style.display = "block";

    if (nameEl) nameEl.textContent = club.name || "俱乐部详情";
    if (subtitleEl) {
      subtitleEl.textContent = levelLabel(club.level) + " · " + (club.district || "") + " · " + (club.hours || "");
    }

    if (photosEl) {
      photosEl.innerHTML = "";
      var photos = Array.isArray(club.photos) && club.photos.length ? club.photos : ["images/main.png"];
      var isDefault = !(Array.isArray(club.photos) && club.photos.length);
      photos.forEach(function (photo) {
        var img = document.createElement("img");
        img.src = resolveUrl(photo);
        img.alt = club.name || "俱乐部";
        img.className = "club-photo";
        if (isDefault || photo.indexOf("cyh") >= 0) { img.style.objectFit = "contain"; img.style.background = "#e0e0e0"; }
        photosEl.appendChild(img);
      });
    }

    if (infoEl) {
      var rows = [
        club.summary,
        club.address ? "地址：" + club.address : "",
        club.hours ? "营业时间：" + club.hours : "",
        club.equipment ? "场地设备：" + club.equipment : "",
        club.phone ? "电话：" + club.phone : "",
        club.mobile ? "手机：" + club.mobile : ""
      ].filter(Boolean);
      infoEl.innerHTML = rows.map(function (text) {
        return '<div class="club-detail-row">' + escapeHtml(text) + '</div>';
      }).join("");
    }

    if (tagsEl) {
      tagsEl.innerHTML = (club.tags || []).map(function (tag) {
        return '<span class="club-tag">' + escapeHtml(tag) + '</span>';
      }).join("");
    }

    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (club.phone) actionsEl.innerHTML += '<a class="club-action" href="tel:' + escapeHtml(club.phone) + '">电话咨询</a>';
      if (club.wechat) actionsEl.innerHTML += '<button class="club-action" type="button" data-wechat="' + escapeHtml(club.wechat) + '">复制微信</button>';
      if (club.lat && club.lng) {
        var mapUrl = "https://uri.amap.com/marker?position=" + club.lng + "," + club.lat + "&name=" + encodeURIComponent(club.name || "俱乐部");
        actionsEl.innerHTML += '<a class="club-action" href="' + mapUrl + '" target="_blank" rel="noopener">导航到店</a>';
      }
      actionsEl.querySelectorAll("[data-wechat]").forEach(function (button) {
        button.addEventListener("click", function () { copyWechat(button); });
      });
    }

    renderCards(coursesEl, club.courses, function (course) {
      return '<h4>' + escapeHtml(course.name) + '</h4><p>' + escapeHtml(course.schedule) + '</p><p class="muted">' + escapeHtml(course.target) + '</p>';
    });

    renderCards(coachesEl, club.coaches, function (coach) {
      return '<h4>' + escapeHtml(coach.name) + ' · ' + escapeHtml(coach.title) + '</h4><p class="muted">' + escapeHtml(coach.focus) + '</p>';
    });

    if (casesEl) {
      casesEl.innerHTML = "";
      (club.cases || []).forEach(function (item) {
        var card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = '<h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.after) + '</p><span class="muted">' + escapeHtml(item.before) + '</span>';
        casesEl.appendChild(card);
      });
    }

    renderAuthorization();
  };

  var loadViewer = function () {
    if (!clubData.hasToken || !clubData.hasToken()) {
      viewer = null;
      authorizations = [];
      return Promise.resolve();
    }
    return Promise.all([
      clubData.me ? clubData.me().catch(function () { return null; }) : Promise.resolve(null),
      clubData.myAuthorizations ? clubData.myAuthorizations().catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] })
    ]).then(function (parts) {
      viewer = parts[0] && parts[0].user ? parts[0] : parts[0] || null;
      authorizations = (parts[1] && (parts[1].items || parts[1].authorizations)) || [];
    });
  };

  if (leadForm) {
    leadForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var formData = new FormData(leadForm);
      var name = formData.get("name") || "用户";
      var target = formData.get("target") || "课程咨询";
      var phone = formData.get("phone") || "";
      if (leadResult) {
        leadResult.style.display = "block";
        leadResult.textContent = "正在提交咨询...";
      }
      clubData.submitLead(currentClubId(), {
        name: name,
        phone: phone,
        target: target,
        source: "web_club_detail"
      }).then(function () {
        if (leadResult) leadResult.textContent = "已提交咨询，俱乐部会尽快联系你。";
        leadForm.reset();
      }).catch(function (err) {
        if (leadResult) leadResult.textContent = clubData.errorMessage ? clubData.errorMessage(err) : "提交失败，请稍后重试。";
      });
    });
  }

  var loadDetail = function () {
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.style.display = "none";
    Promise.all([
      clubData.detailClub ? clubData.detailClub(clubId) : Promise.reject(new Error("俱乐部接口未初始化")),
      loadViewer()
    ]).then(function (parts) {
      club = parts[0].club;
      renderDetail();
    }).catch(function (err) {
      club = null;
      if (loadingEl) loadingEl.style.display = "none";
      if (emptyEl) {
        emptyEl.style.display = "block";
        emptyEl.textContent = clubData.errorMessage ? clubData.errorMessage(err) : "加载失败，请稍后重试。";
      }
    });
  };

  loadDetail();
})();
