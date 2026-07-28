(function () {
  const apiBase = window.ttaiGetApiBase ? window.ttaiGetApiBase() : "/api";
  const urlParams = new URLSearchParams(window.location.search);
  const loginToken = urlParams.get("token");
  const loginOpenId = urlParams.get("openid");
  if (loginToken) localStorage.setItem("token", loginToken);
  if (loginOpenId) localStorage.setItem("openid", loginOpenId);
  const token = localStorage.getItem("token") || "";

  const stateEl = document.getElementById("membership-state");
  const overviewEl = document.getElementById("membership-overview");
  const tierEl = document.getElementById("overview-tier");
  const expiryEl = document.getElementById("overview-expiry");
  const analysisEl = document.getElementById("overview-analysis");
  const analysisNoteEl = document.getElementById("overview-analysis-note");
  const storageEl = document.getElementById("overview-storage");
  const storageMeterEl = document.getElementById("overview-storage-meter");
  const storageNoteEl = document.getElementById("overview-storage-note");
  const tabButtons = Array.from(document.querySelectorAll("[data-membership-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-membership-panel]"));
  const orderFilters = Array.from(document.querySelectorAll("[data-order-status]"));
  const orderListEl = document.getElementById("membership-order-list");
  const orderEmptyEl = document.getElementById("membership-order-empty");
  const refreshOrdersEl = document.getElementById("refresh-orders");
  let currentOrderStatus = "";
  let ordersLoaded = false;

  const requestHeaders = () => ({ Authorization: "Bearer " + token });
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

  const formatBytes = (value) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
    const gib = 1024 * 1024 * 1024;
    const mib = 1024 * 1024;
    if (bytes < gib) return `${Math.max(1, Math.round(bytes / mib))} MB`;
    return `${Math.round(bytes / gib * 10) / 10} GB`;
  };

  const formatDate = (value, includeTime) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = false;
    }
    return date.toLocaleString("zh-CN", options);
  };

  const formatAmount = (amountFen) => {
    const value = Number(amountFen);
    return Number.isFinite(value) ? `¥${(value / 100).toFixed(2)}` : "--";
  };

  const highlightCurrentTier = (tier) => {
    const columnIndex = tier === "golden" ? 3 : (tier === "diamond" ? 4 : (tier === "king" ? 0 : 2));
    document.querySelectorAll(".membership-benefit-table tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        cell.classList.toggle("current-tier-column", columnIndex > 0 && index + 1 === columnIndex);
      });
    });
  };

  const renderQuota = (data) => {
    const tier = data.tier || "seeding";
    const tierName = data.tierName || "乒乓新星";
    const remaining = Number(data.remainingAnalyses);
    const max = Number(data.maxAnalyses);
    const unlimited = max < 0;
    const used = max > 0 && Number.isFinite(remaining) ? Math.max(0, max - remaining) : 0;
    if (tierEl) tierEl.textContent = tierName;
    if (analysisEl) analysisEl.textContent = unlimited ? "不限次" : `${used} / ${Number.isFinite(max) ? max : "--"}`;
    if (analysisNoteEl) analysisNoteEl.textContent = unlimited ? "本月不限分析次数" : `剩余 ${Number.isFinite(remaining) ? Math.max(0, remaining) : "--"} 次`;

    let expiryText = "长期有效";
    if (data.isTrial && data.trialExpiresAt) expiryText = `黄金试用至 ${formatDate(data.trialExpiresAt)}`;
    else if (data.membershipExpiresAt) expiryText = `有效期至 ${formatDate(data.membershipExpiresAt)}`;
    else if (data.nextTierName) expiryText = `下一段位：${data.nextTierName}`;
    if (expiryEl) expiryEl.textContent = expiryText;

    const storage = data.storage || {};
    const metered = storage.meteringAvailable === true && Number.isFinite(Number(storage.usedBytes)) &&
      Number.isFinite(Number(storage.limitBytes)) && Number(storage.limitBytes) > 0;
    if (metered) {
      const usedBytes = Number(storage.usedBytes);
      const limitBytes = Number(storage.limitBytes);
      const percent = clampPercent(Number.isFinite(Number(storage.usagePercent))
        ? Number(storage.usagePercent)
        : usedBytes * 100 / limitBytes);
      if (storageEl) storageEl.textContent = `${formatBytes(usedBytes)} / ${formatBytes(limitBytes)}`;
      if (storageMeterEl) {
        storageMeterEl.style.width = `${percent}%`;
        storageMeterEl.classList.toggle("near", storage.isNearLimit === true && storage.isFull !== true);
        storageMeterEl.classList.toggle("full", storage.isFull === true);
      }
      if (storageNoteEl) {
        storageNoteEl.textContent = storage.isFull
          ? "空间已满"
          : (storage.isNearLimit ? "空间即将用满" : `剩余 ${formatBytes(Math.max(0, limitBytes - usedBytes))}`);
      }
    } else {
      if (storageEl) storageEl.textContent = "暂不可用";
      if (storageNoteEl) storageNoteEl.textContent = "云端空间数据暂不可用";
    }

    highlightCurrentTier(tier);
    if (stateEl) stateEl.hidden = true;
    if (overviewEl) overviewEl.hidden = false;
  };

  const fetchQuota = async () => {
    if (!token) {
      if (stateEl) stateEl.textContent = "请先登录后查看会员权益。";
      return;
    }
    try {
      const response = await fetch(apiBase + "/user/quota", { headers: requestHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload || payload.code !== 0 || !payload.data) {
        throw new Error(payload && payload.message || "会员信息加载失败");
      }
      renderQuota(payload.data);
    } catch (error) {
      if (stateEl) stateEl.textContent = error.message || "会员信息加载失败，请稍后重试。";
    }
  };

  const statusMeta = (status) => {
    const map = {
      paid: { label: "已支付", className: "paid" },
      pending: { label: "待支付", className: "pending" },
      closed: { label: "已关闭", className: "closed" },
      refunded: { label: "已退款", className: "refunded" }
    };
    return map[status] || { label: status || "未知", className: "closed" };
  };

  const appendOrderField = (parent, label, value) => {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const content = document.createElement("strong");
    name.textContent = label;
    content.textContent = value || "--";
    item.append(name, content);
    parent.appendChild(item);
  };

  const renderOrders = (items) => {
    if (!orderListEl || !orderEmptyEl) return;
    orderListEl.innerHTML = "";
    orderEmptyEl.hidden = items.length > 0;
    items.forEach((order) => {
      const article = document.createElement("article");
      article.className = "membership-order-row";
      const head = document.createElement("div");
      head.className = "membership-order-head";
      const title = document.createElement("div");
      const name = document.createElement("strong");
      const orderId = document.createElement("span");
      name.textContent = order.planName || order.serviceName || "TTAI 会员";
      orderId.textContent = order.orderId || "--";
      title.append(name, orderId);
      const meta = statusMeta(order.status);
      const status = document.createElement("span");
      status.className = `membership-order-status ${meta.className}`;
      status.textContent = meta.label;
      head.append(title, status);

      const details = document.createElement("div");
      details.className = "membership-order-details";
      appendOrderField(details, "实付金额", formatAmount(order.amountFen));
      appendOrderField(details, "下单时间", formatDate(order.createdAt, true));
      appendOrderField(details, "支付时间", formatDate(order.paidAt, true));
      appendOrderField(details, "权益到期", order.membershipExpiresAt ? formatDate(order.membershipExpiresAt) : "--");
      article.append(head, details);
      orderListEl.appendChild(article);
    });
  };

  const updateOrderCounts = (counts) => {
    orderFilters.forEach((button) => {
      const status = button.dataset.orderStatus || "all";
      const baseLabel = button.dataset.baseLabel || button.textContent.replace(/\s*\(\d+\)$/, "");
      button.dataset.baseLabel = baseLabel;
      const count = counts && Number(counts[status]);
      button.textContent = Number.isFinite(count) ? `${baseLabel} (${count})` : baseLabel;
    });
  };

  const fetchOrders = async () => {
    if (!token || !orderListEl || !orderEmptyEl) return;
    orderEmptyEl.hidden = false;
    orderEmptyEl.textContent = "正在加载订单...";
    if (refreshOrdersEl) refreshOrdersEl.disabled = true;
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "20", sort: "updatedAt_desc" });
      if (currentOrderStatus) params.set("status", currentOrderStatus);
      const response = await fetch(`${apiBase}/pay/orders?${params.toString()}`, { headers: requestHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload || payload.code !== 0 || !payload.data) {
        throw new Error(payload && payload.message || "订单加载失败");
      }
      const items = Array.isArray(payload.data.items) ? payload.data.items : [];
      renderOrders(items);
      updateOrderCounts(payload.data.statusCounts || {});
      if (!items.length) orderEmptyEl.textContent = "暂无订单。";
      ordersLoaded = true;
    } catch (error) {
      orderListEl.innerHTML = "";
      orderEmptyEl.hidden = false;
      orderEmptyEl.textContent = error.message || "订单加载失败，请稍后重试。";
    } finally {
      if (refreshOrdersEl) refreshOrdersEl.disabled = false;
    }
  };

  const selectTab = (tabName, updateHash) => {
    const next = tabName === "orders" ? "orders" : "benefits";
    tabButtons.forEach((button) => {
      const active = button.dataset.membershipTab === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.membershipPanel !== next; });
    if (updateHash) history.replaceState(null, "", next === "orders" ? "#orders" : window.location.pathname + window.location.search);
    if (next === "orders" && !ordersLoaded) fetchOrders();
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.membershipTab, true));
  });
  orderFilters.forEach((button) => {
    button.addEventListener("click", () => {
      currentOrderStatus = button.dataset.orderStatus || "";
      orderFilters.forEach((item) => item.classList.toggle("active", item === button));
      fetchOrders();
    });
  });
  if (refreshOrdersEl) refreshOrdersEl.addEventListener("click", fetchOrders);

  selectTab(window.location.hash === "#orders" ? "orders" : "benefits", false);
  fetchQuota();
})();
