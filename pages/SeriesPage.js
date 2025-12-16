let seriesNavigationState = {
  currentCategoryIndex: 0,
  currentCardIndex: 0,
  lastFocusedCategory: 0,
  lastFocusedCard: 0,
};

let allSeriesStreamsData = window.allSeriesStreams || [];
let favoriteSeriesIds = [];
const unlockedSeriesAdultIds = new Set();

const isSeriesAdult = (name) => {
  const normalized = (name || "").trim().toLowerCase();
  const configured = window.adultsCategories || [];
  if (configured.includes(normalized)) return true;
  return /(adult|xxx|18\+|18\s*plus|sex|porn|nsfw)/i.test(normalized);
};

window.resetSeriesParentalState = () => {
  unlockedSeriesAdultIds.clear();
};

let isSeriesNavigationInitialized = false;

let seriesChunkLoadingState = {
  loadedCategories: 0,
  categoryChunkSize: 4,
  loadedChunks: {},
  horizontalChunkSize: 12,
  isLoading: false,
};

let seriesEnterKeyState = {
  isPressed: false,
  pressStartTime: 0,
  longPressThreshold: 400,
  timeoutId: null,
};

let seriesNavigationDebounce = {
  lastKeyPress: 0,
  debounceTime: 300,
  isDebouncing: false,
};

function normalizeTextSeries(s) {
  return (s || "").toLowerCase();
}

function getSeriesSearchQuery() {
  return normalizeTextSeries(window.searchQuery || "");
}

function filterSeriesByQuery(streams) {
  const q = getSeriesSearchQuery();
  if (!q) return streams;
  return (streams || []).filter((s) =>
    normalizeTextSeries(s && s.name).includes(q)
  );
}

function formatSeriesData(seriesStream) {
  if (!seriesStream) return null;

  console.log(seriesStream, "seriesStreamseriesStream");

  return {
    id: seriesStream.series_id || seriesStream.num,
    series_id: seriesStream.series_id,
    title: seriesStream.name || "Unknown",
    genre: seriesStream.category_name || "Series",
    year: formatSeriesYear(seriesStream.added),
    image:
      seriesStream.cover ||
      seriesStream.stream_icon ||
      "./assets/demo-img-card.png",
    rating: seriesStream.rating_5based ? seriesStream.rating_5based : "0",
    seasons: seriesStream.seasons || "1",
    category_id: seriesStream.category_id ? seriesStream.category_id : null,
  };
}

function formatSeriesYear(timestamp) {
  if (!timestamp) return "Unknown";
  try {
    return new Date(Number(timestamp) * 1000).getFullYear().toString();
  } catch (e) {
    return "Unknown";
  }
}

function formatSeriesSeasons(series) {
  return (series.seasons || "1") + " Seasons";
}

function getFavoriteSeries() {
  try {
    const username = getCurrentPlaylistUsername();
    if (!username) return [];

    const playlists = getPlaylistsData();
    const playlist = playlists.find((p) => p.playlistName === username);

    if (playlist && playlist.series) {
      console.log(playlist.series, "PLAYLIST SERIES");
      return playlist.series.map((id) => id.toString());
    }

    return [];
  } catch (e) {
    console.error("Error getting favorite series:", e);
    return [];
  }
}

