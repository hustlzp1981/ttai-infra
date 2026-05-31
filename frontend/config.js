(function () {
  window.TTAI_CONFIG = {
    baseUrl: window.TTAI_BASE_URL || ""
  };

  window.ttaiGetBaseUrl = function () {
    return window.TTAI_CONFIG.baseUrl || "";
  };

  window.ttaiGetApiBase = function () {
    return window.ttaiGetBaseUrl() + "/api";
  };

  window.ttaiGetWsUrl = function () {
    var baseUrl = window.ttaiGetBaseUrl();
    if (!baseUrl) return "wss://www.ttcut.com/ws";
    if (baseUrl.indexOf("https://") === 0) {
      return "wss://" + baseUrl.slice("https://".length) + "/ws";
    }
    if (baseUrl.indexOf("http://") === 0) {
      return "ws://" + baseUrl.slice("http://".length) + "/ws";
    }
    return "wss://" + baseUrl + "/ws";
  };
})();
