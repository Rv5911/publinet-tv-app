// MoviesPage.js file
let moviesNavigationState = {
  currentCategoryIndex: 0,
  currentCardIndex: 0,
  lastFocusedCategory: 0,
  lastFocusedCard: 0,
};

let allMoviesStreamsData = window.allMoviesStreams || [];
let favoriteMoviesIds = [];
const unlockedMovieAdultIds = new Set();

const isMovieAdult = (name) => {
  const normalized = (name || "").trim().toLowerCase();
  const configured = window.adultsCategories || [];
  if (configured.includes(normalized)) return true;
  return /(adult|xxx|18\+|18\s*plus|sex|porn|nsfw)/i.test(normalized);
};

window.resetMoviesParentalState = () => {
  unlockedMovieAdultIds.clear();
};

let isMoviesNavigationInitialized = false;

let moviesChunkLoadingState = {
  loadedCategories: 0,
  categoryChunkSize: 4,
  loadedChunks: {},
  horizontalChunkSize: 12,
  isLoading: false,
};

let moviesEnterKeyState = {
  isPressed: false,
  pressStartTime: 0,
  longPressThreshold: 400,
  timeoutId: null,
};

let moviesNavigationDebounce = {
  lastKeyPress: 0,
  debounceTime: 300,
  isDebouncing: false,
};

function normalizeText(s) {
  return (s || "").toLowerCase();
}

function getMoviesSearchQuery() {
  return normalizeText(window.searchQuery || "");
}

function filterStreamsByQuery(streams) {
  const q = getMoviesSearchQuery();
  if (!q) return streams;
  return (streams || []).filter((s) => normalizeText(s && s.name).includes(q));
}

function formatMovieData(movieStream) {
  if (!movieStream) return null;

  // Safely get category_name with fallback
  const categoryName = movieStream.category_name || "Movie";

  return {
    id: movieStream.stream_id || movieStream.num,
    stream_id: movieStream.stream_id,
    title: movieStream.name || "Unknown",
    genre: categoryName,
    year: formatMovieYear(movieStream.added),
    image: movieStream.stream_icon || "./assets/demo-img-card.png",
    duration: formatMovieDuration(movieStream),
    rating: movieStream.rating_5based ? movieStream.rating_5based : "0",
    category_id: movieStream.category_id ? movieStream.category_id : null,
  };
}

function formatMovieYear(timestamp) {
  if (!timestamp) return "Unknown";
  try {
    return new Date(Number(timestamp) * 1000).getFullYear().toString();
  } catch (e) {
    return "Unknown";
  }
}

function formatMovieDuration(movie) {
  return "2h 0m";
}

function getFavoriteMovies() {
  try {
    const username = getCurrentPlaylistUsername();
    if (!username) return [];

    const playlists = getPlaylistsData();
    const playlist = playlists.find((p) => p.playlistName === username);

    if (playlist && playlist.movies) {
      return playlist.movies.map((id) => id.toString());
    }

    return [];
  } catch (e) {
    console.error("Error getting favorite movies:", e);
    return [];
  }
}

