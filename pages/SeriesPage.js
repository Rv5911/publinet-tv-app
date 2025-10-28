function SeriesPage() {
  let allSeriesCategoriesData = window.seriesCategories || [];
  let allSeriesStreamsData = window.allSeriesStreams || [];

  const hasData =
    allSeriesCategoriesData.length > 0 && allSeriesStreamsData.length > 0;

  let allSeriesData = [];
  if (hasData) {
    allSeriesData = allSeriesCategoriesData
      .map((category) => ({
        ...category,
        series: allSeriesStreamsData.filter(
          (stream) => stream.category_id === category.category_id
        ),
      }))
      .flat();
  }

  setTimeout(() => {
    const cards = document.querySelectorAll(".series-card");
    if (!cards.length) return;

    let currentIndex = 0;
    cards[currentIndex].classList.add("series-focused");

    function updateFocus(newIndex) {
      if (cards[currentIndex]) {
        cards[currentIndex].classList.remove("series-focused");
      }
      currentIndex = (newIndex + cards.length) % cards.length;
      if (cards[currentIndex]) {
        cards[currentIndex].classList.add("series-focused");
        cards[currentIndex].scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    }

    // document.addEventListener("keydown", (e) => {
    //   if (e.key === "ArrowRight") updateFocus(currentIndex + 1);
    //   if (e.key === "ArrowLeft") updateFocus(currentIndex - 1);
    // });
  }, 0);

  return `
    <div class="series-container">
      <div class="series-section">
        <h1 class="series-section-title">Trending Series</h1>
        <div class="series-list series-list-normal">
          ${Array.from({ length: 20 })
            .map(
              (_, index) => createSeriesCard({
                id: index + 1,
                title: `Series Name ${index + 1}`,
                genre: "Drama",
                seasons: "3 Seasons",
                year: "2020-2023",
                image: "./assets/demo-img-card.png"
              }, "normal")
            )
            .join("")}
        </div>
      </div>

      <div class="series-section">
        <h1 class="series-section-title">Most Popular</h1>
        <div class="series-list series-list-large">
          ${Array.from({ length: 15 })
            .map(
              (_, index) => createSeriesCard({
                id: index + 21,
                title: `Popular Series ${index + 1}`,
                genre: "Action",
                seasons: "5 Seasons",
                year: "2018-2024",
                image: "./assets/demo-img-card.png"
              }, "large")
            )
            .join("")}
        </div>
      </div>

      <div class="series-section">
        <h1 class="series-section-title">Recently Added</h1>
        <div class="series-list series-list-normal">
          ${Array.from({ length: 15 })
            .map(
              (_, index) => createSeriesCard({
                id: index + 36,
                title: `New Series ${index + 1}`,
                genre: "Comedy",
                seasons: "1 Season",
                year: "2024",
                image: "./assets/demo-img-card.png"
              }, "normal")
            )
            .join("")}
        </div>
      </div>

      <div class="series-section">
        <h1 class="series-section-title">Continue Watching</h1>
        <div class="series-list series-list-normal">
          ${Array.from({ length: 15 })
            .map(
              (_, index) => createSeriesCard({
                id: index + 51,
                title: `Continue Series ${index + 1}`,
                genre: "Thriller",
                seasons: "2 Seasons",
                year: "2022-2023",
                image: "./assets/demo-img-card.png"
              }, "normal")
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function createSeriesCard(seriesData, size = "normal") {
  const isLarge = size === "large";
  const cardClass = isLarge ? "series-card series-card-large" : "series-card";
  
  return `
    <div class="${cardClass}" style="background: url('${seriesData.image}');">
      <div class="series-card-content">
        <div class="series-card-top">
          <img src="./assets/heartIcon.png" alt="img" class="series-card-heart" />
        </div>
        <div class="series-card-center">
          <img src="./assets/card-play-icon.png" alt="img" class="series-card-play" />
        </div>
        <div class="series-card-bottom">
          <div class="series-card-info-left">
            <h3 class="series-card-genre">${seriesData.genre}</h3>
            <h2 class="series-card-title">${seriesData.title}</h2>
          </div>
          <div class="series-card-info-right">
            <h3 class="series-card-seasons">${seriesData.seasons}</h3>
            <h2 class="series-card-year">${seriesData.year}</h2>
          </div>
        </div>
      </div>
    </div>`;
}