// Debug overlay for diagnosing the webOS player loader/state/icon bugs.
// Toggle: remote Red key (keyCode 403). Off by default, not focusable (no
// tabindex, pointer-events:none, never added to focus.js's selector list),
// read-only — it only displays state, never changes anything.
//
// Players call into this file through three small, optional hooks so they
// stay decoupled from it (a player works fine if this file isn't loaded):
//   window.playerDebugRegister({ label: "X", getState: function () {...} })
//   window.playerDebugLog(event, reason)
//   window.playerDebugLoaderCall("show"|"hide", reason)
//
// ES5 only.

(function () {
  "use strict";

  var MAX_LOG = 8;
  var eventLog = [];
  var loaderLog = [];
  var loaderCount = 0;
  var players = {};
  var panelEl = null;
  var pollTimer = null;
  var visible = false;

  function pushLog(list, entry) {
    list.push(entry);
    if (list.length > MAX_LOG) list.shift();
  }

  window.playerDebugLog = function (event, reason) {
    pushLog(eventLog, { t: Date.now(), label: event, reason: reason || "" });
  };

  window.playerDebugLoaderCall = function (action, reason) {
    loaderCount++;
    pushLog(loaderLog, { t: Date.now(), label: action, reason: reason || "" });
  };

  window.playerDebugRegister = function (info) {
    if (!info || !info.label) return;
    players[info.label] = info;
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatEntry(e) {
    return "+" + (Date.now() - e.t) + "ms " + e.label + (e.reason ? " (" + e.reason + ")" : "");
  }

  function render() {
    if (!panelEl) return;

    var html = "";
    var label;
    var hasPlayer = false;
    for (label in players) {
      if (!players.hasOwnProperty(label)) continue;
      hasPlayer = true;
      var state = {};
      try {
        state = players[label].getState() || {};
      } catch (err) {
        state = { error: String(err) };
      }
      html += "<div class='pd-row pd-head'>" + escapeHtml(label) + "</div>";
      html += "<div class='pd-row'>state: " + escapeHtml(state.state) + "</div>";
      html += "<div class='pd-row'>loader visible: " + escapeHtml(state.loaderVisible) + "</div>";
      html += "<div class='pd-row'>currentTime: " + escapeHtml(state.currentTime) + "</div>";
      html += "<div class='pd-row'>readyState: " + escapeHtml(state.readyState) + "</div>";
      html += "<div class='pd-row'>stuck: " + escapeHtml(state.stuckMs) + "ms</div>";
      html += "<div class='pd-row'>extension: " + escapeHtml(state.extension) + "</div>";
      html += "<div class='pd-row'>session: " + escapeHtml(state.session) + "</div>";
    }
    if (!hasPlayer) html += "<div class='pd-row'>(no player registered)</div>";

    html += "<div class='pd-row pd-head'>loader toggles: " + loaderCount + "</div>";

    html += "<div class='pd-row pd-head'>last events</div>";
    var i;
    for (i = eventLog.length - 1; i >= 0; i--) {
      html += "<div class='pd-row'>" + escapeHtml(formatEntry(eventLog[i])) + "</div>";
    }

    html += "<div class='pd-row pd-head'>last loader calls</div>";
    for (i = loaderLog.length - 1; i >= 0; i--) {
      html += "<div class='pd-row'>" + escapeHtml(formatEntry(loaderLog[i])) + "</div>";
    }

    panelEl.innerHTML = html;
  }

  function ensurePanel() {
    if (panelEl) return panelEl;

    var style = document.createElement("style");
    style.textContent =
      "#player-debug-panel{position:fixed;top:0;right:0;width:360px;max-height:100%;" +
      "overflow-y:auto;background:rgba(0,0,0,0.85);color:#0f0;font:12px monospace;" +
      "padding:8px;z-index:999999;pointer-events:none;display:none;}" +
      "#player-debug-panel .pd-row{white-space:pre-wrap;word-break:break-word;}" +
      "#player-debug-panel .pd-head{color:#ff0;margin-top:6px;font-weight:bold;}";
    document.head.appendChild(style);

    panelEl = document.createElement("div");
    panelEl.id = "player-debug-panel";
    document.body.appendChild(panelEl);
    return panelEl;
  }

  function show() {
    ensurePanel();
    panelEl.style.display = "block";
    visible = true;
    render();
    pollTimer = setInterval(render, 500);
  }

  function hide() {
    if (panelEl) panelEl.style.display = "none";
    visible = false;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener("keydown", function (e) {
    if (e.keyCode !== 403) return;
    if (visible) hide();
    else show();
  });
})();
