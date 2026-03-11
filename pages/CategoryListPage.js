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
  focusSection: "grid", // "grid" or "header"
  headerIndex: 0, // 0: search, 1: back
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
    allCategories = window.allSeriesCategories || window.allseriesCategories || [];
  }

  // Handle both raw (category_name) and processed (title) formats
  allCategories = allCategories.filter(cat => (cat.category_id || cat.id) && (cat.category_name || cat.title));

  // Clean category names
  categoryListNavigationState.categories = allCategories.map(cat => ({
    ...cat,
    cleanName: (cat.category_name || cat.title || "Category").replace(/[*]/g, "").trim()
  }));
  
  categoryListNavigationState.filteredCategories = categoryListNavigationState.categories;
  categoryListNavigationState.totalItems = categoryListNavigationState.filteredCategories.length;
  
  // Restore focus if returning from CategoryViewPage
  if (localStorage.getItem("preserveCategoryListFocus") === "true") {
      categoryListNavigationState.currentIndex = parseInt(localStorage.getItem("categoryListLastIndex") || "0");
      categoryListNavigationState.focusSection = localStorage.getItem("categoryListLastFocusSection") || "grid";
      localStorage.removeItem("preserveCategoryListFocus");
  } else {
      categoryListNavigationState.currentIndex = 0;
      categoryListNavigationState.focusSection = "grid";
  }
  
  categoryListNavigationState.headerIndex = 0;

  const title = type === "movies" ? "MOVIES" : "SERIES";

  let html = `
    <div class="category-list-page-container">
      <div class="category-list-header">
        <div class="header-left">
           <img src="./assets/IPTV-Logo.png" class="app-logo" alt="Logo" />
        </div>
        <div class="header-center">
          <h1>${title}</h1>
        </div>
        <div class="header-right">
          <div class="search-container-cat" id="cat-search-btn">
            <i class="fas fa-search"></i>
          </div>
          <div class="back-container-cat" id="cat-back-btn">
            <i class="fas fa-undo"></i>
            <span>Go back</span>
          </div>
        </div>
      </div>
      
      <div class="category-list-search-bar" id="category-search-input-wrapper" style="display: none;">
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
          categoryListNavigationState.filteredCategories = categoryListNavigationState.categories.filter(cat => 
              cat.cleanName.toLowerCase().includes(query)
          );
          categoryListNavigationState.totalItems = categoryListNavigationState.filteredCategories.length;
          categoryListNavigationState.currentIndex = 0;
          const grid = document.getElementById("category-list-grid");
          if (grid) {
              grid.innerHTML = renderCategoryListItems(categoryListNavigationState.filteredCategories);
          }
          updateCategoryListFocus();
      });

      searchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") {
              // Finish search and return to results
              searchInput.blur();
              categoryListNavigationState.focusSection = "grid";
              updateCategoryListFocus();
          }
          if (e.key === "XF86Back" || e.key === "Back" || e.key === "Escape") {
              searchInput.blur();
              categoryListNavigationState.focusSection = "header";
              updateCategoryListFocus();
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
  e.stopImmediatePropagation();
  
  // If search input is focused, let it handle keys
  if (document.activeElement && document.activeElement.id === "category-search-input") {
      if (e.key === "Escape" || e.key === "Back" || e.key === "XF86Back" || (e.key === "Backspace" && document.activeElement.value === "")) {
           document.activeElement.blur();
           categoryListNavigationState.focusSection = "header";
           updateCategoryListFocus();
           e.preventDefault();
      }
      return; 
  }

  const now = Date.now();
  if (now - categoryListDebounce.lastKeyPress < categoryListDebounce.debounceTime) {
    e.preventDefault();
    return;
  }
  categoryListDebounce.lastKeyPress = now;

  const state = categoryListNavigationState;
  const total = state.totalItems;
  const itemsPerRow = state.itemsPerRow;
  
  if (state.focusSection === "header") {
      switch (e.key) {
          case "ArrowRight":
              if (state.headerIndex < 1) state.headerIndex++;
              break;
          case "ArrowLeft":
              if (state.headerIndex > 0) state.headerIndex--;
              break;
          case "ArrowDown":
              state.focusSection = "grid";
              state.currentIndex = 0;
              break;
          case "Enter":
              if (state.headerIndex === 0) {
                  toggleCategorySearch();
              } else {
                  goBackFromCategoryList();
              }
              break;
          case "Escape":
          case "Backspace":
          case "XF86Back":
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
        // Move to Header
        state.focusSection = "header";
        state.headerIndex = 0;
      }
      break;
    case "Enter":
      handleCategoryListEnter();
      break;
    case "Escape":
    case "Backspace":
    case "XF86Back":
      goBackFromCategoryList();
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
  items.forEach(item => item.classList.remove("focused"));
  
  const searchBtn = document.getElementById("cat-search-btn");
  const backBtn = document.getElementById("cat-back-btn");
  if (searchBtn) searchBtn.classList.remove("focused");
  if (backBtn) backBtn.classList.remove("focused");

  if (state.focusSection === "header") {
      if (state.headerIndex === 0) {
          if (searchBtn) searchBtn.classList.add("focused");
      } else {
          if (backBtn) backBtn.classList.add("focused");
      }
  } else {
      const currentItem = items[state.currentIndex];
      if (currentItem) {
        currentItem.classList.add("focused");
        currentItem.scrollIntoView({ block: "center", behavior: "smooth" });
      }
  }
}

function handleCategoryListEnter() {
  const state = categoryListNavigationState;
  const selectedCategory = state.filteredCategories[state.currentIndex];
  if (selectedCategory) {
    const type = state.type;
    localStorage.setItem("viewMoreType", type);
    localStorage.setItem("viewMoreCategoryId", selectedCategory.category_id || selectedCategory.id);
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
        "category"
    );
}

function toggleCategorySearch() {
    const searchWrapper = document.getElementById("category-search-input-wrapper");
    const searchInput = document.getElementById("category-search-input");
    
    if (searchWrapper.style.display === "none") {
        searchWrapper.style.display = "flex";
        searchInput.focus();
    } else {
        // If already open, just focus it
        searchInput.focus();
    }
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
    "viewMoreCategoryTitle"
  ];
  keysToCleanup.forEach(key => localStorage.removeItem(key));

  Router.showPage(page);
}

window.CategoryListPage = CategoryListPage;
