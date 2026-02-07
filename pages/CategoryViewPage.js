/**
 * CategoryViewPage.js
 * Shows all items (Movies or Series) for a specific category in a grid layout.
 */

let categoryViewNavigationState = {
  currentCardIndex: 0,
  itemsPerRow: 6,
  totalItems: 0,
  renderedItemsCount: 0,
  isHeaderFocused: false,
  type: "movies", // "movies" or "series"
  items: [],
  categoryTitle: "",
};

const GRID_CHUNK_SIZE = 30; // 5 rows of 6

let categoryViewDebounce = {
  lastKeyPress: 0,
  debounceTime: 200,
};

function CategoryViewPage() {
  const type = localStorage.getItem("viewMoreType") || "movies";
  const categoryId = localStorage.getItem("viewMoreCategoryId");
  const categoryTitle =
    localStorage.getItem("viewMoreCategoryTitle") || "Category";

  categoryViewNavigationState.type = type;
  categoryViewNavigationState.categoryTitle = categoryTitle;

  let allItems = [];
  if (type === "movies") {
    const categories = window.allMoviesCategories || [];
    const category = categories.find(
      (cat) => String(cat.id) === String(categoryId),
    );
    if (category) {
      allItems = category.movies || [];
    }
  } else {
    const categories = window.allSeriesCategories || [];
    const category = categories.find(
      (cat) => String(cat.id) === String(categoryId),
    );
    if (category) {
      allItems = category.series || [];
    }
  }

  categoryViewNavigationState.items = allItems;
  categoryViewNavigationState.totalItems = allItems.length;

  // Restore focus state if returning from detail page
  if (localStorage.getItem("preserveCategoryViewFocus") === "true") {
    const lastIndex = parseInt(
      localStorage.getItem("categoryViewLastIndex") || "0",
    );
    categoryViewNavigationState.currentCardIndex = lastIndex;
    categoryViewNavigationState.isHeaderFocused = false;
    // Ensure we render enough items to show the focused one
    categoryViewNavigationState.renderedItemsCount = Math.max(
      Math.min(allItems.length, GRID_CHUNK_SIZE),
      lastIndex + GRID_CHUNK_SIZE,
    );
    localStorage.removeItem("preserveCategoryViewFocus");
  } else {
    categoryViewNavigationState.currentCardIndex = 0;
    categoryViewNavigationState.isHeaderFocused = false;
    categoryViewNavigationState.renderedItemsCount = Math.min(
      allItems.length,
      GRID_CHUNK_SIZE,
    );
  }

  let initialItems = allItems.slice(
    0,
    categoryViewNavigationState.renderedItemsCount,
  );

  let html = `
    <div class="category-view-page-container">
      <div class="category-view-header">
        <h1>${categoryTitle} <span class="item-count">(${
          allItems.length
        } items)</span></h1>
      </div>
      <div class="category-view-grid" id="category-view-grid">
        ${renderCategoryGridItems(initialItems, type, 0)}
      </div>
    </div>
  `;

  return html;
}

function loadMoreGridItems() {
  const state = categoryViewNavigationState;
  if (state.renderedItemsCount >= state.totalItems) return;

  const grid = document.getElementById("category-view-grid");
  if (!grid) return;

  const nextCount = Math.min(
    state.totalItems,
    state.renderedItemsCount + GRID_CHUNK_SIZE,
  );
  const newItems = state.items.slice(state.renderedItemsCount, nextCount);
  const newHtml = renderCategoryGridItems(
    newItems,
    state.type,
    state.renderedItemsCount,
  );

  grid.insertAdjacentHTML("beforeend", newHtml);
  state.renderedItemsCount = nextCount;
}

function renderCategoryGridItems(items, type, startIndex) {
  let html = "";
  items.forEach((item, index) => {
    const actualIndex = startIndex + index;
    if (type === "movies") {
      const movieData = formatMovieData(item);
      if (movieData) {
        html += createMovieCard(movieData, "normal", -1, actualIndex);
      }
    } else {
      const seriesData = formatSeriesData(item);
      if (seriesData) {
        html += createSeriesCard(seriesData, "normal", -1, actualIndex);
      }
    }
  });
  return html;
}

CategoryViewPage.init = function (container) {
  localStorage.setItem("navigationFocus", "categoryViewPage");

  // Hide navbar
  const navbarEl = document.querySelector("#navbar-root");
  if (navbarEl) navbarEl.style.display = "none";

  document.addEventListener("keydown", handleCategoryViewKeyNavigation);

  updateCategoryViewFocus();
};

CategoryViewPage.cleanup = function () {
  document.removeEventListener("keydown", handleCategoryViewKeyNavigation);
};

