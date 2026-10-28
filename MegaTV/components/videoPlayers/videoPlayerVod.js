// videoPlayerVod.js - HTML5 <video> player for movies + episodes (webOS / PC).
// Tizen (webapis.avplay) keeps the old AVPlay path; call sites check
// App.VideoPlayerVod.isSupported() first.
//
// App.VideoPlayerVod.open({type, id, title, url, seriesId, season, episode,
//                          fromContinue, startOver})
//
// ES5 only.

(function () {
  "use strict";

  var App = (window.App = window.App || {});

  var ICON_DIR = "./assets/player/";
  var SEEK_STEP = 10;
  var RESUME_MIN_SEC = 5;
  var CW_ADD_AFTER_MS = 5000;
  var CW_SAVE_EVERY_MS = 10000;
  var HUD_HIDE_MS = 5000;
  var START_TIMEOUT_MS = 25000;
  var BUFFER_TIMEOUT_MS = 30000;
  var STALL_MS = 300;
  var KEY_COMMIT_MS = 600;
  var BTN_COMMIT_MS = 500;
  var POLL_MS = 100;

  var KEY_PLAY = 415;
  var KEY_PAUSE = 19;
  var KEY_PLAYPAUSE = 10252;
  var KEY_STOP = 413;
  var KEY_FF = 417;
  var KEY_RW = 412;

  // One neighbor table for every zone. "lastCenter" resolves at runtime.
  var NEIGHBORS = {
    back: { down: "play" },
    rew: { right: "play", up: "back", down: "seek" },
    play: { left: "rew", right: "fwd", up: "back", down: "seek" },
    fwd: { left: "play", up: "back", down: "seek" },
    seek: { up: "lastCenter" },
    errBack: { right: "errRetry" },
    errRetry: { left: "errBack" },
    popResume: { right: "popStart" },
    popStart: { left: "popResume" },
  };

  var S = null; // active session

  // ---------------------------------------------------------------- helpers

  function isTizenAvplay() {
    return typeof window.webapis !== "undefined" && !!window.webapis.avplay;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return (h > 0 ? h + ":" + pad2(m) : m) + ":" + pad2(s);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function iconPair(name) {
    return (
      '<img class="vod-ic n" src="' + ICON_DIR + name + '-white.png" alt="" />' +
      '<img class="vod-ic f" src="' + ICON_DIR + name + '-black.png" alt="" />'
    );
  }

  function kind(cls, name) {
    return '<span class="vod-kind ' + cls + '">' + iconPair(name) + "</span>";
  }

  // ------------------------------------------- continue watching (one writer)

  var Continue = {
    playlistName: function () {
      try {
        return JSON.parse(localStorage.getItem("selectedPlaylist")).playlistName;
      } catch (e) {
        return null;
      }
    },
    key: function (type) {
      return type === "series" ? "continueWatchingSeries" : "continueWatchingMovies";
    },
    load: function () {
      try {
        return JSON.parse(localStorage.getItem("playlistsData")) || [];
      } catch (e) {
        return [];
      }
    },
    // Runs fn(list, playlist) on the current playlist's list; saves when fn returns true.
    edit: function (type, fn) {
      var name = Continue.playlistName();
      var playlists = Continue.load();
      var k = Continue.key(type);
      for (var i = 0; i < playlists.length; i++) {
        if (playlists[i].playlistName !== name) continue;
        var list = playlists[i][k] || [];
        var res = fn(list);
        if (res) {
          playlists[i][k] = res;
          try {
            localStorage.setItem("playlistsData", JSON.stringify(playlists));
          } catch (e) {}
        }
        return;
      }
    },
    find: function (o) {
      var found = null;
      var name = Continue.playlistName();
      var playlists = Continue.load();
      var list = [];
      for (var i = 0; i < playlists.length; i++) {
        if (playlists[i].playlistName === name) {
          list = playlists[i][Continue.key(o.type)] || [];
          break;
        }
      }
      for (var j = 0; j < list.length; j++) {
        var it = list[j];
        if (!it) continue;
        if (o.type === "series") {
          if (String(it.itemId) === String(o.seriesId) && String(it.episodeId) === String(o.id)) {
            found = it;
            break;
          }
        } else if (String(it.itemId) === String(o.id)) {
          found = it;
          break;
        }
      }
      return found;
    },
    // Movies: one entry per movie. Series: one entry per series (last episode).
    write: function (o, episodeId, pos, dur) {
      var itemId = String(o.type === "series" ? o.seriesId : o.id);
      var entry = {
        itemId: itemId,
        episodeId: o.type === "series" ? String(episodeId) : null,
        resumeTime: Math.round(pos * 10) / 10,
        duration: Math.floor(dur || 0),
        type: o.type === "series" ? "series" : "movie",
      };
      if (o.type === "series" && o.season != null) entry.season = o.season;
      if (o.type === "series" && o.episode != null && String(episodeId) === String(o.id)) {
        entry.episode = o.episode;
      }
      Continue.edit(o.type, function (list) {
        var out = [entry];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && String(list[i].itemId) !== itemId) out.push(list[i]);
        }
        return out;
      });
    },
    remove: function (o) {
      var itemId = String(o.type === "series" ? o.seriesId : o.id);
      Continue.edit(o.type, function (list) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
          if (list[i] && String(list[i].itemId) !== itemId) out.push(list[i]);
        }
        return out;
      });
    },
    has: function (type, itemId) {
      var name = Continue.playlistName();
      var playlists = Continue.load();
      for (var i = 0; i < playlists.length; i++) {
        if (playlists[i].playlistName !== name) continue;
        var list = playlists[i][Continue.key(type)] || [];
        for (var j = 0; j < list.length; j++) {
          if (list[j] && String(list[j].itemId) === String(itemId)) return true;
        }
      }
      return false;
    },
  };

  // Next episode (same season, then following seasons) from the cached episode map.
  function findNextEpisode(o) {
    var map;
    try {
      map = JSON.parse(localStorage.getItem("seriesEpisodesData")) || {};
    } catch (e) {
      return null;
    }
    var seasons = Object.keys(map).sort(function (a, b) {
      return Number(a) - Number(b);
    });
    var found = false;
    for (var i = 0; i < seasons.length; i++) {
      var eps = map[seasons[i]] || [];
      for (var j = 0; j < eps.length; j++) {
        if (found) return { id: String(eps[j].id), season: seasons[i], ep: eps[j] };
        if (String(eps[j].id) === String(o.id)) found = true;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------- DOM

  function buildDom(o) {
    var root = el("div", "vod-player vod-s-loading");
    root.id = "vod-player-root";
    root.innerHTML =
      '<video class="vod-video" playsinline webkit-playsinline></video>' +
      '<div class="vod-loader hidden"><div class="vod-spinner"></div></div>' +
      '<div class="vod-hud">' +
      '<div class="vod-top">' +
      '<div class="vod-ctl vod-back" data-vod="back">' + kind("always", "back") + "</div>" +
      '<div class="vod-title"></div>' +
      "</div>" +
      '<div class="vod-center">' +
      '<div class="vod-ctl vod-skip" data-vod="rew">' + kind("always", "arrow-back") + "</div>" +
      '<div class="vod-ctl vod-playbtn" data-vod="play">' + kind("k-play", "play") + kind("k-pause", "pause") + "</div>" +
      '<div class="vod-ctl vod-skip" data-vod="fwd">' + kind("always", "arrow-forward") + "</div>" +
      "</div>" +
      '<div class="vod-bottom">' +
      '<span class="vod-time vod-time-cur">0:00</span>' +
      '<div class="vod-seekbar" data-vod="seek">' +
      '<div class="vod-seek-track"><div class="vod-seek-fill"></div></div>' +
      '<div class="vod-seek-thumb"></div>' +
      '<div class="vod-seek-bubble">0:00</div>' +
      "</div>" +
      '<span class="vod-time vod-time-dur">0:00</span>' +
      "</div>" +
      "</div>" +
      '<div class="vod-error hidden">' +
      '<div class="vod-dialog">' +
      '<div class="vod-dialog-title">Playback error</div>' +
      '<div class="vod-dialog-msg"></div>' +
      '<div class="vod-dialog-btns">' +
      '<div class="vod-ctl vod-btn" data-vod="errBack">' + kind("always", "back") + "<span>Back</span></div>" +
      '<div class="vod-ctl vod-btn" data-vod="errRetry">' + kind("always", "retry") + "<span>Retry</span></div>" +
      "</div></div></div>" +
      '<div class="vod-popup hidden">' +
      '<div class="vod-dialog">' +
      '<div class="vod-dialog-title"></div>' +
      '<div class="vod-dialog-msg"></div>' +
      '<div class="vod-dialog-btns">' +
      '<div class="vod-ctl vod-btn" data-vod="popResume"><span>Resume</span></div>' +
      '<div class="vod-ctl vod-btn" data-vod="popStart"><span>Start over</span></div>' +
      "</div></div></div>";

    var q = function (sel) {
      return root.querySelector(sel);
    };
    var els = {
      root: root,
      video: q(".vod-video"),
      loader: q(".vod-loader"),
      title: q(".vod-title"),
      playBtn: q(".vod-playbtn"),
      cur: q(".vod-time-cur"),
      dur: q(".vod-time-dur"),
      bar: q(".vod-seekbar"),
      fill: q(".vod-seek-fill"),
      thumb: q(".vod-seek-thumb"),
      bubble: q(".vod-seek-bubble"),
      error: q(".vod-error"),
      errMsg: q(".vod-error .vod-dialog-msg"),
      popup: q(".vod-popup"),
      popTitle: q(".vod-popup .vod-dialog-title"),
      popMsg: q(".vod-popup .vod-dialog-msg"),
    };
    els.title.textContent = o.title || "";
    return els;
  }

  function ctl(id) {
    return S && S.els.root.querySelector('[data-vod="' + id + '"]');
  }

  // ---------------------------------------------------------- listeners

  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, !!capture);
    S.listeners.push([target, type, fn, !!capture]);
  }

  function offAll() {
    var l = S.listeners;
    for (var i = 0; i < l.length; i++) l[i][0].removeEventListener(l[i][1], l[i][2], l[i][3]);
    S.listeners = [];
  }

  // ------------------------------------------------------------- state

  function setState(next) {
    if (!S || S.state === next) return;
    S.state = next;
    var cls = S.els.root.className.replace(/\bvod-s-\w+/g, "").replace(/\s+/g, " ");
    S.els.root.className = cls + " vod-s-" + next;
    armWatchdog();
    syncPlayIcon();
    updateLoader();
    refreshHud();
  }

  function playIntent() {
    return !S.userPaused && S.state !== "ended" && S.state !== "error";
  }

  function syncPlayIcon() {
    var b = S.els.playBtn;
    var showPause = S.state === "playing" || (S.state !== "paused" && playIntent());
    if (showPause) b.classList.add("is-pause");
    else b.classList.remove("is-pause");
  }

  function armWatchdog() {
    clearTimeout(S.watchdogTimer);
    S.watchdogTimer = null;
    var ms = 0;
    var msg = "";
    if (S.state === "loading") {
      ms = START_TIMEOUT_MS;
      msg = "The video did not start. Check the stream and try again.";
    } else if (S.state === "buffering" || S.state === "seeking") {
      ms = BUFFER_TIMEOUT_MS;
      msg = "Playback stalled. Check your connection and try again.";
    }
    if (!ms) return;
    S.watchdogTimer = setTimeout(function () {
      showError(msg);
    }, ms);
  }

  // Loader: only in loading/buffering/seeking, and only while really stalled.
  function updateLoader() {
    if (!S) return;
    var v = S.els.video;
    var st = S.state;
    var inState = st === "loading" || st === "buffering" || st === "seeking";
    var stalled = S.waiting && v.readyState < 3 && Date.now() - S.lastProgressAt >= STALL_MS;
    var show = inState && stalled && !S.errorOpen;
    if (show !== S.loaderOn) {
      S.loaderOn = show;
      if (show) S.els.loader.classList.remove("hidden");
      else S.els.loader.classList.add("hidden");
    }
  }

  // ---------------------------------------------------------------- HUD

  function hudMustStay() {
    return (
      S.state !== "playing" ||
      S.previewing ||
      S.dragging ||
      S.popupOpen ||
      S.errorOpen
    );
  }

  function armHudTimer() {
    clearTimeout(S.hudTimer);
    S.hudTimer = null;
    if (!S.hudVisible || hudMustStay()) return;
    S.hudTimer = setTimeout(hideHud, HUD_HIDE_MS);
  }

  function refreshHud() {
    if (S.hudVisible) armHudTimer();
  }

  function showHud() {
    if (!S || S.errorOpen || S.popupOpen) return;
    if (!S.hudVisible) {
      S.hudVisible = true;
      S.els.root.classList.add("vod-hud-on");
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
    S.els.root.classList.remove("vod-hud-on");
    rebuildEntries();
  }

  // ------------------------------------------------- focus + neighbor table

  function currentIds() {
    if (S.popupOpen) return ["popResume", "popStart"];
    if (S.errorOpen) return ["errBack", "errRetry"];
    if (S.hudVisible) return ["back", "rew", "play", "fwd", "seek"];
    return [];
  }

  function defaultFocus() {
    if (S.popupOpen) return "popResume";
    if (S.errorOpen) return "errBack";
    return "play";
  }

  // Re-registered whenever controls show, hide or rebuild.
  function rebuildEntries() {
    S.entries = currentIds();
    if (S.entries.indexOf(S.focusId) === -1) S.focusId = defaultFocus();
    applyFocus();
  }

  function applyFocus() {
    var prev = document.querySelectorAll(".focused");
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove("focused");
    if (!S.entries.length) return;
    var n = ctl(S.focusId);
    if (n) n.classList.add("focused");
    if (S.focusId === "rew" || S.focusId === "play" || S.focusId === "fwd") S.lastCenter = S.focusId;
  }

  function setFocusId(id) {
    if (S.entries.indexOf(id) === -1) return;
    S.focusId = id;
    applyFocus();
  }

  function navigate(dir) {
    var nb = NEIGHBORS[S.focusId];
    var to = nb && nb[dir];
    if (to === "lastCenter") to = S.lastCenter || "play";
    if (to) setFocusId(to);
  }

  // ---------------------------------------------------------------- seeking

  function duration() {
    var d = S.els.video.duration;
    return isFinite(d) && d > 0 ? d : S.knownDuration || 0;
  }

  function setSeekUI(sec, preview) {
    var d = duration();
    var pct = d ? clamp((sec / d) * 100, 0, 100) : 0;
    S.els.fill.style.width = pct + "%";
    S.els.thumb.style.left = pct + "%";
    if (preview) {
      S.els.bubble.textContent = fmtTime(sec);
      S.els.bubble.style.left = pct + "%";
    }
  }

  function updateTimes() {
    if (!S || S.previewing || S.dragging) return;
    var v = S.els.video;
    S.els.cur.textContent = fmtTime(v.currentTime);
    S.els.dur.textContent = fmtTime(duration());
    setSeekUI(v.currentTime, false);
  }

  function setPreview(sec, delay) {
    var d = duration();
    if (!d) return;
    S.seekPreview = clamp(sec, 0, Math.max(0, d - 1));
    if (!S.previewing) {
      S.previewing = true;
      S.els.root.classList.add("vod-previewing");
    }
    setSeekUI(S.seekPreview, true);
    clearTimeout(S.commitTimer);
    S.commitTimer = null;
    if (delay) S.commitTimer = setTimeout(commitSeek, delay);
    showHud();
    armHudTimer();
  }

  function previewStep(dir, repeat) {
    S.holdCount = repeat ? S.holdCount + 1 : 0;
    var step = S.holdCount > 20 ? 60 : S.holdCount > 8 ? 30 : SEEK_STEP;
    var base = S.seekPreview != null ? S.seekPreview : S.els.video.currentTime;
    setPreview(base + dir * step, KEY_COMMIT_MS);
  }

  function buttonSeek(dir) {
    var base = S.seekPreview != null ? S.seekPreview : S.els.video.currentTime;
    setPreview(base + dir * SEEK_STEP, BTN_COMMIT_MS);
  }

  function cancelPreview() {
    clearTimeout(S.commitTimer);
    S.commitTimer = null;
    S.seekPreview = null;
    S.previewing = false;
    S.dragging = false;
    S.els.root.classList.remove("vod-previewing");
    updateTimes();
    armHudTimer();
  }

  function commitSeek() {
    if (!S || S.seekPreview == null) return;
    var t = S.seekPreview;
    clearTimeout(S.commitTimer);
    S.commitTimer = null;
    S.seekPreview = null;
    S.previewing = false;
    S.dragging = false;
    S.els.root.classList.remove("vod-previewing");
    realSeek(t);
  }

  // Real seek = pause, loader, set currentTime, resume on seeked + canplay.
  function realSeek(t) {
    var v = S.els.video;
    if (S.state === "error" || S.state === "ended") return;
    S.seekWait = { seeked: false, canplay: false, resume: !S.userPaused };
    if (!v.paused) {
      S.ignorePause = true;
      v.pause();
    }
    S.waiting = true;
    S.lastProgressAt = Date.now();
    S.lastPos = t;
    setState("seeking");
    try {
      v.currentTime = t;
    } catch (e) {}
    S.els.cur.textContent = fmtTime(t);
    setSeekUI(t, false);
  }

  function tryFinishSeek() {
    var w = S.seekWait;
    if (!w || !w.seeked || !w.canplay) return;
    var v = S.els.video;
    S.seekWait = null;
    S.waiting = false;
    S.lastProgressAt = Date.now();
    S.lastTime = v.currentTime;
    if (w.resume) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
      setState("playing");
    } else {
      setState("paused");
    }
    savePosition("seek-end");
    updateTimes();
  }

  // ------------------------------------------------------------ transport

  function togglePlay() {
    var v = S.els.video;
    if (S.state === "error" || S.state === "ended") return;
    if (v.paused) doPlay();
    else doPause();
    showHud();
  }

  function doPlay() {
    var v = S.els.video;
    S.userPaused = false;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    syncPlayIcon();
  }

  function doPause() {
    S.userPaused = true;
    S.els.video.pause();
    syncPlayIcon();
  }

  function startPlayback(startAt) {
    var v = S.els.video;
    S.pendingStart = startAt > 0 ? startAt : 0;
    S.lastPos = S.pendingStart;
    S.lastTime = -1;
    S.waiting = true;
    S.lastProgressAt = Date.now();
    S.seekWait = null;
    S.userPaused = false;
    setState("loading");
    var url = S.opts.url || "";
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
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function stopMedia() {
    var v = S.els.video;
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

  // ------------------------------------------------------------ error UI

  function showError(msg) {
    if (!S || S.errorOpen || S.leaving) return;
    savePosition("error");
    S.errorOpen = true;
    S.seekPreview = null;
    S.previewing = false;
    S.dragging = false;
    S.seekWait = null;
    clearTimeout(S.watchdogTimer);
    clearTimeout(S.hudTimer);
    clearTimeout(S.commitTimer);
    clearInterval(S.pollTimer);
    clearInterval(S.saveTimer);
    S.watchdogTimer = S.hudTimer = S.commitTimer = S.pollTimer = S.saveTimer = null;
    stopMedia();
    S.hudVisible = false;
    S.els.root.classList.remove("vod-hud-on", "vod-previewing");
    S.els.errMsg.textContent = msg || "Something went wrong while playing this video.";
    S.els.error.classList.remove("hidden");
    S.state = "error";
    S.els.root.className = S.els.root.className.replace(/\bvod-s-\w+/g, "") + " vod-s-error";
    S.loaderOn = false;
    S.els.loader.classList.add("hidden");
    S.focusId = "errBack";
    rebuildEntries();
  }

  function retry() {
    if (!S.errorOpen) return;
    S.errorOpen = false;
    S.els.error.classList.add("hidden");
    S.state = "idle";
    startTimers();
    S.hudVisible = false;
    showHud();
    startPlayback(S.lastPos);
  }

  function errorMessageFor(v) {
    var code = v.error ? v.error.code : 0;
    if (code === 2) return "Network error. Check your connection and try again.";
    if (code === 3) return "This video could not be decoded.";
    if (code === 4) return "This video or its address is not supported.";
    return "Something went wrong while playing this video.";
  }

  // --------------------------------------------------- resume + popup

  function openPopup(savedPos) {
    S.popupOpen = true;
    S.hudVisible = false;
    S.els.root.classList.remove("vod-hud-on");
    S.els.popTitle.textContent = S.opts.title || "";
    S.els.popMsg.textContent = "Continue from " + fmtTime(savedPos) + "?";
    S.els.popup.classList.remove("hidden");
    S.focusId = "popResume";
    rebuildEntries();
  }

  function closePopup() {
    S.popupOpen = false;
    S.els.popup.classList.add("hidden");
    rebuildEntries();
  }

  // ------------------------------------------------ continue watching writes

  function currentPos() {
    var v = S.els.video;
    if (S.state === "error" || !v.getAttribute("src") && !S.hls) return S.lastPos;
    return v.currentTime || S.lastPos;
  }

  function savePosition(reason) {
    if (!S || !S.cwActive || !S.everPlayed || S.ended) return;
    var pos = currentPos();
    if (!(pos >= 0)) return;
    var dur = duration();
    S.lastPos = pos;
    Continue.write(S.opts, S.opts.id, pos, dur);
    if (window.console && console.log) console.log("[VOD] saved " + pos + "s (" + reason + ")");
  }

  function onEnded() {
    if (S.ended || S.leaving) return;
    S.ended = true;
    S.seekWait = null;
    setState("ended");
    var o = S.opts;
    var nextId = null;
    if (o.type === "series") {
      var next = findNextEpisode(o);
      if (next) {
        nextId = next.id;
        var nd = 0;
        if (next.ep && next.ep.info && next.ep.info.duration_secs) nd = parseInt(next.ep.info.duration_secs, 10) || 0;
        var o2 = {
          type: "series",
          seriesId: o.seriesId,
          id: next.id,
          season: next.season,
          episode: next.ep ? next.ep.episode_num : null,
        };
        Continue.write(o2, next.id, 0, nd);
      } else {
        Continue.remove(o); // last episode finished
      }
    } else {
      Continue.remove(o);
    }
    S.cwActive = false;
    leave({ nextEpisodeId: nextId });
  }

  // ----------------------------------------------------------------- timers

  function startTimers() {
    clearInterval(S.pollTimer);
    clearInterval(S.saveTimer);
    S.lastTickAt = Date.now();
    S.pollTimer = setInterval(tick, POLL_MS);
    S.saveTimer = setInterval(function () {
      if (S.state === "playing") savePosition("interval");
    }, CW_SAVE_EVERY_MS);
  }

  function tick() {
    if (!S) return;
    var v = S.els.video;
    var now = Date.now();
    var dt = Math.min(now - S.lastTickAt, 500);
    S.lastTickAt = now;
    var t = v.currentTime;
    var advanced = Math.abs(t - S.lastTime) > 0.01;

    if (advanced) {
      S.lastTime = t;
      S.lastProgressAt = now;
      if (!v.paused && !S.seekWait) {
        S.waiting = false;
        if (S.state === "loading" || S.state === "buffering") setState("playing");
        if (S.state === "playing") {
          S.lastPos = t;
          S.everPlayed = true;
          S.realPlayMs += dt;
          if (!S.cwActive && S.realPlayMs >= CW_ADD_AFTER_MS) {
            S.cwActive = true;
            savePosition("added");
          }
        }
      }
    } else if (
      S.state === "playing" &&
      !v.paused &&
      v.readyState < 3 &&
      now - S.lastProgressAt >= STALL_MS
    ) {
      S.waiting = true;
      setState("buffering");
    }
    updateLoader();
  }

  // ------------------------------------------------------------- video events

  function bindVideo() {
    var v = S.els.video;

    on(v, "loadedmetadata", function () {
      S.knownDuration = isFinite(v.duration) ? v.duration : S.knownDuration;
      if (S.pendingStart > 0 && S.pendingStart < (v.duration || Infinity) - 1) {
        try {
          v.currentTime = S.pendingStart;
        } catch (e) {}
      }
      S.pendingStart = 0;
      updateTimes();
    });
    on(v, "durationchange", updateTimes);
    on(v, "timeupdate", updateTimes);
    on(v, "waiting", function () {
      S.waiting = true;
      if (S.state === "playing") setState("buffering");
    });
    on(v, "playing", function () {
      S.waiting = false;
      S.lastProgressAt = Date.now();
      if (S.seekWait) return;
      if (S.state !== "ended" && S.state !== "error") setState("playing");
    });
    on(v, "canplay", function () {
      if (S.seekWait) {
        S.seekWait.canplay = true;
        tryFinishSeek();
      }
    });
    on(v, "seeked", function () {
      if (S.seekWait) {
        S.seekWait.seeked = true;
        if (v.readyState >= 3) S.seekWait.canplay = true;
        tryFinishSeek();
      }
    });
    on(v, "pause", function () {
      if (S.ignorePause) {
        S.ignorePause = false;
        return;
      }
      if (S.state === "ended" || S.state === "error" || S.leaving || v.ended) return;
      S.userPaused = true;
      setState("paused");
      savePosition("pause");
      showHud();
    });
    on(v, "play", function () {
      if (S.state === "paused") {
        S.userPaused = false;
        S.lastProgressAt = Date.now();
        setState("playing");
      }
    });
    on(v, "ended", onEnded);
    on(v, "error", function () {
      if (!v.getAttribute("src") && !S.hls) return;
      showError(errorMessageFor(v));
    });
  }

  // ------------------------------------------------------------------- keys

  function actionFor(id) {
    switch (id) {
      case "back":
      case "errBack":
        leave();
        break;
      case "rew":
        buttonSeek(-1);
        break;
      case "fwd":
        buttonSeek(1);
        break;
      case "play":
        togglePlay();
        break;
      case "seek":
        if (S.seekPreview != null) commitSeek();
        else togglePlay();
        break;
      case "errRetry":
        retry();
        break;
      case "popResume":
        closePopup();
        startPlayback(S.savedPos);
        showHud();
        break;
      case "popStart":
        closePopup();
        S.savedPos = 0;
        S.lastPos = 0;
        if (S.hadEntry) Continue.write(S.opts, S.opts.id, 0, S.knownDuration);
        startPlayback(0);
        showHud();
        break;
    }
  }

  function handleBack() {
    if (S.seekPreview != null || S.previewing) {
      cancelPreview();
      return;
    }
    if (S.popupOpen) {
      closePopup();
      leave();
      return;
    }
    if (S.errorOpen) {
      leave();
      return;
    }
    if (S.hudVisible) {
      hideHud();
      return;
    }
    leave();
  }

  function handleMedia(kc) {
    var v = S.els.video;
    if (S.errorOpen || S.popupOpen) return;
    if (kc === KEY_PLAY) {
      if (v.paused) doPlay();
    } else if (kc === KEY_PAUSE) {
      if (!v.paused) doPause();
    } else if (kc === KEY_PLAYPAUSE) {
      if (v.paused) doPlay();
      else doPause();
    } else if (kc === KEY_STOP) {
      leave();
      return;
    } else if (kc === KEY_FF) {
      buttonSeek(1);
    } else if (kc === KEY_RW) {
      buttonSeek(-1);
    }
    showHud();
  }

  function isMediaKey(kc) {
    return (
      kc === KEY_PLAY || kc === KEY_PAUSE || kc === KEY_PLAYPAUSE ||
      kc === KEY_STOP || kc === KEY_FF || kc === KEY_RW
    );
  }

  function dirOf(e) {
    switch (e.keyCode) {
      case 38: return "up";
      case 40: return "down";
      case 37: return "left";
      case 39: return "right";
    }
    return null;
  }

  function onKeyDown(e) {
    if (!S || S.leaving) return;
    var kc = e.keyCode;
    var handled = true;

    if (isMediaKey(kc)) {
      handleMedia(kc);
    } else if (isBackKeyEvent(e)) {
      handleBack();
    } else if (dirOf(e)) {
      var dir = dirOf(e);
      if (!S.entries.length && !S.errorOpen && !S.popupOpen) {
        // HUD hidden: first press only wakes the HUD (left/right start a seek preview).
        showHud();
        if (dir === "left" || dir === "right") {
          setFocusId("seek");
          previewStep(dir === "left" ? -1 : 1, false);
        }
      } else if (S.focusId === "seek" && (dir === "left" || dir === "right")) {
        previewStep(dir === "left" ? -1 : 1, e.repeat);
      } else {
        navigate(dir);
      }
      showHud();
    } else if (kc === 13) {
      if (!e.repeat) {
        if (!S.entries.length) {
          togglePlay();
          showHud();
        } else {
          actionFor(S.focusId);
          showHud();
        }
      }
    } else {
      handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onKeyUp(e) {
    if (!S || S.leaving) return;
    if ((e.keyCode === 37 || e.keyCode === 39) && S.focusId === "seek" && S.seekPreview != null) {
      S.holdCount = 0;
      commitSeek();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function isBackKeyEvent(e) {
    if (typeof window.isBackKey === "function") return window.isBackKey(e);
    var c = e.keyCode;
    return c === 10009 || c === 461 || c === 8 || c === 27;
  }

  // ---------------------------------------------------------------- pointer

  function seekPctFromEvent(e) {
    var r = S.els.bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / (r.width || 1), 0, 1);
  }

  function bindPointer() {
    var root = S.els.root;

    on(root, "mousemove", function () {
      showHud();
    });

    on(root, "click", function (e) {
      if (S.errorOpen || S.popupOpen) return;
      var t = e.target;
      while (t && t !== root) {
        if (t.className && typeof t.className === "string" && /\bvod-(ctl|seekbar|hud-hit)\b/.test(t.className)) return;
        t = t.parentNode;
      }
      if (S.hudVisible) hideHud();
      else showHud();
    });

    on(S.els.bar, "mousedown", function (e) {
      if (!duration()) return;
      S.dragging = true;
      S.focusId = "seek";
      showHud();
      applyFocus();
      setPreview(seekPctFromEvent(e) * duration(), 0);
      e.preventDefault();
    });
    on(document, "mousemove", function (e) {
      if (!S.dragging) return;
      setPreview(seekPctFromEvent(e) * duration(), 0);
    });
    on(document, "mouseup", function () {
      if (!S.dragging) return;
      S.lastPointerSeek = Date.now();
      commitSeek();
    });
  }

  // ------------------------------------------------------------- lifecycle

  function onVisibility() {
    if (S && document.hidden) savePosition("hidden");
  }

  function onPageHide() {
    if (S) savePosition("exit");
  }

  function cleanupSession() {
    clearTimeout(S.watchdogTimer);
    clearTimeout(S.hudTimer);
    clearTimeout(S.commitTimer);
    clearInterval(S.pollTimer);
    clearInterval(S.saveTimer);
    stopMedia();
    offAll();
    if (S.els.root.parentNode) S.els.root.parentNode.removeChild(S.els.root);
    window.VodPlayerHoverSync = null;
    window.VodPlayerActivate = null;
  }

  function leave(info) {
    if (!S || S.leaving) return;
    S.leaving = true;
    savePosition("back");
    var o = S.opts;
    var nextId = info && info.nextEpisodeId;
    cleanupSession();
    S = null;
    navigateBack(o, nextId);
  }

  function navigateBack(o, nextEpisodeId) {
    var navbar = document.querySelector("#navbar-root");
    if (navbar) navbar.style.display = "block";
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "black";

    var fromHome = localStorage.getItem("fromHome") === "true";
    var page;
    if (fromHome) {
      localStorage.setItem("fromHome", "false");
      page = "homePage";
    } else if (o.type === "series") {
      localStorage.setItem("lastPlayedEpisodeId", String(nextEpisodeId || o.id));
      localStorage.setItem(
        "isContinueWatchingSeries",
        Continue.has("series", o.seriesId) ? "true" : "false"
      );
      page = "seriesDetailPage";
    } else {
      localStorage.setItem(
        "isContinueWatchingMovie",
        Continue.has("movie", o.id) ? "true" : "false"
      );
      page = "movieDetailPage";
    }
    if (typeof window.buildDynamicSidebarOptions === "function" && !fromHome) {
      try {
        window.buildDynamicSidebarOptions();
      } catch (e) {}
    }
    localStorage.setItem("currentPage", page);
    if (window.Router) window.Router.showPage(page);
    if (page === "homePage") {
      setTimeout(function () {
        var b = document.querySelector('[data-page="homePage"]');
        if (b) b.focus();
      }, 100);
    }
    setTimeout(decorateCards, 300);
  }

  function open(o) {
    if (!o || !o.url) return;
    if (S) {
      S.leaving = true;
      cleanupSession();
      S = null;
    }
    o.type = o.type === "series" ? "series" : "movie";
    var els = buildDom(o);
    S = {
      opts: o,
      els: els,
      listeners: [],
      state: "idle",
      entries: [],
      focusId: "play",
      lastCenter: "play",
      hudVisible: false,
      hudTimer: null,
      watchdogTimer: null,
      pollTimer: null,
      saveTimer: null,
      commitTimer: null,
      seekPreview: null,
      previewing: false,
      dragging: false,
      holdCount: 0,
      seekWait: null,
      ignorePause: false,
      userPaused: false,
      waiting: false,
      loaderOn: false,
      lastTime: -1,
      lastProgressAt: Date.now(),
      lastTickAt: Date.now(),
      lastPos: 0,
      knownDuration: 0,
      pendingStart: 0,
      realPlayMs: 0,
      everPlayed: false,
      cwActive: false,
      hadEntry: false,
      savedPos: 0,
      popupOpen: false,
      errorOpen: false,
      ended: false,
      leaving: false,
      hls: null,
      lastPointerSeek: 0,
    };

    // keys other pages read when we return to them
    localStorage.setItem("from", o.type);
    if (o.type === "series") {
      localStorage.setItem("selectedSeriesId", String(o.seriesId));
      localStorage.setItem("selectedEpisodeId", String(o.id));
      if (o.season != null) localStorage.setItem("selectedSeason", String(o.season));
    } else {
      localStorage.setItem("selectedMovieId", String(o.id));
    }
    localStorage.setItem("currentPage", "vodPlayer");

    var navbar = document.querySelector("#navbar-root");
    if (navbar) navbar.style.display = "none";
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "black";
    document.body.appendChild(els.root);

    window.VodPlayerHoverSync = function (node) {
      if (!S) return;
      var id = node && node.getAttribute("data-vod");
      if (id && S.entries.indexOf(id) !== -1) {
        S.focusId = id;
        applyFocus();
      }
      showHud();
    };
    window.VodPlayerActivate = function (node) {
      if (!S) return;
      var id = node && node.getAttribute("data-vod");
      if (!id || S.entries.indexOf(id) === -1) return;
      if (id === "seek" && Date.now() - S.lastPointerSeek < 500) return;
      S.focusId = id;
      applyFocus();
      actionFor(id);
      showHud();
    };

    on(document, "keydown", onKeyDown, true);
    on(document, "keyup", onKeyUp, true);
    on(document, "visibilitychange", onVisibility);
    on(window, "pagehide", onPageHide);
    on(window, "beforeunload", onPageHide);
    bindVideo();
    bindPointer();

    // resume decision
    var entry = Continue.find(o);
    S.hadEntry = !!entry;
    S.cwActive = !!entry;
    var saved = entry ? Number(entry.resumeTime) || 0 : 0;
    S.knownDuration = entry ? Number(entry.duration) || 0 : 0;
    S.savedPos = saved;

    startTimers();
    if (o.startOver) {
      S.savedPos = 0;
      if (entry) Continue.write(o, o.id, 0, S.knownDuration);
      startPlayback(0);
      showHud();
    } else if (saved > RESUME_MIN_SEC && !o.fromContinue) {
      openPopup(saved);
      S.state = "idle";
    } else {
      startPlayback(saved > RESUME_MIN_SEC ? saved : 0);
      showHud();
    }
  }

  // --------------------------------------------- red progress bars on cards

  function progressMap(type) {
    var map = {};
    var name = Continue.playlistName();
    var playlists = Continue.load();
    for (var i = 0; i < playlists.length; i++) {
      if (playlists[i].playlistName !== name) continue;
      var list = playlists[i][Continue.key(type)] || [];
      for (var j = 0; j < list.length; j++) {
        var it = list[j];
        if (it && it.duration > 0) {
          map[String(it.itemId)] = clamp((it.resumeTime / it.duration) * 100, 0, 100);
        }
      }
    }
    return map;
  }

  function decorateCards() {
    var cards = document.querySelectorAll(".movie-card, .series-card, .home-card");
    if (!cards.length) return;
    var movies = progressMap("movie");
    var series = progressMap("series");
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var isSeries =
        c.classList.contains("series-card") || c.getAttribute("data-type") === "series";
      var id = c.getAttribute(isSeries && c.hasAttribute("data-series-id") ? "data-series-id" : "data-stream-id");
      var pct = id != null ? (isSeries ? series : movies)[String(id)] : undefined;
      var bar = c.querySelector(".vod-card-progress");
      if (pct == null || pct <= 0) {
        if (bar) bar.parentNode.removeChild(bar);
        continue;
      }
      if (!bar) {
        bar = el("div", "vod-card-progress", "<i></i>");
        c.appendChild(bar);
      }
      bar.firstChild.style.width = pct + "%";
    }
  }

  var decorateTimer = null;
  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateCards, 300);
  }

  function watchCards() {
    var host = document.getElementById("main-app-container");
    if (!host || typeof MutationObserver === "undefined") return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) {
          scheduleDecorate();
          return;
        }
      }
    }).observe(host, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchCards);
  else watchCards();

  App.VideoPlayerVod = {
    open: open,
    close: function () {
      leave();
    },
    isSupported: function () {
      return !isTizenAvplay();
    },
    isActive: function () {
      return !!S;
    },
    refreshCardProgress: decorateCards,
  };
})();