function getRecentlyWatchedMovies() {
  try {
    let username = window.getCurrentPlaylistUsername
      ? window.getCurrentPlaylistUsername()
      : null;
    if (!username) return [];

    let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
    for (let i = 0; i < playlists.length; i++) {
      if (playlists[i].playlistUsername === username) {
        let recent = playlists[i].continueWatchingMovies || [];
        return recent
          .slice(0, 15)
          .map(formatMovieData)
          .filter((m) => m !== null);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

function getPopularMovies() {
  try {
    if (allMoviesStreamsData.length === 0) return [];

    let sorted = allMoviesStreamsData.slice(0, 50);
    sorted.sort(function (a, b) {
      return (
        (parseFloat(b.rating_5based) || 0) - (parseFloat(a.rating_5based) || 0)
      );
    });

    return sorted
      .slice(0, 30)
      .map(formatMovieData)
      .filter((m) => m !== null);
  } catch (e) {
    return [];
  }
}

function getAPICategories(sortType = "default") {
  let allMoviesCategoriesData = window.moviesCategories || [];
  let allMoviesStreamsData = window.allMoviesStreams || [];

  if (
    allMoviesCategoriesData.length === 0 ||
    allMoviesStreamsData.length === 0
  ) {
    return [];
  }

  let categories = [];
  for (let i = 0; i < allMoviesCategoriesData.length; i++) {
    let category = allMoviesCategoriesData[i];
    if (!category) continue;

    let movies = [];

    for (let j = 0; j < allMoviesStreamsData.length; j++) {
      let stream = allMoviesStreamsData[j];
      if (!stream) continue;

      if (stream.category_id == category.category_id) {
        movies.push(stream);
      }
    }
    movies = filterStreamsByQuery(movies).slice(0, 50);

    categories.push({
      title: category.category_name
        ? category.category_name.replace(/[*]/g, "")
        : "Category",
      movies: movies,
      id: category.category_id,
      containerClass: "movies-category-container",
      category_id: category.category_id,
    });
  }

  // Apply sorting based on selected sort option
  return sortMovieCategories(categories, sortType);
}

function sortMovieCategories(categories, sortType) {
  if (!categories || categories.length === 0) return categories;

  // Separate categories into two groups: alphabetic and non-alphabetic
  let alphabeticCategories = [];
  let nonAlphabeticCategories = [];

  for (let i = 0; i < categories.length; i++) {
    let category = categories[i];
    let firstChar = category.title.charAt(0);

    // Check if first character is a letter (A-Z, a-z)
    if (/^[A-Za-z]$/.test(firstChar)) {
      alphabeticCategories.push(category);
    } else {
      nonAlphabeticCategories.push(category);
    }
  }

  // Sort based on selected sort option
  switch (sortType) {
    case "a-z":
      // A-Z: Alphabetic A-Z first, then non-alphabetic A-Z
      alphabeticCategories.sort((a, b) =>
        (a.title || "")
          .toLowerCase()
          .localeCompare((b.title || "").toLowerCase())
      );
      nonAlphabeticCategories.sort((a, b) =>
        (a.title || "")
          .toLowerCase()
          .localeCompare((b.title || "").toLowerCase())
      );
      return alphabeticCategories.concat(nonAlphabeticCategories);

    case "z-a":
      // Z-A: Alphabetic Z-A first, then non-alphabetic Z-A
      alphabeticCategories.sort((a, b) =>
        (b.title || "")
          .toLowerCase()
          .localeCompare((a.title || "").toLowerCase())
      );
      nonAlphabeticCategories.sort((a, b) =>
        (b.title || "")
          .toLowerCase()
          .localeCompare((a.title || "").toLowerCase())
      );
      return alphabeticCategories.concat(nonAlphabeticCategories);

    case "recently-added":
      // Recently Added - sort by category_id descending (assuming higher IDs are newer)
      return categories.sort(
        (a, b) => (b.category_id || 0) - (a.category_id || 0)
      );

    case "top-rated":
      // Top Rated - sort by average rating of movies in category
      return categories.sort((a, b) => {
        const avgRatingA =
          a.movies && a.movies.length > 0
            ? a.movies.reduce(
                (sum, movie) => sum + (parseFloat(movie.rating_5based) || 0),
                0
              ) / a.movies.length
            : 0;
        const avgRatingB =
          b.movies && b.movies.length > 0
            ? b.movies.reduce(
                (sum, movie) => sum + (parseFloat(movie.rating_5based) || 0),
                0
              ) / b.movies.length
            : 0;
        return avgRatingB - avgRatingA;
      });

    case "default":
    default:
      // Default - return as is (no sorting)
      return categories;
  }
}

function createMovieCard(movieData, size, categoryIndex, movieIndex) {
  if (!movieData) return ""; // Add safety check

  let isLarge = size === "large";
  let cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
  let movieId = String(movieData.stream_id || movieData.id);

  let isMovieFav =
    Array.isArray(favoriteMoviesIds) &&
    favoriteMoviesIds.some((favId) => String(favId) === String(movieId));

  let imageUrl = movieData.image || "./assets/demo-img-card.png";
  let titleClass = "movie-title-marquee";

  // Safely get category name
  let currentCardCategory = window.moviesCategories
    ? window.moviesCategories.filter(
        (cat) => cat.category_id == movieData.category_id
      )
    : [];

  let categoryName =
    currentCardCategory.length > 0
      ? currentCardCategory[0].category_name
      : movieData.genre || "Movie"; // Use genre as fallback

  const isAdult = isMovieAdult(movieData.genre) || isMovieAdult(categoryName);
  const currentPlaylist = getCurrentPlaylist();
  const hasParentalPassword =
    currentPlaylist && currentPlaylist.parentalPassword;
  const isLocked = isAdult && !unlockedMovieAdultIds.has(String(movieId));

  let overlayHtml = "";
  if (isLocked) {
    if (hasParentalPassword) {
      overlayHtml = `<div class="adult-overlay"><i class="fas fa-lock card-lock-icon"></i></div>`;
    } else {
      overlayHtml = `<div class="adult-overlay"></div>`;
    }
  }

  return `<div class="${cardClass}" 
            data-category="${categoryIndex}" 
            data-index="${movieIndex}" 
            data-stream-id="${movieId}" 
            data-is-adult="${isAdult}"
            data-is-locked="${isLocked}"
            data-image-url="${imageUrl}"
            style="background-image: url('${
              imageUrl ? imageUrl : "./assets/placeholder-img.png"
            }')">
            <img src="${imageUrl}" style="display: none;" onerror="this.parentElement.style.backgroundImage = 'url(./assets/placeholder-img.png)'" />
            ${overlayHtml}
            <div class="movie-card-content">
                <div class="movie-card-top">
                    <img src="./assets/heartIcon.png" 
                         style="display: ${isMovieFav ? "block" : "none"}" 
                         alt="Favorite" 
                         class="movie-card-heart" />
                </div>
                <div class="movie-card-play-div">
                    <img src="./assets/card-play-icon.png" alt="Play" class="movie-card-play" />
                </div>
                <div class="movie-card-bottom">
                    <div class="movie-card-bottom-left">
                        <h3>${categoryName}</h3>
                        <h2 class="${titleClass}">${
    movieData.title || "Unknown"
  }</h2>
                    </div>
                    <div class="movie-card-bottom-right">
                        <h3 style="opacity: 0">${
                          movieData.duration || "2h 0m"
                        }</h3>
                        <span class="movie-card-rating"> <img src="./assets/rating-star.png" class="movie-card-star-icon" />${
                          movieData.rating ? movieData.rating : "0"
                        }</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function createMoviesLoadingIndicator(categoryIndex) {
  return (
    '<div class="movies-loading-indicator" data-category="' +
    categoryIndex +
    '">' +
    "<p>Loading...</p>" +
    "</div>"
  );
}

function getMoviesLoadedChunkCount(categoryIndex) {
  return moviesChunkLoadingState.loadedChunks[categoryIndex] || 0;
}

function setMoviesLoadedChunkCount(categoryIndex, count) {
  ``;
  moviesChunkLoadingState.loadedChunks[categoryIndex] = count;
}

function loadMoviesChunk(category, categoryIndex) {
  if (!category || !category.movies || category.movies.length === 0) return "";

  let loadedCount = getMoviesLoadedChunkCount(categoryIndex);
  let chunkSize = moviesChunkLoadingState.horizontalChunkSize;
  let totalMovies = category.movies.length;

  if (loadedCount >= totalMovies) return "";

  let endIndex = Math.min(loadedCount + chunkSize, totalMovies);
  let cardsHTML = "";

  for (let i = loadedCount; i < endIndex; i++) {
    let movieStream = category.movies[i];
    if (!movieStream) continue; // Skip if movie stream is undefined

    let movieData = formatMovieData(movieStream);
    if (!movieData) continue;

    let size = category.id === "popular" ? "large" : "normal";
    cardsHTML += createMovieCard(movieData, size, categoryIndex, i);
  }

  setMoviesLoadedChunkCount(categoryIndex, endIndex);
  return cardsHTML;
}

function moviesCategoryHasMovies(categoryIndex) {
  let categories = window.allMoviesCategories || [];
  let category = categories[categoryIndex];

  if (!category) {
    return false;
  }

  let cardList = document.querySelector(
    '.movies-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) {
    return false;
  }

  let cardsInDOM = cardList.querySelectorAll(".movie-card");
  if (cardsInDOM.length > 0) {
    return true;
  }

  // Fallback: check the data structure
  if (!category.movies || category.movies.length === 0) {
    return false;
  }

  let loadedCount = getMoviesLoadedChunkCount(categoryIndex);
  return loadedCount > 0;
}

function findNextMoviesCategoryWithMovies(startIndex, direction) {
  let allCategories = window.allMoviesCategories || [];

  if (direction === 1) {
    for (let i = startIndex; i < allCategories.length; i++) {
      if (moviesCategoryHasMovies(i)) {
        return i;
      }
    }
  } else {
    for (let i = startIndex; i >= 0; i--) {
      if (moviesCategoryHasMovies(i)) {
        return i;
      }
    }
  }

  return -1;
}

function loadMoreMoviesCategories() {
  if (moviesChunkLoadingState.isLoading) return;

  let allCategories = window.allMoviesCategories || [];
  let currentLoaded = moviesChunkLoadingState.loadedCategories;

  // If searching and no remaining categories have items, remove any indicator and stop
  const remainingHasItems = allCategories
    .slice(currentLoaded)
    .some(function (cat) {
      return cat && cat.movies && cat.movies.length > 0;
    });
  if (!remainingHasItems) {
    let container = document.querySelector(".movies-page-container");
    if (container) {
      let categoriesLoading = container.querySelector(
        ".categories-loading-indicator"
      );
      if (categoriesLoading) categoriesLoading.remove();
    }
    moviesChunkLoadingState.isLoading = false;
    return;
  }

  if (currentLoaded >= allCategories.length) {
    let container = document.querySelector(".movies-page-container");
    if (container) {
      let categoriesLoading = container.querySelector(
        ".categories-loading-indicator"
      );
      if (categoriesLoading) {
        categoriesLoading.remove();
      }
    }
    return;
  }

  moviesChunkLoadingState.isLoading = true;

  let nextChunk = Math.min(
    currentLoaded + moviesChunkLoadingState.categoryChunkSize,
    allCategories.length
  );

  let safetyTimeout = setTimeout(function () {
    if (moviesChunkLoadingState.isLoading) {
      console.warn(
        "loadMoreMoviesCategories: Safety timeout triggered, resetting loading state"
      );
      moviesChunkLoadingState.isLoading = false;
      let container = document.querySelector(".movies-page-container");
      if (container) {
        let categoriesLoading = container.querySelector(
          ".categories-loading-indicator"
        );
        if (categoriesLoading) {
          categoriesLoading.remove();
        }
      }
    }
  }, 5000);

  setTimeout(function () {
    try {
      let container = document.querySelector(".movies-page-container");
      if (!container) {
        clearTimeout(safetyTimeout);
        moviesChunkLoadingState.isLoading = false;
        return;
      }

      let categoriesLoading = container.querySelector(
        ".categories-loading-indicator"
      );
      if (categoriesLoading) {
        categoriesLoading.remove();
      }

      let categoriesAdded = 0;
      for (let i = currentLoaded; i < nextChunk; i++) {
        let category = allCategories[i];
        if (!category) continue;

        if (category.movies && category.movies.length > 0) {
          try {
            let categoryHTML = createMoviesCategorySection(category, i);
            container.insertAdjacentHTML("beforeend", categoryHTML);
            categoriesAdded++;
          } catch (e) {
            console.error("Error creating movies category section:", e);
          }
        }
      }

      let hasMoreCategories = false;
      for (let i = nextChunk; i < allCategories.length; i++) {
        let category = allCategories[i];
        if (category && category.movies && category.movies.length > 0) {
          hasMoreCategories = true;
          break;
        }
      }

      // Show "No results found" if no more categories are available
      if (!hasMoreCategories && categoriesAdded === 0) {
        container.insertAdjacentHTML(
          "beforeend",
          '<div class="no-more-categories"><p>No results found</p></div>'
        );
      }

      moviesChunkLoadingState.loadedCategories = nextChunk;
      clearTimeout(safetyTimeout);
      moviesChunkLoadingState.isLoading = false;

      if (categoriesAdded > 0) {
        updateMoviesFocus();
      }
    } catch (e) {
      console.error("Error in loadMoreMoviesCategories:", e);
      clearTimeout(safetyTimeout);
      moviesChunkLoadingState.isLoading = false;

      let container = document.querySelector(".movies-page-container");
      if (container) {
        let categoriesLoading = container.querySelector(
          ".categories-loading-indicator"
        );
        if (categoriesLoading) {
          categoriesLoading.remove();
        }
      }
    }
  }, 50);
}

function createMoviesCategorySection(category, categoryIndex) {
  let size = category.id === "popular" ? "large" : "normal";

  let html = '<div class="' + category.containerClass + '">';
  html += "<h1>" + category.title + "</h1>";
  html +=
    '<div class="movies-card-list ' +
    category.id +
    '-list" data-category="' +
    categoryIndex +
    '">';

  let initialMovies = loadMoviesChunk(category, categoryIndex);
  html += initialMovies;

  if (
    category.movies &&
    category.movies.length > getMoviesLoadedChunkCount(categoryIndex)
  ) {
    html += createMoviesLoadingIndicator(categoryIndex);
  }

  html += "</div>";
  html += "</div>";

  return html;
}

function createMoviesNoDataMessage(categoryTitle) {
  return (
    '<div class="no-data-container">' +
    '<div class="no-data-content">' +
    "<h2>No Data Available</h2>" +
    "<p>No " +
    categoryTitle +
    " found</p>" +
    "</div>" +
    "</div>"
  );
}

function createMoviesNoSearchMessage() {
  return (
    '<div class="no-data-container">' +
    '<div class="no-data-content">' +
    "<h2>No Search Results Found</h2>" +
    "</div>" +
    "</div>"
  );
}

function handleMoviesEnterKey(e) {
  let currentPage = localStorage.getItem("currentPage");
  let navigationFocus = localStorage.getItem("navigationFocus");
  if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();

    if (e.type === "keydown") {
      moviesEnterKeyState.isPressed = true;
      moviesEnterKeyState.pressStartTime = Date.now();

      moviesEnterKeyState.timeoutId = setTimeout(function () {
        if (moviesEnterKeyState.isPressed) {
          handleMoviesLongPressEnter();
          moviesEnterKeyState.isPressed = false;
        }
      }, moviesEnterKeyState.longPressThreshold);
    } else if (e.type === "keyup") {
      if (moviesEnterKeyState.isPressed) {
        let pressDuration = Date.now() - moviesEnterKeyState.pressStartTime;

        if (pressDuration < moviesEnterKeyState.longPressThreshold) {
          clearTimeout(moviesEnterKeyState.timeoutId);
          handleMoviesSimpleEnter();
        }

        moviesEnterKeyState.isPressed = false;
      }
    }
  }
}

function handleMoviesSimpleEnter() {
  if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
    return;
  }

  let categoryIndex = moviesNavigationState.currentCategoryIndex;
  let cardIndex = moviesNavigationState.currentCardIndex;

  let currentCard = document.querySelector(
    '.movie-card[data-category="' +
      categoryIndex +
      '"][data-index="' +
      cardIndex +
      '"]'
  );

  if (currentCard) {
    let streamId = currentCard.getAttribute("data-stream-id");

    const isAdult = currentCard.getAttribute("data-is-adult") === "true";
    const isLocked = currentCard.getAttribute("data-is-locked") === "true";
    const currentPlaylist = getCurrentPlaylist();
    const hasParentalPassword =
      currentPlaylist && currentPlaylist.parentalPassword;

    if (isAdult && isLocked) {
      if (hasParentalPassword) {
        ParentalPinDialog(
          () => {
            unlockedMovieAdultIds.add(String(streamId));
            const overlay = currentCard.querySelector(".adult-overlay");
            if (overlay) overlay.remove();
            currentCard.setAttribute("data-is-locked", "false");
            proceedToMovieDetail(categoryIndex, cardIndex, streamId);
          },
          () => {
            // Stay on page
          },
          currentPlaylist,
          "moviesPage"
        );
        return;
      } else {
        proceedToMovieDetail(categoryIndex, cardIndex, streamId);
        return;
      }
    }

    proceedToMovieDetail(categoryIndex, cardIndex, streamId);
  }
}

function proceedToMovieDetail(categoryIndex, cardIndex, streamId) {
  let isContinueWatchingMovie = false;
  localStorage.setItem("moviesCategoryIndex", categoryIndex);
  localStorage.setItem("moviesCardIndex", cardIndex);
  localStorage.setItem("moviesSelectedCategoryId", categoryIndex);

  localStorage.setItem("selectedMovieId", streamId);
  const currentPlaylist = getCurrentPlaylist();
  const allRecentlyWatchedMovies = currentPlaylist.continueWatchingMovies;
  if (allRecentlyWatchedMovies && Array.isArray(allRecentlyWatchedMovies)) {
    isContinueWatchingMovie = allRecentlyWatchedMovies.some(
      (movie) => movie && movie.itemId == streamId
    );
  }

  localStorage.setItem(
    "isContinueWatchingMovie",
    isContinueWatchingMovie.toString()
  );

  buildDynamicSidebarOptions();

  const selectedMovieItem = window.allMoviesStreams.find(
    (item) => item.stream_id == streamId
  );
  if (selectedMovieItem) {
    localStorage.setItem(
      "selectedMovieData",
      JSON.stringify(selectedMovieItem)
    );
  }

  cleanupMoviesNavigation();

  localStorage.setItem("currentPage", "movieDetailPage");
  localStorage.setItem("navigationFocus", "movieDetailPage");

  Router.showPage("movieDetailPage");
}

function handleMoviesLongPressEnter() {
  if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
    return;
  }

  let categoryIndex = moviesNavigationState.currentCategoryIndex;
  let cardIndex = moviesNavigationState.currentCardIndex;

  let currentCard = document.querySelector(
    '.movie-card[data-category="' +
      categoryIndex +
      '"][data-index="' +
      cardIndex +
      '"]'
  );

  if (currentCard) {
    let streamId = currentCard.getAttribute("data-stream-id");

    // Save current scroll position
    const moviesContainer = document.querySelector(".movies-page-container");
    const currentScrollTop = moviesContainer ? moviesContainer.scrollTop : 0;

    // Toggle favorite
    const result = toggleFavoriteItem(
      Number(streamId),
      "favouriteMovies",
      getCurrentPlaylistUsername()
    );

    // Update ALL cards across ALL categories with the same stream_id
    updateAllMovieCardsHeartDisplay(streamId, result.isFav);

    // Show toast
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast(
        result.isFav ? "success" : "error",
        result.isFav ? "Added to Favorites" : "Removed from Favorites"
      );
    }

    // Update My Fav category in real-time
    updateMyFavCategoryRealtime(
      streamId,
      result.isFav,
      categoryIndex,
      cardIndex
    );

    // Restore scroll position
    if (moviesContainer) {
      moviesContainer.scrollTop = currentScrollTop;
    }

    // Maintain focus on the same card position
    setTimeout(() => {
      updateMoviesFocus();
    }, 50);

    saveMoviesNavigationState();
  }
}

function updateAllMovieCardsHeartDisplay(streamId, isFav) {
  // Update heart icon on ALL cards with this stream_id across all categories
  document
    .querySelectorAll('.movie-card[data-stream-id="' + streamId + '"]')
    .forEach(function (card) {
      const heartEl = card.querySelector(".movie-card-heart");
      if (heartEl) {
        heartEl.style.display = isFav ? "block" : "none";
      }
    });
}

function updateMyFavCategoryRealtime(
  streamId,
  isFav,
  currentCategoryIndex,
  currentCardIndex
) {
  const currentPlaylist = getCurrentPlaylist();
  const favIdsRaw = currentPlaylist
    ? currentPlaylist.favouriteMovies || []
    : [];
  const favIds = Array.isArray(favIdsRaw)
    ? favIdsRaw.map((id) => String(id))
    : [];
  favoriteMoviesIds = favIds;

  const favouriteMovies =
    window.allMoviesStreams && favIds.length
      ? window.allMoviesStreams.filter(
          (m) => m && favIds.includes(String(m.stream_id))
        )
      : [];

  const isSearchMode = !!getMoviesSearchQuery();
  let favList = document.querySelector(".movies-card-list.fav-list");
  let favContainer = document.querySelector(".movies-fav-container");

  // If adding to favorites and My Fav section doesn't exist, create it
  if (isFav && !favContainer && !isSearchMode) {
    createMyFavCategory();
    favList = document.querySelector(".movies-card-list.fav-list");
    favContainer = document.querySelector(".movies-fav-container");

    // After creating My Fav, currentCategoryIndex has been shifted by createMyFavCategory()
    // So we don't need to adjust it here
  }

  if (!favList) return;

  const favCategoryIndex = parseInt(favList.getAttribute("data-category"), 10);
  const isCurrentlyInFavCategory = currentCategoryIndex === favCategoryIndex;

  if (isFav) {
    // Adding to favorites - append new card to My Fav
    const newMovie = window.allMoviesStreams.find(
      (m) => m && String(m.stream_id) === String(streamId)
    );
    if (newMovie) {
      const movieData = formatMovieData(newMovie);
      if (movieData) {
        const currentCards = favList.querySelectorAll(".movie-card");
        const newIndex = currentCards.length;
        const cardHTML = createMovieCard(
          movieData,
          "normal",
          favCategoryIndex,
          newIndex
        );
        favList.insertAdjacentHTML("beforeend", cardHTML);

        // CRITICAL: Set chunk count to reflect actual loaded cards
        const updatedCards = favList.querySelectorAll(".movie-card");
        setMoviesLoadedChunkCount(favCategoryIndex, updatedCards.length);

        // Update window.allMoviesCategories My Fav movies array
        if (
          window.allMoviesCategories &&
          window.allMoviesCategories[favCategoryIndex]
        ) {
          if (!window.allMoviesCategories[favCategoryIndex].movies) {
            window.allMoviesCategories[favCategoryIndex].movies = [];
          }
          // Only add if not already in the array
          const existsInArray = window.allMoviesCategories[
            favCategoryIndex
          ].movies.some((m) => m && String(m.stream_id) === String(streamId));
          if (!existsInArray) {
            window.allMoviesCategories[favCategoryIndex].movies.push(newMovie);
          }
        }
      }
    }
  } else {
    // Removing from favorites
    const cardToRemove = favList.querySelector(
      '.movie-card[data-stream-id="' + streamId + '"]'
    );

    if (cardToRemove) {
      cardToRemove.remove();

      // Reindex remaining cards in My Fav category
      const remainingCards = favList.querySelectorAll(".movie-card");
      remainingCards.forEach((card, index) => {
        card.setAttribute("data-index", index);
      });

      setMoviesLoadedChunkCount(favCategoryIndex, remainingCards.length);

      // Update window.allMoviesCategories My Fav movies array
      if (
        window.allMoviesCategories &&
        window.allMoviesCategories[favCategoryIndex]
      ) {
        window.allMoviesCategories[favCategoryIndex].movies = favouriteMovies;
      }

      // If removed from My Fav category itself, adjust focus
      if (isCurrentlyInFavCategory) {
        if (remainingCards.length === 0) {
          // No more favorites - remove My Fav section and move to next category
          removeMyFavCategory();

          // After removal, find next available category (indices have shifted back)
          const nextIdx = findNextMoviesCategoryWithMovies(0, 1);
          moviesNavigationState.currentCategoryIndex =
            nextIdx !== -1 ? nextIdx : 0;
          moviesNavigationState.currentCardIndex = 0;
        } else {
          // Adjust focus to stay within bounds
          moviesNavigationState.currentCardIndex = Math.min(
            currentCardIndex,
            remainingCards.length - 1
          );
        }
      }
    }

    // If My Fav is now empty and not in search mode, remove the entire section
    if (favouriteMovies.length === 0 && !isSearchMode && favContainer) {
      removeMyFavCategory();

      // If focus was on My Fav, move to next available category
      if (isCurrentlyInFavCategory) {
        const nextIdx = findNextMoviesCategoryWithMovies(0, 1);
        moviesNavigationState.currentCategoryIndex =
          nextIdx !== -1 ? nextIdx : 0;
        moviesNavigationState.currentCardIndex = 0;
      }
    }
  }
}

function createMyFavCategory() {
  const pageContainer = document.querySelector(".movies-page-container");
  if (!pageContainer) return;

  // Check if My Fav already exists
  const existingFav = document.querySelector(".movies-fav-container");
  if (existingFav) return;

  // Save current scroll position
  const currentScrollTop = pageContainer.scrollTop;

  // Create My Fav category at the top (index 0)
  const favCategory = {
    title: "My Fav",
    movies: [], // Will be populated by adding cards
    id: "fav",
    containerClass: "movies-fav-container",
  };

  // Create the HTML structure for My Fav category
  let html = '<div class="' + favCategory.containerClass + '">';
  html += "<h1>" + favCategory.title + "</h1>";
  html += '<div class="movies-card-list fav-list" data-category="0">';
  html += "</div>";
  html += "</div>";

  // Insert at the beginning of the page
  pageContainer.insertAdjacentHTML("afterbegin", html);

  // Shift all chunk loading states by 1 index
  const oldChunks = {
    ...moviesChunkLoadingState.loadedChunks,
  };
  moviesChunkLoadingState.loadedChunks = {};
  moviesChunkLoadingState.loadedChunks[0] = 0; // My Fav starts with 0 loaded

  Object.keys(oldChunks).forEach((key) => {
    const oldIndex = parseInt(key, 10);
    const newIndex = oldIndex + 1;
    moviesChunkLoadingState.loadedChunks[newIndex] = oldChunks[key];
  });

  // Update all existing category indices (shift them by 1)
  const allCategoryLists = pageContainer.querySelectorAll(
    ".movies-card-list:not(.fav-list)"
  );
  allCategoryLists.forEach((list) => {
    const currentIndex = parseInt(list.getAttribute("data-category"), 10);
    const newIndex = currentIndex + 1;
    list.setAttribute("data-category", newIndex);

    // Update all cards in this category
    const cards = list.querySelectorAll(".movie-card");
    cards.forEach((card) => {
      card.setAttribute("data-category", newIndex);
    });

    // Update loading indicators if any
    const loadingIndicator = list.querySelector(".movies-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.setAttribute("data-category", newIndex);
    }
  });

  // Adjust current navigation state
  moviesNavigationState.currentCategoryIndex += 1;
  moviesNavigationState.lastFocusedCategory += 1;

  // Update window.allMoviesCategories to include My Fav at index 0
  if (window.allMoviesCategories && window.allMoviesCategories.length > 0) {
    // Check if My Fav already exists in the array
    const favIndex = window.allMoviesCategories.findIndex(
      (cat) => cat.id === "fav"
    );
    if (favIndex === -1) {
      // My Fav doesn't exist, add it at the beginning
      window.allMoviesCategories.unshift(favCategory);
    } else if (favIndex !== 0) {
      // My Fav exists but not at index 0, move it
      const favCat = window.allMoviesCategories.splice(favIndex, 1)[0];
      window.allMoviesCategories.unshift(favCat);
    }
  }

  // Increment loaded categories count
  moviesChunkLoadingState.loadedCategories += 1;

  // Restore scroll position
  pageContainer.scrollTop = currentScrollTop;
}

function removeMyFavCategory() {
  const favContainer = document.querySelector(".movies-fav-container");
  if (!favContainer) return;

  const pageContainer = document.querySelector(".movies-page-container");
  if (!pageContainer) return;

  // Save current scroll position
  const currentScrollTop = pageContainer.scrollTop;

  // Remove My Fav container
  favContainer.remove();

  // Shift all chunk loading states back by 1 index
  const oldChunks = {
    ...moviesChunkLoadingState.loadedChunks,
  };
  moviesChunkLoadingState.loadedChunks = {};

  Object.keys(oldChunks).forEach((key) => {
    const oldIndex = parseInt(key, 10);
    if (oldIndex === 0) return; // Skip My Fav (index 0)
    const newIndex = oldIndex - 1;
    moviesChunkLoadingState.loadedChunks[newIndex] = oldChunks[key];
  });

  // Update all category indices (shift them back by 1)
  const allCategoryLists = pageContainer.querySelectorAll(".movies-card-list");
  allCategoryLists.forEach((list) => {
    const currentIndex = parseInt(list.getAttribute("data-category"), 10);
    const newIndex = currentIndex - 1;
    list.setAttribute("data-category", newIndex);

    // Update all cards in this category
    const cards = list.querySelectorAll(".movie-card");
    cards.forEach((card) => {
      card.setAttribute("data-category", newIndex);
    });

    // Update loading indicators if any
    const loadingIndicator = list.querySelector(".movies-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.setAttribute("data-category", newIndex);
    }
  });

  // Adjust navigation state (shift back by 1)
  if (moviesNavigationState.currentCategoryIndex > 0) {
    moviesNavigationState.currentCategoryIndex -= 1;
  }
  if (moviesNavigationState.lastFocusedCategory > 0) {
    moviesNavigationState.lastFocusedCategory -= 1;
  }

  // Remove from window.allMoviesCategories
  if (window.allMoviesCategories && window.allMoviesCategories.length > 0) {
    const favIndex = window.allMoviesCategories.findIndex(
      (cat) => cat.id === "fav"
    );
    if (favIndex !== -1) {
      window.allMoviesCategories.splice(favIndex, 1);
    }
  }

  // Decrement loaded categories count
  if (moviesChunkLoadingState.loadedCategories > 0) {
    moviesChunkLoadingState.loadedCategories -= 1;
  }

  // Restore scroll position
  pageContainer.scrollTop = currentScrollTop;
}

function refreshMoviesFavoritesList() {
  const currentPlaylist = getCurrentPlaylist();
  const favIdsRaw = currentPlaylist
    ? currentPlaylist.favouriteMovies || []
    : [];
  const favIds = Array.isArray(favIdsRaw)
    ? favIdsRaw.map((id) => String(id))
    : [];
  favoriteMoviesIds = favIds; // Update global favorite IDs

  // This function now only updates favoriteMoviesIds
  // All UI updates are handled by updateMyFavCategoryRealtime()
}

function handleMoviesKeyNavigation(e) {
  let currentPage = localStorage.getItem("currentPage");
  let navigationFocus = localStorage.getItem("navigationFocus");

  if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
    return;
  }
  if (
    e &&
    e.target &&
    (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
  ) {
    return;
  }

  if (e.key === "Enter") {
    handleMoviesEnterKey(e);
    return;
  }

  const now = Date.now();
  if (
    now - moviesNavigationDebounce.lastKeyPress <
    moviesNavigationDebounce.debounceTime
  ) {
    e.preventDefault();
    return;
  }

  e.preventDefault();

  moviesNavigationDebounce.lastKeyPress = now;

  switch (e.key) {
    case "ArrowRight":
      moveMoviesRight();
      break;
    case "ArrowLeft":
      moveMoviesLeft();
      break;
    case "ArrowDown":
      moveMoviesDown();
      break;
    case "ArrowUp":
      moveMoviesUp();
      break;
    case "Escape":
    case "Back":
    case "BrowserBack":
    case "XF86Back":
    case "SoftLeft":
    case "Backspace":
    case 10009:
      moviesNavigationState.currentCategoryIndex = 0;
      moviesNavigationState.currentCardIndex = 0;

      const moviesContainer = document.querySelector(".movies-page-container");
      if (moviesContainer) {
        moviesContainer.scrollTop = 0;
      }

      const navbarEl = document.querySelector("#navbar-root");
      if (navbarEl) {
        navbarEl.style.display = "block";
      }
      break;
  }

  updateMoviesFocus();
  saveMoviesNavigationState();
}

function cleanupMoviesNavigation() {
  document.removeEventListener("keydown", handleMoviesKeyNavigation);
  document.removeEventListener("keyup", handleMoviesKeyNavigation);
  isMoviesNavigationInitialized = false;
  moviesNavigationDebounce.lastKeyPress = 0;
  moviesNavigationDebounce.isDebouncing = false;

  // Clear any pending timeouts
  if (moviesEnterKeyState.timeoutId) {
    clearTimeout(moviesEnterKeyState.timeoutId);
    moviesEnterKeyState.timeoutId = null;
  }
  moviesEnterKeyState.isPressed = false;
}

function getMoviesCurrentVisibleIndex(categoryIndex, cardIndex) {
  let cardList = document.querySelector(
    '.movies-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) return 0;

  let containerWidth = cardList.offsetWidth;
  let firstCard = cardList.querySelector(".movie-card");
  if (!firstCard) return 0;

  let cardWidth = firstCard.offsetWidth + 16;
  let visibleCardsCount = Math.floor(containerWidth / cardWidth);

  // Clamp to last visible card index
  if (cardIndex >= visibleCardsCount) {
    return visibleCardsCount - 1;
  }

  return cardIndex;
}

function moveMoviesRight() {
  if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
    return;
  }

  let currentCategory = getCurrentMoviesCategory();
  if (!currentCategory) return;

  let loadedCount = getMoviesLoadedChunkCount(
    moviesNavigationState.currentCategoryIndex
  );
  let totalMovies = currentCategory.movies ? currentCategory.movies.length : 0;

  if (moviesNavigationState.currentCardIndex < loadedCount - 1) {
    moviesNavigationState.currentCardIndex++;
  } else {
    if (loadedCount < totalMovies) {
      loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
    }
  }

  moviesNavigationState.lastFocusedCategory =
    moviesNavigationState.currentCategoryIndex;
  moviesNavigationState.lastFocusedCard =
    moviesNavigationState.currentCardIndex;
}

function moveMoviesLeft() {
  if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
    return;
  }

  if (moviesNavigationState.currentCardIndex > 0) {
    moviesNavigationState.currentCardIndex--;
  }

  moviesNavigationState.lastFocusedCategory =
    moviesNavigationState.currentCategoryIndex;
  moviesNavigationState.lastFocusedCard =
    moviesNavigationState.currentCardIndex;
}

function moveMoviesDown() {
  let allCategories = window.allMoviesCategories || [];
  if (allCategories.length === 0) return;

  let currentIndex = moviesNavigationState.currentCategoryIndex;
  let currentCardIndex = moviesNavigationState.currentCardIndex;

  let nextCategoryIndex = findNextMoviesCategoryWithMovies(currentIndex + 1, 1);

  if (nextCategoryIndex > 2) {
    const navbarEl = document.querySelector("#navbar-root");
    if (navbarEl) {
      navbarEl.style.display = "none";
    }
  }

  if (nextCategoryIndex !== -1) {
    moviesNavigationState.currentCategoryIndex = nextCategoryIndex;

    let newCategory = getCurrentMoviesCategory();
    if (newCategory) {
      let loadedCount = getMoviesLoadedChunkCount(
        moviesNavigationState.currentCategoryIndex
      );

      let visiblePosition = getMoviesCurrentVisibleIndex(
        currentIndex,
        currentCardIndex
      );
      moviesNavigationState.currentCardIndex =
        loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
    } else {
      moviesNavigationState.currentCardIndex = 0;
    }

    let loadedCategoriesCount = moviesChunkLoadingState.loadedCategories;
    if (
      moviesNavigationState.currentCategoryIndex >=
      loadedCategoriesCount - 2
    ) {
      loadMoreMoviesCategories();
    }
  } else {
    // Try to load more categories if we are at the bottom
    loadMoreMoviesCategories();

    let currentCategory = getCurrentMoviesCategory();
    if (currentCategory && currentCategory.movies) {
      let loadedCount = getMoviesLoadedChunkCount(currentIndex);
      let totalMovies = currentCategory.movies.length;
      if (loadedCount < totalMovies) {
        loadMoreMoviesForCategory(currentIndex);
      }
    }
  }
}

function moveMoviesUp() {
  let currentIndex = moviesNavigationState.currentCategoryIndex;
  let currentCardIndex = moviesNavigationState.currentCardIndex;

  let prevCategoryIndex = findNextMoviesCategoryWithMovies(
    currentIndex - 1,
    -1
  );

  if (prevCategoryIndex !== -1) {
    moviesNavigationState.currentCategoryIndex = prevCategoryIndex;

    let newCategory = getCurrentMoviesCategory();
    if (newCategory) {
      let loadedCount = getMoviesLoadedChunkCount(
        moviesNavigationState.currentCategoryIndex
      );

      let visiblePosition = getMoviesCurrentVisibleIndex(
        currentIndex,
        currentCardIndex
      );
      moviesNavigationState.currentCardIndex =
        loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
    } else {
      moviesNavigationState.currentCardIndex = 0;
    }
  } else {
    try {
      const moviesContainer = document.querySelector(".movies-page-container");
      if (moviesContainer) {
        moviesContainer.scrollTop = 0;
      }

      const navbarEl = document.querySelector("#navbar-root");
      if (navbarEl) {
        navbarEl.style.display = "block";
      }
    } catch (e) {
      console.log("Movies scroll to top failed:", e);
    }

    removeAllMoviesFocus();
    saveMoviesNavigationState();
    localStorage.setItem("navigationFocus", "navbar");

    setTimeout(() => {
      const moviesNavItem = document.querySelector(
        '.nav-item[data-page="moviesPage"]'
      );
      if (moviesNavItem) {
        moviesNavItem.focus();
        moviesNavItem.classList.add("active");
      }
    }, 50);
  }
}

function loadMoreMoviesForCategory(categoryIndex) {
  if (moviesChunkLoadingState.isLoading) return;

  let categories = window.allMoviesCategories || [];
  if (categoryIndex < 0 || categoryIndex >= categories.length) return;

  let category = categories[categoryIndex];
  if (!category) return;

  let loadedCount = getMoviesLoadedChunkCount(categoryIndex);
  let totalMovies = category.movies ? category.movies.length : 0;

  if (loadedCount >= totalMovies) {
    let cardList = document.querySelector(
      '.movies-card-list[data-category="' + categoryIndex + '"]'
    );
    if (cardList) {
      let loadingEl = cardList.querySelector(".movies-loading-indicator");
      if (loadingEl) {
        loadingEl.remove();
      }
    }
    return;
  }

  moviesChunkLoadingState.isLoading = true;

  let cardList = document.querySelector(
    '.movies-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) {
    moviesChunkLoadingState.isLoading = false;
    return;
  }

  let existingLoading = cardList.querySelector(".movies-loading-indicator");
  if (existingLoading) {
    existingLoading.remove();
  }

  cardList.insertAdjacentHTML(
    "beforeend",
    createMoviesLoadingIndicator(categoryIndex)
  );

  let safetyTimeout = setTimeout(function () {
    if (moviesChunkLoadingState.isLoading) {
      console.warn(
        "loadMoreMoviesForCategory: Safety timeout triggered, resetting loading state"
      );
      moviesChunkLoadingState.isLoading = false;
      let cardList = document.querySelector(
        '.movies-card-list[data-category="' + categoryIndex + '"]'
      );
      if (cardList) {
        let loadingEl = cardList.querySelector(".movies-loading-indicator");
        if (loadingEl) {
          loadingEl.remove();
        }
      }
    }
  }, 3000);

  setTimeout(function () {
    try {
      let cardList = document.querySelector(
        '.movies-card-list[data-category="' + categoryIndex + '"]'
      );
      if (!cardList) {
        clearTimeout(safetyTimeout);
        moviesChunkLoadingState.isLoading = false;
        return;
      }

      let newCardsHTML = loadMoviesChunk(category, categoryIndex);

      let loadingEl = cardList.querySelector(".movies-loading-indicator");
      if (loadingEl) {
        loadingEl.remove();
      }

      if (newCardsHTML) {
        cardList.insertAdjacentHTML("beforeend", newCardsHTML);

        if (moviesNavigationState.currentCategoryIndex === categoryIndex) {
          updateMoviesFocus();
        }
      }

      clearTimeout(safetyTimeout);
      moviesChunkLoadingState.isLoading = false;
    } catch (e) {
      console.error("Error in loadMoreMoviesForCategory:", e);
      clearTimeout(safetyTimeout);
      moviesChunkLoadingState.isLoading = false;

      let cardList = document.querySelector(
        '.movies-card-list[data-category="' + categoryIndex + '"]'
      );
      if (cardList) {
        let loadingEl = cardList.querySelector(".movies-loading-indicator");
        if (loadingEl) {
          loadingEl.remove();
        }
      }
    }
  }, 30);
}

function removeAllMoviesFocus() {
  let allCards = document.querySelectorAll(".movie-card");
  for (let i = 0; i < allCards.length; i++) {
    allCards[i].classList.remove("focused");

    let titleElement = allCards[i].querySelector(".movie-title-marquee");
    if (titleElement) {
      titleElement.classList.remove("marquee-active");
    }
  }
}

function updateMoviesFocus() {
  removeAllMoviesFocus();

  let navigationFocus = localStorage.getItem("navigationFocus");
  if (navigationFocus === "moviesPage") {
    if (moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
      let currentCard = document.querySelector(
        '.movie-card[data-category="' +
          moviesNavigationState.currentCategoryIndex +
          '"][data-index="' +
          moviesNavigationState.currentCardIndex +
          '"]'
      );

      if (currentCard) {
        currentCard.classList.add("focused");
        scrollToMoviesElement(currentCard);

        // Show navbar when focused on first category (any card in category 0)
        const navbarEl = document.querySelector("#navbar-root");
        if (navbarEl) {
          if (moviesNavigationState.currentCategoryIndex === 0) {
            navbarEl.style.display = "block";
          } else {
            navbarEl.style.display = "none";
          }
        }

        // Conditional Marquee
        const title = currentCard.querySelector(".movie-title-marquee");
        if (title) {
          title.classList.remove("marquee-active");
          if (title.scrollWidth > title.clientWidth) {
            title.classList.add("marquee-active");
          }
        }

        moviesNavigationState.lastFocusedCategory =
          moviesNavigationState.currentCategoryIndex;
        moviesNavigationState.lastFocusedCard =
          moviesNavigationState.currentCardIndex;

        activateMoviesMarquee(currentCard);
      }
    }
  }
}

function activateMoviesMarquee(card) {
  if (!card) return;

  let titleElement = card.querySelector(".movie-title-marquee");
  if (!titleElement) return;

  let container = titleElement.parentElement;
  if (!container) return;

  if (titleElement.scrollWidth > container.offsetWidth) {
    titleElement.classList.add("marquee-active");
  } else {
    titleElement.classList.remove("marquee-active");
  }
}

function scrollToMoviesElement(element) {
  if (!element) return;

  try {
    document.body.scrollTop = 30;
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  } catch (e) {
    try {
      element.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    } catch (finalError) {
      try {
        element.scrollIntoView();
      } catch (error) {
        console.log("Movies scroll failed");
      }
    }
  }
}

function saveMoviesNavigationState() {
  try {
    localStorage.setItem(
      "moviesNavState",
      JSON.stringify({
        currentCategoryIndex: moviesNavigationState.currentCategoryIndex,
        currentCardIndex: moviesNavigationState.currentCardIndex,
        lastFocusedCategory: moviesNavigationState.lastFocusedCategory,
        lastFocusedCard: moviesNavigationState.lastFocusedCard,
      })
    );
  } catch (e) {
    console.log("Error saving movies navigation state:", e);
  }
}

function restoreMoviesNavigationState() {
  try {
    let saved = localStorage.getItem("moviesNavState");
    if (saved) {
      let state = JSON.parse(saved);
      moviesNavigationState.currentCategoryIndex =
        state.currentCategoryIndex || 0;
      moviesNavigationState.currentCardIndex = state.currentCardIndex || 0;
      moviesNavigationState.lastFocusedCategory =
        state.lastFocusedCategory || 0;
      moviesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;

      // Show the same loader that was used initially
      const pageEl = document.getElementById("movies-page");
      if (pageEl) {
        const loader = document.createElement("div");
        loader.id = "movies-page-loader";
        loader.className = "custom-page-loader";
        loader.innerHTML = `
          <div class="custom-loader-content">
            <div class="custom-loader-spinner"></div>
          </div>
        `;
        pageEl.appendChild(loader);
      }

      setTimeout(() => {
        validateAndAdjustRestoredMoviesState();
      }, 100);
    }
  } catch (e) {
    console.log("Error restoring movies navigation state:", e);
  }
}

function doesMoviesCardExist(categoryIndex, cardIndex) {
  let cardList = document.querySelector(
    '.movies-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) return false;

  let card = cardList.querySelector(
    '.movie-card[data-index="' + cardIndex + '"]'
  );
  return card !== null;
}

function validateAndAdjustRestoredMoviesState() {
  let targetCategoryIndex = moviesNavigationState.currentCategoryIndex;
  let targetCardIndex = moviesNavigationState.currentCardIndex;
  let allCategories = window.allMoviesCategories || [];

  // 1. Ensure Category is Loaded
  if (!moviesCategoryHasMovies(targetCategoryIndex)) {
    if (targetCategoryIndex < allCategories.length) {
      let container = document.querySelector(".movies-page-container");
      if (container) {
        let currentLoaded = moviesChunkLoadingState.loadedCategories;
        for (let i = currentLoaded; i <= targetCategoryIndex + 2; i++) {
          if (i >= allCategories.length) break;
          let category = allCategories[i];
          if (
            (category.movies && category.movies.length > 0) ||
            category.id === "fav"
          ) {
            let categoryHTML = createMoviesCategorySection(category, i);
            let noResults = container.querySelector(".no-more-categories");
            if (noResults) noResults.remove();

            container.insertAdjacentHTML("beforeend", categoryHTML);
          }
        }
        moviesChunkLoadingState.loadedCategories = Math.max(
          moviesChunkLoadingState.loadedCategories,
          targetCategoryIndex + 3
        );
      }
    }
  }

  // 2. Ensure Card is Loaded (Horizontal)
  if (moviesCategoryHasMovies(targetCategoryIndex)) {
    let currentCategory = allCategories[targetCategoryIndex];
    let loadedCount = getMoviesLoadedChunkCount(targetCategoryIndex);

    if (targetCardIndex >= loadedCount) {
      let cardList = document.querySelector(
        '.movies-card-list[data-category="' + targetCategoryIndex + '"]'
      );
      if (cardList) {
        while (
          getMoviesLoadedChunkCount(targetCategoryIndex) <= targetCardIndex
        ) {
          let newCardsHTML = loadMoviesChunk(
            currentCategory,
            targetCategoryIndex
          );
          if (!newCardsHTML) break;

          let loadingEl = cardList.querySelector(".movies-loading-indicator");
          if (loadingEl) loadingEl.remove();
          cardList.insertAdjacentHTML("beforeend", newCardsHTML);
        }
      }
    }
  }

  // 3. Final Validation
  if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
    let nextCategoryIndex = findNextMoviesCategoryWithMovies(0, 1);
    if (nextCategoryIndex !== -1) {
      moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
      moviesNavigationState.currentCardIndex = 0;
    } else {
      moviesNavigationState.currentCategoryIndex = 0;
      moviesNavigationState.currentCardIndex = 0;
    }
  } else {
    let currentCategory = getCurrentMoviesCategory();
    if (currentCategory) {
      let loadedCount = getMoviesLoadedChunkCount(
        moviesNavigationState.currentCategoryIndex
      );

      if (moviesNavigationState.currentCardIndex >= loadedCount) {
        moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
      }

      if (
        !doesMoviesCardExist(
          moviesNavigationState.currentCategoryIndex,
          moviesNavigationState.currentCardIndex
        ) &&
        loadedCount < currentCategory.movies.length
      ) {
        loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
      }
    }
  }

  setTimeout(() => {
    updateMoviesFocus();
    const loader = document.getElementById("movies-page-loader");
    if (loader) {
      loader.remove();
    }
  }, 50);
}

function getCurrentMoviesCategory() {
  let categories = window.allMoviesCategories || [];
  return categories[moviesNavigationState.currentCategoryIndex];
}

function initMoviesNavigation() {
  if (isMoviesNavigationInitialized) {
    cleanupMoviesNavigation();
  }

  document.addEventListener("keydown", handleMoviesKeyNavigation);
  document.addEventListener("keyup", handleMoviesKeyNavigation);
  isMoviesNavigationInitialized = true;
}

function hasAnyMoviesCategoryData() {
  let categories = window.allMoviesCategories || [];
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].movies && categories[i].movies.length > 0) {
      return true;
    }
  }
  return false;
}

function validateMoviesData() {
  // Clean up window.allMoviesStreams
  if (window.allMoviesStreams && Array.isArray(window.allMoviesStreams)) {
    window.allMoviesStreams = window.allMoviesStreams.filter(
      (movie) =>
        movie !== null && movie !== undefined && typeof movie === "object"
    );
  }

  // Clean up window.moviesCategories
  if (window.moviesCategories && Array.isArray(window.moviesCategories)) {
    window.moviesCategories = window.moviesCategories.filter(
      (category) =>
        category !== null &&
        category !== undefined &&
        typeof category === "object"
    );
  }
}

function MoviesPage() {
  validateMoviesData();

  // Get current sort option
  const currentSort = localStorage.getItem("sortvalue") || "default";

  // Check if there's no initial data and return early
  if (
    window.moviesCategories.length == 0 ||
    window.allMoviesStreams.length == 0
  ) {
    let loadingHTML = `
      <div class="movies-page-container">
        <div class="no-data-container">
          <div class="no-data-content">
            <h2>No Data Available</h2>
            <p>No movies found</p>
          </div>
        </div>
      </div>
    `;

    localStorage.setItem(
      "previousPage",
      localStorage.getItem("currentPage") || ""
    );
    localStorage.setItem("currentPage", "moviesPage");
    const activeEl = document.activeElement;
    const isSearchFocused = activeEl && activeEl.id === "search-input";
    if (!isSearchFocused) {
      localStorage.setItem("navigationFocus", "moviesPage");
    }

    return loadingHTML;
  }

  let loadingHTML =
    '<div id="movies-page-loader" class="custom-page-loader">' +
    '<div class="custom-loader-content">' +
    '<div class="custom-loader-spinner"></div>' +
    "</div>" +
    "</div>";

  localStorage.setItem(
    "previousPage",
    localStorage.getItem("currentPage") || ""
  );
  localStorage.setItem("currentPage", "moviesPage");
  const activeEl = document.activeElement;
  const isSearchFocused = activeEl && activeEl.id === "search-input";
  if (!isSearchFocused) {
    localStorage.setItem("navigationFocus", "moviesPage");
  }

  favoriteMoviesIds = [];

  setTimeout(function () {
    const currentPlaylist = getCurrentPlaylist();
    const currentPlaylistFavIds = currentPlaylist
      ? currentPlaylist.favouriteMovies
      : [];

    favoriteMoviesIds = currentPlaylistFavIds || [];

    let favouriteMovies =
      window.allMoviesStreams && currentPlaylistFavIds
        ? filterStreamsByQuery(
            window.allMoviesStreams.filter(
              (m) => m && currentPlaylistFavIds.includes(m.stream_id)
            )
          )
        : [];

    let popularMovies = window.allMoviesStreams
      ? filterStreamsByQuery(
          window.allMoviesStreams.filter((m) => m && m.rating_5based > 4)
        ).slice(0, 10)
      : [];

    let recentlyWatchedMoviesIds =
      currentPlaylist && currentPlaylist.continueWatchingMovies
        ? currentPlaylist.continueWatchingMovies
            .filter((m) => m !== null && m !== undefined)
            .map((item) => item.itemId)
        : [];

    let recentMoviesArray =
      window.allMoviesStreams && recentlyWatchedMoviesIds
        ? filterStreamsByQuery(
            window.allMoviesStreams.filter((m) =>
              recentlyWatchedMoviesIds.includes(m.stream_id.toString())
            )
          )
        : [];

    // Pass current sort option to getAPICategories
    let apiCategories = getAPICategories(currentSort);

    // ALWAYS show these three categories at the top, in this specific order
    let fixedTopCategories = [
      {
        title: "My Fav",
        movies: favouriteMovies,
        id: "fav",
        containerClass: "movies-fav-container",
      },
      {
        title: "Popular Movies",
        movies: popularMovies,
        id: "popular",
        containerClass: "movies-popular-container",
      },
      {
        title: "Recently Watched",
        movies: recentMoviesArray,
        id: "recent",
        containerClass: "recently-watched-container",
      },
    ];

    // Remove any fixed categories that have no movies (except My Fav which can be empty)
    let initialCategories = fixedTopCategories.filter((category) => {
      // if (category.id === "fav") return true; // Always show My Fav even if empty
      return category.movies && category.movies.length > 0;
    });

    // Add the first few API categories after the fixed ones
    let apiCategoriesToLoad = apiCategories.slice(0, 3);
    initialCategories = initialCategories.concat(apiCategoriesToLoad);

    // Set up the complete categories list (fixed top + all API categories)
    window.allMoviesCategories = initialCategories.concat(
      apiCategories.slice(3)
    );

    moviesChunkLoadingState.loadedCategories = initialCategories.length;
    moviesChunkLoadingState.loadedChunks = {};
    moviesChunkLoadingState.isLoading = false;

    if (!hasAnyMoviesCategoryData()) {
      let noDataHTML =
        '<div class="movies-page-container">' +
        (getMoviesSearchQuery()
          ? createMoviesNoSearchMessage()
          : createMoviesNoDataMessage("movies")) +
        "</div>";
      const loadingEl = document.querySelector("#movies-page-loader");
      if (loadingEl) {
        loadingEl.outerHTML = noDataHTML;
      } else {
        const pageEl = document.getElementById("movies-page");
        if (pageEl) pageEl.innerHTML = noDataHTML;
      }
      return;
    }

    let html = '<div class="movies-page-container">';

    for (let i = 0; i < initialCategories.length; i++) {
      let category = initialCategories[i];
      if (
        (category.movies && category.movies.length > 0) ||
        category.id === "fav"
      ) {
        html += createMoviesCategorySection(category, i);
      }
    }

    let hasMoreCategories = false;
    for (
      let i = initialCategories.length;
      i < window.allMoviesCategories.length;
      i++
    ) {
      let category = window.allMoviesCategories[i];
      if (category && category.movies && category.movies.length > 0) {
        hasMoreCategories = true;
        break;
      }
    }

    // Removed loading indicator - categories load quickly enough without it

    html += "</div>";

    let container = document.querySelector("#movies-page-loader");
    if (container) {
      container.outerHTML = html;
    }

    restoreMoviesNavigationState();

    setTimeout(function () {
      initMoviesNavigation();
    }, 100);
  }, 500);

  return loadingHTML;
}

document.addEventListener("sortChanged", function (e) {
  const { sortType, page } = e.detail;

  if (page === "moviesPage") {
    // Refresh movies page with new sort
    if (typeof window.rerenderMoviesPage === "function") {
      Router.showPage("moviesPage");
    }
  }
});

window.cleanupMoviesNavigation = cleanupMoviesNavigation;
window.moviesNavigationState = moviesNavigationState;
window.updateMoviesFocus = updateMoviesFocus;
window.saveMoviesNavigationState = saveMoviesNavigationState;
window.rerenderMoviesPage = MoviesPage;
