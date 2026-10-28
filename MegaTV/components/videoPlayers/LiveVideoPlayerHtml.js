// LiveVideoPlayerHtml.js - HTML5 <video> live player for the Live page (webOS / PC).
// Tizen (webapis.avplay) keeps LiveAvPlayer. One <video> is reused for the
// preview and for fullscreen: applyLayout() is the only place that changes the
// layout, the stream is never reloaded on enter/exit.
//
// ES5 only.

(function () {
  "use strict";

  var ICON_DIR = "./assets/player/";
  var START_TIMEOUT_MS = 15000;
  var BUFFER_TIMEOUT_MS = 20000;
  var STALL_MS = 300;
  var HUD_HIDE_MS = 5000;
  var POLL_MS = 100;
  var TOAST_MS = 2500;
  var CONTROLS_HIDE_MS = 4000;

  var KEY_PLAY = 415;
  var KEY_PAUSE = 19;
  var KEY_PLAYPAUSE = 10252;
  var KEY_STOP = 413;
  var KEY_FF = 417;
  var KEY_RW = 412;

  // One neighbor table for every zone.
  var NEIGHBORS = {
    play: { down: "exit" },
    exit: { up: "play" },
    errBack: { right: "errRetry" },
    errRetry: { left: "errBack" },
  };

  var S = null;

  function isTizenAvplay() {
    return typeof window.webapis !== "undefined" && !!window.webapis.avplay;
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function iconPair(name) {
    return (
      '<img class="lvh-ic n" src="' + ICON_DIR + name + '-white.png" alt="" />' +
      '<img class="lvh-ic f" src="' + ICON_DIR + name + '-black.png" alt="" />'
    );
  }

  function kind(cls, name) {
    return '<span class="lvh-kind ' + cls + '">' + iconPair(name) + "</span>";
  }

  function q(sel) {
    return S.root.querySelector(sel);
  }

  function ctl(id) {
    return S && S.root.querySelector('[data-lvh="' + id + '"]');
  }

  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, !!capture);
    S.listeners.push([target, type, fn, !!capture]);
  }

  function offAll() {
    var l = S.listeners;
    for (var i = 0; i < l.length; i++) l[i][0].removeEventListener(l[i][1], l[i][2], l[i][3]);
    S.listeners = [];
  }

  // ------------------------------------------------------------------- DOM

  function markup(cfg) {
    return (
      '<div class="livetvPlayer-main-container lvh-root lvh-s-loading">' +
      '<div class="live-video-player live-video-player-div">' +
      '<div class="play-pause-icon"><i class="fa-solid fa-play"></i></div>' +
      '<div class="live-top-overlays">' +
      '<div class="live-channel-name">' + esc(cfg.name) + "</div>" +
      '<div class="live-badge">LIVE</div></div>' +
      '<div class="live-video-controls">' +
      '<div id="lp-fullscreen-btn" class="lp-fullscreen-btn">' +
      '<i class="fa-sharp fa-solid fa-expand lp-fullscreen-icon"></i></div></div>' +
      '<video id="html-live-player" class="html-live-player lvh-video" autoplay playsinline webkit-playsinline data-stream-id="' +
      esc(cfg.streamId) + '"></video>' +
      '<div class="lvh-loader hidden"><div class="lvh-spinner"></div></div>' +
      '<div class="lvh-hud">' +
      '<div class="lvh-top"><div class="lvh-name"></div><div class="lvh-live">LIVE</div></div>' +
      '<div class="lvh-center"><div class="lvh-ctl lvh-playbtn" data-lvh="play">' +
      kind("k-play", "play") + kind("k-pause", "pause") + "</div></div>" +
      '<div class="lvh-bottom"><div class="lvh-ctl lvh-exitbtn" data-lvh="exit">' +
      kind("always", "fs-exit") + "</div></div>" +
      "</div>" +
      '<div class="lvh-toast hidden"></div>' +
      '<div class="lvh-error hidden"><div class="lvh-dialog">' +
      '<div class="lvh-dialog-title">Playback error</div>' +
      '<div class="lvh-dialog-msg"></div>' +
      '<div class="lvh-dialog-btns">' +
      '<div class="lvh-ctl lvh-btn" data-lvh="errBack">' + kind("always", "back") + "<span>Back</span></div>" +
      '<div class="lvh-ctl lvh-btn" data-lvh="errRetry">' + kind("always", "retry") + "<span>Retry</span></div>" +
      "</div></div></div>" +
      "</div></div>"
    );
  }

  // ---------------------------------------------------------------- state

  function isBusyState(st) {
    return st === "loading" || st === "buffering";
  }

  function setState(next) {
    if (!S || S.state === next) return;
    var prev = S.state;
    S.state = next;
    S.root.className = S.root.className.replace(/\blvh-s-\w+/g, "").replace(/\s+/g, " ") + " lvh-s-" + next;

    // Loading/buffering: only the spinner shows (one root class).
    var wasBusy = isBusyState(prev);
    var nowBusy = isBusyState(next);
    if (!wasBusy && nowBusy) {
      S.hudBeforeBusy = prev === "idle" ? S.fullscreen : S.hudVisible;
      clearTimeout(S.hudTimer);
      S.hudTimer = null;
      S.hudVisible = false;
      S.root.classList.remove("lvh-hud-on");
      S.root.classList.add("is-loading");
      rebuildEntries();
    } else if (wasBusy && !nowBusy) {
      S.root.classList.remove("is-loading");
      if (S.hudBeforeBusy) {
        S.hudBeforeBusy = false;
        showHud();
      }
    }
    armWatchdog();
    syncIcons();
    updateLoader();
    armHudTimer();
  }

  function syncIcons() {
    var v = S.video;
    var pause = S.state === "playing" || ((S.state === "loading" || S.state === "buffering") && !S.userPaused);
    if (pause) S.els.playBtn.classList.add("is-pause");
    else S.els.playBtn.classList.remove("is-pause");
    var legacy = S.root.querySelector(".play-pause-icon");
    if (legacy) {
      legacy.innerHTML = v.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    }
  }

  function armWatchdog() {
    clearTimeout(S.watchdogTimer);
    S.watchdogTimer = null;
    var ms = 0;
    if (S.state === "loading") ms = START_TIMEOUT_MS;
    else if (S.state === "buffering") ms = BUFFER_TIMEOUT_MS;
    if (!ms) return;
    S.watchdogTimer = setTimeout(function () {
      failure("The channel did not respond. Check the stream and try again.");
    }, ms);
  }

  // Loader: only in loading/buffering and only while really stalled.
  function updateLoader() {
    if (!S) return;
    var v = S.video;
    var inState = S.state === "loading" || S.state === "buffering";
    var stalled = S.waiting && v.readyState < 3 && Date.now() - S.lastProgressAt >= STALL_MS;
    var show = inState && stalled && !S.errorOpen;
    if (show !== S.loaderOn) {
      S.loaderOn = show;
      S.els.loader.classList[show ? "remove" : "add"]("hidden");
    }
  }

  function tick() {
    if (!S) return;
    var v = S.video;
    var now = Date.now();
    var t = v.currentTime;
    if (Math.abs(t - S.lastTime) > 0.01) {
      S.lastTime = t;
      S.lastProgressAt = now;
      if (!v.paused) {
        S.waiting = false;
        if (S.state === "loading" || S.state === "buffering") markPlaying();
      }
    } else if (S.state === "playing" && !v.paused && v.readyState < 3 && now - S.lastProgressAt >= STALL_MS) {
      S.waiting = true;
      setState("buffering");
    }
    updateLoader();
  }

  function markPlaying() {
    S.hasPlayedOnce = true;
    S.retried = false;
    S.waiting = false;
    setState("playing");
  }

  // ---------------------------------------------------------------- errors

  // One automatic retry first, then the overlay.
  function failure(msg) {
    if (!S || S.errorOpen) return;
    if (!S.retried) {
      S.retried = true;
      loadStream(true);
      return;
    }
    showError(msg);
  }

  function showError(msg) {
    if (!S || S.errorOpen) return;
    S.errorOpen = true;
    clearTimeout(S.watchdogTimer);
    clearTimeout(S.hudTimer);
    clearInterval(S.pollTimer);
    S.watchdogTimer = S.hudTimer = S.pollTimer = null;
    stopMedia();
    S.root.classList.remove("is-loading");
    S.state = "error";
    S.root.className = S.root.className.replace(/\blvh-s-\w+/g, "") + " lvh-s-error lvh-error-on";
    S.els.loader.classList.add("hidden");
    S.loaderOn = false;
    S.els.errMsg.textContent = msg || "Something went wrong while playing this channel.";
    S.els.error.classList.remove("hidden");
    S.hudVisible = false;
    S.root.classList.remove("lvh-hud-on");
    S.focusId = "errBack";
    rebuildEntries();
  }

  function retry() {
    if (!S.errorOpen) return;
    S.errorOpen = false;
    S.els.error.classList.add("hidden");
    S.root.classList.remove("lvh-error-on");
    S.retried = false;
    S.focusId = "play";
    startPoll();
    loadStream(false);
    rebuildEntries();
    if (S.fullscreen) showHud();
  }

  // ---------------------------------------------------------------- media

  function stopMedia() {
    var v = S.video;
    try {
      v.pause();
    } catch (e) {}
    if (S.hls) {
      try {
        S.hls.destroy();
      } catch (e2) {}
      S.hls = null;
    }
    v.removeAttribute("src");
    try {
      v.load();
    } catch (e3) {}
  }

  function loadStream(isRetry) {
    var v = S.video;
    var url = S.cfg.url;
    if (!isRetry) S.retried = false;
    S.hasPlayedOnce = false;
    S.userPaused = false;
    S.lastTime = -1;
    S.waiting = true;
    S.lastProgressAt = Date.now();
    if (S.hls) {
      try {
        S.hls.destroy();
      } catch (e) {}
      S.hls = null;
    }
    setState("loading");
    armWatchdog(); // restart the start timeout even when already "loading"
    v.removeAttribute("src");
    if (
      /\.m3u8(\?|$)/i.test(url) &&
      !v.canPlayType("application/vnd.apple.mpegurl") &&
      window.Hls &&
      window.Hls.isSupported()
    ) {
      S.hls = new window.Hls();
      S.hls.loadSource(url);
      S.hls.attachMedia(v);
    } else {
      v.src = url;
      try {
        v.load();
      } catch (e2) {}
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function doPlay() {
    S.userPaused = false;
    var p = S.video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function doPause() {
    S.userPaused = true;
    S.video.pause();
  }

  // Click and OK share this. Only while playing/paused; a repeat within 300ms
  // is ignored. In the error state only the windowed preview retries on OK
  // (it has no focusable overlay buttons for the remote); fullscreen uses them.
  function togglePlay() {
    if (S.errorOpen) {
      if (!S.fullscreen) retry();
      return;
    }
    if (S.state !== "playing" && S.state !== "paused") return;
    var now = Date.now();
    if (now - S.lastToggleAt < 300) return;
    S.lastToggleAt = now;
    if (S.video.paused) doPlay();
    else doPause();
  }

  function bindVideo() {
    var v = S.video;
    // a bare 'waiting' blip changes nothing: tick() switches to buffering only
    // after a real stall (readyState < 3 and time frozen for 300ms)
    on(v, "waiting", function () {
      S.waiting = true;
    });
    on(v, "playing", function () {
      S.lastProgressAt = Date.now();
      S.lastTime = v.currentTime;
      markPlaying();
      showControls();
    });
    on(v, "canplay", function () {
      if (!v.paused && S.state === "loading") S.waiting = false;
    });
    on(v, "pause", function () {
      if (S.errorOpen || S.leaving) return;
      S.userPaused = true;
      setState("paused");
      showControls();
      if (S.fullscreen) showHud();
    });
    on(v, "play", function () {
      if (S.state === "paused") {
        S.userPaused = false;
        S.lastProgressAt = Date.now();
        S.lastTime = v.currentTime;
        setState("playing");
      }
      syncIcons();
    });
    on(v, "ended", function () {
      failure("Something went wrong while playing this channel.");
    });
    on(v, "error", function () {
      if (!v.getAttribute("src") && !S.hls) return;
      var code = v.error ? v.error.code : 0;
      failure(code === 2 ? "Network error. Check your connection and try again." : "Something went wrong while playing this channel.");
    });
  }

  function startPoll() {
    clearInterval(S.pollTimer);
    S.pollTimer = setInterval(tick, POLL_MS);
  }

  // ------------------------------------------------- windowed legacy controls

  function showControls() {
    if (!S) return;
    if (S.fullscreen) return;
    var pp = S.root.querySelector(".play-pause-icon");
    var fsb = document.getElementById("lp-fullscreen-btn");
    var top = S.root.querySelector(".live-top-overlays");
    if (pp) pp.style.display = "flex";
    if (fsb) fsb.style.display = "flex";
    if (top) top.classList.remove("hidden");
    clearTimeout(window._controlsTimer);
    window._controlsTimer = setTimeout(function () {
      if (!S || S.state === "paused") return;
      hideControls();
    }, CONTROLS_HIDE_MS);
  }

  function hideControls() {
    if (!S) return;
    var pp = S.root.querySelector(".play-pause-icon");
    var fsb = document.getElementById("lp-fullscreen-btn");
    var top = S.root.querySelector(".live-top-overlays");
    if (pp) pp.style.display = "none";
    if (fsb) fsb.style.display = "none";
    if (top) top.classList.add("hidden");
  }

  // ------------------------------------------------------------ fullscreen HUD

  function hudMustStay() {
    return S.state !== "playing" || S.errorOpen;
  }

  function armHudTimer() {
    if (!S) return;
    clearTimeout(S.hudTimer);
    S.hudTimer = null;
    if (!S.fullscreen || !S.hudVisible || hudMustStay()) return;
    S.hudTimer = setTimeout(hideHud, HUD_HIDE_MS);
  }

  function showHud() {
    if (!S || !S.fullscreen || S.errorOpen || isBusyState(S.state)) return;
    if (!S.hudVisible) {
      S.hudVisible = true;
      S.root.classList.add("lvh-hud-on");
      rebuildEntries();
    }
    armHudTimer();
  }

  function hideHud() {
    if (!S) return;
    clearTimeout(S.hudTimer);
    S.hudTimer = null;
    if (!S.hudVisible) return;
    S.hudVisible = false;
    S.root.classList.remove("lvh-hud-on");
    rebuildEntries();
  }

  function toast(msg) {
    if (!S) return;
    S.els.toast.textContent = msg;
    S.els.toast.classList.remove("hidden");
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () {
      if (S) S.els.toast.classList.add("hidden");
    }, TOAST_MS);
  }

  // ------------------------------------------------- focus + neighbor table

  function currentIds() {
    if (S.errorOpen) return ["errBack", "errRetry"];
    if (isBusyState(S.state)) return [];
    if (S.fullscreen && S.hudVisible) return ["play", "exit"];
    return [];
  }

  // Re-registered whenever controls show, hide or rebuild.
  function rebuildEntries() {
    S.entries = currentIds();
    if (S.entries.indexOf(S.focusId) === -1) S.focusId = S.errorOpen ? "errBack" : "play";
    applyFocus();
  }

  function applyFocus() {
    if (!S.entries.length) {
      var stale = S.root.querySelectorAll(".lvh-ctl.focused");
      for (var j = 0; j < stale.length; j++) stale[j].classList.remove("focused");
      return;
    }
    var prev = document.querySelectorAll(".focused");
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove("focused");
    var n = ctl(S.focusId);
    if (n) n.classList.add("focused");
  }

  function navigate(dir) {
    var nb = NEIGHBORS[S.focusId];
    var to = nb && nb[dir];
    if (to && S.entries.indexOf(to) !== -1) {
      S.focusId = to;
      applyFocus();
    }
  }

  function actionFor(id) {
    if (id === "play") togglePlay();
    else if (id === "exit" || id === "errBack") {
      if (S.fullscreen) exitFullscreen();
      else if (id === "errBack") {
        S.errorOpen = false;
        S.els.error.classList.add("hidden");
        S.root.classList.remove("lvh-error-on");
        S.focusId = "play";
        rebuildEntries();
      }
    } else if (id === "errRetry") retry();
  }

  // ---------------------------------------------------------------- layout

  // The only place that changes the layout.
  function applyLayout(full) {
    if (!S) return;
    var box = document.getElementById("lp-player-container");
    S.fullscreen = !!full;
    if (box) box.classList[full ? "add" : "remove"]("lvh-fs");
    document.body.classList[full ? "add" : "remove"]("lvh-fs-on");
    S.root.classList[full ? "add" : "remove"]("lvh-full");
    clearTimeout(S.hudTimer);
    S.hudVisible = false;
    S.root.classList.remove("lvh-hud-on");
    S.hudBeforeBusy = !!full && isBusyState(S.state); // HUD returns after the spinner
    if (full) {
      hideControls();
      S.focusId = "play";
      showHud();
    } else {
      S.entries = [];
      applyFocus();
      showControls();
    }
    rebuildEntries();
    if (typeof window.liveHtmlLayoutChanged === "function") window.liveHtmlLayoutChanged(!!full);
  }

  function enterFullscreen() {
    if (S && !S.fullscreen) applyLayout(true);
  }

  function exitFullscreen() {
    if (S && S.fullscreen) applyLayout(false);
  }

  // ------------------------------------------------------------------- keys

  function dirOf(kc) {
    return kc === 38 ? "up" : kc === 40 ? "down" : kc === 37 ? "left" : kc === 39 ? "right" : null;
  }

  function isBack(e) {
    if (typeof window.isBackKey === "function") return window.isBackKey(e);
    var c = e.keyCode;
    return c === 10009 || c === 461 || c === 8 || c === 27;
  }

  function onKeyDown(e) {
    if (!S || S.leaving) return;
    var kc = e.keyCode;
    var inPage = localStorage.getItem("currentPage") === "liveTvPage";
    if (!S.fullscreen && !inPage) return;

    // FF / RW are not available on live TV (any layout).
    if (kc === KEY_FF || kc === KEY_RW) {
      toast("Not available for live TV");
      if (S.fullscreen) showHud();
      block(e);
      return;
    }
    if (kc === KEY_PLAYPAUSE) {
      togglePlay();
      if (S.fullscreen) showHud();
      block(e);
      return;
    }

    if (!S.fullscreen) return; // windowed navigation belongs to LivePage

    // loading / buffering: only Back works (exits fullscreen)
    if (isBusyState(S.state) && !S.errorOpen) {
      var back = kc === KEY_STOP || isBack(e);
      if (back || dirOf(kc) || kc === 13 || kc === KEY_PLAY || kc === KEY_PAUSE) block(e);
      if (back) exitFullscreen();
      return;
    }

    if (kc === KEY_PLAY) {
      if (S.video.paused) doPlay();
      showHud();
    } else if (kc === KEY_PAUSE) {
      if (!S.video.paused) doPause();
      showHud();
    } else if (kc === KEY_STOP || isBack(e)) {
      // exit fullscreen first; LivePage handles the next Back
      if (S.errorOpen && S.focusId !== "errBack") S.focusId = "errBack";
      exitFullscreen();
    } else if (dirOf(kc)) {
      if (!S.entries.length) {
        showHud();
      } else {
        navigate(dirOf(kc));
        showHud();
      }
    } else if (kc === 13) {
      if (!e.repeat) {
        // HUD hidden or nothing focused: OK toggles play/pause, then the HUD shows
        var focusedEl = S.entries.length ? ctl(S.focusId) : null;
        if (!focusedEl || !focusedEl.classList.contains("focused")) togglePlay();
        else actionFor(S.focusId);
        showHud();
      }
    } else {
      return;
    }
    block(e);
  }

  function block(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // ---------------------------------------------------------------- pointer

  function bindPointer() {
    on(S.root, "mousemove", function () {
      if (S.fullscreen) showHud();
    });
    on(S.root, "click", function (e) {
      var t = e.target;
      while (t && t !== S.root) {
        if (t.className && typeof t.className === "string" && /\blvh-ctl\b/.test(t.className)) return;
        t = t.parentNode;
      }
      if (!S.fullscreen || S.errorOpen) return;
      // click on the video toggles the HUD (never pauses live TV)
      if (S.hudVisible) hideHud();
      else showHud();
    });
    // windowed fullscreen button: LivePage only wires it to the remote, so
    // the click is handled here (same toggle the remote OK reaches)
    var fsBtn = S.root.querySelector("#lp-fullscreen-btn");
    if (fsBtn) {
      fsBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (S.fullscreen) exitFullscreen();
        else enterFullscreen();
      };
    }
    var legacy = S.root.querySelector(".play-pause-icon");
    if (legacy) {
      legacy.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        showControls();
      };
    }
  }

  // -------------------------------------------------------------- lifecycle

  function teardown() {
    if (!S) return;
    S.leaving = true;
    clearTimeout(S.watchdogTimer);
    clearTimeout(S.hudTimer);
    clearTimeout(S.toastTimer);
    clearInterval(S.pollTimer);
    stopMedia();
    offAll();
    var box = document.getElementById("lp-player-container");
    if (box) box.classList.remove("lvh-fs");
    document.body.classList.remove("lvh-fs-on");
    if (window._controlsTimer) {
      clearTimeout(window._controlsTimer);
      window._controlsTimer = null;
    }
    window.LiveHtmlHoverSync = null;
    window.LiveHtmlActivate = null;
    if (window.livePlayer && window.livePlayer.isHtmlLive) window.livePlayer = null;
    S = null;
  }

  function exposeCompat() {
    window.livePlayer = {
      isHtmlLive: true,
      play: function () {
        doPlay();
      },
      pause: function () {
        doPause();
      },
      paused: function () {
        return S ? S.video.paused : true;
      },
      togglePlayPause: togglePlay,
      showControls: showControls,
      hideControls: hideControls,
      refreshControlsVisibility: function () {
        if (!S || S.fullscreen) return;
        if (S.video.paused) showControls();
      },
      dispose: teardown,
    };
  }

  function play(wrapper, cfg) {
    if (!wrapper || !cfg || !cfg.url) return;

    // Same wrapper still holds our player: switch channel on the same <video>.
    if (S && S.root && wrapper.contains(S.root)) {
      S.cfg = cfg;
      S.video.setAttribute("data-stream-id", String(cfg.streamId));
      var nm = S.root.querySelectorAll(".live-channel-name, .lvh-name");
      for (var i = 0; i < nm.length; i++) nm[i].textContent = cfg.name || "";
      if (S.errorOpen) {
        S.errorOpen = false;
        S.els.error.classList.add("hidden");
        S.root.classList.remove("lvh-error-on");
        startPoll();
      }
      loadStream(false);
      rebuildEntries();
      return;
    }

    if (S) teardown();
    wrapper.innerHTML = markup(cfg);
    var root = wrapper.querySelector(".lvh-root");
    S = {
      cfg: cfg,
      root: root,
      video: root.querySelector("video"),
      els: null,
      listeners: [],
      state: "idle",
      entries: [],
      focusId: "play",
      fullscreen: false,
      hudVisible: false,
      errorOpen: false,
      leaving: false,
      userPaused: false,
      waiting: false,
      loaderOn: false,
      retried: false,
      hasPlayedOnce: false,
      lastTime: -1,
      lastProgressAt: Date.now(),
      watchdogTimer: null,
      hudTimer: null,
      pollTimer: null,
      toastTimer: null,
      hls: null,
      hudBeforeBusy: false,
      lastToggleAt: 0,
    };
    S.els = {
      loader: q(".lvh-loader"),
      playBtn: q(".lvh-playbtn"),
      toast: q(".lvh-toast"),
      error: q(".lvh-error"),
      errMsg: q(".lvh-error .lvh-dialog-msg"),
    };
    S.video.controls = false;
    S.video.removeAttribute("controls");
    var nameEls = root.querySelectorAll(".lvh-name");
    for (var k = 0; k < nameEls.length; k++) nameEls[k].textContent = cfg.name || "";

    window.LiveHtmlHoverSync = function (node) {
      if (!S) return;
      var id = node && node.getAttribute("data-lvh");
      if (id && S.entries.indexOf(id) !== -1) {
        S.focusId = id;
        applyFocus();
      }
      if (S.fullscreen) showHud();
    };
    window.LiveHtmlActivate = function (node) {
      if (!S) return;
      var id = node && node.getAttribute("data-lvh");
      if (!id || S.entries.indexOf(id) === -1) {
        // OK with the pointer visible but none of our controls registered/focused
        if (!S.errorOpen) {
          togglePlay();
          if (S.fullscreen) showHud();
        }
        return;
      }
      S.focusId = id;
      applyFocus();
      actionFor(id);
      if (S.fullscreen) showHud();
    };

    exposeCompat();
    // window capture runs before focus.js's document-level OK handler
    on(window, "keydown", onKeyDown, true);
    bindVideo();
    bindPointer();
    startPoll();
    loadStream(false);
    syncIcons();
  }

  window.LiveVideoPlayerHtml = {
    play: play,
    dispose: teardown,
    isSupported: function () {
      return !isTizenAvplay();
    },
    isActive: function () {
      return !!S;
    },
    isFullscreen: function () {
      return !!(S && S.fullscreen);
    },
    enterFullscreen: enterFullscreen,
    exitFullscreen: exitFullscreen,
    toggleFullscreen: function () {
      if (!S) return;
      if (S.fullscreen) exitFullscreen();
      else enterFullscreen();
    },
  };
})();
