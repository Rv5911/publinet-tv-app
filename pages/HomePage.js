let homeNavigationState = {
  currentCategoryIndex: 0,
  currentCardIndex: 0,
  lastFocusedCategory: 0,
  lastFocusedCard: 0,
};

function normalizeHomeText(s) {
  return (s || "").toLowerCase();
}
function getHomeSearchQuery() {
  return normalizeHomeText(window.searchQuery || "");
}
function filterHomeStreamsByQuery(streams) {
  const q = getHomeSearchQuery();
  if (!q) return streams;
  return (streams || []).filter((s) =>
    normalizeHomeText(s && (s.name || s.title)).includes(q)
  );
}

function formatHomeMovieData(stream) {
  if (!stream) return null;
  return {
    id: stream.stream_id || stream.num,
    stream_id: stream.stream_id,
    title: stream.name || "Unknown",
    genre: stream.category_name || "Movie",
    image: stream.stream_icon || "./assets/demo-img-card.png",
    duration: "2h 0m",
    rating: stream.rating_5based ? stream.rating_5based : "0",
    category_id: stream.category_id ? stream.category_id : null,
  };
}

function createHomeCard(movieData, categoryIndex, movieIndex, isLarge) {
  if (!movieData) return "";
  const cardClass = isLarge ? "home-card home-card-large" : "home-card";
  const movieId = String(movieData.stream_id || movieData.id);
  const currentPlaylist = getCurrentPlaylist();
  const favIds =
    currentPlaylist && currentPlaylist.favouriteMovies
      ? currentPlaylist.favouriteMovies.map((id) => String(id))
      : [];
  const isFav = Array.isArray(favIds) && favIds.includes(String(movieId));
  const imageUrl = movieData.image || "./assets/demo-img-card.png";
  return `<div class="${cardClass}" data-category="${categoryIndex}" data-index="${movieIndex}" data-stream-id="${movieId}" style="background-image: url('${imageUrl}')"><div class="home-card-content"><div class="home-card-top"><img src="./assets/heartIcon.png" style="display: ${
    isFav ? "block" : "none"
  }" alt="Favorite" class="home-card-heart" /></div><div class="home-card-play-div"><img src="./assets/card-play-icon.png" alt="Play" class="home-card-play" /></div><div class="home-card-bottom"><div class="home-card-bottom-left"><h3>${
    movieData.genre || "Movie"
  }</h3><h2 class="home-title-marquee">${
    movieData.title || "Unknown"
  }</h2></div><div class="home-card-bottom-right"><h3>${
    movieData.duration || "2h 0m"
  }</h3><span class="home-card-rating"><img src="./assets/rating-star.png" class="home-card-star-icon" />${
    movieData.rating ? movieData.rating : "0"
  }</span></div></div></div></div>`;
}

function createHomeCategorySection(category, categoryIndex) {
  const isLarge = category.id === "home-popular";
  let html = `<div class="${category.containerClass}">`;
  html += `<h1>${category.title}</h1>`;
  html += `<div class="home-card-list ${category.id}-list" data-category="${categoryIndex}">`;
  const movies = category.movies || [];
  for (let i = 0; i < movies.length; i++) {
    const movieData = formatHomeMovieData(movies[i]);
    html += createHomeCard(movieData, categoryIndex, i, isLarge);
  }
  html += `</div>`;
  html += `</div>`;
  return html;
}

function removeAllHomeFocus() {
  const allCards = document.querySelectorAll(".home-card");
  for (let i = 0; i < allCards.length; i++) {
    allCards[i].classList.remove("focused");
    const titleElement = allCards[i].querySelector(".home-title-marquee");
    if (titleElement) {
      titleElement.classList.remove("marquee-active");
    }
  }
}

