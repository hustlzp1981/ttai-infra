(function () {
  var apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  var localPreviewHosts = ["localhost", "127.0.0.1"];
  var previewEnabled = localPreviewHosts.indexOf(window.location.hostname) >= 0 ||
    window.TTAI_ENABLE_CLUB_ADMIN_PREVIEW === true;

  var unwrap = function (payload) {
    return payload && payload.data ? payload.data : payload;
  };

  var token = function () {
    return localStorage.getItem("token") || "";
  };

  var authHeaders = function () {
    return token() ? { Authorization: "Bearer " + token() } : {};
  };

  var buildQuery = function (params) {
    var search = new URLSearchParams();
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    return search.toString();
  };

  var apiError = function (message, status, payload) {
    var err = new Error(message || "接口请求失败");
    err.status = status || 0;
    err.payload = payload || null;
    err.isAuthError = status === 401;
    err.isForbidden = status === 403;
    err.isNotFound = status === 404;
    err.isStub = !!(payload && payload.stub);
    return err;
  };

  var normalizeError = function (err) {
    if (err && typeof err.status !== "undefined") return err;
    return apiError((err && err.message) || "网络异常，请稍后重试", 0, null);
  };

  var fetchJson = function (url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.text().then(function (text) {
        var payload = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (err) {
          throw apiError("接口返回格式异常，请检查后端路由。", response.status, null);
        }
        var data = unwrap(payload);
        if (!response.ok) {
          throw apiError(data.message || data.error || "接口请求失败", response.status, data);
        }
        if (data && data.stub) {
          throw apiError("后端接口仍是桩数据，暂不可作为真实数据展示", response.status, data);
        }
        return data;
      });
    }).catch(function (err) {
      throw normalizeError(err);
    });
  };

  var apiGet = function (path, params, auth) {
    var query = buildQuery(params || {});
    return fetchJson(apiBase + path + (query ? "?" + query : ""), {
      headers: auth ? authHeaders() : {}
    });
  };

  var apiPost = function (path, body, auth) {
    return fetchJson(apiBase + path, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, auth ? authHeaders() : {}),
      body: JSON.stringify(body || {})
    });
  };

  var apiDelete = function (path, body, auth) {
    return fetchJson(apiBase + path, {
      method: "DELETE",
      headers: Object.assign({ "Content-Type": "application/json" }, auth ? authHeaders() : {}),
      body: JSON.stringify(body || {})
    });
  };

  window.TTAI_CLUB_DATA = {
    source: "api",
    previewEnabled: previewEnabled,
    hasToken: function () {
      return !!token();
    },
    errorMessage: function (err) {
      err = normalizeError(err);
      if (err.isAuthError) return "请先扫码登录。";
      if (err.isForbidden) return "当前账号没有访问权限。";
      if (err.isNotFound) return "数据不存在或已下线。";
      if (err.isStub) return "后端接口仍是桩数据，等待真实接口上线。";
      return err.message || "接口请求失败，请稍后重试。";
    },
    me: function () {
      return apiGet("/web/me", {}, true);
    },
    listClubs: function (params) {
      return apiGet("/clubs/list", Object.assign({ page: 1, pageSize: 50 }, params || {}), false)
        .then(function (data) {
          return {
            source: "api",
            items: data.items || [],
            total: data.total || 0,
            districts: data.districts || []
          };
        });
    },
    detailClub: function (idOrSlug) {
      return apiGet("/clubs/detail", { id: idOrSlug }, false).then(function (data) {
        return { source: "api", club: data.club || data };
      });
    },
    myAuthorizations: function () {
      return apiGet("/clubs/my-authorizations", {}, true);
    },
    authorizeClub: function (clubId, scopes) {
      return apiPost("/clubs/" + encodeURIComponent(clubId) + "/authorize", {
        scopes: scopes || ["training_summary", "analysis_summary"]
      }, true);
    },
    revokeClubAuthorization: function (clubId) {
      return apiDelete("/clubs/" + encodeURIComponent(clubId) + "/authorize", {}, true);
    },
    submitLead: function (clubId, lead) {
      return apiPost("/clubs/" + encodeURIComponent(clubId) + "/leads", lead || {}, !!token())
        .then(function (data) {
          return { source: "api", data: data };
        });
    },
    adminProfile: function () {
      return apiGet("/club-admin/profile", {}, true);
    },
    adminOverview: function (clubId) {
      return apiGet("/club-admin/overview", { clubId: clubId }, true);
    },
    adminMembers: function (clubId) {
      return apiGet("/club-admin/members", { clubId: clubId }, true);
    },
    adminMemberActivity: function (clubId, memberId) {
      return apiGet("/club-admin/members/" + encodeURIComponent(memberId) + "/activity", { clubId: clubId }, true);
    },
    adminLeads: function (clubId) {
      return apiGet("/club-admin/leads", { clubId: clubId }, true);
    },
    updateLeadStatus: function (clubId, leadId, status) {
      return apiPost("/club-admin/leads/" + encodeURIComponent(leadId) + "/status", {
        clubId: clubId,
        status: status
      }, true);
    },
    loadAdmin: function (clubId) {
      return Promise.all([
        this.adminOverview(clubId),
        this.adminMembers(clubId),
        this.adminLeads(clubId)
      ]).then(function (parts) {
        return {
          source: "api",
          overview: parts[0] || {},
          members: (parts[1] && (parts[1].items || parts[1].members)) || [],
          leads: (parts[2] && (parts[2].items || parts[2].leads)) || []
        };
      });
    }
  };
})();
