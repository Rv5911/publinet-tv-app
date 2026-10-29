const Router = (function () {
  const pages = {
    login: {
      el: document.getElementById("login-page"),
      render: LoginPage,
    },
    listPage: {
      el: document.getElementById("list-users-page"),
      render: ListUsersPage,
    },
    homePage: {
      el: document.getElementById("home-page"),
      render: HomePage,
    },
    settingsPage: {
      el: document.getElementById("settings-page"),
      render: SettingsPage,
    },
    moviesPage: {
      el: document.getElementById("movies-page"),
      render: MoviesPage,
    },
    seriesPage: {
      el: document.getElementById("series-page"),
      render: SeriesPage,
    },
    liveTvPage: {
      el: document.getElementById("livetv-page"),
      render: LivePage,
    },
    accountPage: {
      el: document.getElementById("account-page"),
      render: AccountPage,
    },
    preLoginPage: {
      el: document.getElementById("prelogin-page"),
      render: PreLoginPage,
    },
    movieDetailPage: {
      el: document.getElementById("movies-detail-page"),
      render: MovieDetailPage,
    },
    videoJsPlayer: {
      el: document.getElementById("videojs-player"),
      render: VideoJsPlayer,
    },
    seriesDetailPage: {
      el: document.getElementById("series-detail-page"),
      render: SeriesDetailPage,
    },
    categoryViewPage: {
      el: document.getElementById("category-view-page"),
      render: CategoryViewPage,
      init: CategoryViewPage.init,
      cleanup: CategoryViewPage.cleanup,
    },
    categoryListPage: {
      el: document.getElementById("category-list-page"),
      render: CategoryListPage,
      init: CategoryListPage.init,
      cleanup: CategoryListPage.cleanup,
    },
    exitModal: {
      el: document.getElementById("exit-modal"),
      render: ExitModal,
    },
  };

  var currentPageName = null;
  var navToken = 0;

  function showPage(name) {
    var myToken = ++navToken;

    if (
      currentPageName &&
      typeof pages[currentPageName].cleanup === "function" &&
      name !== "exitModal"
    ) {
      pages[currentPageName].cleanup();
    }

    // Only hide other pages if we are NOT opening the exit modal (overlay)
    if (name !== "exitModal") {
      Object.values(pages).forEach(function (p) {
        if (p.el) p.el.style.display = "none";
      });
    }

    var page = pages[name];
    if (!page) return;

    if (typeof page.render === "function") {
      // Handle both sync and async render functions
      const renderResult = page.render();
      if (renderResult instanceof Promise) {
        renderResult.then((html) => {
          // A newer navigation already happened while this page was still
          // loading (e.g. user went back to another page mid-fetch) -
          // ignore this stale result instead of popping its UI back up.
          if (myToken !== navToken) return;
          if (typeof html !== "string") return;

          page.el.innerHTML = html;
          page.el.style.display = "block";

          if (typeof page.init === "function") {
            page.init(page.el);
          }
        });
      } else {
        page.el.innerHTML = renderResult;
        page.el.style.display = "block";

        if (typeof page.init === "function") {
          page.init(page.el);
        }
      }
    } else {
      page.el.style.display = "block";
    }

    currentPageName = name;
    localStorage.setItem("currentPage", name);
  }

  return {
    showPage,
  };
})();

window.Router = Router;
