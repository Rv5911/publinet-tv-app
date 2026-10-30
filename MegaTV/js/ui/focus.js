// LG Magic Remote pointer support (app-wide).
//
// Root cause this file fixes: the app only ever had keyboard/D-pad
// navigation. Every page tracks its own "selected" index and only moves it
// on ArrowUp/Down/Left/Right; Enter/OK always acts on that same index. There
// is no mouseover handling anywhere, so moving the Magic Remote pointer and
// pressing OK never updates (or acts on) what is actually under the pointer.
// Settings' left menu additionally has no click handler at all.
//
// Fix: one delegated listener set on the app root (document) that (1) keeps
// the shared `.focused` class following the pointer, (2) tracks whether the
// pointer is currently visible via the platform's `cursorStateChange` event,
// and (3) while the pointer is visible, makes Enter/OK act on the hovered
// item instead of whatever arrow keys last selected.
//
// ES5 only.

(function () {
  "use strict";

  // Older webOS WebKit builds predate Element.prototype.closest/matches,
  // which this whole file (and several pages) relies on - without this,
  // every el.closest(...) call below throws and the pointer system never
  // runs at all on those TVs. Standard polyfill, no-op where already native.
  if (typeof Element !== "undefined" && !Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  }
  if (typeof Element !== "undefined" && !Element.prototype.closest) {
    Element.prototype.closest = function (selector) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches(selector)) return el;
        el = el.parentElement || el.parentNode;
        if (el && el.nodeType !== 1) el = null;
      }
      return null;
    };
  }

  var pointerVisible = false;
  var lastHovered = null;
  var lastActivation = { el: null, time: 0 };
  var wheelLock = false;
  var wheelAnchor = { x: 0, y: 0 };
  var pointerPosition = { x: 0, y: 0 };
  var lastWheelAt = -Infinity;
  var lastWheelStepAt = -Infinity;
  var forwardingClick = false;

  // Native elements are already focusable; everything else below is a
  // custom "card"/"row"/"item" convention used by one or more pages that
  // only ever gets a CSS class (no real DOM focus) today.
  var FOCUSABLE_SELECTOR = [
    "input",
    "select",
    "textarea",
    "button",
    "[tabindex]",
    ".movie-card",
    ".movies-view-more",
    "#movie-view-mode-btn",
    ".series-card",
    ".series-view-more",
    "#series-view-mode-btn",
    ".category-item",
    "#cat-back-btn",
    ".dialog-option",
    ".radio-option",
    ".parental-field",
    ".av-live-sidebar-item",
    ".av-live-nav-btn",
    ".settings-pages-container p",
    ".channel-card",
    ".livetv-channel-category",
    ".lp-category-item",
    ".lp-channel-card",
    ".play-pause-icon",
    "#lp-fullscreen-btn",
    ".movie-cast-item",
    ".series-cast-item",
    ".seasons-episodes-item",
    ".dropdown-item",
    ".playlist-card",
    ".eye-icon-login",
    ".video-action-overlay.center",
    ".vod-ctl",
    ".vod-seekbar",
    ".lvh-ctl",
  ].join(",");

  // Pages whose cards/rows have no DOM focus and no click listener at all
  // (pure keydown + private index variable). Their navigation state and
  // update/select functions are already exposed as top-level globals, so
  // hovering can keep them in sync with zero changes to those page files.
  var ADAPTERS = {
    movies: {
      zone: ".movies-page-container",
      sync: function (el) {
        var state = window.moviesNavigationState;
        if (!state) return;
        if (el.id === "movie-view-mode-btn") {
          state.currentCategoryIndex = "header-top";
        } else if (el.classList.contains("movies-view-more")) {
          state.currentCategoryIndex = toIndexValue(el.getAttribute("data-category"));
          state.currentCardIndex = "header";
        } else {
          state.currentCategoryIndex = toIndexValue(el.getAttribute("data-category"));
          state.currentCardIndex = toIndexValue(el.getAttribute("data-index"));
        }
        if (typeof window.updateMoviesFocus === "function") window.updateMoviesFocus();
      },
      activate: function () {
        if (typeof window.handleMoviesSimpleEnter === "function") window.handleMoviesSimpleEnter();
      },
      stepUp: function () {
        if (typeof window.moveMoviesUp === "function") window.moveMoviesUp();
      },
      stepDown: function () {
        if (typeof window.moveMoviesDown === "function") window.moveMoviesDown();
      },
      stepLeft: function () {
        if (typeof window.moveMoviesLeft === "function") window.moveMoviesLeft();
      },
      stepRight: function () {
        if (typeof window.moveMoviesRight === "function") window.moveMoviesRight();
      },
    },
    series: {
      zone: ".series-page-container",
      sync: function (el) {
        var state = window.seriesNavigationState;
        if (!state) return;
        if (el.id === "series-view-mode-btn") {
          state.currentCategoryIndex = "header-top";
        } else if (el.classList.contains("series-view-more")) {
          state.currentCategoryIndex = toIndexValue(el.getAttribute("data-category"));
          state.currentCardIndex = "header";
        } else {
          state.currentCategoryIndex = toIndexValue(el.getAttribute("data-category"));
          state.currentCardIndex = toIndexValue(el.getAttribute("data-index"));
        }
        if (typeof window.updateSeriesFocus === "function") window.updateSeriesFocus();
      },
      activate: function () {
        if (typeof window.handleSeriesSimpleEnter === "function") window.handleSeriesSimpleEnter();
      },
      stepUp: function () {
        if (typeof window.moveSeriesUp === "function") window.moveSeriesUp();
      },
      stepDown: function () {
        if (typeof window.moveSeriesDown === "function") window.moveSeriesDown();
      },
      stepLeft: function () {
        if (typeof window.moveSeriesLeft === "function") window.moveSeriesLeft();
      },
      stepRight: function () {
        if (typeof window.moveSeriesRight === "function") window.moveSeriesRight();
      },
    },
    // Live TV: hover only moves the shared .focused highlight (sync), it
    // never switches category/channel — there is deliberately no `activate`
    // here, so OK/click fall through to LivePage's own existing click
    // listeners (setupClickListeners), which are the only thing allowed to
    // change the playing channel.
    live: {
      zone: ".lp-main-container",
      sync: function (el) {
        if (typeof window.liveHoverSync === "function") window.liveHoverSync(el);
      },
      stepUp: function () {
        if (window.liveNavigate) window.liveNavigate.up();
      },
      stepDown: function () {
        if (window.liveNavigate) window.liveNavigate.down();
      },
      stepLeft: function () {
        if (window.liveNavigate) window.liveNavigate.left();
      },
      stepRight: function () {
        if (window.liveNavigate) window.liveNavigate.right();
      },
    },
    movieDetail: {
      zone: ".movie-detail-page-container",
      // No activate: the page's single delegated click handler runs the
      // action (OK with the pointer visible turns into el.click()).
      sync: function (el) {
        if (typeof window.movieDetailHoverSync === "function") window.movieDetailHoverSync(el);
      },
    },
    seriesDetail: {
      zone: ".series-detail-page-container",
      // No activate: see movieDetail above.
      sync: function (el) {
        if (typeof window.seriesDetailHoverSync === "function") window.seriesDetailHoverSync(el);
      },
    },
    listUsers: {
      zone: ".list-users-container",
      sync: function (el) {
        if (typeof window.listUsersHoverSync === "function") window.listUsersHoverSync(el);
      },
      activate: function (el) {
        if (typeof window.listUsersActivate === "function") window.listUsersActivate(el);
      },
    },
    login: {
      zone: ".login-page-container",
      sync: function (el) {
        if (typeof window.loginHoverSync === "function") window.loginHoverSync(el);
      },
      activate: function (el) {
        if (typeof window.loginActivate === "function") window.loginActivate(el);
      },
    },
    // Navbar sidebar overlay (settings/list-user/account/sort/sign-out, plus
    // its sort submenu and any page-specific dynamic options).
    sidebar: {
      zone: "#sidebar",
      sync: function (el) {
        if (typeof window.sidebarHoverSync === "function") window.sidebarHoverSync(el);
      },
      activate: function (el) {
        if (typeof window.sidebarActivate === "function") window.sidebarActivate(el);
      },
    },
    videoPlayer: {
      zone: ".video-js-player-container",
      sync: function () {},
      activate: function () {
        if (typeof window.videoPlayerToggle === "function") window.videoPlayerToggle();
      },
    },
    // HTML5 players (videoPlayerVod / LiveVideoPlayerHtml): the players own
    // the .focused class + zone index; OK is handled only by the focused control.
    vodPlayer: {
      zone: ".vod-player",
      sync: function (el) {
        if (typeof window.VodPlayerHoverSync === "function") window.VodPlayerHoverSync(el);
      },
      activate: function (el) {
        if (typeof window.VodPlayerActivate === "function") window.VodPlayerActivate(el);
      },
    },
    liveHtmlPlayer: {
      zone: ".lvh-root .lvh-ctl",
      sync: function (el) {
        if (typeof window.LiveHtmlHoverSync === "function") window.LiveHtmlHoverSync(el);
      },
      activate: function (el) {
        if (typeof window.LiveHtmlActivate === "function") window.LiveHtmlActivate(el);
      },
    },
    // Home: hover keeps navState (row/column) in step with the pointer; the
    // page's single delegated click handler runs the action (no activate here,
    // OK with the pointer visible becomes el.click()). Wheel steps like Movies.
    home: {
      zone: ".home-page-container",
      sync: function (el) {
        if (typeof window.homeHoverSync === "function") window.homeHoverSync(el);
      },
      stepUp: function () {
        if (window.homeStep) window.homeStep("ArrowUp");
      },
      stepDown: function () {
        if (window.homeStep) window.homeStep("ArrowDown");
      },
      stepLeft: function () {
        if (window.homeStep) window.homeStep("ArrowLeft");
      },
      stepRight: function () {
        if (window.homeStep) window.homeStep("ArrowRight");
      },
    },
    categoryView: {
      zone: "#category-view-grid",
      sync: function (el) {
        var state = window.categoryViewNavigationState;
        var grid = document.getElementById("category-view-grid");
        if (!state || !grid) return;
        var cardClass = state.type === "movies" ? ".movie-card" : ".series-card";
        var cards = grid.querySelectorAll(cardClass);
        var idx = Array.prototype.indexOf.call(cards, el);
        if (idx === -1) return;
        state.currentCardIndex = idx;
        state.isHeaderFocused = false;
        if (typeof window.updateCategoryViewFocus === "function") window.updateCategoryViewFocus();
      },
      activate: function () {
        if (typeof window.handleCategoryViewEnter === "function") window.handleCategoryViewEnter();
      },
    },
    categoryList: {
      zone: "#category-list-grid",
      sync: function (el) {
        var state = window.categoryListNavigationState;
        if (!state) return;
        var idx = parseInt(el.getAttribute("data-index"), 10);
        if (isNaN(idx)) return;
        state.currentIndex = idx;
        state.focusSection = "grid";
        if (typeof window.updateCategoryListFocus === "function") window.updateCategoryListFocus();
      },
      activate: function () {
        if (typeof window.handleCategoryListEnter === "function") window.handleCategoryListEnter();
      },
    },
  };

  function toIndexValue(value) {
    if (value === null || value === undefined) return value;
    var n = parseInt(value, 10);
    return isNaN(n) ? value : n;
  }

  function resolveAdapter(el) {
    if (!el || typeof el.closest !== "function") return null;
    if (el.closest(ADAPTERS.sidebar.zone)) return ADAPTERS.sidebar;
    if (el.closest(ADAPTERS.home.zone)) return ADAPTERS.home;
    if (el.closest(ADAPTERS.vodPlayer.zone)) return ADAPTERS.vodPlayer;
    if (el.closest(ADAPTERS.liveHtmlPlayer.zone)) return ADAPTERS.liveHtmlPlayer;
    if (el.closest(ADAPTERS.categoryView.zone)) return ADAPTERS.categoryView;
    if (el.closest(ADAPTERS.categoryList.zone)) return ADAPTERS.categoryList;
    if (el.closest(ADAPTERS.movies.zone)) return ADAPTERS.movies;
    if (el.closest(ADAPTERS.series.zone)) return ADAPTERS.series;
    if (el.closest(ADAPTERS.live.zone)) return ADAPTERS.live;
    if (el.closest(ADAPTERS.movieDetail.zone)) return ADAPTERS.movieDetail;
    if (el.closest(ADAPTERS.seriesDetail.zone)) return ADAPTERS.seriesDetail;
    if (el.closest(ADAPTERS.listUsers.zone)) return ADAPTERS.listUsers;
    if (el.closest(ADAPTERS.login.zone)) return ADAPTERS.login;
    if (el.closest(ADAPTERS.videoPlayer.zone)) return ADAPTERS.videoPlayer;
    return null;
  }

  function isNativeFocusable(el) {
    var tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      tag === "BUTTON" ||
      el.hasAttribute("tabindex")
    );
  }

  function closestFocusable(target) {
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(FOCUSABLE_SELECTOR);
  }

  function setFocused(el) {
    var prev = document.querySelectorAll(".focused");
    for (var i = 0; i < prev.length; i++) {
      if (prev[i] !== el) prev[i].classList.remove("focused");
    }
    el.classList.add("focused");
  }

  function isTextInput(el) {
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  function handleHover(el) {
    if (!el) return;
    lastHovered = el;
    setFocused(el);
    // Text inputs only ever get real focus from an explicit click/OK -
    // hover (and arrow-driven highlight, which also routes through here)
    // must never call focus() on one, or webOS pops the on-screen keyboard.
    if (isNativeFocusable(el) && !isTextInput(el) && !el.readOnly) el.focus();
    var adapter = resolveAdapter(el);
    if (adapter) adapter.sync(el);
    setFocused(el);
  }

  function noteActivation(el) {
    lastActivation.el = el;
    lastActivation.time = Date.now();
  }

  function recentlyActivated(el) {
    return lastActivation.el === el && Date.now() - lastActivation.time < 300;
  }

  function isTypingInField() {
    var active = document.activeElement;
    return !!(active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA"));
  }

  // 1) Pointer visibility (LG webOS Magic Remote). webOS sends both the
  // custom event and keyCode 1536 (shown) / 1537 (hidden) on keydown; track
  // either signal, but never act on these codes beyond that.
  document.addEventListener("cursorStateChange", function (e) {
    pointerVisible = !!(e && e.detail && e.detail.visibility);
    window.__pointerVisible = pointerVisible;
  });
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.keyCode === 1536) {
        pointerVisible = true;
        window.__pointerVisible = true;
      } else if (e.keyCode === 1537) {
        pointerVisible = false;
        window.__pointerVisible = false;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown" ||
          e.key === "ArrowLeft" || e.key === "ArrowRight" ||
          (e.keyCode >= 37 && e.keyCode <= 40)) {
        wheelLock = false;
        lastHovered = null;
        pointerVisible = false;
        window.__pointerVisible = false;
      }
    },
    true
  );

  // 2) Hover -> shared .focused class + per-page index sync, delegated.
  document.addEventListener("mouseover", function (e) {
    if (wheelLock) return;
    var el = closestFocusable(e.target);
    if (el && el !== lastHovered) handleHover(el);
  });

  // Movement only unlocks. The following mouseover owns the focus change.
  document.addEventListener("mousemove", function (e) {
    pointerPosition.x = e.clientX;
    pointerPosition.y = e.clientY;
    if (!wheelLock || Date.now() - lastWheelAt < 500) return;
    var dx = pointerPosition.x - wheelAnchor.x;
    var dy = pointerPosition.y - wheelAnchor.y;
    if (dx * dx + dy * dy > 30 * 30) {
      wheelLock = false;
      lastHovered = null;
    }
  });

  // 3) Click -> sync + run the item's OK action, delegated. Capture phase so
  // we can de-dupe a redundant trusted click before any per-page click
  // listener (all registered on document, bubble phase) sees it.
  document.addEventListener(
    "click",
    function (e) {
      if (forwardingClick) return;
      var el = wheelLock ? document.querySelector(".focused") : closestFocusable(e.target);
      if (wheelLock) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!el || recentlyActivated(el)) return;
        activateSelected(el);
        return;
      }
      if (!el) return;

      if (e.isTrusted && recentlyActivated(el)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }

      handleHover(el);
      noteActivation(el);

      var adapter = resolveAdapter(el);
      if (adapter && adapter.activate) adapter.activate(el);
    },
    true
  );

  function activateSelected(el) {
    noteActivation(el);
    var adapter = resolveAdapter(el);
    var checkable = el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio");
    if (adapter && adapter.activate && !checkable) {
      adapter.activate(el);
    } else if (isTextInput(el) && !el.readOnly) {
      el.focus();
    } else {
      // Suppress the original pointer click and deliver exactly one click
      // to the selected item, including pages with their own click handlers.
      forwardingClick = true;
      try {
        el.click();
      } finally {
        forwardingClick = false;
      }
    }
  }

  // 4) Enter/OK while the pointer is visible acts on the hovered item, not
  // whatever arrow keys last selected. Capture phase on document so this
  // runs before every page's own (bubble-phase) keydown handler.
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Enter" && e.keyCode !== 13) return;
      if (!pointerVisible && !wheelLock) return;
      if (!wheelLock && isTypingInField()) return;

      var el = document.querySelector(".focused") || (wheelLock ? null : lastHovered);
      if (!el) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (recentlyActivated(el)) return;
      activateSelected(el);
    },
    true
  );

  // 5) Back closes an open on-screen keyboard first, everywhere, before the
  // page's own Back handling ever sees the press - capture phase so this
  // runs ahead of every per-page/per-player keydown listener.
  document.addEventListener(
    "keydown",
    function (e) {
      if (typeof window.isBackKey !== "function" || !window.isBackKey(e)) return;
      var active = document.activeElement;
      if (!isTextInput(active)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      active.blur();
    },
    true
  );

  // webOS on-screen keyboard dismissed by the system (not by us) - keep
  // input state in sync so a stray blur doesn't leave it stuck "open".
  document.addEventListener("keyboardStateChange", function (e) {
    if (e && e.detail && e.detail.visibility === false && isTextInput(document.activeElement)) {
      document.activeElement.blur();
    }
  });

  // Native page steps preserve pagination and page-specific navigation.
  // Other lists use directional geometry, one item/row per wheel step.
  function wheelScope(target) {
    if (!target || !target.closest) return null;
    return target.closest(".remove-dialog, .custom-dialog, [role=dialog], #sidebar, " +
      ".settings-pages-container, .settings-second-container, .seasons-dropdown, " +
      ".seasons-episodes-list, .playlist-cards-container, #category-view-grid, " +
      "#category-list-grid, .list-users-container, .series-detail-page-container, " +
      ".movie-detail-page-container, .settings-main-container") || target.parentElement;
  }

  function stepList(target, selected, horizontal, forward) {
    var scope = wheelScope(target);
    if (!scope) return;
    var candidates = scope.querySelectorAll(FOCUSABLE_SELECTOR);
    var origin = selected && scope.contains(selected) ? selected : closestFocusable(target);
    var rect = origin && origin.getBoundingClientRect();
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate === origin || !candidate.getClientRects().length ||
          (origin && origin.contains(candidate)) || candidate.disabled) continue;
      var style = window.getComputedStyle(candidate);
      if (style.visibility === "hidden" || style.display === "none") continue;
      var box = candidate.getBoundingClientRect();
      if (!rect) { best = candidate; break; }
      var dx = (box.left + box.right - rect.left - rect.right) / 2;
      var dy = (box.top + box.bottom - rect.top - rect.bottom) / 2;
      var primary = horizontal ? dx : dy;
      var cross = horizontal ? dy : dx;
      if ((forward ? primary : -primary) <= 1) continue;
      var score = Math.abs(primary) + Math.abs(cross) * 3;
      if (score < bestScore) { best = candidate; bestScore = score; }
    }
    if (best) {
      handleHover(best);
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function handleWheel(e) {
    var deltaX = e.deltaX || 0;
    var deltaY = e.deltaY || 0;
    if (!deltaX && !deltaY) return;
    if (e.shiftKey && !deltaX) { deltaX = deltaY; deltaY = 0; }

    var now = Date.now();
    // Every wheel event extends the lock, including throttled events and
    // attempts to scroll past the final item. Save the last real position.
    wheelLock = true;
    wheelAnchor.x = pointerPosition.x;
    wheelAnchor.y = pointerPosition.y;
    lastWheelAt = now;
    e.preventDefault();
    e.stopPropagation();
    if (now - lastWheelStepAt < 100) return;
    lastWheelStepAt = now;

    var selected = document.querySelector(".focused");
    var target = selected || e.target;
    var adapter = resolveAdapter(target);
    var horizontal = Math.abs(deltaX) > Math.abs(deltaY);
    var forward = horizontal ? deltaX > 0 : deltaY > 0;
    var step = horizontal ? (forward ? "stepRight" : "stepLeft") :
      (forward ? "stepDown" : "stepUp");
    if (adapter && adapter[step]) {
      adapter[step]();
      if (adapter === ADAPTERS.movies && typeof window.updateMoviesFocus === "function") window.updateMoviesFocus();
      if (adapter === ADAPTERS.series && typeof window.updateSeriesFocus === "function") window.updateSeriesFocus();
      // Live maintains its selection with .lp-focused rather than .focused.
      selected = adapter === ADAPTERS.live ?
        document.querySelector(".lp-main-container .lp-focused, .lp-main-container .lp-control-focused") :
        document.querySelector(".focused");
      if (selected) {
        setFocused(selected);
        selected.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } else {
      stepList(target, selected, horizontal, forward);
    }
  }

  function normalizeLegacyWheel(e) {
    var deltaY = typeof e.wheelDelta === "number" ? -e.wheelDelta / 40 : e.detail || 0;
    handleWheel({
      target: e.target,
      shiftKey: e.shiftKey,
      deltaX: 0,
      deltaY: deltaY,
      preventDefault: function () {
        if (e.preventDefault) e.preventDefault();
      },
      stopPropagation: function () {
        if (e.stopPropagation) e.stopPropagation();
      },
    });
  }

  document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
  document.addEventListener("mousewheel", normalizeLegacyWheel, { passive: false, capture: true });
  document.addEventListener("DOMMouseScroll", normalizeLegacyWheel, { passive: false, capture: true });
})();
