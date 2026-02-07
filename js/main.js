window.onload = function () {
  window.moviesCategories = [];
  window.allMoviesStreams = [];
  window.allSeriesStreams = [];
  window.allseriesCategories = [];
  window.allLiveStreams = [];
  window.liveCategories = [];

  if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
    const keys = tizen.tvinputdevice.getSupportedKeys();
    keys.forEach((key) => {
      tizen.tvinputdevice.registerKey(key.name);
    });
  }

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
      !sidebar.classList.contains("option-remove") &&
      [
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "Escape",
        "Backspace",
        "XF86Back",
      ].includes(e.key)
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
    navbarRoot.innerHTML = Navbar();
    initNavbar();
  }

  // Show splash screen first
  showSplashScreen();

  setTimeout(() => {
    const playlistsData = localStorage.getItem("playlistsData")
      ? JSON.parse(localStorage.getItem("playlistsData"))
      : [];
    const isLogin = localStorage.getItem("isLogin") === "true";

    if (isLogin) {
      localStorage.setItem("currentPage", "preLoginPage");
      Router.showPage("preLoginPage");
    } else if (playlistsData.length > 0 && !isLogin) {
      localStorage.removeItem("navigationFocus");
      localStorage.setItem("currentPage", "listPage");
      Router.showPage("listPage");
    } else {
      localStorage.setItem("currentPage", "login");
      Router.showPage("login");
    }
  }, 5000);

  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
};

function showSplashScreen() {
  const splashPage = document.getElementById("splash-page");
  splashPage.innerHTML = `
    <div class="splash-page-container">
      <img src="/assets/main-logo.png" alt="Logo" class="spash-logo" />
    </div>
  `;
  splashPage.style.display = "block";

  // Hide navbar during splash screen
  const navbarRoot = document.getElementById("navbar-root");
  if (navbarRoot) {
    navbarRoot.style.display = "none";
  }

  const allPages = document.querySelectorAll(".page");
  allPages.forEach((page) => {
    if (page.id !== "splash-page") {
      page.style.display = "none";
    }
  });
}

function renderNavbarVisibility() {
  const currentPage = localStorage.getItem("currentPage");
  const hiddenPages = [
    "login",
    "listPage",
    "splashScreen",
    "settingsPage",
    "accountPage",
    "preLoginPage",
    "videoJsPlayer",
    "categoryViewPage",
  ];
  const navbarRoot = document.getElementById("navbar-root");
  if (!navbarRoot) return;

  navbarRoot.style.display = hiddenPages.includes(currentPage)
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