function getRecentlyWatchedSeries() {
  try {
    let username = window.getCurrentPlaylistUsername
      ? window.getCurrentPlaylistUsername()
      : null;
    if (!username) return [];

    let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
    for (let i = 0; i < playlists.length; i++) {
      if (playlists[i].playlistUsername === username) {
        let recent = playlists[i].continueWatchingSeries || [];
        return recent
          .slice(0, 15)
          .map(formatSeriesData)
          .filter((s) => s !== null);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

function getPopularSeries() {
  try {
    if (allSeriesStreamsData.length === 0) return [];

    let sorted = allSeriesStreamsData.slice(0, 50);
    console.log(sorted, "SORTED");
    sorted.sort(function (a, b) {
      return (
        (parseFloat(b.rating_5based) || 0) - (parseFloat(a.rating_5based) || 0)
      );
    });

    return sorted
      .slice(0, 30)
      .map(formatSeriesData)
      .filter((s) => s !== null);
  } catch (e) {
    return [];
  }
}

function getAPISeriesCategories(sortType = "default") {
  let allSeriesCategoriesData = window.allseriesCategories || [];
  let allSeriesStreamsData = window.allSeriesStreams || [];

  if (
    allSeriesCategoriesData.length === 0 ||
    allSeriesStreamsData.length === 0
  ) {
    return [];
  }

  let categories = [];
  for (let i = 0; i < allSeriesCategoriesData.length; i++) {
    let category = allSeriesCategoriesData[i];
    let series = [];

    for (let j = 0; j < allSeriesStreamsData.length; j++) {
      let stream = allSeriesStreamsData[j];
      if (stream.category_id == category.category_id) {
        series.push(stream);
      }
    }
    series = filterSeriesByQuery(series).slice(0, 50);

    categories.push({
      title: category.category_name || "Category",
      series: series,
      id: category.category_id,
      containerClass: "series-category-container",
      category_id: category.category_id,
    });
  }

  // Apply sorting based on selected sort option
  return sortSeriesCategories(categories, sortType);
}

function sortSeriesCategories(categories, sortType) {
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
      // Top Rated - sort by average rating of series in category
      return categories.sort((a, b) => {
        const avgRatingA =
          a.series && a.series.length > 0
            ? a.series.reduce(
                (sum, series) => sum + (parseFloat(series.rating_5based) || 0),
                0
              ) / a.series.length
            : 0;
        const avgRatingB =
          b.series && b.series.length > 0
            ? b.series.reduce(
                (sum, series) => sum + (parseFloat(series.rating_5based) || 0),
                0
              ) / b.series.length
            : 0;
        return avgRatingB - avgRatingA;
      });

    case "default":
    default:
      // Default - return as is (no sorting)
      return categories;
  }
}

function createSeriesCard(seriesData, size, categoryIndex, seriesIndex) {
  let isLarge = size === "large";
  let cardClass = isLarge ? "series-card series-card-large" : "series-card";
  let seriesId = String(seriesData.series_id || seriesData.id);

  let isSeriesFav =
    Array.isArray(favoriteSeriesIds) &&
    favoriteSeriesIds.some((favId) => String(favId) === String(seriesId));

  let imageUrl = seriesData.image || "./assets/demo-img-card.png";
  let titleClass = "series-title-marquee";

  let currentCardCategory = window.allseriesCategories
    ? window.allseriesCategories.filter(
        (cat) => cat.category_id == seriesData.category_id
      )
    : [];

  let categoryName =
    currentCardCategory.length > 0
      ? currentCardCategory[0].category_name
      : seriesData.genre || "Series";

  const isAdult =
    isSeriesAdult(seriesData.genre) || isSeriesAdult(categoryName);
  const currentPlaylist = getCurrentPlaylist();
  const hasParentalPassword =
    currentPlaylist && currentPlaylist.parentalPassword;
  const isLocked = isAdult && !unlockedSeriesAdultIds.has(String(seriesId));

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
            data-index="${seriesIndex}" 
            data-series-id="${seriesId}" 
            data-is-adult="${isAdult}"
            data-is-locked="${isLocked}"
            style="background-image: url('${
              imageUrl ? imageUrl : "./assets/demo-img-card.png"
            }')">
            ${overlayHtml}
            <div class="series-card-content">
                <div class="series-card-top">
                    <img src="./assets/heartIcon.png" 
                         style="display: ${isSeriesFav ? "block" : "none"}" 
                         alt="Favorite" 
                         class="series-card-heart" />
                </div>
                <div class="series-card-play-div">
                    <img src="./assets/card-play-icon.png" alt="Play" class="series-card-play" />
                </div>
                <div class="series-card-bottom">
                    <div class="series-card-bottom-left">
                        <h3>${categoryName}</h3>
                        <h2 class="${titleClass}">${
    seriesData.title || "Unknown"
  }</h2>
                    </div>
                    <div class="series-card-bottom-right">
                        <h3>-</h3>
                    <span class="movie-card-rating"> <img src="./assets/rating-star.png" class="movie-card-star-icon" />${
                      seriesData.rating ? seriesData.rating : "0"
                    }</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function createSeriesLoadingIndicator(categoryIndex) {
  return (
    '<div class="series-loading-indicator" data-category="' +
    categoryIndex +
    '">' +
    "<p>Loading...</p>" +
    "</div>"
  );
}

function getSeriesLoadedChunkCount(categoryIndex) {
  return seriesChunkLoadingState.loadedChunks[categoryIndex] || 0;
}

function setSeriesLoadedChunkCount(categoryIndex, count) {
  seriesChunkLoadingState.loadedChunks[categoryIndex] = count;
}

function loadSeriesChunk(category, categoryIndex) {
  if (!category || !category.series || category.series.length === 0) return "";

  let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
  let chunkSize = seriesChunkLoadingState.horizontalChunkSize;
  let totalSeries = category.series.length;

  if (loadedCount >= totalSeries) return "";

  let endIndex = Math.min(loadedCount + chunkSize, totalSeries);
  let cardsHTML = "";

  for (let i = loadedCount; i < endIndex; i++) {
    let seriesData = formatSeriesData(category.series[i]);
    if (!seriesData) continue;

    let size = category.id === "popular" ? "large" : "normal";
    cardsHTML += createSeriesCard(seriesData, size, categoryIndex, i);
  }

  setSeriesLoadedChunkCount(categoryIndex, endIndex);
  return cardsHTML;
}

function seriesCategoryHasSeries(categoryIndex) {
  let categories = window.allSeriesCategories || [];
  let category = categories[categoryIndex];

  if (!category) {
    return false;
  }

  // Check if the category exists in the DOM and has cards
  let cardList = document.querySelector(
    '.series-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) {
    return false;
  }

  // Check if there are actual card elements in the DOM
  let cardsInDOM = cardList.querySelectorAll(".series-card");
  if (cardsInDOM.length > 0) {
    return true;
  }

  // Fallback: check the data structure
  if (!category.series || category.series.length === 0) {
    return false;
  }

  let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
  return loadedCount > 0;
}

function findNextSeriesCategoryWithSeries(startIndex, direction) {
  let allCategories = window.allSeriesCategories || [];

  if (direction === 1) {
    for (let i = startIndex; i < allCategories.length; i++) {
      if (seriesCategoryHasSeries(i)) {
        return i;
      }
    }
  } else {
    for (let i = startIndex; i >= 0; i--) {
      if (seriesCategoryHasSeries(i)) {
        return i;
      }
    }
  }

  return -1;
}

function loadMoreSeriesCategories() {
  if (seriesChunkLoadingState.isLoading) return;

  let allCategories = window.allSeriesCategories || [];
  let currentLoaded = seriesChunkLoadingState.loadedCategories;

  // If searching and no remaining categories have items, remove any indicator and stop
  const remainingHasItems = allCategories
    .slice(currentLoaded)
    .some(function (cat) {
      return cat && cat.series && cat.series.length > 0;
    });
  if (!remainingHasItems) {
    let container = document.querySelector(".series-page-container");
    if (container) {
      let categoriesLoading = container.querySelector(
        ".categories-loading-indicator"
      );
      if (categoriesLoading) categoriesLoading.remove();
    }
    seriesChunkLoadingState.isLoading = false;
    return;
  }

  if (currentLoaded >= allCategories.length) {
    let container = document.querySelector(".series-page-container");
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

  seriesChunkLoadingState.isLoading = true;

  let nextChunk = Math.min(
    currentLoaded + seriesChunkLoadingState.categoryChunkSize,
    allCategories.length
  );

  let safetyTimeout = setTimeout(function () {
    if (seriesChunkLoadingState.isLoading) {
      console.warn(
        "loadMoreSeriesCategories: Safety timeout triggered, resetting loading state"
      );
      seriesChunkLoadingState.isLoading = false;
      let container = document.querySelector(".series-page-container");
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
      let container = document.querySelector(".series-page-container");
      if (!container) {
        clearTimeout(safetyTimeout);
        seriesChunkLoadingState.isLoading = false;
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

        if (category.series && category.series.length > 0) {
          try {
            let categoryHTML = createSeriesCategorySection(category, i);
            container.insertAdjacentHTML("beforeend", categoryHTML);
            categoriesAdded++;
          } catch (e) {
            console.error("Error creating series category section:", e);
          }
        }
      }

      let hasMoreCategories = false;
      for (let i = nextChunk; i < allCategories.length; i++) {
        let category = allCategories[i];
        if (category && category.series && category.series.length > 0) {
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

      // Removed loading indicator - categories load quickly without needing it

      seriesChunkLoadingState.loadedCategories = nextChunk;
      clearTimeout(safetyTimeout);
      seriesChunkLoadingState.isLoading = false;

      if (categoriesAdded > 0) {
        updateSeriesFocus();
      }
    } catch (e) {
      console.error("Error in loadMoreSeriesCategories:", e);
      clearTimeout(safetyTimeout);
      seriesChunkLoadingState.isLoading = false;

      let container = document.querySelector(".series-page-container");
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

function createSeriesCategorySection(category, categoryIndex) {
  let size = category.id === "popular" ? "large" : "normal";

  let html = '<div class="' + category.containerClass + '">';
  html += "<h1>" + category.title + "</h1>";
  html +=
    '<div class="series-card-list ' +
    category.id +
    '-list" data-category="' +
    categoryIndex +
    '">';

  let initialSeries = loadSeriesChunk(category, categoryIndex);
  html += initialSeries;

  if (
    category.series &&
    category.series.length > getSeriesLoadedChunkCount(categoryIndex)
  ) {
    html += createSeriesLoadingIndicator(categoryIndex);
  }

  html += "</div>";
  html += "</div>";

  return html;
}

function createSeriesNoDataMessage(categoryTitle) {
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

function createSeriesNoSearchMessage() {
  return (
    '<div class="no-data-container">' +
    '<div class="no-data-content">' +
    "<h2>No Search Results Found</h2>" +
    "<p>Try a different query</p>" +
    "</div>" +
    "</div>"
  );
}

function handleSeriesEnterKey(e) {
  let currentPage = localStorage.getItem("currentPage");
  let navigationFocus = localStorage.getItem("navigationFocus");

  if (currentPage !== "seriesPage" || navigationFocus !== "seriesPage") {
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();

    if (e.type === "keydown") {
      seriesEnterKeyState.isPressed = true;
      seriesEnterKeyState.pressStartTime = Date.now();

      seriesEnterKeyState.timeoutId = setTimeout(function () {
        if (seriesEnterKeyState.isPressed) {
          handleSeriesLongPressEnter();
          seriesEnterKeyState.isPressed = false;
        }
      }, seriesEnterKeyState.longPressThreshold);
    } else if (e.type === "keyup") {
      if (seriesEnterKeyState.isPressed) {
        let pressDuration = Date.now() - seriesEnterKeyState.pressStartTime;

        if (pressDuration < seriesEnterKeyState.longPressThreshold) {
          clearTimeout(seriesEnterKeyState.timeoutId);
          handleSeriesSimpleEnter();
        }

        seriesEnterKeyState.isPressed = false;
      }
    }
  }
}

function handleSeriesSimpleEnter() {
  if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
    return;
  }

  let categoryIndex = seriesNavigationState.currentCategoryIndex;
  let cardIndex = seriesNavigationState.currentCardIndex;

  let currentCard = document.querySelector(
    '.series-card[data-category="' +
      categoryIndex +
      '"][data-index="' +
      cardIndex +
      '"]'
  );

  if (currentCard) {
    let seriesId = currentCard.getAttribute("data-series-id");

    const isAdult = currentCard.getAttribute("data-is-adult") === "true";
    const isLocked = currentCard.getAttribute("data-is-locked") === "true";
    const currentPlaylist = getCurrentPlaylist();
    const hasParentalPassword =
      currentPlaylist && currentPlaylist.parentalPassword;

    if (isAdult && isLocked) {
      if (hasParentalPassword) {
        ParentalPinDialog(
          () => {
            unlockedSeriesAdultIds.add(String(seriesId));
            const overlay = currentCard.querySelector(".adult-overlay");
            if (overlay) overlay.remove();
            currentCard.setAttribute("data-is-locked", "false");
            proceedToSeriesDetail(categoryIndex, cardIndex, seriesId);
          },
          () => {
            // Stay on page
          },
          currentPlaylist,
          "seriesPage"
        );
        return;
      } else {
        proceedToSeriesDetail(categoryIndex, cardIndex, seriesId);
        return;
      }
    }

    proceedToSeriesDetail(categoryIndex, cardIndex, seriesId);
  }
}

function proceedToSeriesDetail(categoryIndex, cardIndex, seriesId) {
  localStorage.setItem("seriesCategoryIndex", categoryIndex);
  localStorage.setItem("seriesCardIndex", cardIndex);
  localStorage.setItem("seriesSelectedCategoryId", categoryIndex);

  localStorage.setItem("selectedSeriesId", seriesId);

  const selectedSeriesItem = window.allSeriesStreams.find(
    (item) => item.series_id == seriesId
  );
  if (selectedSeriesItem) {
    localStorage.setItem(
      "selectedSeriesItem",
      JSON.stringify(selectedSeriesItem)
    );
  }

  cleanupSeriesNavigation();

  document.querySelector("#loading-progress").style.display = "none";

  localStorage.setItem("currentPage", "seriesDetailPage");
  localStorage.setItem("navigationFocus", "seriesDetailPage");

  Router.showPage("seriesDetailPage");
}

function handleSeriesLongPressEnter() {
  if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
    return;
  }

  let categoryIndex = seriesNavigationState.currentCategoryIndex;
  let cardIndex = seriesNavigationState.currentCardIndex;

  let currentCard = document.querySelector(
    '.series-card[data-category="' +
      categoryIndex +
      '"][data-index="' +
      cardIndex +
      '"]'
  );

  if (currentCard) {
    let seriesId = currentCard.getAttribute("data-series-id");

    // Save current scroll position
    const seriesContainer = document.querySelector(".series-page-container");
    const currentScrollTop = seriesContainer ? seriesContainer.scrollTop : 0;

    // Toggle favorite
    const result = toggleFavoriteItem(
      Number(seriesId),
      "favouriteSeries",
      getCurrentPlaylistUsername()
    );

    // Update ALL cards across ALL categories with the same series_id
    updateAllSeriesCardsHeartDisplay(seriesId, result.isFav);

    // Show toast
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast(
        result.isFav ? "success" : "error",
        result.isFav ? "Added to Favorites" : "Removed from Favorites"
      );
    }

    // Update My Fav category in real-time
    updateMyFavSeriesCategoryRealtime(
      seriesId,
      result.isFav,
      categoryIndex,
      cardIndex
    );

    // Restore scroll position
    if (seriesContainer) {
      seriesContainer.scrollTop = currentScrollTop;
    }

    // Maintain focus on the same card position
    setTimeout(() => {
      updateSeriesFocus();
    }, 50);

    saveSeriesNavigationState();
  }
}

function updateAllSeriesCardsHeartDisplay(seriesId, isFav) {
  // Update heart icon on ALL cards with this series_id across all categories
  document
    .querySelectorAll('.series-card[data-series-id="' + seriesId + '"]')
    .forEach(function (card) {
      const heartEl = card.querySelector(".series-card-heart");
      if (heartEl) {
        heartEl.style.display = isFav ? "block" : "none";
      }
    });
}

function updateMyFavSeriesCategoryRealtime(
  seriesId,
  isFav,
  currentCategoryIndex,
  currentCardIndex
) {
  const currentPlaylist = getCurrentPlaylist();
  const favIdsRaw = currentPlaylist
    ? currentPlaylist.favouriteSeries || []
    : [];
  const favIds = Array.isArray(favIdsRaw)
    ? favIdsRaw.map((id) => String(id))
    : [];
  favoriteSeriesIds = favIds;

  const favouriteSeries =
    window.allSeriesStreams && favIds.length
      ? window.allSeriesStreams.filter(
          (s) => s && favIds.includes(String(s.series_id))
        )
      : [];

  const isSearchMode = !!getSeriesSearchQuery();
  let favList = document.querySelector(".series-card-list.fav-list");
  let favContainer = document.querySelector(".series-fav-container");

  // If adding to favorites and My Fav section doesn't exist, create it
  if (isFav && !favContainer && !isSearchMode) {
    createMyFavSeriesCategory();
    favList = document.querySelector(".series-card-list.fav-list");
    favContainer = document.querySelector(".series-fav-container");
  }

  if (!favList) return;

  const favCategoryIndex = parseInt(favList.getAttribute("data-category"), 10);
  const isCurrentlyInFavCategory = currentCategoryIndex === favCategoryIndex;

  if (isFav) {
    // Adding to favorites - append new card to My Fav
    const newSeries = window.allSeriesStreams.find(
      (s) => s && String(s.series_id) === String(seriesId)
    );
    if (newSeries) {
      const seriesData = formatSeriesData(newSeries);
      if (seriesData) {
        const currentCards = favList.querySelectorAll(".series-card");
        const newIndex = currentCards.length;
        const cardHTML = createSeriesCard(
          seriesData,
          "normal",
          favCategoryIndex,
          newIndex
        );
        favList.insertAdjacentHTML("beforeend", cardHTML);

        // CRITICAL: Set chunk count to reflect actual loaded cards
        const updatedCards = favList.querySelectorAll(".series-card");
        setSeriesLoadedChunkCount(favCategoryIndex, updatedCards.length);

        // Update window.allSeriesCategories My Fav series array
        if (
          window.allSeriesCategories &&
          window.allSeriesCategories[favCategoryIndex]
        ) {
          if (!window.allSeriesCategories[favCategoryIndex].series) {
            window.allSeriesCategories[favCategoryIndex].series = [];
          }
          // Only add if not already in the array
          const existsInArray = window.allSeriesCategories[
            favCategoryIndex
          ].series.some((s) => s && String(s.series_id) === String(seriesId));
          if (!existsInArray) {
            window.allSeriesCategories[favCategoryIndex].series.push(newSeries);
          }
        }
      }
    }
  } else {
    // Removing from favorites
    const cardToRemove = favList.querySelector(
      '.series-card[data-series-id="' + seriesId + '"]'
    );

    if (cardToRemove) {
      cardToRemove.remove();

      // Reindex remaining cards in My Fav category
      const remainingCards = favList.querySelectorAll(".series-card");
      remainingCards.forEach((card, index) => {
        card.setAttribute("data-index", index);
      });

      setSeriesLoadedChunkCount(favCategoryIndex, remainingCards.length);

      // Update window.allSeriesCategories My Fav series array
      if (
        window.allSeriesCategories &&
        window.allSeriesCategories[favCategoryIndex]
      ) {
        window.allSeriesCategories[favCategoryIndex].series = favouriteSeries;
      }

      // If removed from My Fav category itself, adjust focus
      if (isCurrentlyInFavCategory) {
        if (remainingCards.length === 0) {
          // No more favorites - remove My Fav section and move to next category
          removeMyFavSeriesCategory();

          // After removal, find next available category (indices have shifted back)
          const nextIdx = findNextSeriesCategoryWithSeries(0, 1);
          seriesNavigationState.currentCategoryIndex =
            nextIdx !== -1 ? nextIdx : 0;
          seriesNavigationState.currentCardIndex = 0;
        } else {
          // Adjust focus to stay within bounds
          seriesNavigationState.currentCardIndex = Math.min(
            currentCardIndex,
            remainingCards.length - 1
          );
        }
      }
    }

    // If My Fav is now empty and not in search mode, remove the entire section
    if (favouriteSeries.length === 0 && !isSearchMode && favContainer) {
      removeMyFavSeriesCategory();

      // If focus was on My Fav, move to next available category
      if (isCurrentlyInFavCategory) {
        const nextIdx = findNextSeriesCategoryWithSeries(0, 1);
        seriesNavigationState.currentCategoryIndex =
          nextIdx !== -1 ? nextIdx : 0;
        seriesNavigationState.currentCardIndex = 0;
      }
    }
  }
}

function createMyFavSeriesCategory() {
  const pageContainer = document.querySelector(".series-page-container");
  if (!pageContainer) return;

  // Check if My Fav already exists
  const existingFav = document.querySelector(".series-fav-container");
  if (existingFav) return;

  // Save current scroll position
  const currentScrollTop = pageContainer.scrollTop;

  // Create My Fav category at the top (index 0)
  const favCategory = {
    title: "My Fav",
    series: [], // Will be populated by adding cards
    id: "fav",
    containerClass: "series-fav-container",
  };

  // Create the HTML structure for My Fav category
  let html = '<div class="' + favCategory.containerClass + '">';
  html += "<h1>" + favCategory.title + "</h1>";
  html += '<div class="series-card-list fav-list" data-category="0">';
  html += "</div>";
  html += "</div>";

  // Insert at the beginning of the page
  pageContainer.insertAdjacentHTML("afterbegin", html);

  // Shift all chunk loading states by 1 index
  const oldChunks = {
    ...seriesChunkLoadingState.loadedChunks,
  };
  seriesChunkLoadingState.loadedChunks = {};
  seriesChunkLoadingState.loadedChunks[0] = 0; // My Fav starts with 0 loaded

  Object.keys(oldChunks).forEach((key) => {
    const oldIndex = parseInt(key, 10);
    const newIndex = oldIndex + 1;
    seriesChunkLoadingState.loadedChunks[newIndex] = oldChunks[key];
  });

  // Update all existing category indices (shift them by 1)
  const allCategoryLists = pageContainer.querySelectorAll(
    ".series-card-list:not(.fav-list)"
  );
  allCategoryLists.forEach((list) => {
    const currentIndex = parseInt(list.getAttribute("data-category"), 10);
    const newIndex = currentIndex + 1;
    list.setAttribute("data-category", newIndex);

    // Update all cards in this category
    const cards = list.querySelectorAll(".series-card");
    cards.forEach((card) => {
      card.setAttribute("data-category", newIndex);
    });

    // Update loading indicators if any
    const loadingIndicator = list.querySelector(".series-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.setAttribute("data-category", newIndex);
    }
  });

  // Adjust current navigation state
  seriesNavigationState.currentCategoryIndex += 1;
  seriesNavigationState.lastFocusedCategory += 1;

  // Update window.allSeriesCategories to include My Fav at index 0
  if (window.allSeriesCategories && window.allSeriesCategories.length > 0) {
    // Check if My Fav already exists in the array
    const favIndex = window.allSeriesCategories.findIndex(
      (cat) => cat.id === "fav"
    );
    if (favIndex === -1) {
      // My Fav doesn't exist, add it at the beginning
      window.allSeriesCategories.unshift(favCategory);
    } else if (favIndex !== 0) {
      // My Fav exists but not at index 0, move it
      const favCat = window.allSeriesCategories.splice(favIndex, 1)[0];
      window.allSeriesCategories.unshift(favCat);
    }
  }

  // Increment loaded categories count
  seriesChunkLoadingState.loadedCategories += 1;

  // Restore scroll position
  pageContainer.scrollTop = currentScrollTop;
}

function removeMyFavSeriesCategory() {
  const favContainer = document.querySelector(".series-fav-container");
  if (!favContainer) return;

  const pageContainer = document.querySelector(".series-page-container");
  if (!pageContainer) return;

  // Save current scroll position
  const currentScrollTop = pageContainer.scrollTop;

  // Remove My Fav container
  favContainer.remove();

  // Shift all chunk loading states back by 1 index
  const oldChunks = {
    ...seriesChunkLoadingState.loadedChunks,
  };
  seriesChunkLoadingState.loadedChunks = {};

  Object.keys(oldChunks).forEach((key) => {
    const oldIndex = parseInt(key, 10);
    if (oldIndex === 0) return; // Skip My Fav (index 0)
    const newIndex = oldIndex - 1;
    seriesChunkLoadingState.loadedChunks[newIndex] = oldChunks[key];
  });

  // Update all category indices (shift them back by 1)
  const allCategoryLists = pageContainer.querySelectorAll(".series-card-list");
  allCategoryLists.forEach((list) => {
    const currentIndex = parseInt(list.getAttribute("data-category"), 10);
    const newIndex = currentIndex - 1;
    list.setAttribute("data-category", newIndex);

    // Update all cards in this category
    const cards = list.querySelectorAll(".series-card");
    cards.forEach((card) => {
      card.setAttribute("data-category", newIndex);
    });

    // Update loading indicators if any
    const loadingIndicator = list.querySelector(".series-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.setAttribute("data-category", newIndex);
    }
  });

  // Adjust navigation state (shift back by 1)
  if (seriesNavigationState.currentCategoryIndex > 0) {
    seriesNavigationState.currentCategoryIndex -= 1;
  }
  if (seriesNavigationState.lastFocusedCategory > 0) {
    seriesNavigationState.lastFocusedCategory -= 1;
  }

  // Remove from window.allSeriesCategories
  if (window.allSeriesCategories && window.allSeriesCategories.length > 0) {
    const favIndex = window.allSeriesCategories.findIndex(
      (cat) => cat.id === "fav"
    );
    if (favIndex !== -1) {
      window.allSeriesCategories.splice(favIndex, 1);
    }
  }

  // Decrement loaded categories count
  if (seriesChunkLoadingState.loadedCategories > 0) {
    seriesChunkLoadingState.loadedCategories -= 1;
  }

  // Restore scroll position
  pageContainer.scrollTop = currentScrollTop;
}

function refreshSeriesFavoritesList() {
  const currentPlaylist = getCurrentPlaylist();
  const favIdsRaw = currentPlaylist
    ? currentPlaylist.favouriteSeries || []
    : [];
  const favIds = Array.isArray(favIdsRaw)
    ? favIdsRaw.map((id) => String(id))
    : [];
  favoriteSeriesIds = favIds; // Update global favorite IDs

  const favouriteSeries =
    window.allSeriesStreams && favIds.length
      ? window.allSeriesStreams.filter(
          (s) => s && favIds.includes(String(s.series_id))
        )
      : [];

  // If in search mode, do not show My Fav section; keep page focused on search results
  const isSearchMode = !!getSeriesSearchQuery();
  if (isSearchMode) {
    const favContainerSearch = document.querySelector(".series-fav-container");
    const favListSearch = document.querySelector(".series-card-list.fav-list");
    if (favListSearch) {
      const categoryIndexAttr = favListSearch.getAttribute("data-category");
      const categoryIndex = categoryIndexAttr
        ? parseInt(categoryIndexAttr, 10)
        : 0;
      setSeriesLoadedChunkCount(categoryIndex, 0);
    }
    if (favContainerSearch) {
      favContainerSearch.remove();
    }
    // If focus points to removed fav category, shift to next available category
    const currentList = document.querySelector(
      '.series-card-list[data-category="' +
        seriesNavigationState.currentCategoryIndex +
        '"]'
    );
    if (!currentList) {
      const nextIdx = findNextSeriesCategoryWithSeries(
        seriesNavigationState.currentCategoryIndex + 1,
        1
      );
      seriesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
      seriesNavigationState.currentCardIndex = 0;
      updateSeriesFocus();
      saveSeriesNavigationState();
    }
    return;
  }

  // If there are no favorites, remove the entire My Fav category section
  if (!favouriteSeries.length) {
    const favContainer = document.querySelector(".series-fav-container");
    const favListForIdx = document.querySelector(".series-card-list.fav-list");
    if (favListForIdx) {
      const categoryIndexAttr = favListForIdx.getAttribute("data-category");
      const categoryIndex = categoryIndexAttr
        ? parseInt(categoryIndexAttr, 10)
        : 0;
      setSeriesLoadedChunkCount(categoryIndex, 0);
    }
    if (favContainer) {
      favContainer.remove();
    }
    // If focus points to a non-existent list, shift focus
    const currentList = document.querySelector(
      '.series-card-list[data-category="' +
        seriesNavigationState.currentCategoryIndex +
        '"]'
    );
    if (!currentList) {
      const nextIdx = findNextSeriesCategoryWithSeries(
        seriesNavigationState.currentCategoryIndex + 1,
        1
      );
      seriesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
      seriesNavigationState.currentCardIndex = 0;
      updateSeriesFocus();
      saveSeriesNavigationState();
    }
    return;
  }

  // Ensure My Fav container exists; if not, create it at the top
  let favContainer = document.querySelector(".series-fav-container");
  let favList = document.querySelector(".series-card-list.fav-list");

  if (!favContainer || !favList) {
    const pageContainer = document.querySelector(".series-page-container");
    if (pageContainer) {
      const favCategory = {
        title: "My Fav",
        series: favouriteSeries,
        id: "fav",
        containerClass: "series-fav-container",
      };
      const favHTML = createSeriesCategorySection(favCategory, 0);
      pageContainer.insertAdjacentHTML("afterbegin", favHTML);
      favContainer = document.querySelector(".series-fav-container");
      favList = document.querySelector(".series-card-list.fav-list");
    }
  }

  if (!favList) return;

  const categoryIndexAttr = favList.getAttribute("data-category");
  const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;

  let html = "";
  for (let i = 0; i < favouriteSeries.length; i++) {
    const seriesData = formatSeriesData(favouriteSeries[i]);
    if (!seriesData) continue;
    html += createSeriesCard(seriesData, "normal", categoryIndex, i);
  }

  favList.innerHTML = html;
  setSeriesLoadedChunkCount(categoryIndex, favouriteSeries.length);

  // After rendering, restore or set focus on My Fav cards
  const navigationFocus = localStorage.getItem("navigationFocus");
  if (navigationFocus === "seriesPage") {
    const hasFocused = document.querySelector(".series-card.focused");
    if (!hasFocused) {
      seriesNavigationState.currentCategoryIndex = categoryIndex;
      seriesNavigationState.currentCardIndex = Math.max(
        0,
        Math.min(
          seriesNavigationState.currentCardIndex,
          favouriteSeries.length - 1
        )
      );
    } else if (seriesNavigationState.currentCategoryIndex === categoryIndex) {
      seriesNavigationState.currentCardIndex = Math.max(
        0,
        Math.min(
          seriesNavigationState.currentCardIndex,
          favouriteSeries.length - 1
        )
      );
    }
    updateSeriesFocus();
    saveSeriesNavigationState();
  }
}

function handleSeriesKeyNavigation(e) {
  let currentPage = localStorage.getItem("currentPage");
  let navigationFocus = localStorage.getItem("navigationFocus");

  if (currentPage !== "seriesPage" || navigationFocus !== "seriesPage") {
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
    handleSeriesEnterKey(e);
    return;
  }

  const now = Date.now();
  if (
    now - seriesNavigationDebounce.lastKeyPress <
    seriesNavigationDebounce.debounceTime
  ) {
    e.preventDefault();
    return;
  }

  e.preventDefault();

  seriesNavigationDebounce.lastKeyPress = now;

  switch (e.key) {
    case "ArrowRight":
      moveSeriesRight();
      break;
    case "ArrowLeft":
      moveSeriesLeft();
      break;
    case "ArrowDown":
      moveSeriesDown();
      break;
    case "ArrowUp":
      moveSeriesUp();
      break;
    case "Escape":
    case "Back":
    case "BrowserBack":
    case "XF86Back":
    case "SoftLeft":
    case "Backspace":
    case 10009:
      localStorage.setItem("returnPage", "seriesPage");
      localStorage.setItem("returnFocus", "seriesPage");
      localStorage.setItem("currentPage", "exitModal");
      Router.showPage("exitModal");
      break;
  }

  updateSeriesFocus();
  saveSeriesNavigationState();
}

function cleanupSeriesNavigation() {
  document.removeEventListener("keydown", handleSeriesKeyNavigation);
  document.removeEventListener("keyup", handleSeriesKeyNavigation);
  isSeriesNavigationInitialized = false;
  seriesNavigationDebounce.lastKeyPress = 0;
  seriesNavigationDebounce.isDebouncing = false;

  // Clear any pending timeouts
  if (seriesEnterKeyState.timeoutId) {
    clearTimeout(seriesEnterKeyState.timeoutId);
    seriesEnterKeyState.timeoutId = null;
  }
  seriesEnterKeyState.isPressed = false;
}

function getSeriesCurrentVisibleIndex(categoryIndex, cardIndex) {
  let cardList = document.querySelector(
    '.series-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) return 0;

  let containerWidth = cardList.offsetWidth;
  let firstCard = cardList.querySelector(".series-card");
  if (!firstCard) return 0;

  let cardWidth = firstCard.offsetWidth + 16;
  let visibleCardsCount = Math.floor(containerWidth / cardWidth);

  // Clamp to last visible card index
  if (cardIndex >= visibleCardsCount) {
    return visibleCardsCount - 1;
  }

  return cardIndex;
}

function moveSeriesRight() {
  if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
    return;
  }

  let currentCategory = getCurrentSeriesCategory();
  if (!currentCategory) return;

  let loadedCount = getSeriesLoadedChunkCount(
    seriesNavigationState.currentCategoryIndex
  );
  let totalSeries = currentCategory.series ? currentCategory.series.length : 0;

  if (seriesNavigationState.currentCardIndex < loadedCount - 1) {
    seriesNavigationState.currentCardIndex++;
  } else {
    if (loadedCount < totalSeries) {
      loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
    }
  }

  seriesNavigationState.lastFocusedCategory =
    seriesNavigationState.currentCategoryIndex;
  seriesNavigationState.lastFocusedCard =
    seriesNavigationState.currentCardIndex;
}

function moveSeriesLeft() {
  if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
    return;
  }

  if (seriesNavigationState.currentCardIndex > 0) {
    seriesNavigationState.currentCardIndex--;
  }

  seriesNavigationState.lastFocusedCategory =
    seriesNavigationState.currentCategoryIndex;
  seriesNavigationState.lastFocusedCard =
    seriesNavigationState.currentCardIndex;
}

function moveSeriesDown() {
  let allCategories = window.allSeriesCategories || [];
  if (allCategories.length === 0) return;

  let currentIndex = seriesNavigationState.currentCategoryIndex;
  let currentCardIndex = seriesNavigationState.currentCardIndex;

  let nextCategoryIndex = findNextSeriesCategoryWithSeries(currentIndex + 1, 1);

  if (nextCategoryIndex > 2) {
    const navbarEl = document.querySelector("#navbar-root");
    if (navbarEl) {
      navbarEl.style.display = "none";
    }
  }

  if (nextCategoryIndex !== -1) {
    seriesNavigationState.currentCategoryIndex = nextCategoryIndex;

    let newCategory = getCurrentSeriesCategory();
    if (newCategory) {
      let loadedCount = getSeriesLoadedChunkCount(
        seriesNavigationState.currentCategoryIndex
      );

      let visiblePosition = getSeriesCurrentVisibleIndex(
        currentIndex,
        currentCardIndex
      );
      seriesNavigationState.currentCardIndex =
        loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
    } else {
      seriesNavigationState.currentCardIndex = 0;
    }

    let loadedCategoriesCount = seriesChunkLoadingState.loadedCategories;
    if (
      seriesNavigationState.currentCategoryIndex >=
      loadedCategoriesCount - 2
    ) {
      loadMoreSeriesCategories();
    }
  } else {
    // Try to load more categories if we are at the bottom
    loadMoreSeriesCategories();

    let currentCategory = getCurrentSeriesCategory();
    if (currentCategory && currentCategory.series) {
      let loadedCount = getSeriesLoadedChunkCount(currentIndex);
      let totalSeries = currentCategory.series.length;
      if (loadedCount < totalSeries) {
        loadMoreSeriesForCategory(currentIndex);
      }
    }
  }
}

function moveSeriesUp() {
  let currentIndex = seriesNavigationState.currentCategoryIndex;
  let currentCardIndex = seriesNavigationState.currentCardIndex;

  let prevCategoryIndex = findNextSeriesCategoryWithSeries(
    currentIndex - 1,
    -1
  );

  if (prevCategoryIndex !== -1) {
    seriesNavigationState.currentCategoryIndex = prevCategoryIndex;

    let newCategory = getCurrentSeriesCategory();
    if (newCategory) {
      let loadedCount = getSeriesLoadedChunkCount(
        seriesNavigationState.currentCategoryIndex
      );

      let visiblePosition = getSeriesCurrentVisibleIndex(
        currentIndex,
        currentCardIndex
      );
      seriesNavigationState.currentCardIndex =
        loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
    } else {
      seriesNavigationState.currentCardIndex = 0;
    }
  } else {
    try {
      const seriesContainer = document.querySelector(".series-page-container");
      if (seriesContainer) {
        seriesContainer.scrollTop = 0;
      }

      const navbarEl = document.querySelector("#navbar-root");
      if (navbarEl) {
        navbarEl.style.display = "block";
      }
    } catch (e) {
      console.log("Series scroll to top failed:", e);
    }

    removeAllSeriesFocus();
    saveSeriesNavigationState();
    localStorage.setItem("navigationFocus", "navbar");

    setTimeout(() => {
      const seriesNavItem = document.querySelector(
        '.nav-item[data-page="seriesPage"]'
      );
      if (seriesNavItem) {
        seriesNavItem.focus();
        seriesNavItem.classList.add("active");
      }
    }, 50);
  }
}

function loadMoreSeriesForCategory(categoryIndex) {
  if (seriesChunkLoadingState.isLoading) return;

  let categories = window.allSeriesCategories || [];
  if (categoryIndex < 0 || categoryIndex >= categories.length) return;

  let category = categories[categoryIndex];
  if (!category) return;

  let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
  let totalSeries = category.series ? category.series.length : 0;

  if (loadedCount >= totalSeries) {
    let cardList = document.querySelector(
      '.series-card-list[data-category="' + categoryIndex + '"]'
    );
    if (cardList) {
      let loadingEl = cardList.querySelector(".series-loading-indicator");
      if (loadingEl) {
        loadingEl.remove();
      }
    }
    return;
  }

  seriesChunkLoadingState.isLoading = true;

  let cardList = document.querySelector(
    '.series-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) {
    seriesChunkLoadingState.isLoading = false;
    return;
  }

  let existingLoading = cardList.querySelector(".series-loading-indicator");
  if (existingLoading) {
    existingLoading.remove();
  }

  cardList.insertAdjacentHTML(
    "beforeend",
    createSeriesLoadingIndicator(categoryIndex)
  );

  let safetyTimeout = setTimeout(function () {
    if (seriesChunkLoadingState.isLoading) {
      console.warn(
        "loadMoreSeriesForCategory: Safety timeout triggered, resetting loading state"
      );
      seriesChunkLoadingState.isLoading = false;
      let cardList = document.querySelector(
        '.series-card-list[data-category="' + categoryIndex + '"]'
      );
      if (cardList) {
        let loadingEl = cardList.querySelector(".series-loading-indicator");
        if (loadingEl) {
          loadingEl.remove();
        }
      }
    }
  }, 3000);

  setTimeout(function () {
    try {
      let cardList = document.querySelector(
        '.series-card-list[data-category="' + categoryIndex + '"]'
      );
      if (!cardList) {
        clearTimeout(safetyTimeout);
        seriesChunkLoadingState.isLoading = false;
        return;
      }

      let newCardsHTML = loadSeriesChunk(category, categoryIndex);

      let loadingEl = cardList.querySelector(".series-loading-indicator");
      if (loadingEl) {
        loadingEl.remove();
      }

      if (newCardsHTML) {
        cardList.insertAdjacentHTML("beforeend", newCardsHTML);

        if (seriesNavigationState.currentCategoryIndex === categoryIndex) {
          updateSeriesFocus();
        }
      }

      clearTimeout(safetyTimeout);
      seriesChunkLoadingState.isLoading = false;
    } catch (e) {
      console.error("Error in loadMoreSeriesForCategory:", e);
      clearTimeout(safetyTimeout);
      seriesChunkLoadingState.isLoading = false;

      let cardList = document.querySelector(
        '.series-card-list[data-category="' + categoryIndex + '"]'
      );
      if (cardList) {
        let loadingEl = cardList.querySelector(".series-loading-indicator");
        if (loadingEl) {
          loadingEl.remove();
        }
      }
    }
  }, 100);
}

function removeAllSeriesFocus() {
  let allCards = document.querySelectorAll(".series-card");
  for (let i = 0; i < allCards.length; i++) {
    allCards[i].classList.remove("focused");

    let titleElement = allCards[i].querySelector(".series-title-marquee");
    if (titleElement) {
      titleElement.classList.remove("marquee-active");
    }
  }
}

function updateSeriesFocus() {
  removeAllSeriesFocus();

  let navigationFocus = localStorage.getItem("navigationFocus");
  if (navigationFocus === "seriesPage") {
    if (seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
      let currentCard = document.querySelector(
        '.series-card[data-category="' +
          seriesNavigationState.currentCategoryIndex +
          '"][data-index="' +
          seriesNavigationState.currentCardIndex +
          '"]'
      );

      if (currentCard) {
        currentCard.classList.add("focused");
        scrollToSeriesElement(currentCard);

        // Show navbar when focused on first category (any card in category 0)
        const navbarEl = document.querySelector("#navbar-root");
        if (navbarEl) {
          if (seriesNavigationState.currentCategoryIndex === 0) {
            navbarEl.style.display = "block";
          } else {
            navbarEl.style.display = "none";
          }
        }

        // Conditional Marquee
        const title = currentCard.querySelector(".series-title-marquee");
        if (title) {
          title.classList.remove("marquee-active");
          if (title.scrollWidth > title.clientWidth) {
            title.classList.add("marquee-active");
          }
        }

        seriesNavigationState.lastFocusedCategory =
          seriesNavigationState.currentCategoryIndex;
        seriesNavigationState.lastFocusedCard =
          seriesNavigationState.currentCardIndex;
      }
    }
  }
}

function activateSeriesMarquee(card) {
  if (!card) return;

  let titleElement = card.querySelector(".series-title-marquee");
  if (!titleElement) return;

  let container = titleElement.parentElement;
  if (!container) return;

  if (titleElement.scrollWidth > container.offsetWidth) {
    titleElement.classList.add("marquee-active");
  } else {
    titleElement.classList.remove("marquee-active");
  }
}

function scrollToSeriesElement(element) {
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
        console.log("Series scroll failed");
      }
    }
  }
}

function saveSeriesNavigationState() {
  try {
    localStorage.setItem(
      "seriesNavState",
      JSON.stringify({
        currentCategoryIndex: seriesNavigationState.currentCategoryIndex,
        currentCardIndex: seriesNavigationState.currentCardIndex,
        lastFocusedCategory: seriesNavigationState.lastFocusedCategory,
        lastFocusedCard: seriesNavigationState.lastFocusedCard,
      })
    );
  } catch (e) {
    console.log("Error saving series navigation state:", e);
  }
}

function restoreSeriesNavigationState() {
  try {
    let saved = localStorage.getItem("seriesNavState");
    if (saved) {
      let state = JSON.parse(saved);
      seriesNavigationState.currentCategoryIndex =
        state.currentCategoryIndex || 0;
      seriesNavigationState.currentCardIndex = state.currentCardIndex || 0;
      seriesNavigationState.lastFocusedCategory =
        state.lastFocusedCategory || 0;
      seriesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;

      // Show the same loader that was used initially
      const pageEl = document.getElementById("series-page");
      if (pageEl) {
        const loader = document.createElement("div");
        loader.id = "series-page-loader";
        loader.className = "custom-page-loader";
        loader.innerHTML = `
          <div class="custom-loader-content">
            <div class="custom-loader-spinner"></div>
          </div>
        `;
        pageEl.appendChild(loader);
      }

      setTimeout(() => {
        validateAndAdjustRestoredSeriesState();
      }, 100);
    }
  } catch (e) {
    console.log("Error restoring series navigation state:", e);
  }
}

function doesSeriesCardExist(categoryIndex, cardIndex) {
  let cardList = document.querySelector(
    '.series-card-list[data-category="' + categoryIndex + '"]'
  );
  if (!cardList) return false;

  let card = cardList.querySelector(
    '.series-card[data-index="' + cardIndex + '"]'
  );
  return card !== null;
}

function validateAndAdjustRestoredSeriesState() {
  let targetCategoryIndex = seriesNavigationState.currentCategoryIndex;
  let targetCardIndex = seriesNavigationState.currentCardIndex;
  let allCategories = window.allSeriesCategories || [];

  // 1. Ensure Category is Loaded
  if (!seriesCategoryHasSeries(targetCategoryIndex)) {
    if (targetCategoryIndex < allCategories.length) {
      let container = document.querySelector(".series-page-container");
      if (container) {
        let currentLoaded = seriesChunkLoadingState.loadedCategories;
        for (let i = currentLoaded; i <= targetCategoryIndex + 2; i++) {
          if (i >= allCategories.length) break;
          let category = allCategories[i];
          if (
            (category.series && category.series.length > 0) ||
            category.id === "fav"
          ) {
            let categoryHTML = createSeriesCategorySection(category, i);
            let noResults = container.querySelector(".no-more-categories");
            if (noResults) noResults.remove();

            container.insertAdjacentHTML("beforeend", categoryHTML);
          }
        }
        seriesChunkLoadingState.loadedCategories = Math.max(
          seriesChunkLoadingState.loadedCategories,
          targetCategoryIndex + 3
        );
      }
    }
  }

  // 2. Ensure Card is Loaded (Horizontal)
  if (seriesCategoryHasSeries(targetCategoryIndex)) {
    let currentCategory = allCategories[targetCategoryIndex];
    let loadedCount = getSeriesLoadedChunkCount(targetCategoryIndex);

    if (targetCardIndex >= loadedCount) {
      let cardList = document.querySelector(
        '.series-card-list[data-category="' + targetCategoryIndex + '"]'
      );
      if (cardList) {
        while (
          getSeriesLoadedChunkCount(targetCategoryIndex) <= targetCardIndex
        ) {
          let newCardsHTML = loadSeriesChunk(
            currentCategory,
            targetCategoryIndex
          );
          if (!newCardsHTML) break;

          let loadingEl = cardList.querySelector(".series-loading-indicator");
          if (loadingEl) loadingEl.remove();
          cardList.insertAdjacentHTML("beforeend", newCardsHTML);
        }
      }
    }
  }

  // 3. Final Validation
  if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
    let nextCategoryIndex = findNextSeriesCategoryWithSeries(0, 1);
    if (nextCategoryIndex !== -1) {
      seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
      seriesNavigationState.currentCardIndex = 0;
    } else {
      seriesNavigationState.currentCategoryIndex = 0;
      seriesNavigationState.currentCardIndex = 0;
    }
  } else {
    let currentCategory = getCurrentSeriesCategory();
    if (currentCategory) {
      let loadedCount = getSeriesLoadedChunkCount(
        seriesNavigationState.currentCategoryIndex
      );

      if (seriesNavigationState.currentCardIndex >= loadedCount) {
        seriesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
      }

      if (
        !doesSeriesCardExist(
          seriesNavigationState.currentCategoryIndex,
          seriesNavigationState.currentCardIndex
        ) &&
        loadedCount < currentCategory.series.length
      ) {
        loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
      }
    }
  }

  setTimeout(() => {
    updateSeriesFocus();
    const loader = document.getElementById("series-page-loader");
    if (loader) {
      loader.remove();
    }
  }, 50);
}

function getCurrentSeriesCategory() {
  let categories = window.allSeriesCategories || [];
  return categories[seriesNavigationState.currentCategoryIndex];
}

function initSeriesNavigation() {
  if (isSeriesNavigationInitialized) {
    cleanupSeriesNavigation();
  }

  document.addEventListener("keydown", handleSeriesKeyNavigation);
  document.addEventListener("keyup", handleSeriesKeyNavigation);
  isSeriesNavigationInitialized = true;
}

function hasAnySeriesCategoryData() {
  let categories = window.allSeriesCategories || [];
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].series && categories[i].series.length > 0) {
      return true;
    }
  }
  return false;
}

