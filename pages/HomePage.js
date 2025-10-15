function HomePage(){

    return`
    <div class="home-page-container">
        <h1>Welcome to the Home Page</h1>

  ${window.moviesCategories.length}
  ${window.allMoviesStreams.length}
    ${window.allSeriesStreams.length}
    ${window.allseriesCategories.length}
    ${window.allLiveStreams.length}
    ${window.liveCategories.length}


    </div>
    `
}