function scrollToHomeElement(element) {
  if (!element) return;
  try {
    document.body.scrollTop = 30;
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch (e) {
    try {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (finalError) {
      try {
        element.scrollIntoView();
      } catch (error) {}
    }
  }
}

function activateHomeMarquee(card) {
  if (!card) return;
  const titleElement = card.querySelector(".home-title-marquee");
  if (!titleElement) return;
  const container = titleElement.parentElement;
  if (!container) return;
  if (titleElement.scrollWidth > container.offsetWidth) {
    titleElement.classList.add("marquee-active");
  } else {
    titleElement.classList.remove("marquee-active");
  }
}

function updateHomeFocus() {
  removeAllHomeFocus();
  const currentCard = document.querySelector(
    '.home-card[data-category="' +
      homeNavigationState.currentCategoryIndex +
      '"][data-index="' +
      homeNavigationState.currentCardIndex +
      '"]'
  );
  if (currentCard) {
    currentCard.classList.add("focused");
    scrollToHomeElement(currentCard);
    homeNavigationState.lastFocusedCategory =
      homeNavigationState.currentCategoryIndex;
    homeNavigationState.lastFocusedCard = homeNavigationState.currentCardIndex;
    activateHomeMarquee(currentCard);
  }
}

function getHomeCategories(selectedPlaylist) {
  const favIdsRaw = selectedPlaylist
    ? selectedPlaylist.favouriteMovies || []
    : [];
  const favIds = Array.isArray(favIdsRaw)
    ? favIdsRaw.map((id) => String(id))
    : [];
  const favMovies =
    window.allMoviesStreams && favIds.length
      ? filterHomeStreamsByQuery(
          window.allMoviesStreams.filter(
            (m) => m && favIds.includes(String(m.stream_id))
          )
        )
      : [];
  const recentIds =
    selectedPlaylist && selectedPlaylist.continueWatchingMovies
      ? selectedPlaylist.continueWatchingMovies
          .filter((m) => m !== null && m !== undefined)
          .map((item) => String(item.itemId))
      : [];
  const recentMovies = window.allMoviesStreams
    ? filterHomeStreamsByQuery(
        window.allMoviesStreams.filter((m) =>
          recentIds.includes(String(m.stream_id))
        )
      )
    : [];
  const categories = [];
  categories.push({
    title: "My Fav",
    movies: favMovies,
    id: "home-fav",
    containerClass: "home-fav-container",
  });
  categories.push({
    title: "Recently Watched",
    movies: recentMovies,
    id: "home-recent",
    containerClass: "home-recent-container",
  });
  return categories;
}

function HomePage() {
  const selectedPlaylistData = localStorage.getItem("selectedPlaylist")
    ? JSON.parse(localStorage.getItem("selectedPlaylist"))
    : {};
  const currentPlaylist = getCurrentPlaylist();
  const categories = getHomeCategories(currentPlaylist);
  let contentHTML =
    '<div class="home-page-container">' +
    '<div class="poster">' +
    HomeCarousel() +
    "</div>";
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (category.movies && category.movies.length > 0) {
      contentHTML += createHomeCategorySection(category, i);
    }
  }
  if (!categories.some((c) => c.movies && c.movies.length)) {
    contentHTML +=
      '<div class="home-page-no-data"><p>No Home Data Available</p></div>';
  }
  contentHTML += "</div>";
  setTimeout(function () {
    if (HomePage.cleanup) HomePage.cleanup();
    const loadingEl = document.querySelector("#loading-overlay");
    if (loadingEl) {
      loadingEl.style.background = "black";
      loadingEl.style.marginTop = "0px";
    }
    function homePageKeydownEvents(e) {
      if(localStorage.getItem("currentPage") != "homePage"&&localStorage.getItem("navigationFocus")!="homePage"){
        return;
      }
      const key = e.key;
      if (key === "ArrowRight") {
        const list = document.querySelector(
          '.home-card-list[data-category="' +
            homeNavigationState.currentCategoryIndex +
            '"]'
        );
        if (list) {
          const cards = list.querySelectorAll(".home-card");
          homeNavigationState.currentCardIndex = Math.min(
            homeNavigationState.currentCardIndex + 1,
            Math.max(cards.length - 1, 0)
          );
          updateHomeFocus();
        }
      } else if (key === "ArrowLeft") {
        homeNavigationState.currentCardIndex = Math.max(
          homeNavigationState.currentCardIndex - 1,
          0
        );
        updateHomeFocus();
      } else if (key === "ArrowDown") {
        const nextCategory = homeNavigationState.currentCategoryIndex + 1;
        const nextList = document.querySelector(
          '.home-card-list[data-category="' + nextCategory + '"]'
        );
        if (nextList) {
          homeNavigationState.currentCategoryIndex = nextCategory;
          const cards = nextList.querySelectorAll(".home-card");
          homeNavigationState.currentCardIndex = Math.min(
            homeNavigationState.currentCardIndex,
            Math.max(cards.length - 1, 0)
          );
          updateHomeFocus();
        }
      } else if (key === "ArrowUp") {
        const prevCategory = homeNavigationState.currentCategoryIndex - 1;
        if (homeNavigationState.currentCategoryIndex === 0) {
          localStorage.setItem("navigationFocus", "navbar");
          const homeNavItem = document.querySelector(
            '.nav-item[data-page="homePage"]'
          );
          const allNavItems = document.querySelectorAll(".nav-item");
          allNavItems.forEach((i) => i.classList.remove("active"));
          const searchInput = document.getElementById("search-input");
          if (searchInput) searchInput.classList.remove("active");
          const profileIcon = document.getElementById("profileIcon");
          if (profileIcon) profileIcon.classList.remove("active");
          if (typeof window.focusNavbarHome === "function") {
            window.focusNavbarHome();
          } else if (homeNavItem) {
            homeNavItem.classList.add("active");
            homeNavItem.focus();
          }
          return;
        }
        const prevList = document.querySelector(
          '.home-card-list[data-category="' + prevCategory + '"]'
        );
        if (prevList) {
          homeNavigationState.currentCategoryIndex = Math.max(prevCategory, 0);
          const cards = prevList.querySelectorAll(".home-card");
          homeNavigationState.currentCardIndex = Math.min(
            homeNavigationState.currentCardIndex,
            Math.max(cards.length - 1, 0)
          );
          updateHomeFocus();
        }
      } else if (key === "Enter") {
        const currentCard = document.querySelector(
          '.home-card[data-category="' +
            homeNavigationState.currentCategoryIndex +
            '"][data-index="' +
            homeNavigationState.currentCardIndex +
            '"]'
        );
        if (currentCard) {
          const streamId = currentCard.getAttribute("data-stream-id");
          localStorage.setItem("selectedMovieId", streamId);
          const selectedMovieItem = window.allMoviesStreams.find(
            (item) => String(item.stream_id) === String(streamId)
          );
          if (selectedMovieItem) {
            localStorage.setItem(
              "selectedMovieData",
              JSON.stringify(selectedMovieItem)
            );
          }
          localStorage.setItem("currentPage", "movieDetailPage");
          localStorage.setItem("navigationFocus", "movieDetailPage");
          Router.showPage("movieDetailPage");
        }
      }
    }
    document.addEventListener("keydown", homePageKeydownEvents);
    document.addEventListener("keydown", function (e) {
      if (localStorage.getItem("currentPage") == "homePage") {
        const backKeys = [10009, "Escape", "Back", "BrowserBack", "XF86Back"];
        if (
          (e.key === "XF86Exit" ||
            e.key === "XF86Home" ||
            e.keyCode === 10071 ||
            backKeys.includes(e.keyCode) ||
            backKeys.includes(e.key)) &&
          typeof tizen !== "undefined"
        ) {
          e.preventDefault();
          localStorage.setItem("currentPage", "exitPage");
          Router.showPage("exitModal");
        }
      }
    });
    HomePage.cleanup = function () {
      document.removeEventListener("keydown", homePageKeydownEvents);
    };
    homeNavigationState.currentCategoryIndex = 0;
    homeNavigationState.currentCardIndex = 0;
    updateHomeFocus();
  }, 0);
  return contentHTML;
}

window.homeNavigationState = homeNavigationState;
window.updateHomeFocus = updateHomeFocus;
