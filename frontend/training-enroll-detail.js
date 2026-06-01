(function () {
  var apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  var baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  var params = new URLSearchParams(window.location.search);
  var clubId = params.get("id") || "";

  var nameEl = document.getElementById("club-name");
  var subtitleEl = document.getElementById("club-subtitle");
  var loadingEl = document.getElementById("club-loading");
  var emptyEl = document.getElementById("club-empty");
  var detailEl = document.getElementById("club-detail");
  var photosEl = document.getElementById("club-photos");
  var infoEl = document.getElementById("club-info");
  var tagsEl = document.getElementById("club-tags");
  var actionsEl = document.getElementById("club-actions");

  var resolveUrl = function (path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.indexOf("/") === 0) return baseUrl + path;
    return baseUrl + "/" + path;
  };

  var renderDetail = function (club) {
    if (!club) return;
    if (loadingEl) loadingEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "none";
    if (detailEl) detailEl.style.display = "grid";

    if (nameEl) nameEl.textContent = club.name || "俱乐部详情";
    if (subtitleEl) {
      var level = club.level ? club.level : "";
      subtitleEl.textContent = level ? "等级 · " + level : "俱乐部信息";
    }

    if (photosEl) {
      photosEl.innerHTML = "";
      var photos = Array.isArray(club.photos) ? club.photos : [];
      if (!photos.length) photos = ["images/club-default.png"];
      photos.forEach(function (p) {
        var img = document.createElement("img");
        img.src = resolveUrl(p);
        img.alt = "club";
        img.className = "club-photo";
        photosEl.appendChild(img);
      });
    }

    if (infoEl) {
      infoEl.innerHTML = "";
      var infoItems = [];
      if (club.address) infoItems.push('📍 ' + club.address);
      if (club.hours) infoItems.push('⏰ ' + club.hours);
      if (club.equipment) infoItems.push('🏓 ' + club.equipment);
      if (club.phone) infoItems.push('📞 ' + club.phone);
      if (club.mobile) infoItems.push('📱 ' + club.mobile);
      if (club.description) infoItems.push(club.description);
      infoItems.forEach(function (text) {
        var div = document.createElement("div");
        div.className = "club-detail-row";
        div.textContent = text;
        infoEl.appendChild(div);
      });
    }

    if (tagsEl) {
      tagsEl.innerHTML = "";
      var tags = Array.isArray(club.tags) ? club.tags : [];
      tags.forEach(function (tag) {
        var span = document.createElement("span");
        span.className = "club-tag";
        span.textContent = tag;
        tagsEl.appendChild(span);
      });
    }

    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (club.phone) {
        actionsEl.innerHTML += '<a class="club-action" href="tel:' + club.phone + '">📞 电话</a>';
      }
      if (club.wechat) {
        actionsEl.innerHTML += '<button class="club-action" data-wechat="' + club.wechat + '">💬 微信</button>';
      }
      if (club.lat && club.lng) {
        var mapUrl = 'https://uri.amap.com/marker?position=' + club.lng + ',' + club.lat + '&name=' + encodeURIComponent(club.name || "俱乐部");
        actionsEl.innerHTML += '<a class="club-action" href="' + mapUrl + '" target="_blank" rel="noopener">🗺️ 导航</a>';
      }
    }

    actionsEl.querySelectorAll('[data-wechat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wechat = btn.getAttribute('data-wechat') || '';
        if (!wechat) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(wechat).then(function () {
            btn.textContent = '✅ 已复制';
          });
        } else {
          window.prompt('复制微信号', wechat);
        }
      });
    });
  };

  var loadDetail = function () {
    if (!clubId) {
      if (loadingEl) loadingEl.style.display = "none";
      if (emptyEl) emptyEl.style.display = "block";
      if (subtitleEl) subtitleEl.textContent = "缺少俱乐部 ID";
      return;
    }

    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.style.display = "none";

    fetch(apiBase + "/clubs/detail?id=" + encodeURIComponent(clubId))
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        var data = payload && payload.data ? payload.data : payload;
        renderDetail(data);
      })
      .catch(function () {
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) emptyEl.style.display = "block";
      });
  };

  loadDetail();
})();