function validateSeriesData() {
  // Clean up window.allSeriesStreams
  if (window.allSeriesStreams && Array.isArray(window.allSeriesStreams)) {
    window.allSeriesStreams = window.allSeriesStreams.filter(
      (series) =>
        series !== null && series !== undefined && typeof series === "object"
    );
  }

  // Clean up window.allseriesCategories
  if (window.allseriesCategories && Array.isArray(window.allseriesCategories)) {
    window.allseriesCategories = window.allseriesCategories.filter(
      (category) =>
        category !== null &&
        category !== undefined &&
        typeof category === "object"
    );
  }
}

function SeriesPage() {
  validateSeriesData();

  const currentSort = localStorage.getItem("sortvalue") || "default";

  // Check if there's no initial data and return early
  if (
    !window.allSeriesStreams ||
    !window.allseriesCategories ||
    window.allSeriesStreams.length == 0 ||
    window.allseriesCategories.length == 0
  ) {
    let loadingHTML = `
      <div class="series-page-container">
        <div class="no-data-container">
          <div class="no-data-content">
            <h2>No Data Available</h2>
            <p>No series found</p>
          </div>
        </div>
      </div>
    `;

    localStorage.setItem(
      "previousPage",
      localStorage.getItem("currentPage") || ""
    );
    localStorage.setItem("currentPage", "seriesPage");
    const activeEl = document.activeElement;
    const isSearchFocused = activeEl && activeEl.id === "search-input";
    if (!isSearchFocused) {
      localStorage.setItem("navigationFocus", "seriesPage");
    }

    return loadingHTML;
  }

  let loadingHTML =
    '<div id="series-page-loader" class="custom-page-loader">' +
    '<div class="custom-loader-content">' +
    '<div class="custom-loader-spinner"></div>' +
    "</div>" +
    "</div>";

  localStorage.setItem(
    "previousPage",
    localStorage.getItem("currentPage") || ""
  );
  localStorage.setItem("currentPage", "seriesPage");
  const activeEl = document.activeElement;
  const isSearchFocused = activeEl && activeEl.id === "search-input";
  if (!isSearchFocused) {
    localStorage.setItem("navigationFocus", "seriesPage");
  }

  favoriteSeriesIds = [];

  setTimeout(function () {
    const currentPlaylist = getCurrentPlaylist();
    const currentPlaylistFavIds = currentPlaylist
      ? currentPlaylist.favouriteSeries
      : [];

    favoriteSeriesIds = currentPlaylistFavIds || [];

    let favouriteSeries =
      window.allSeriesStreams && currentPlaylistFavIds
        ? filterSeriesByQuery(
            window.allSeriesStreams.filter((s) =>
              currentPlaylistFavIds.includes(s.series_id)
            )
          )
        : [];
    let popularSeries = window.allSeriesStreams
      ? filterSeriesByQuery(
          window.allSeriesStreams.filter((s) => s.rating_5based > 4)
        ).slice(0, 10)
      : [];

    let recentlyWatchedSeriesIds =
      currentPlaylist && currentPlaylist.continueWatchingSeries
        ? currentPlaylist.continueWatchingSeries
            .filter((m) => m !== null && m !== undefined)
            .map((item) => item.itemId)
        : [];

    let recentSeriesArray =
      window.allSeriesStreams && recentlyWatchedSeriesIds
        ? filterSeriesByQuery(
            window.allSeriesStreams.filter((m) =>
              recentlyWatchedSeriesIds.includes(m.series_id.toString())
            )
          )
        : [];

    // Pass current sort option to getAPISeriesCategories
    let apiCategories = getAPISeriesCategories(currentSort);

    // ALWAYS show these three categories at the top, in this specific order
    let fixedTopCategories = [
      {
        title: "My Fav",
        series: favouriteSeries,
        id: "fav",
        containerClass: "series-fav-container",
      },
      {
        title: "Popular Series",
        series: popularSeries,
        id: "popular",
        containerClass: "series-popular-container",
      },
      {
        title: "Recently Watched",
        series: recentSeriesArray,
        id: "recent",
        containerClass: "recently-watched-container",
      },
    ];

    // Remove any fixed categories that have no series (except My Fav which can be empty)
    let initialCategories = fixedTopCategories.filter((category) => {
      // if (category.id === "fav") return true; // Always show My Fav even if empty
      return category.series && category.series.length > 0;
    });

    // Add the first few API categories after the fixed ones
    let apiCategoriesToLoad = apiCategories.slice(0, 3);
    initialCategories = initialCategories.concat(apiCategoriesToLoad);

    // Set up the complete categories list (fixed top + all API categories)
    window.allSeriesCategories = initialCategories.concat(
      apiCategories.slice(3)
    );

    seriesChunkLoadingState.loadedCategories = initialCategories.length;
    seriesChunkLoadingState.loadedChunks = {};
    seriesChunkLoadingState.isLoading = false;

    if (!hasAnySeriesCategoryData()) {
      let noDataHTML =
        '<div class="series-page-container">' +
        (getSeriesSearchQuery()
          ? createSeriesNoSearchMessage()
          : createSeriesNoDataMessage("series")) +
        "</div>";
      const loadingEl = document.querySelector("#series-page-loader");
      if (loadingEl) {
        loadingEl.outerHTML = noDataHTML;
      } else {
        const pageEl = document.getElementById("series-page");
        if (pageEl) pageEl.innerHTML = noDataHTML;
      }
      return;
    }

    let html = '<div class="series-page-container">';

    for (let i = 0; i < initialCategories.length; i++) {
      let category = initialCategories[i];
      if (
        (category.series && category.series.length > 0) ||
        category.id === "fav"
      ) {
        html += createSeriesCategorySection(category, i);
      }
    }

    let hasMoreCategories = false;
    for (
      let i = initialCategories.length;
      i < window.allSeriesCategories.length;
      i++
    ) {
      let category = window.allSeriesCategories[i];
      if (category && category.series && category.series.length > 0) {
        hasMoreCategories = true;
        break;
      }
    }

    // Removed loading indicator - categories load quickly enough without it

    html += "</div>";

    let container = document.querySelector("#series-page-loader");
    if (container) {
      container.outerHTML = html;
    }

    restoreSeriesNavigationState();

    setTimeout(function () {
      initSeriesNavigation();
    }, 100);
  }, 500);

  return loadingHTML;
}

document.addEventListener("sortChanged", function (e) {
  const { sortType, page } = e.detail;

  if (page === "moviesPage") {
    if (typeof window.rerenderMoviesPage === "function") {
      Router.showPage("moviesPage");
    }
  } else if (page === "seriesPage") {
    if (typeof window.rerenderSeriesPage === "function") {
      Router.showPage("seriesPage");
    }
  }
});
window.cleanupSeriesNavigation = cleanupSeriesNavigation;
window.seriesNavigationState = seriesNavigationState;
window.updateSeriesFocus = updateSeriesFocus;
window.saveSeriesNavigationState = saveSeriesNavigationState;
window.rerenderSeriesPage = SeriesPage;
