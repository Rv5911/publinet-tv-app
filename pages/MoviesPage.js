function MoviesPage() {
  let allMoviesCategoriesData = window.moviesCategories || [];
  let allMoviesStreamsData = window.allMoviesStreams || [];

  const hasData =
    allMoviesCategoriesData.length > 0 && allMoviesStreamsData.length > 0;

  let allMoviesData = [];
  if (hasData) {
    allMoviesData = allMoviesCategoriesData
      .map((category) => ({
        ...category,
        movies: allMoviesStreamsData.filter(
          (stream) => stream.category_id === category.category_id
        ),
      }))
      .flat();
  }

  setTimeout(() => {
    const cards = document.querySelectorAll(".movie-card");
    if (!cards.length) return;

    let currentIndex = 0;
    cards[currentIndex].classList.add("focused");

    function updateFocus(newIndex) {
      if (cards[currentIndex]) {
        cards[currentIndex].classList.remove("focused");
      }
      currentIndex = (newIndex + cards.length) % cards.length;
      if (cards[currentIndex]) {
        cards[currentIndex].classList.add("focused");
        cards[currentIndex].scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    }

    // document.addEventListener("keydown", (e) => {
    //   if (e.key === "ArrowRight") updateFocus(currentIndex + 1);
    //   if (e.key === "ArrowLeft") updateFocus(currentIndex - 1);
    // });
  }, 0);

  return `
    <div class="movies-page-container">
      <div class="movies-fav-container">
        <h1>My Fav</h1>
        <div class="movies-fav-list movies-card-list">
          ${Array.from({ length: 20 })
            .map(
              (_, index) => createMovieCard({
                id: index + 1,
                title: `Movie Name ${index + 1}`,
                genre: "Action",
                duration: "2h 30m",
                year: "2022",
                image: "./assets/demo-img-card.png"
              }, "normal")
            )
            .join("")}
        </div>
      </div>

      <div class="movies-popular-container">
        <h1>Most Popular</h1>
        <div class="movies-popular-list movies-card-list">
          ${Array.from({ length: 15 })
            .map(
              (_, index) => createMovieCard({
                id: index + 21,
                title: `Popular Movie ${index + 1}`,
                genre: "Drama",
                duration: "1h 45m",
                year: "2023",
                image: "./assets/demo-img-card.png"
              }, "large")
            )
            .join("")}
        </div>
      </div>

      <div class="recently-watched-container">
        <h1>Recently Watched</h1>
        <div class="recently-watched-list movies-card-list">
          ${Array.from({ length: 15 })
            .map(
              (_, index) => createMovieCard({
                id: index + 36,
                title: `Recent Movie ${index + 1}`,
                genre: "Comedy",
                duration: "1h 55m",
                year: "2024",
                image: "./assets/demo-img-card.png"
              }, "normal")
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function createMovieCard(movieData, size = "normal") {
  const isLarge = size === "large";
  const cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
  
  return `
    <div class="${cardClass}" style="background: url('${movieData.image}');">
      <div class="movie-card-content">
        <div>
          <img src="./assets/heartIcon.png" alt="img" class="movie-card-heart" />
        </div>
        <div class="movie-card-play-div">
          <img src="./assets/card-play-icon.png" alt="img" class="movie-card-play" />
        </div>
        <div class="movie-card-bottom">
          <div class="movie-card-bottom-left">
            <h3>${movieData.genre}</h3>
            <h2>${movieData.title}</h2>
          </div>
          <div class="movie-card-bottom-right">
            <h3>${movieData.duration}</h3>
            <h2>${movieData.year}</h2>
          </div>
        </div>
      </div>
    </div>`;
}