function handleCategoryViewKeyNavigation(e) {
  if (localStorage.getItem("navigationFocus") !== "categoryViewPage") return;

  const now = Date.now();
  if (
    now - categoryViewDebounce.lastKeyPress <
    categoryViewDebounce.debounceTime
  ) {
    e.preventDefault();
    return;
  }
  categoryViewDebounce.lastKeyPress = now;

  const total = categoryViewNavigationState.totalItems;
  const itemsPerRow = categoryViewNavigationState.itemsPerRow;
  let currentIndex = categoryViewNavigationState.currentCardIndex;
  let isHeaderFocused = categoryViewNavigationState.isHeaderFocused;

  switch (e.key) {
    case "ArrowRight":
      if (isHeaderFocused) break;
      if (currentIndex < total - 1) {
        categoryViewNavigationState.currentCardIndex++;
        // Load more if at the edge of rendered
        if (
          categoryViewNavigationState.currentCardIndex >=
          categoryViewNavigationState.renderedItemsCount
        ) {
          loadMoreGridItems();
        }
      }
      break;
    case "ArrowLeft":
      if (isHeaderFocused) break;
      if (currentIndex > 0) {
        categoryViewNavigationState.currentCardIndex--;
      }
      break;
    case "ArrowDown":
      if (isHeaderFocused) {
        // categoryViewNavigationState.isHeaderFocused = false;
        // categoryViewNavigationState.currentCardIndex = 0;
      } else {
        if (currentIndex + itemsPerRow < total) {
          categoryViewNavigationState.currentCardIndex += itemsPerRow;
          // Load more if needed
          if (
            categoryViewNavigationState.currentCardIndex >=
            categoryViewNavigationState.renderedItemsCount
          ) {
            loadMoreGridItems();
          }
        }
        // Removed logic that forced jump to last item
      }
      break;
    case "ArrowUp":
      if (isHeaderFocused) break;
      if (currentIndex - itemsPerRow >= 0) {
        categoryViewNavigationState.currentCardIndex -= itemsPerRow;
      } else {
        // categoryViewNavigationState.isHeaderFocused = true;
      }
      break;
    case "Enter":
      if (isHeaderFocused) {
        goBackFromCategoryView();
      } else {
        handleCategoryViewEnter();
      }
      break;
    case "Escape":
    case "Back":
    case "BrowserBack":
    case "XF86Back":
    case "Backspace":
    case 10009:
      goBackFromCategoryView();
      break;
  }

  updateCategoryViewFocus();
}

function updateCategoryViewFocus() {
  const index = categoryViewNavigationState.currentCardIndex;
  const type = categoryViewNavigationState.type;
  const isHeaderFocused = categoryViewNavigationState.isHeaderFocused;
  const cardClass = type === "movies" ? ".movie-card" : ".series-card";

  // Clear all focus classes in header and grid
  const headerBack = document.getElementById("category-back-btn");
  if (headerBack) headerBack.classList.remove("focused");

  const grid = document.getElementById("category-view-grid");
  if (!grid) return;

  const focusedElements = grid.querySelectorAll(".focused");
  focusedElements.forEach((el) => {
    el.classList.remove("focused");
    const marquee = el.querySelector(
      ".movie-title-marquee, .series-title-marquee",
    );
    if (marquee) marquee.classList.remove("marquee-active");
  });

  if (isHeaderFocused) {
    // Header focus (Back button) removed functionality but kept state just in case,
    // though without the button it effectively does nothing visual.
    // Keeping logic simple, if header focused was set to true (not reachable via keys now), nothing highlights.
    return;
  }

  const cards = grid.querySelectorAll(cardClass);
  const currentCard = cards[index];

  if (currentCard) {
    currentCard.classList.add("focused");
    currentCard.scrollIntoView({
      // behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // Handle Marquee
    const marquee = currentCard.querySelector(
      ".movie-title-marquee, .series-title-marquee",
    );
    if (marquee) {
      if (marquee.scrollWidth > marquee.clientWidth) {
        const scrollDist = marquee.scrollWidth - marquee.clientWidth;
        marquee.style.setProperty("--scroll-dist", `-${scrollDist}px`);
        marquee.style.setProperty("--duration", `${marquee.scrollWidth / 50}s`);
        marquee.classList.add("marquee-active");
      }
    }
  }
}

function handleCategoryViewEnter() {
  const index = categoryViewNavigationState.currentCardIndex;
  const type = categoryViewNavigationState.type;
  const cardClass = type === "movies" ? ".movie-card" : ".series-card";
  const grid = document.getElementById("category-view-grid");
  const cards = grid.querySelectorAll(cardClass);
  const currentCard = cards[index];

  if (currentCard) {
    const streamId = currentCard.getAttribute(
      type === "movies" ? "data-stream-id" : "data-series-id",
    );

    // Persist state for return
    localStorage.setItem("categoryViewLastIndex", index);
    localStorage.setItem("preserveCategoryViewFocus", "true");
    localStorage.setItem("returnPage", "categoryViewPage");

    if (type === "movies") {
      localStorage.setItem("selectedMovieId", streamId);
      const selectedMovieItem = window.allMoviesStreams.find(
        (item) => item.stream_id == streamId,
      );
      if (selectedMovieItem) {
        localStorage.setItem(
          "selectedMovieData",
          JSON.stringify(selectedMovieItem),
        );
      }
      localStorage.setItem("currentPage", "movieDetailPage");
      localStorage.setItem("navigationFocus", "movieDetailPage");
      Router.showPage("movieDetailPage");
    } else {
      localStorage.setItem("selectedSeriesId", streamId);
      const selectedSeriesItem = window.allSeriesStreams.find(
        (item) => item.series_id == streamId,
      );
      if (selectedSeriesItem) {
        localStorage.setItem(
          "selectedSeriesItem",
          JSON.stringify(selectedSeriesItem),
        );
      }
      localStorage.setItem("currentPage", "seriesDetailPage");
      localStorage.setItem("navigationFocus", "seriesDetailPage");
      Router.showPage("seriesDetailPage");
    }
  }
}

function goBackFromCategoryView() {
  const type = categoryViewNavigationState.type;
  const page = type === "movies" ? "moviesPage" : "seriesPage";

  // Removed focus reset to preserve previous state on the main page.
  // if (type === "movies") {
  //   moviesNavigationState.currentCardIndex = 0;
  // } else {
  //   seriesNavigationState.currentCardIndex = 0;
  // }

  localStorage.setItem("currentPage", page);
  localStorage.setItem("navigationFocus", page);

  Router.showPage(page);
}

window.CategoryViewPage = CategoryViewPage;
