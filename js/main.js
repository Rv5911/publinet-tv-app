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
      !sidebar.classList.contains("hidden") &&
      ["ArrowUp","ArrowDown","Enter","Escape","Backspace","XF86Back"].includes(e.key)
    ) {
      e.preventDefault();
      return;
    }

    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
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
      localStorage.setItem("currentPage", "moviesPage");
      Router.showPage("moviesPage");
    }, 0);

  if (typeof Toaster === "function") Toaster();
  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
};

function renderNavbarVisibility() {
  const currentPage = localStorage.getItem("currentPage");
  const hiddenPages = ["login", "listPage", "splashScreen", "settingsPage"];
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
