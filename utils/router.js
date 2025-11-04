const Router = (function() {
  const pages = {
    login: { el: document.getElementById("login-page"), render: LoginPage },
    listPage: { el: document.getElementById("list-users-page"), render: ListUsersPage },
    splashScreen: { el: document.getElementById("splash-page"), render: SplashScreen },
    homePage: { el: document.getElementById("home-page"), render: HomePage },
    settingsPage: { el: document.getElementById("settings-page"), render: SettingsPage },
    moviesPage: { el: document.getElementById("movies-page"), render: MoviesPage },
    seriesPage: { el: document.getElementById("series-page"), render: SeriesPage },
    liveTvPage: { el: document.getElementById("livetv-page"), render: LiveTvPage },
            accountPage: { el: document.getElementById("account-page"), render: AccountPage },
            preLoginPage: { el: document.getElementById("prelogin-page"), render: PreLoginPage },


  };

  var currentPageName = null;

  function showPage(name) {
    if (currentPageName && typeof pages[currentPageName].cleanup === "function") {
      pages[currentPageName].cleanup();
    }

    Object.values(pages).forEach(function(p) {
      if (p.el) p.el.style.display = "none";
    });

    var page = pages[name];
    if (!page) return;

    if (typeof page.render === "function") {
      page.el.innerHTML = page.render();
    }

    page.el.style.display = "block";

    if (typeof page.init === "function") {
      page.init(page.el);
    }

    currentPageName = name;
    localStorage.setItem("currentPage", name);
  }

  return { showPage };
})();

window.Router = Router;
