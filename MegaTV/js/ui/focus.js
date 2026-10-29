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

  var pointerVisible = false;
  var lastHovered = null;
  var lastActivation = { el: null, time: 0 };

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

  function handleHover(el) {
    if (!el) return;
    lastHovered = el;
    setFocused(el);
    // readonly fields (login) get real focus only from their own openInput()
    if (isNativeFocusable(el) && !el.readOnly) el.focus();
    var adapter = resolveAdapter(el);
    if (adapter) adapter.sync(el);
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

  // 1) Pointer visibility (LG webOS Magic Remote).
  document.addEventListener("cursorStateChange", function (e) {
    pointerVisible = !!(e && e.detail && e.detail.visibility);
  });

  // 2) Hover -> shared .focused class + per-page index sync, delegated.
  document.addEventListener("mouseover", function (e) {
    var el = closestFocusable(e.target);
    if (el && el !== lastHovered) handleHover(el);
  });

  // 3) Click -> sync + run the item's OK action, delegated. Capture phase so
  // we can de-dupe a redundant trusted click before any per-page click
  // listener (all registered on document, bubble phase) sees it.
  document.addEventListener(
    "click",
    function (e) {
      var el = closestFocusable(e.target);
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

  // 4) Enter/OK while the pointer is visible acts on the hovered item, not
  // whatever arrow keys last selected. Capture phase on document so this
  // runs before every page's own (bubble-phase) keydown handler.
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Enter" && e.keyCode !== 13) return;
      if (!pointerVisible) return;
      if (isTypingInField()) return;

      var el = document.querySelector(".focused") || lastHovered;
      if (!el) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (recentlyActivated(el)) return;
      noteActivation(el);

      var adapter = resolveAdapter(el);
      if (adapter && adapter.activate) {
        adapter.activate(el);
      } else {
        el.click();
      }
    },
    true
  );

  // 5) Wheel/trackpad. Zones with step functions (movies/series/live) move
  // exactly one row/card per tick, throttled to 100ms, reusing the same
  // step functions arrow keys already call — so a newly-loaded row/card is
  // handled identically whether you arrowed or scrolled to it. Everywhere
  // else falls back to scrolling whatever auto/scroll ancestor is under the
  // pointer (e.g. Settings, category view/list, dialogs).
  var lastWheelAt = 0;

  function handleWheel(e) {
    var now = Date.now();
    if (now - lastWheelAt < 100) {
      e.preventDefault();
      return;
    }

    var deltaX = e.deltaX || 0;
    var deltaY = e.deltaY || 0;
    if (e.shiftKey && !deltaX) {
      deltaX = deltaY;
      deltaY = 0;
    }

    var adapter = resolveAdapter(e.target);
    if (adapter && (adapter.stepUp || adapter.stepDown || adapter.stepLeft || adapter.stepRight)) {
      e.preventDefault();
      lastWheelAt = now;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && adapter.stepRight) adapter.stepRight();
        else if (deltaX < 0 && adapter.stepLeft) adapter.stepLeft();
      } else {
        if (deltaY > 0 && adapter.stepDown) adapter.stepDown();
        else if (deltaY < 0 && adapter.stepUp) adapter.stepUp();
      }
      return;
    }

    var el = e.target;
    while (el && el !== document.documentElement) {
      var style = window.getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth && (style.overflowX === "auto" || style.overflowX === "scroll")) {
        lastWheelAt = now;
        el.scrollLeft += deltaX || deltaY;
        break;
      }
      if (el.scrollHeight > el.clientHeight && (style.overflowY === "auto" || style.overflowY === "scroll")) {
        lastWheelAt = now;
        el.scrollTop += deltaY || e.deltaY;
        break;
      }
      el = el.parentElement;
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
    });
  }

  document.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("mousewheel", normalizeLegacyWheel, { passive: false });
  document.addEventListener("DOMMouseScroll", normalizeLegacyWheel, { passive: false });
})();
