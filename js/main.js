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

  const navbarRoot = document.getElementById("navbar-root");
  if (navbarRoot) {
    navbarRoot.innerHTML = Navbar();
    initNavbar();
  }

  Router.showPage("splashScreen");

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
  }, 0);

  if (typeof Toaster === "function") Toaster();
  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
};

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
    originalShowPage(name);
    renderNavbarVisibility();
  };
})();
