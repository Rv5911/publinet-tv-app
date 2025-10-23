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
      ["ArrowUp","ArrowDown","Enter","Escape","Backspace","XF86Back"].indexOf(e.key) > -1
    ) {
      e.preventDefault();
      return;
    }

    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.key) > -1)
      e.preventDefault();
  });

  // ✅ Render navbar once
  var navbarRoot = document.getElementById("navbar-root");
  if (navbarRoot) {
    navbarRoot.innerHTML = Navbar();
    initNavbar();
  }

  // Show initial page
  var currentPage = localStorage.getItem("currentPage") || "splashScreen";
  Router.showPage(currentPage);
  
  // Optional: switch to home after splash
  if (currentPage === "splashScreen") {
    setTimeout(() => {
      Router.showPage("homePage");
    }, 1000);
  }

  // Initialize utilities
  if (typeof Toaster === "function") Toaster();
  if (typeof logAllDnsEntries === "function") logAllDnsEntries();
  if (typeof getTmbdId === "function") getTmbdId();
};

// ✅ Hide/show navbar based on page
function renderNavbarVisibility() {
  var currentPage = localStorage.getItem("currentPage");
  var hiddenPages = ["login", "listPage", "splashScreen", "settingsPage"];
  var navbarRoot = document.getElementById("navbar-root");
  if (!navbarRoot) return;

  if (hiddenPages.indexOf(currentPage) > -1) {
    navbarRoot.style.display = "none";
  } else {
    navbarRoot.style.display = "block";
  }
}

// ✅ Patch Router to update navbar visibility after page change
(function() {
  var originalShowPage = Router.showPage;
  Router.showPage = function(name) {
    originalShowPage(name);
    renderNavbarVisibility();
  };
})();
