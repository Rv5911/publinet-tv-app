window.onload = function () {

      window.moviesCategories = [];
  window.allMoviesStreams = [];

  window.allSeriesStreams = [];
  window.allseriesCategories = [];

  window.allLiveStreams = [];
  window.liveCategories = [];

//   localStorage.setItem("currentPage", "loginPage");

    Toaster();

        let mainEl=this.document.querySelector("#main-app-container");
    mainEl.innerHTML = SplashScreen();


    setTimeout(() => {
        
        mainEl.innerHTML = LoginPage();
    }, 5000);
}
