(function () {
  var baseUrl = window.ttaiGetBaseUrl ? window.ttaiGetBaseUrl() : "";
  var clubData = window.TTAI_CLUB_DATA || { clubs: [], getDistricts: function () { return []; } };

  var clubsList = document.getElementById("clubs-list");
  var emptyEl = document.getElementById("clubs-empty");
  var loadingEl = document.getElementById("clubs-loading");
  var citySelect = document.getElementById("city-select");
  var districtSelect = document.getElementById("district-select");
  var tagButtons = Array.prototype.slice.call(document.querySelectorAll("[data-tag]"));
  var selectedTag = "";

  var resolveUrl = function (path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    if (path.indexOf("/") === 0) return baseUrl + path;
    return baseUrl + "/" + path;
  };

  var renderDistricts = function () {
    if (!districtSelect) return;
    var city = citySelect ? citySelect.value : "上海";
    var districts = clubData.getDistricts(city);
    districtSelect.innerHTML = "";

    ["全部区域"].concat(districts).forEach(function (district) {
      var option = document.createElement("option");
      option.value = district === "全部区域" ? "" : district;
      option.textContent = district;
      districtSelect.appendChild(option);
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

      var photo = resolveUrl((club.photos && club.photos[0]) || "images/main.png");
      var tagsHtml = (club.tags || []).slice(0, 5).map(function (tag) {
        return '<span class="club-tag">' + tag + '</span>';
      }).join("");

      var actions = "";
      if (club.phone) actions += '<a class="club-action" href="tel:' + club.phone + '">电话</a>';
      if (club.wechat) actions += '<button class="club-action" type="button" data-wechat="' + club.wechat + '">复制微信</button>';
      if (club.lat && club.lng) {
        var mapUrl = "https://uri.amap.com/marker?position=" + club.lng + "," + club.lat + "&name=" + encodeURIComponent(club.name || "俱乐部");
        actions += '<a class="club-action" href="' + mapUrl + '" target="_blank" rel="noopener">导航</a>';
      }
      actions += '<a class="club-action primary" href="training-enroll-detail.html?id=' + encodeURIComponent(club.id) + '">查看详情</a>';

      card.innerHTML =
        '<img class="club-photo" src="' + photo + '" alt="' + (club.name || "俱乐部") + '">' +
        '<div class="club-info">' +
          '<div class="club-header">' +
            '<div class="club-name">' + (club.name || "俱乐部") + '</div>' +
            (club.isPartner ? '<span class="partner-badge">合作俱乐部</span>' : '<span class="partner-badge muted-badge">入驻俱乐部</span>') +
          '</div>' +
          '<div class="club-address">' + (club.district || "") + " · " + (club.address || "") + '</div>' +
          '<div class="club-phone">' + (club.summary || "") + '</div>' +
          '<div class="club-tags">' + tagsHtml + '</div>' +
          '<div class="club-actions">' + actions + '</div>' +
        '</div>';

      clubsList.appendChild(card);
    });

    clubsList.querySelectorAll("[data-wechat]").forEach(function (button) {
      button.addEventListener("click", function () {
        copyWechat(button);
      });
    });
  };

  var filterClubs = function () {
    var city = citySelect ? citySelect.value : "上海";
    var district = districtSelect ? districtSelect.value : "";
    return clubData.clubs.filter(function (club) {
      if (city && club.city !== city) return false;
      if (district && club.district !== district) return false;
      if (selectedTag && (club.tags || []).indexOf(selectedTag) === -1) return false;
      return true;
    });
  };

  var loadClubs = function () {
    if (loadingEl) loadingEl.style.display = "block";
    window.setTimeout(function () {
      renderClubs(filterClubs());
      if (loadingEl) loadingEl.style.display = "none";
    }, 120);
  };

  tagButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      selectedTag = button.getAttribute("data-tag") || "";
      tagButtons.forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");
      loadClubs();
    });
  });

  if (districtSelect) districtSelect.addEventListener("change", loadClubs);
  if (citySelect) {
    citySelect.addEventListener("change", function () {
      renderDistricts();
      loadClubs();
    });
  }

  renderDistricts();
  loadClubs();
})();
