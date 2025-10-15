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

  Toaster();


      Router.showPage("splashScreen");

    setTimeout(() => {
  Router.showPage("login");

  }, 0);


  if (typeof logAllDnsEntries === "function") {
    logAllDnsEntries();
  }

  if (typeof getTmbdId === "function") {
    getTmbdId();
  }
};
