let appInitialized = false;

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  window.moviesCategories = [];
  window.allMoviesStreams = [];
  window.allSeriesStreams = [];
  window.allseriesCategories = [];
  window.allLiveStreams = [];
  window.liveCategories = [];

  const appBackground = "linear-gradient(180deg, #2d2203 0%, #0b1376 100%)";
  document.documentElement.style.background = appBackground;
  if (document.body) {
    document.body.style.background = appBackground;
    document.body.style.minHeight = "100vh";
  }

  // if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
  //   const keys = tizen.tvinputdevice.getSupportedKeys();
  //   keys.forEach((key) => {
  //     tizen.tvinputdevice.registerKey(key.name);
  //   });
  // }

  document.addEventListener("keydown", (e) => {
    if (localStorage.getItem("currentPage") !== "dashboard") {
      if (e.key === "XF86Exit" && typeof tizen !== "undefined") {
        const app = tizen.application.getCurrentApplication();
        if (app) app.exit();
      }
    }
  });

  document.addEventListener("keydown", function (e) {
    const sidebar = document.getElementById("sidebar");
    if (
      sidebar &&
      sidebar.classList &&
      !sidebar.classList.contains("hidden") &&
      (["ArrowUp", "ArrowDown", "Enter"].includes(e.key) || isBackKey(e))
    ) {
      e.preventDefault();
      return;
    }

    // Check if user is typing in an input field
    const isInputFocused =
      document.activeElement &&
      (document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA");

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      // Allow default behavior for Left/Right arrows in input fields
      if (isInputFocused && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
        return;
      }
      e.preventDefault();
    }
  });

  if (typeof Toaster === "function") Toaster();

  const navbarRoot = document.getElementById("navbar-root");
  if (navbarRoot) {
    navbarRoot.style.display = "none";
    navbarRoot.innerHTML = Navbar();
    initNavbar();
  }

  const playlistsData = localStorage.getItem("playlistsData")
    ? JSON.parse(localStorage.getItem("playlistsData"))
    : [];
  const isLogin = localStorage.getItem("isLogin") === "true";

  if (isLogin) {
    localStorage.setItem("currentPage", "preLoginPage");
    Router.showPage("preLoginPage");
  } else if (playlistsData.length > 0) {
    localStorage.removeItem("navigationFocus");
    localStorage.setItem("currentPage", "listPage");
    Router.showPage("listPage");
  } else {
    localStorage.setItem("currentPage", "login");
    Router.showPage("login");
  }
  renderNavbarVisibility();

  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function renderNavbarVisibility() {
  const currentPage = localStorage.getItem("currentPage");
  const hiddenPages = [
    "login",
    "listPage",
    "settingsPage",
    "accountPage",
    "preLoginPage",
    "videoJsPlayer",
    "categoryListPage",
    "categoryViewPage",
  ];
  const navbarRoot = document.getElementById("navbar-root");
  if (!navbarRoot) return;

  const shouldHideExitModalNavbar =
    currentPage === "exitModal" &&
    localStorage.getItem("returnPage") === "login";

  navbarRoot.style.display =
    hiddenPages.includes(currentPage) || shouldHideExitModalNavbar
    ? "none"
    : "block";
}

(function () {
  const originalShowPage = Router.showPage;
  Router.showPage = function (name) {
    // Check previous page before showing new one
    const previousPage = localStorage.getItem("currentPage");

    // Clear search if changing pages
    // We check if name !== previousPage to avoid clearing on re-renders of the same page
    if (previousPage && previousPage !== name) {
      window.searchQuery = "";
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.value = "";
      }
    }

    originalShowPage(name);
    renderNavbarVisibility();
    if (typeof window.updateSearchVisibility === "function") {
      window.updateSearchVisibility(name);
    }
  };
})();
