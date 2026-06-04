(function () {
  var baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  var clubData = window.TTAI_CLUB_DATA || {};
  var params = new URLSearchParams(window.location.search);
  var clubId = params.get("id") || params.get("slug") || "";
  var club = null;
  var dataSource = "mock";

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

  var resolveUrl = function (path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.indexOf("/") === 0) return baseUrl + path;
    return baseUrl + "/" + path;
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
      var sourceText = dataSource === "api" ? "线上数据" : "预览数据";
      subtitleEl.textContent = (club.level || "俱乐部") + " · " + (club.district || "") + " · " + (club.hours || "") + " · " + sourceText;
    }

    if (photosEl) {
      photosEl.innerHTML = "";
      var photos = Array.isArray(club.photos) && club.photos.length ? club.photos : ["images/main.png"];
      photos.forEach(function (photo) {
        var img = document.createElement("img");
        img.src = resolveUrl(photo);
        img.alt = club.name || "俱乐部";
        img.className = "club-photo";
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
        return '<div class="club-detail-row">' + text + '</div>';
      }).join("");
    }

    if (tagsEl) {
      tagsEl.innerHTML = (club.tags || []).map(function (tag) {
        return '<span class="club-tag">' + tag + '</span>';
      }).join("");
    }

    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (club.phone) actionsEl.innerHTML += '<a class="club-action" href="tel:' + club.phone + '">电话咨询</a>';
      if (club.wechat) actionsEl.innerHTML += '<button class="club-action" type="button" data-wechat="' + club.wechat + '">复制微信</button>';
      if (club.lat && club.lng) {
        var mapUrl = "https://uri.amap.com/marker?position=" + club.lng + "," + club.lat + "&name=" + encodeURIComponent(club.name || "俱乐部");
        actionsEl.innerHTML += '<a class="club-action" href="' + mapUrl + '" target="_blank" rel="noopener">导航到店</a>';
      }
      actionsEl.querySelectorAll("[data-wechat]").forEach(function (button) {
        button.addEventListener("click", function () {
          copyWechat(button);
        });
      });
    }

    renderCards(coursesEl, club.courses, function (course) {
      return '<h4>' + course.name + '</h4><p>' + course.schedule + '</p><p class="muted">' + course.target + '</p>';
    });

    renderCards(coachesEl, club.coaches, function (coach) {
      return '<h4>' + coach.name + ' · ' + coach.title + '</h4><p class="muted">' + coach.focus + '</p>';
    });

    if (casesEl) {
      casesEl.innerHTML = "";
      (club.cases || []).forEach(function (item) {
        var card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = '<h4>' + item.title + '</h4><p>' + item.after + '</p><span class="muted">' + item.before + '</span>';
        casesEl.appendChild(card);
      });
    }
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
      var submitter = clubData.submitLead ? clubData.submitLead(clubId, {
        name: name,
        phone: phone,
        target: target,
        source: "web_club_detail"
      }) : Promise.resolve({ source: "mock" });
      submitter.then(function (result) {
        var sourceText = result.source === "api" ? "已提交到后端" : "已记录为接口预览";
        if (leadResult) {
          leadResult.textContent = "已记录 " + name + " 的" + target + "咨询。" + sourceText + "。";
        }
        leadForm.reset();
      }).catch(function () {
        if (leadResult) leadResult.textContent = "提交失败，请稍后重试。";
      });
    });
  }

  var loadDetail = function () {
    if (loadingEl) loadingEl.style.display = "block";
    var loader = clubData.detailClub ? clubData.detailClub(clubId) : Promise.resolve({ source: "mock", club: clubData.getClubById ? clubData.getClubById(clubId) : null });
    loader.then(function (result) {
      dataSource = result.source || "mock";
      club = result.club;
      renderDetail();
    }).catch(function () {
      club = clubData.getClubById ? clubData.getClubById(clubId) : null;
      dataSource = "mock";
      renderDetail();
    });
  };

  loadDetail();
})();
