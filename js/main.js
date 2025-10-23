window.onload = function () {
  window.moviesCategories = [];
  window.allMoviesStreams = [];
  window.allSeriesStreams = [];
  window.allseriesCategories = [];
  window.allLiveStreams = [];
  window.liveCategories = [];

  if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
    var keys = tizen.tvinputdevice.getSupportedKeys();
    keys.forEach(function (key) {
      tizen.tvinputdevice.registerKey(key.name);
    });
  }


  // Global keydown
  document.addEventListener("keydown", function (e) {
    var sidebar = document.getElementById("sidebar");
    if (
      sidebar &&
      sidebar.classList &&
      !sidebar.classList.contains("hidden") &&
      [
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "Escape",
        "Backspace",
        "XF86Back",
      ].indexOf(e.key) > -1
    ) {
      e.preventDefault();
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1)
      e.preventDefault();
  });


  // Router.showPage("splashScreen");

  setTimeout(() => {
    localStorage.setItem("currentPage", "homePage");

    Router.showPage("homePage");
  }, 0);

  if (typeof Toaster === "function") Toaster();
  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
};

function renderNavbar() {
  var currentPage = localStorage.getItem("currentPage");
  var hiddenPages = ["login", "listPage", "splashScreen","settingsPage"];
  var navbarContainer = document.getElementById("navbar-root");
  if (!navbarContainer) return;

  if (hiddenPages.indexOf(currentPage) > -1) {
    navbarContainer.innerHTML = "";
    return;
  }

  navbarContainer.innerHTML = Navbar();
  initNavbar();
}
