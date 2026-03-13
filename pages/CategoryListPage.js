/**
 * CategoryListPage.js
 * Shows all categories in a list/grid layout.
 */

let categoryListNavigationState = {
  currentIndex: 0,
  itemsPerRow: 2,
  totalItems: 0,
  type: "movies", // "movies" or "series"
  categories: [],
  filteredCategories: [],
  focusSection: "grid", // "grid", "search", or "back"
};

let categoryListDebounce = {
  lastKeyPress: 0,
  debounceTime: 200,
};

function CategoryListPage() {
  const type = localStorage.getItem("categoryListType") || "movies";
  categoryListNavigationState.type = type;

  let allCategories = [];
  if (type === "movies") {
    allCategories = window.allMoviesCategories || window.moviesCategories || [];
  } else {
    allCategories =
      window.allSeriesCategories || window.allseriesCategories || [];
  }

  // Handle both raw (category_name) and processed (title) formats
  allCategories = allCategories.filter(
    (cat) => (cat.category_id || cat.id) && (cat.category_name || cat.title),
  );

  // Clean category names
  categoryListNavigationState.categories = allCategories.map((cat) => ({
    ...cat,
    cleanName: (cat.category_name || cat.title || "Category")
      .replace(/[*]/g, "")
      .trim(),
  }));

  categoryListNavigationState.filteredCategories =
    categoryListNavigationState.categories;
  categoryListNavigationState.totalItems =
    categoryListNavigationState.filteredCategories.length;

  // Restore focus if returning from CategoryViewPage
  if (localStorage.getItem("preserveCategoryListFocus") === "true") {
    categoryListNavigationState.currentIndex = parseInt(
      localStorage.getItem("categoryListLastIndex") || "0",
    );
    categoryListNavigationState.focusSection =
      localStorage.getItem("categoryListLastFocusSection") || "grid";
    localStorage.removeItem("preserveCategoryListFocus");
  } else {
    categoryListNavigationState.currentIndex = 0;
    categoryListNavigationState.focusSection = "grid";
  }

  const title = type === "movies" ? "MOVIES CATEGORIES" : "SERIES CATEGORIES";

  let html = `
    <div class="category-list-page-container">
      <div class="category-list-header">
        <div class="header-left">
           <img src="./assets/main-logo.png" class="app-logo" alt="Logo" />
        </div>
        <div class="header-center">
          <h1>${title}</h1>
        </div>
        <div class="header-right">
          <div class="back-container-cat" id="cat-back-btn">
            <i class="fa-solid fa-arrow-left"></i>
          </div>
        </div>
      </div>
      
      <div class="category-list-search-bar" id="category-search-input-wrapper">
        <div class="search-input-inner">
            <i class="fas fa-search"></i>
            <input type="text" id="category-search-input" placeholder="Type to filter categories..." />
        </div>
      </div>

      <div class="category-list-grid" id="category-list-grid">
        ${renderCategoryListItems(categoryListNavigationState.filteredCategories)}
      </div>
    </div>
  `;

  return html;
}

function renderCategoryListItems(categories) {
  if (categories.length === 0) {
    return `<div class="no-categories">No categories found matching your search.</div>`;
  }

  let html = "";
  categories.forEach((cat, index) => {
    html += `
      <div class="category-item" data-index="${index}" data-id="${cat.category_id}">
        <div class="category-item-icon-box">
          <i class="fas fa-desktop"></i>
        </div>
        <div class="category-item-name">*${cat.cleanName.toUpperCase()}*</div>
      </div>
    `;
  });
  return html;
}

