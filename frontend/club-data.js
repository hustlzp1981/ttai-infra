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

  var filenameFromDisposition = function (value) {
    var text = String(value || "");
    var match = text.match(/filename\*=UTF-8''([^;]+)/i);
    if (match) return decodeURIComponent(match[1]);
    match = text.match(/filename="?([^"]+)"?/i);
    return match ? match[1] : "";
  };

  var fetchBlob = function (path, params, auth) {
    var query = buildQuery(params || {});
    return fetch(apiBase + path + (query ? "?" + query : ""), {
      headers: auth ? authHeaders() : {}
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          var payload = {};
          try {
            payload = text ? JSON.parse(text) : {};
          } catch (err) {}
          throw apiError(payload.message || payload.error || "文件下载失败", response.status, payload);
        });
      }
      return response.blob().then(function (blob) {
        return { blob: blob, filename: filenameFromDisposition(response.headers.get("Content-Disposition")) };
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

  var apiPut = function (path, body, auth) {
    return fetchJson(apiBase + path, {
      method: "PUT",
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

  var apiForm = function (path, formData, auth) {
    return fetchJson(apiBase + path, {
      method: "POST",
      headers: auth ? authHeaders() : {},
      body: formData
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
    },
    eduMeta: function (clubId) {
      return apiGet("/club-admin/edu/meta", { clubId: clubId }, true);
    },
    eduCourseProducts: function (clubId, params) {
      return apiGet("/club-admin/edu/course-products", Object.assign({ clubId: clubId, page: 1, pageSize: 50 }, params || {}), true);
    },
    eduStudents: function (clubId, params) {
      return apiGet("/club-admin/edu/students", Object.assign({ clubId: clubId, page: 1, pageSize: 80 }, params || {}), true);
    },
    eduSaveStudent: function (clubId, student) {
      student = Object.assign({ clubId: clubId }, student || {});
      if (student.id || student._id) {
        return apiPut("/club-admin/edu/students/" + encodeURIComponent(student.id || student._id), student, true);
      }
      return apiPost("/club-admin/edu/students", student, true);
    },
    eduDeleteStudent: function (clubId, id) {
      return apiDelete("/club-admin/edu/students/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduImportStudents: function (clubId, file) {
      var form = new FormData();
      form.append("clubId", clubId);
      form.append("file", file);
      return apiForm("/club-admin/edu/students/import", form, true);
    },
    eduStudentBindQrcode: function (clubId, studentId, payload) {
      return apiPost("/club-admin/edu/students/" + encodeURIComponent(studentId) + "/bind-qrcode", Object.assign({
        clubId: clubId
      }, payload || {}), true);
    },
    eduPackageTemplates: function (clubId, params) {
      return apiGet("/club-admin/edu/package-templates", Object.assign({ clubId: clubId, page: 1, pageSize: 80 }, params || {}), true);
    },
    eduSavePackageTemplate: function (clubId, template) {
      template = Object.assign({ clubId: clubId }, template || {});
      if (template.id || template._id) {
        return apiPut("/club-admin/edu/package-templates/" + encodeURIComponent(template.id || template._id), template, true);
      }
      return apiPost("/club-admin/edu/package-templates", template, true);
    },
    eduDeletePackageTemplate: function (clubId, id) {
      return apiDelete("/club-admin/edu/package-templates/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduCreateWallet: function (clubId, studentId, wallet) {
      return apiPost("/club-admin/edu/students/" + encodeURIComponent(studentId) + "/wallets", Object.assign({ clubId: clubId }, wallet || {}), true);
    },
    eduStudentWallets: function (clubId, studentId, params) {
      return apiGet("/club-admin/edu/students/" + encodeURIComponent(studentId) + "/wallets", Object.assign({ clubId: clubId, page: 1, pageSize: 50 }, params || {}), true);
    },
    eduWallets: function (clubId, params) {
      return apiGet("/club-admin/edu/wallets", Object.assign({ clubId: clubId, page: 1, pageSize: 200 }, params || {}), true);
    },
    eduStudentLedgers: function (clubId, studentId, params) {
      return apiGet("/club-admin/edu/students/" + encodeURIComponent(studentId) + "/ledgers", Object.assign({ clubId: clubId, page: 1, pageSize: 50 }, params || {}), true);
    },
    eduLedgers: function (clubId, params) {
      return apiGet("/club-admin/edu/ledgers", Object.assign({ clubId: clubId, page: 1, pageSize: 80 }, params || {}), true);
    },
    eduSaveCourseProduct: function (clubId, course) {
      course = Object.assign({ clubId: clubId }, course || {});
      if (course.id || course._id) {
        return apiPut("/club-admin/edu/course-products/" + encodeURIComponent(course.id || course._id), course, true);
      }
      return apiPost("/club-admin/edu/course-products", course, true);
    },
    eduDeleteCourseProduct: function (clubId, id) {
      return apiDelete("/club-admin/edu/course-products/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduClasses: function (clubId, params) {
      return apiGet("/club-admin/edu/classes", Object.assign({ clubId: clubId, page: 1, pageSize: 50 }, params || {}), true);
    },
    eduSaveClass: function (clubId, klass) {
      klass = Object.assign({ clubId: clubId }, klass || {});
      if (klass.id || klass._id) {
        return apiPut("/club-admin/edu/classes/" + encodeURIComponent(klass.id || klass._id), klass, true);
      }
      return apiPost("/club-admin/edu/classes", klass, true);
    },
    eduDeleteClass: function (clubId, id) {
      return apiDelete("/club-admin/edu/classes/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduStaff: function (clubId, params) {
      return apiGet("/club-admin/edu/staff", Object.assign({ clubId: clubId, page: 1, pageSize: 100 }, params || {}), true);
    },
    eduSaveStaff: function (clubId, staff) {
      staff = Object.assign({ clubId: clubId }, staff || {});
      if (staff.id || staff._id) {
        return apiPut("/club-admin/edu/staff/" + encodeURIComponent(staff.id || staff._id), staff, true);
      }
      return apiPost("/club-admin/edu/staff", staff, true);
    },
    eduDeleteStaff: function (clubId, id) {
      return apiDelete("/club-admin/edu/staff/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduAvailability: function (clubId, params) {
      return apiGet("/club-admin/edu/teacher-availability", Object.assign({ clubId: clubId, page: 1, pageSize: 100 }, params || {}), true);
    },
    eduSaveAvailability: function (clubId, availability) {
      return apiPost("/club-admin/edu/teacher-availability", Object.assign({ clubId: clubId }, availability || {}), true);
    },
    eduDeleteAvailability: function (clubId, id) {
      return apiDelete("/club-admin/edu/teacher-availability/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduApproveAvailability: function (clubId, id, approve) {
      return apiPost("/club-admin/edu/teacher-availability/" + encodeURIComponent(id) + "/approve", {
        clubId: clubId,
        approve: approve !== false
      }, true);
    },
    eduBookingAvailability: function (clubId, params) {
      return apiGet("/club-admin/edu/booking-availability", Object.assign({ clubId: clubId }, params || {}), true);
    },
    eduSaveBookingAvailability: function (clubId, availability) {
      return apiPost("/club-admin/edu/booking-availability", Object.assign({ clubId: clubId }, availability || {}), true);
    },
    eduPublishBookingAvailabilityWeek: function (clubId, payload) {
      return apiPost("/club-admin/edu/booking-availability/publish-week", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduCopyBookingAvailabilityWeek: function (clubId, payload) {
      return apiPost("/club-admin/edu/booking-availability/copy-week", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduPauseBookingAvailability: function (clubId, id, payload) {
      return apiPost("/club-admin/edu/booking-availability/" + encodeURIComponent(id) + "/pause", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduResumeBookingAvailability: function (clubId, id, payload) {
      return apiPost("/club-admin/edu/booking-availability/" + encodeURIComponent(id) + "/resume", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduDeleteBookingAvailability: function (clubId, id) {
      return apiDelete("/club-admin/edu/booking-availability/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduResources: function (clubId, params) {
      return apiGet("/club-admin/edu/resources", Object.assign({ clubId: clubId, page: 1, pageSize: 100 }, params || {}), true);
    },
    eduSaveResource: function (clubId, resource) {
      resource = Object.assign({ clubId: clubId }, resource || {});
      if (resource.id || resource._id) {
        return apiPut("/club-admin/edu/resources/" + encodeURIComponent(resource.id || resource._id), resource, true);
      }
      return apiPost("/club-admin/edu/resources", resource, true);
    },
    eduDeleteResource: function (clubId, id) {
      return apiDelete("/club-admin/edu/resources/" + encodeURIComponent(id), { clubId: clubId }, true);
    },
    eduSessions: function (clubId, params) {
      return apiGet("/club-admin/edu/sessions", Object.assign({ clubId: clubId, page: 1, pageSize: 80 }, params || {}), true);
    },
    eduSaveSession: function (clubId, session) {
      session = Object.assign({ clubId: clubId }, session || {});
      if (session.id || session._id) {
        return apiPut("/club-admin/edu/sessions/" + encodeURIComponent(session.id || session._id), session, true);
      }
      return apiPost("/club-admin/edu/sessions", session, true);
    },
    eduCancelSession: function (clubId, sessionId, reason) {
      return apiPost("/club-admin/edu/sessions/" + encodeURIComponent(sessionId) + "/cancel", {
        clubId: clubId,
        reason: reason || ""
      }, true);
    },
    eduDeleteSession: function (clubId, sessionId, reason) {
      return apiDelete("/club-admin/edu/sessions/" + encodeURIComponent(sessionId), {
        clubId: clubId,
        reason: reason || ""
      }, true);
    },
    eduBookings: function (clubId, params) {
      return apiGet("/club-admin/edu/bookings", Object.assign({ clubId: clubId, page: 1, pageSize: 300 }, params || {}), true);
    },
    eduDirectConfirmBooking: function (clubId, payload) {
      return apiPost("/club-admin/edu/bookings/direct-confirm", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduCopyBookingPreview: function (clubId, payload) {
      return apiPost("/club-admin/edu/bookings/copy-preview", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduPublishBookingDraft: function (clubId, payload) {
      return apiPost("/club-admin/edu/bookings/publish-draft", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduConfirmBooking: function (clubId, id, payload) {
      return apiPost("/club-admin/edu/bookings/" + encodeURIComponent(id) + "/confirm", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduRejectBooking: function (clubId, id, payload) {
      return apiPost("/club-admin/edu/bookings/" + encodeURIComponent(id) + "/reject", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduProposeBooking: function (clubId, id, payload) {
      return apiPost("/club-admin/edu/bookings/" + encodeURIComponent(id) + "/propose", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduAttendance: function (clubId, sessionId) {
      return apiGet("/club-admin/edu/sessions/" + encodeURIComponent(sessionId) + "/attendance", { clubId: clubId }, true);
    },
    eduSaveRoster: function (clubId, sessionId, items) {
      return apiPost("/club-admin/edu/sessions/" + encodeURIComponent(sessionId) + "/roster", {
        clubId: clubId,
        items: items || []
      }, true);
    },
    eduSubmitAttendance: function (clubId, sessionId, records) {
      return apiPost("/club-admin/edu/sessions/" + encodeURIComponent(sessionId) + "/attendance", {
        clubId: clubId,
        records: records || []
      }, true);
    },
    eduRevokeAttendance: function (clubId, attendanceId, reason) {
      return apiPost("/club-admin/edu/attendance/" + encodeURIComponent(attendanceId) + "/revoke", {
        clubId: clubId,
        reason: reason || ""
      }, true);
    },
    eduDownloadScheduleExport: function (clubId, params) {
      return fetchBlob("/club-admin/edu/schedule-export.xlsx", Object.assign({ clubId: clubId }, params || {}), true);
    },
    eduGenerateScheduleExport: function (clubId, payload) {
      return apiPost("/club-admin/edu/schedule-exports/generate", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    eduScheduleExports: function (clubId, params) {
      return apiGet("/club-admin/edu/schedule-exports", Object.assign({ clubId: clubId, page: 1, pageSize: 20 }, params || {}), true);
    },
    eduDownloadSavedScheduleExport: function (clubId, id) {
      return fetchBlob("/club-admin/edu/schedule-exports/" + encodeURIComponent(id || "") + "/download", { clubId: clubId }, true);
    },
    eduScheduleExportSettings: function (clubId, branchId) {
      return apiGet("/club-admin/edu/schedule-export-settings", { clubId: clubId, branchId: branchId || "" }, true);
    },
    eduSaveScheduleExportSettings: function (clubId, payload) {
      return apiPut("/club-admin/edu/schedule-export-settings", Object.assign({ clubId: clubId }, payload || {}), true);
    },
    listCities: function () {
      return apiGet('/clubs/cities', {}, false).then(function (data) {
        return (data.items || []).map(function (item) { return item.city }).filter(Boolean)
      })
    },
  };
})();
