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
  var _qrBranchData = null;
  var _clubDetail = null;

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
    renderOverview();
    renderFunnel();
    renderWeaknesses();
    renderMembers();
    renderLeads();
    renderActivities();
    loadBranchQRData();
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
      loadDashboard();
    }).catch(function (err) {
      showLocked(clubData.errorMessage ? clubData.errorMessage(err) : "管理员权限校验失败。", err && err.isAuthError);
    });
  };

  if (clubSelectEl) {
    clubSelectEl.addEventListener("change", function () {
      selectedClubId = clubSelectEl.value;
      if (memberDetailEl) memberDetailEl.style.display = "none";
      loadDashboard();
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

  initProfile();
})();
