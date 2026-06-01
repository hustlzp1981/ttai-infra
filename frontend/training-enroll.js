(function () {
  var apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  var baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";

  var clubsList = document.getElementById("clubs-list");
  var emptyEl = document.getElementById("clubs-empty");
  var loadingEl = document.getElementById("clubs-loading");
  var citySelect = document.getElementById("city-select");
  var districtSelect = document.getElementById("district-select");

  var districts = [
    "全部区域",
    "浦东新区",
    "黄浦区",
    "徐汇区",
    "长宁区",
    "静安区",
    "普陀区",
    "虹口区",
    "杨浦区",
    "闵行区",
    "宝山区",
    "嘉定区",
    "松江区",
    "青浦区"
  ];

  var resolveUrl = function (path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.indexOf("/") === 0) return baseUrl + path;
    return baseUrl + "/" + path;
  };

  var renderDistricts = function () {
    if (!districtSelect) return;
    districtSelect.innerHTML = "";
    districts.forEach(function (d) {
      var option = document.createElement("option");
      option.value = d === "全部区域" ? "" : d;
      option.textContent = d;
      districtSelect.appendChild(option);
    });
  };

  var renderClubs = function (items) {
    if (!clubsList) return;
    clubsList.innerHTML = "";
    if (!items || items.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    items.forEach(function (club) {
      var card = document.createElement("div");
      card.className = "club-card";

      var photo = "images/club-default.png";
      if (club.photos && club.photos.length) photo = resolveUrl(club.photos[0]);

      var tagsHtml = "";
      var tags = Array.isArray(club.tags) ? club.tags : [];
      tags.slice(0, 4).forEach(function (tag) {
        tagsHtml += '<span class="club-tag">' + tag + '</span>';
      });

      var contactButtons = "";
      var clubId = club.id || club._id || "";
      if (club.phone) {
        contactButtons += '<a class="club-action" href="tel:' + club.phone + '">📞 电话</a>';
      }
      if (club.wechat) {
        contactButtons += '<button class="club-action" data-wechat="' + club.wechat + '">💬 微信</button>';
      }
      if (club.lat && club.lng) {
        var mapUrl = 'https://uri.amap.com/marker?position=' + club.lng + ',' + club.lat + '&name=' + encodeURIComponent(club.name || "俱乐部");
        contactButtons += '<a class="club-action" href="' + mapUrl + '" target="_blank" rel="noopener">🗺️ 导航</a>';
      }
      if (clubId) {
        contactButtons += '<a class="club-action" href="training-enroll-detail.html?id=' + encodeURIComponent(clubId) + '">查看详情</a>';
      }

      card.innerHTML =
        '<img class="club-photo" src="' + photo + '" alt="club">' +
        '<div class="club-info">' +
          '<div class="club-header">' +
            '<div class="club-name">' + (club.name || "俱乐部") + '</div>' +
            (club.isPartner ? '<span class="partner-badge">🏅 合作</span>' : '') +
          '</div>' +
          '<div class="club-address">📍 ' + (club.address || "") + '</div>' +
          (club.phone ? '<div class="club-phone">📞 ' + club.phone + '</div>' : '') +
          '<div class="club-tags">' + tagsHtml + '</div>' +
          '<div class="club-actions">' + contactButtons + '</div>' +
        '</div>';

      clubsList.appendChild(card);
    });

    clubsList.querySelectorAll('[data-wechat]').forEach(function (btn) {
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

  var loadClubs = function () {
    var city = citySelect ? citySelect.value : "上海";
    var district = districtSelect ? districtSelect.value : "";
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.style.display = "none";

    var url = apiBase + "/clubs/list?city=" + encodeURIComponent(city) + "&page=1&pageSize=50";
    if (district) url += "&district=" + encodeURIComponent(district);

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        var data = payload && payload.data ? payload.data : payload;
        renderClubs(data.items || []);
      })
      .catch(function () {
        renderClubs([]);
      })
      .finally(function () {
        if (loadingEl) loadingEl.style.display = "none";
      });
  };

  if (districtSelect) {
    renderDistricts();
    districtSelect.addEventListener("change", loadClubs);
  }

  if (citySelect) {
    citySelect.addEventListener("change", loadClubs);
  }

  loadClubs();
})();