CategoryListPage.init = function (container) {
  localStorage.setItem("navigationFocus", "categoryListPage");

  // Hide navbar
  const navbarEl = document.querySelector("#navbar-root");
  if (navbarEl) navbarEl.style.display = "none";

  document.addEventListener("keydown", handleCategoryListKeyNavigation);

  // Setup search input listener
  const searchInput = document.getElementById("category-search-input");
  if (searchInput) {
    searchInput.value = ""; // Clear on init
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      categoryListNavigationState.filteredCategories =
        categoryListNavigationState.categories.filter((cat) =>
          cat.cleanName.toLowerCase().includes(query),
        );
      categoryListNavigationState.totalItems =
        categoryListNavigationState.filteredCategories.length;
      categoryListNavigationState.currentIndex = 0;
      const grid = document.getElementById("category-list-grid");
      if (grid) {
        grid.innerHTML = renderCategoryListItems(
          categoryListNavigationState.filteredCategories,
        );
      }
      updateCategoryListFocus();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Finish search and return to results
        searchInput.blur();
        categoryListNavigationState.focusSection = "grid";
        updateCategoryListFocus();
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "ArrowDown") {
        if (categoryListNavigationState.totalItems > 0) {
          searchInput.blur();
          categoryListNavigationState.focusSection = "grid";
          updateCategoryListFocus();
        }
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "ArrowUp") {
        searchInput.blur();
        categoryListNavigationState.focusSection = "back";
        updateCategoryListFocus();
        e.preventDefault();
        e.stopPropagation();
      }
      const backKeys = [
        "XF86Back",
        "Back",
        "Escape",
        "BrowserBack",
        "Backspace",
        "10009",
      ];
      if (backKeys.includes(e.key)) {
        if (searchInput.value.length > 0) {
          // Clear characters one by one
          searchInput.value = searchInput.value.slice(0, -1);
          // Trigger input event to update filtered list
          searchInput.dispatchEvent(new Event("input"));
        } else {
          // If empty, go back
          goBackFromCategoryList();
        }
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  updateCategoryListFocus();
};

CategoryListPage.cleanup = function () {
  document.removeEventListener("keydown", handleCategoryListKeyNavigation);
};

function handleCategoryListKeyNavigation(e) {
  if (localStorage.getItem("navigationFocus") !== "categoryListPage") return;

  // If search input is currently focused (typing mode), skip global nav
  if (
    document.activeElement &&
    document.activeElement.id === "category-search-input"
  ) {
    return;
  }

  e.stopImmediatePropagation();

  const now = Date.now();
  if (
    now - categoryListDebounce.lastKeyPress <
    categoryListDebounce.debounceTime
  ) {
    e.preventDefault();
    return;
  }
  categoryListDebounce.lastKeyPress = now;

  const state = categoryListNavigationState;
  const total = state.totalItems;
  const itemsPerRow = state.itemsPerRow;

  if (state.focusSection === "back") {
    switch (e.key) {
      case "ArrowDown":
        state.focusSection = "search";
        break;
      case "Enter":
        goBackFromCategoryList();
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
      case "Back":
      case "BrowserBack":
      case "SoftLeft":
      case "10009":
        goBackFromCategoryList();
        break;
    }
    updateCategoryListFocus();
    return;
  }

  if (state.focusSection === "search") {
    switch (e.key) {
      case "ArrowUp":
        state.focusSection = "back";
        break;
      case "ArrowDown":
        if (state.totalItems > 0) {
          state.focusSection = "grid";
          state.currentIndex = 0;
        }
        break;
      case "Enter":
        const input = document.getElementById("category-search-input");
        if (input) input.focus();
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
      case "Back":
      case "BrowserBack":
      case "SoftLeft":
      case "10009":
        goBackFromCategoryList();
        break;
    }
    updateCategoryListFocus();
    return;
  }

  // Grid Navigation
  switch (e.key) {
    case "ArrowRight":
      if (state.currentIndex < total - 1) {
        state.currentIndex++;
      }
      break;
    case "ArrowLeft":
      if (state.currentIndex > 0) {
        state.currentIndex--;
      }
      break;
    case "ArrowDown":
      if (state.currentIndex + itemsPerRow < total) {
        state.currentIndex += itemsPerRow;
      }
      break;
    case "ArrowUp":
      if (state.currentIndex - itemsPerRow >= 0) {
        state.currentIndex -= itemsPerRow;
      } else {
        // Move to Search Bar
        state.focusSection = "search";
      }
      break;
    case "Enter":
      handleCategoryListEnter();
      break;
    case "Escape":
    case "Backspace":
    case "XF86Back":
    case "Back":
    case "BrowserBack":
    case "SoftLeft":
    case "10009":
      if (state.currentIndex === 0) {
        goBackFromCategoryList();
      } else {
        state.currentIndex = 0;
        updateCategoryListFocus();
      }
      break;
  }

  updateCategoryListFocus();
}

function updateCategoryListFocus() {
  const state = categoryListNavigationState;
  const grid = document.getElementById("category-list-grid");
  if (!grid) return;

  // Clear focus classes
  const items = grid.querySelectorAll(".category-item");
  items.forEach((item) => item.classList.remove("focused"));

  const backBtn = document.getElementById("cat-back-btn");
  const searchWrapper = document.getElementById(
    "category-search-input-wrapper",
  );

  if (backBtn) backBtn.classList.remove("focused");
  if (searchWrapper) searchWrapper.classList.remove("focused");

  if (state.focusSection === "back") {
    if (backBtn) backBtn.classList.add("focused");
  } else if (state.focusSection === "search") {
    if (searchWrapper) searchWrapper.classList.add("focused");
  } else {
    const currentItem = items[state.currentIndex];
    if (currentItem) {
      currentItem.classList.add("focused");
      currentItem.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    }
  }
}

function handleCategoryListEnter() {
  const state = categoryListNavigationState;
  const selectedCategory = state.filteredCategories[state.currentIndex];
  if (selectedCategory) {
    const type = state.type;
    localStorage.setItem("viewMoreType", type);
    localStorage.setItem(
      "viewMoreCategoryId",
      selectedCategory.category_id || selectedCategory.id,
    );
    localStorage.setItem("viewMoreCategoryTitle", selectedCategory.cleanName);

    // Save state for focus preservation
    localStorage.setItem("categoryListLastIndex", state.currentIndex);
    localStorage.setItem("categoryListLastFocusSection", state.focusSection);
    localStorage.setItem("preserveCategoryListFocus", "true");
    localStorage.setItem("categoryReturnPage", "categoryListPage");

    localStorage.setItem("currentPage", "categoryViewPage");
    localStorage.setItem("navigationFocus", "categoryViewPage");
    Router.showPage("categoryViewPage");
  }
}

function openCategoryViewModeDialog() {
  const type = categoryListNavigationState.type;

  ViewChangeDialog(
    (newView) => {
      // No longer saving view preference to localStorage
      if (newView === "poster") {
        const page = type === "movies" ? "moviesPage" : "seriesPage";
        localStorage.setItem("currentPage", page);
        localStorage.setItem("navigationFocus", page);
        Router.showPage(page);
      }
    },
    () => {
      localStorage.setItem("navigationFocus", "categoryListPage");
    },
    "category",
  );
}

function goBackFromCategoryList() {
  const type = categoryListNavigationState.type;
  const page = type === "movies" ? "moviesPage" : "seriesPage";

  localStorage.setItem("currentPage", page);
  localStorage.setItem("navigationFocus", page);

  // Cleanup all category list related localStorage values
  const keysToCleanup = [
    "categoryListType",
    "categoryListLastIndex",
    "categoryListLastFocusSection",
    "preserveCategoryListFocus",
    "categoryReturnPage",
    "viewMoreType",
    "viewMoreCategoryId",
    "viewMoreCategoryTitle",
  ];
  keysToCleanup.forEach((key) => localStorage.removeItem(key));

  Router.showPage(page);
}

window.CategoryListPage = CategoryListPage;
