(function () {
  var apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  var urlParams = new URLSearchParams(window.location.search);
  var loginToken = urlParams.get("token");
  var loginOpenId = urlParams.get("openid");
  if (loginToken) localStorage.setItem("token", loginToken);
  if (loginOpenId) localStorage.setItem("openid", loginOpenId);

  var navLogin = document.getElementById("nav-login");
  var navUser = document.getElementById("nav-user");
  var navAvatar = document.getElementById("nav-avatar");
  var navName = document.getElementById("nav-name");
  var navLogout = document.getElementById("nav-logout");
  var token = localStorage.getItem("token") || "";

  var showLoggedOut = function () {
    if (navLogin) navLogin.style.display = "inline-flex";
    if (navUser) navUser.style.display = "none";
  };

  var showLoggedIn = function (user) {
    if (navLogin) navLogin.style.display = "none";
    if (navUser) navUser.style.display = "inline-flex";
    if (navAvatar) navAvatar.src = (user && (user.avatarUrl || user.avatar)) || "images/main.png";
    if (navName) navName.textContent = (user && user.nickname) || "已登录";
  };

  if (!token) {
    showLoggedOut();
    return;
  }

  var cachedUserInfo = localStorage.getItem("userInfo");
  if (cachedUserInfo) {
    var parsed = JSON.parse(cachedUserInfo);
    if (parsed && (parsed.nickname || parsed.avatarUrl)) {
      showLoggedIn(parsed);
    }
  }

  var openid = localStorage.getItem("openid") || "";
  var userUrl = openid ? apiBase + "/user?openid=" + encodeURIComponent(openid) : apiBase + "/user";
  fetch(userUrl, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(function (response) {
      if (!response.ok) throw new Error("user fetch failed");
      return response.json();
    })
    .then(function (payload) {
      var data = payload && payload.data ? payload.data : payload;
      var user = data && data.user ? data.user : null;
      if (user) {
        localStorage.setItem("userInfo", JSON.stringify(user));
      }
      showLoggedIn(user);
    })
    .catch(function () {
      if (!cachedUserInfo) showLoggedOut();
    });

  if (navLogout) {
    navLogout.addEventListener("click", function () {
      localStorage.removeItem("token");
      localStorage.removeItem("openid");
      window.location.href = "login.html";
    });
  }
})();
