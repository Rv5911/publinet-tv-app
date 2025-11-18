let isSortOptionsOpen = false;

function Navbar() {
  return `
    <div class="navbar-container">
      <div class="navbar-left">
        <img src="/assets/main-logo.png" alt="Logo" class="logo" />
        <div class="search-bar-container">
          <img src="/assets/search-icon-navbar.png" alt="Search Icon" class="nav-search-bar" />
          <input type="text" id="search-input" placeholder="Search" tabindex="0" class="search-bar" />
        </div>
      </div>
      <div class="navbar-right">
        <div class="nav-item" data-page="homePage" tabindex="0">Home</div>
        <div class="nav-item" data-page="liveTvPage" tabindex="0">Live TV</div>
        <div class="nav-item" data-page="moviesPage" tabindex="0">Movies</div>
        <div class="nav-item" data-page="seriesPage" tabindex="0">Series</div>
        <div class="navbar-profile">
          <svg width="50" id="profileIcon" tabindex="0" height="50" viewBox="0 0 12 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="6" fill="white"/>
            <circle cx="6" cy="24" r="6" fill="white"/>
            <circle cx="6" cy="42" r="6" fill="white"/>
          </svg>
        </div>
      </div>
    </div>

    <div id="sidebar" class="sidebar option-remove">
      <div class="sidebar-content">
        <ul>
          <li class="sidebar-link" tabindex="0"><img src="/assets/sidebar-settings.png" alt="Logo" class="sidebar-link-logo" />Settings</li>
          <li class="sidebar-link" tabindex="0"><img src="/assets/sidebar-list-user.png" alt="Logo" class="sidebar-link-logo" />List User</li>
          <li class="account-navbar sidebar-link" tabindex="0"><img src="/assets/sidebar-account.png" alt="Logo" class="sidebar-link-logo" />My Account</li>
          
          <!-- Sort with expandable submenu -->
          <li class="sidebar-link sidebar-sort" tabindex="0">
            <span class="sidebar-link-sort-container">
              <img src="/assets/sidebar-sort.png" alt="Logo" class="sidebar-link-logo" />
              Sort
            </span>
            <span class="arrow-icon"><img src="/assets/down-arrow.png" alt="Logo" /></span>
          </li>
          <div id="sort-options" class="sort-options option-remove">
            <ul>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="default">
                  <span class="checkmark"></span>
                  Default
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="recently-added">
                  <span class="checkmark"></span>
                  Recently Added
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="a-z">
                  <span class="checkmark"></span>
                  A-Z
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="z-a">
                  <span class="checkmark"></span>
                  Z-A
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="top-rated">
                  <span class="checkmark"></span>
                  Top Rated
                </label>
              </li>
            </ul>
          </div>

          <!-- Dynamic page-specific options will be injected here -->
          
          <li class="logout-navbar sidebar-link" tabindex="0">Sign Out</li>
        </ul>
      </div>
    </div>
  `;
}

function buildDynamicSidebarOptions() {
  try {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const list = sidebar.querySelector("ul");
    if (!list) return;

    list
      .querySelectorAll(".dynamic-sidebar-option")
      .forEach((el) => el.remove());

    const currentPage = localStorage.getItem("currentPage");
    let label = "";
    let action = "";
    const currentPlaylist = getCurrentPlaylist();
    const allRecentlyWatchedMovies = currentPlaylist.continueWatchingMovies;
    const allRecentlyWatchedSeries = currentPlaylist.continueWatchingSeries;
    const selectedMovieId = localStorage.getItem("selectedMovieId");
    const selectedSeriesId = localStorage.getItem("selectedSeriesId");

    // FIX: Properly check if movie is in recently watched
    const isIncludedInRecentlyWatchedMovies =
      allRecentlyWatchedMovies &&
      allRecentlyWatchedMovies.some(
        (movie) => movie && movie.itemId == selectedMovieId
      );

    const isIncludedInRecentlyWatchedSeries =
      allRecentlyWatchedSeries &&
      allRecentlyWatchedSeries.some(
        (series) => series && series.id == selectedSeriesId
      );

    console.log("Current page:", currentPage);
    console.log(
      "isContinueWatchingMovie:",
      localStorage.getItem("isContinueWatchingMovie")
    );
    console.log("Selected Movie ID:", selectedMovieId);
    console.log("Recently Watched Movies:", allRecentlyWatchedMovies);

    if (currentPage === "moviesPage") {
      if (allRecentlyWatchedMovies && allRecentlyWatchedMovies.length > 0) {
        label = "Remove All Recently Watched Movies";
        action = "remove-all-movies";
      } else {
        return;
      }
    } else if (currentPage === "seriesPage") {
      if (allRecentlyWatchedSeries && allRecentlyWatchedSeries.length > 0) {
        label = "Remove All Recently Watched Series";
        action = "remove-all-series";
      } else {
        return;
      }
    }
    // FIX: Use consistent page name and proper boolean check
    else if (currentPage === "movieDetailPage") {
      const isContinueWatching =
        localStorage.getItem("isContinueWatchingMovie") === "true";
      console.log(
        "Movie Detail Page - isContinueWatching:",
        isContinueWatching
      );

      if (isContinueWatching) {
        label = "Remove Movie From Recently Watched";
        action = "remove-movie";
      } else {
        console.log(
          "Not showing remove option - movie not in recently watched"
        );
        return;
      }
    } else if (currentPage === "seriesDetailPage") {
      if (
        isIncludedInRecentlyWatchedSeries &&
        isIncludedInRecentlyWatchedSeries.length > 0
      ) {
        label = "Remove Series From Recently Watched";
        action = "remove-series";
      } else {
        return;
      }
    }

    if (!action) return;

    const li = document.createElement("li");
    li.className = "sidebar-link dynamic-sidebar-option";
    li.setAttribute("tabindex", "0");
    li.dataset.action = action;
    li.innerHTML = `<i class="fa fa-trash" style="margin-right: 10px;" aria-hidden="true"></i> <p class="sidebar-link-label" style="margin-left: 20px;">${label}</p>`;
    const logoutItem = list.querySelector(".logout-navbar");
    if (logoutItem) list.insertBefore(li, logoutItem);
    else list.appendChild(li);
  } catch (e) {
    console.error("buildDynamicSidebarOptions error", e);
  }
}

// Helpers to update favourites in localStorage
function getSelectedPlaylistName() {
  try {
    const sel = JSON.parse(localStorage.getItem("selectedPlaylist") || "null");
    return sel && sel.playlistName ? sel.playlistName : null;
  } catch (e) {
    return null;
  }
}

function updatePlaylistsData(updateFn) {
  try {
    const playlists = JSON.parse(localStorage.getItem("playlistsData") || "[]");
    const name = getSelectedPlaylistName();
    if (!name) return { success: false };
    const updated = playlists.map((pl) => {
      if (pl.playlistName === name) {
        return updateFn(pl);
      }
      return pl;
    });
    localStorage.setItem("playlistsData", JSON.stringify(updated));
    return { success: true };
  } catch (e) {
    console.error("updatePlaylistsData error", e);
    return { success: false, error: e };
  }
}

function removeAllFavoriteMovies() {
  const res = updatePlaylistsData((pl) => ({ ...pl, favouriteMovies: [] }));
  if (res.success) {
    if (typeof refreshMoviesFavoritesList === "function")
      refreshMoviesFavoritesList();
    document
      .querySelectorAll(".movie-card-heart")
      .forEach((h) => (h.style.display = "none"));
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast("success", "Removed all favorite movies");
    }
  }
}

function removeAllFavoriteSeries() {
  const res = updatePlaylistsData((pl) => ({ ...pl, favouriteSeries: [] }));
  if (res.success) {
    if (typeof refreshSeriesFavoritesList === "function")
      refreshSeriesFavoritesList();
    document
      .querySelectorAll(".series-card-heart")
      .forEach((h) => (h.style.display = "none"));
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast("success", "Removed all favorite series");
    }
  }
}

function removeFavoriteMovieById(streamId) {
  if (!streamId) return;
  const res = updatePlaylistsData((pl) => {
    const fav = Array.isArray(pl.favouriteMovies) ? pl.favouriteMovies : [];
    const filtered = fav.filter((id) => String(id) !== String(streamId));
    return { ...pl, favouriteMovies: filtered };
  });
  if (res.success) {
    // Update detail page button if present
    const favBtn = document.querySelector(".movie-detail-fav-button");
    if (favBtn) {
      const heartIcon = favBtn.querySelector(".heart-icon");
      const favText = favBtn.querySelector(".fav-text");
      if (heartIcon)
        heartIcon.innerHTML = '<i class="fa-regular fa-heart"></i>';
      if (favText) favText.textContent = "Add to Favorites";
    }
    document
      .querySelectorAll(
        '.movie-card[data-stream-id="' + streamId + '"] .movie-card-heart'
      )
      .forEach((h) => (h.style.display = "none"));
    if (typeof refreshMoviesFavoritesList === "function")
      refreshMoviesFavoritesList();
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast("success", "Removed movie from favorites");
    }
  }
}

function removeFavoriteSeriesById(seriesId) {
  if (!seriesId) return;
  const res = updatePlaylistsData((pl) => {
    const fav = Array.isArray(pl.favouriteSeries) ? pl.favouriteSeries : [];
    const filtered = fav.filter((id) => String(id) !== String(seriesId));
    return { ...pl, favouriteSeries: filtered };
  });
  if (res.success) {
    const favBtn = document.querySelector(".series-detail-fav-button");
    if (favBtn) {
      const heartIcon = favBtn.querySelector(".heart-icon");
      const favText = favBtn.querySelector(".fav-text");
      if (heartIcon)
        heartIcon.innerHTML = '<i class="fa-regular fa-heart"></i>';
      if (favText) favText.textContent = "Add to Favorites";
    }
    document
      .querySelectorAll(
        '.series-card[data-series-id="' + seriesId + '"] .series-card-heart'
      )
      .forEach((h) => (h.style.display = "none"));
    if (typeof refreshSeriesFavoritesList === "function")
      refreshSeriesFavoritesList();
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast("success", "Removed series from favorites");
    }
  }
}

function initNavbar() {
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const sidebar = document.getElementById("sidebar");
  const profileIcon = document.getElementById("profileIcon");
  const searchInput = document.getElementById("search-input");
  const sortItem = sidebar.querySelector(".sidebar-sort");
  const sortOptions = document.getElementById("sort-options");
  const arrowIcon = sortItem.querySelector(".arrow-icon");
  const sortCheckboxes = Array.from(
    document.querySelectorAll(".sort-checkbox")
  );

  let currentIndex = 0;
  const totalItems = navItems.length + 2;

  const pageIndexMap = {
    homePage: 0,
    liveTvPage: 1,
    moviesPage: 2,
    seriesPage: 3,
  };

  // Add this function to dispose Live TV player
  const disposeLiveTvPlayer = () => {
    if (localStorage.getItem("currentPage") === "liveTvPage") {
      // Call Live TV page cleanup if it exists
      if (
        typeof LiveTvPage !== "undefined" &&
        typeof LiveTvPage.cleanup === "function"
      ) {
        LiveTvPage.cleanup();
      }

      // Additional cleanup for live player
      if (window.livePlayer) {
        try {
          if (typeof window.livePlayer.dispose === "function") {
            window.livePlayer.dispose();
          } else if (typeof window.livePlayer.destroy === "function") {
            window.livePlayer.destroy();
          }
        } catch (error) {
          console.log("Error disposing live player:", error);
        }
        window.livePlayer = null;
      }

      // Clean up video elements
      const videoWrappers = document.querySelectorAll(
        ".livetv-video-wrapper, .live-video-player-div"
      );
      videoWrappers.forEach((wrapper) => {
        const videos = wrapper.querySelectorAll("video");
        videos.forEach((video) => {
          video.pause();
          video.src = "";
          video.load();
        });
      });
    }
  };
  // Initialize search query in window object
  window.searchQuery = window.searchQuery || "";

  setSortOption("default");

  updateNavbarActive(localStorage.getItem("currentPage"));
  buildDynamicSidebarOptions();

  let searchDebounceTimer = null;
  const SEARCH_DEBOUNCE_MS = 150;
  searchInput.addEventListener("input", (e) => {
    window.searchQuery = e.target.value || "";
    window.dispatchEvent(
      new CustomEvent("global-search", { detail: window.searchQuery })
    );
    const currentPage = localStorage.getItem("currentPage");
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      if (currentPage === "moviesPage") {
        try {
          if (typeof window.rerenderMoviesPage === "function") {
            Router.showPage("moviesPage");
            localStorage.setItem("navigationFocus", "navbar");
            searchInput.focus();
          }
        } catch (err) {}
      } else if (currentPage === "seriesPage") {
        try {
          if (typeof window.rerenderSeriesPage === "function") {
            Router.showPage("seriesPage");
            localStorage.setItem("navigationFocus", "navbar");
            searchInput.focus();
          }
        } catch (err) {}
      }
    }, SEARCH_DEBOUNCE_MS);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  });

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.getAttribute("data-page");
      disposeLiveTvPlayer();
      Router.showPage(page);
      updateNavbarActive(page);
      buildDynamicSidebarOptions();
    });
  });

  profileIcon.addEventListener("click", openSidebar);
  profileIcon.addEventListener("focus", () => {
    profileIcon.classList.add("active");
    localStorage.setItem("navigationFocus", "navbar");
  });
  profileIcon.addEventListener("blur", () => {
    profileIcon.classList.remove("active");
  });

  sortItem.addEventListener("click", toggleSortMenu);

  sortCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        setSortOption(e.target.dataset.sort);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    const navigationFocus = localStorage.getItem("navigationFocus");
    const currentPage = localStorage.getItem("currentPage");
    const key = e.key;

    const isSearchFocused = document.activeElement === searchInput;
    if (
      isSearchFocused &&
      !["ArrowLeft", "ArrowRight", "ArrowDown"].includes(key)
    ) {
      return;
    }

    if (currentPage === "moviesDetailPage") {
      return;
    }

    if (currentPage == "settingsPage") return;

    if (isSortOptionsOpen) {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "Enter",
          "Escape",
          "Backspace",
          "XF86Back",
        ].includes(key)
      ) {
        e.preventDefault();
        handleSortOptionsKeys(e);
        return;
      }
    }

    if (sidebar && !sidebar.classList.contains("option-remove")) {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "Enter",
          "Escape",
          "Backspace",
          "XF86Back",
        ].includes(key)
      ) {
        e.preventDefault();
        handleSidebarKeys(e);
        return;
      }
    }

    // Only process navbar keys if navigation focus is navbar
    if (navigationFocus !== "navbar") {
      return;
    }

    if (["ArrowLeft", "ArrowRight"].includes(key)) e.preventDefault();

    switch (key) {
      case "ArrowRight":
        if (profileIcon.classList.contains("active")) {
          return;
        } else {
          currentIndex = (currentIndex + 1) % totalItems;
          highlightNavItem(currentIndex);
          break;
        }
      case "ArrowLeft":
        if (searchInput.classList.contains("active")) {
          querySelectorAll(".nav-item").forEach((item) =>
            item.classList.remove("active")
          );
          profileIcon.classList.remove("active");
          searchInput.blur();

          // Move to Home
          // currentIndex = 1;
          // highlightNavItem(currentIndex);
        } else {
          currentIndex = (currentIndex - 1 + totalItems) % totalItems;
          highlightNavItem(currentIndex);
        }
        break;
      case "ArrowDown":
        // Handle ArrowDown for moviesPage, liveTvPage, and seriesPage
        if (
          (currentPage === "moviesPage" ||
            currentPage === "liveTvPage" ||
            currentPage == "movieDetailPage" ||
            currentPage === "seriesPage") &&
          navigationFocus === "navbar"
        ) {
          searchInput.blur();
          localStorage.setItem("navigationFocus", currentPage);

          navItems.forEach((item) => item.classList.remove("active"));
          searchInput.classList.remove("active");
          profileIcon.classList.remove("active");

          // For liveTvPage, focus on first category
          if (currentPage === "liveTvPage") {
            setTimeout(() => {
              if (typeof focusCategories === "function") {
                focusCategories(0);
              }
              const firstCategory = document.querySelector(
                ".livetv-channel-category"
              );
              if (firstCategory) {
                firstCategory.focus();
                firstCategory.classList.add("livetv-channel-category-focused");
              }
            }, 10);
          }

          if (currentPage === "movieDetailPage") {
            setTimeout(() => {
              const firstDetailPlayBtn = document.querySelector(
                ".movie-detail-play-button"
              );
              if (firstDetailPlayBtn) {
                document
                  .querySelectorAll(".movie-detail-button-focused")
                  .forEach((btn) => btn.classList.remove("movie-detail-button-focused"));
                firstDetailPlayBtn.classList.add("movie-detail-button-focused");
                firstDetailPlayBtn.focus();
                localStorage.setItem("navigationFocus", "movieDetailPage");
                localStorage.setItem("currentPage", "movieDetailPage");
              }
            }, 0);
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          // MoviesPage: prioritize My Fav on initial down from navbar
          if (currentPage === "moviesPage" && window.moviesNavigationState) {
            // Move focus from navbar to movies page
            localStorage.setItem("navigationFocus", "moviesPage");

            setTimeout(() => {
              const favList = document.querySelector(
                ".movies-card-list.fav-list"
              );
              let targetCard = null;

              // Try My Fav first
              if (favList) {
                const favFirstCard = favList.querySelector(".movie-card");
                if (favFirstCard) {
                  targetCard = favFirstCard;
                  const favCategoryIndex = parseInt(
                    favList.getAttribute("data-category") || "0",
                    10
                  );
                  window.moviesNavigationState.currentCategoryIndex =
                    favCategoryIndex;
                  window.moviesNavigationState.currentCardIndex = 0;
                }
              }

              // Fallback: first card in DOM order
              if (!targetCard) {
                const firstCard = document.querySelector(".movie-card");
                if (firstCard) {
                  targetCard = firstCard;
                  const listEl = firstCard.closest(".movies-card-list");
                  const catIndex = parseInt(
                    (listEl && listEl.getAttribute("data-category")) || "0",
                    10
                  );
                  window.moviesNavigationState.currentCategoryIndex = catIndex;
                  window.moviesNavigationState.currentCardIndex = 0;
                }
              }

              // Persist and update focus using MoviesPage helpers
              if (typeof window.saveMoviesNavigationState === "function") {
                window.saveMoviesNavigationState();
              }
              if (targetCard) {
                targetCard.focus();
                if (typeof window.updateMoviesFocus === "function") {
                  window.updateMoviesFocus();
                }
              }
            }, 10);
          }

          // SeriesPage: prioritize My Fav on initial down from navbar
          if (currentPage === "seriesPage" && window.seriesNavigationState) {
            // Move focus from navbar to series page
            localStorage.setItem("navigationFocus", "seriesPage");

            setTimeout(() => {
              const favList = document.querySelector(
                ".series-card-list.fav-list"
              );
              let targetCard = null;

              // Try My Fav first
              if (favList) {
                const favFirstCard = favList.querySelector(".series-card");
                if (favFirstCard) {
                  targetCard = favFirstCard;
                  const favCategoryIndex = parseInt(
                    favList.getAttribute("data-category") || "0",
                    10
                  );
                  window.seriesNavigationState.currentCategoryIndex =
                    favCategoryIndex;
                  window.seriesNavigationState.currentCardIndex = 0;
                }
              }

              // Fallback: first card in DOM order
              if (!targetCard) {
                const firstCard = document.querySelector(".series-card");
                if (firstCard) {
                  targetCard = firstCard;
                  const listEl = firstCard.closest(".series-card-list");
                  const catIndex = parseInt(
                    (listEl && listEl.getAttribute("data-category")) || "0",
                    10
                  );
                  window.seriesNavigationState.currentCategoryIndex = catIndex;
                  window.seriesNavigationState.currentCardIndex = 0;
                }
              }

              // Persist and update focus using SeriesPage helpers
              if (typeof window.saveSeriesNavigationState === "function") {
                window.saveSeriesNavigationState();
              }
              if (targetCard) {
                targetCard.focus();
                if (typeof window.updateSeriesFocus === "function") {
                  window.updateSeriesFocus();
                }
              }
            }, 10);
          }
        }
        break;
      case "Enter":
        if (currentIndex === 0) {
          searchInput.focus();
        } else if (currentIndex === totalItems - 1) {
          openSidebar();
        } else {
          if (window.cleanupMoviesNavigation) {
            window.cleanupMoviesNavigation();
          }
          if (window.cleanupSeriesNavigation) {
            window.cleanupSeriesNavigation();
          }
          const page = navItems[currentIndex - 1].getAttribute("data-page");
          clearMoviesAndSeriesLocalStorage();
          disposeLiveTvPlayer();
          Router.showPage(page);
          updateNavbarActive(page);
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        if (sidebar && !sidebar.classList.contains("option-remove")) {
          closeSidebar();
        }
        break;
    }
  });

  // Ensure search input focus manages navbar active classes correctly
  searchInput.addEventListener("focus", () => {
    localStorage.setItem("navigationFocus", "navbar");
    currentIndex = 0;
    highlightNavItem(currentIndex);
  });

  searchInput.addEventListener("blur", () => {
    searchInput.classList.remove("active");
  });

  function highlightNavItem(index) {
    searchInput.classList.remove("active");
    navItems.forEach((i) => i.classList.remove("active"));
    profileIcon.classList.remove("active");

    if (index === 0) {
      searchInput.classList.add("active");
    } else if (index === totalItems - 1) {
      profileIcon.classList.add("active");
      profileIcon.focus();
    } else {
      const item = navItems[index - 1];
      item.classList.add("active");
      item.focus();
    }
  }

  function updateNavbarActive(page) {
    const index = pageIndexMap[page] || 0;
    currentIndex = index + 1;
    highlightNavItem(currentIndex);
    localStorage.setItem("navigationFocus", "navbar");
  }

  function openSidebar() {
    buildDynamicSidebarOptions();
    sidebar.classList.remove("option-remove");
    // Manually set display block
    sidebar.style.display = "block";
    localStorage.setItem("navigationFocus", "sidebar");
    isSortOptionsOpen = false;
    const items = Array.from(sidebar.querySelectorAll("li.sidebar-link"));
    updateSidebarSelection(items, 0);
    const firstItem = items[0];
    if (firstItem) firstItem.focus();
  }

  function closeSidebar() {
    sidebar.classList.add("option-remove");
    // Manually set display none
    sidebar.style.display = "none";
    localStorage.setItem("navigationFocus", "navbar");
    isSortOptionsOpen = false;

    setTimeout(() => {
      if (profileIcon) {
        profileIcon.focus();
        profileIcon.classList.add("active");
      }
    }, 10);
  }

  function handleLogOut() {
    localStorage.setItem("isLogin", false);

    localStorage.setItem("currentPage", "login");
    Router.showPage("login");
    closeSidebar();
  }

  function toggleSortMenu() {
    const expanded = !sortOptions.classList.contains("option-remove");
    if (expanded) {
      closeSortMenu();
    } else {
      openSortMenu();
    }
  }

  function openSortMenu() {
    sortOptions.classList.remove("option-remove");
    sortOptions.style.display = "block"; // Manually set display block
    arrowIcon.classList.add("rotated");
    isSortOptionsOpen = true;

    const sortOptionItems = Array.from(
      sortOptions.querySelectorAll(".sort-option")
    );
    if (sortOptionItems.length > 0) {
      updateSortOptionsSelection(sortOptionItems, 0);
    }
  }

  function closeSortMenu() {
    sortOptions.classList.add("option-remove");
    sortOptions.style.display = "none"; // Manually set display none
    arrowIcon.classList.remove("rotated");
    isSortOptionsOpen = false;

    // Focus back on the Sort menu item
    const sortMenuItem = sidebar.querySelector(".sidebar-sort");
    if (sortMenuItem) {
      sortMenuItem.focus();
      const sidebarItems = Array.from(
        sidebar.querySelectorAll("li.sidebar-link")
      );
      const sortIndex = sidebarItems.indexOf(sortMenuItem);
      updateSidebarSelection(sidebarItems, sortIndex);
    }
  }
  function setSortOption(sortType) {
    // Uncheck all checkboxes
    sortCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // Check the selected one
    const selectedCheckbox = document.querySelector(
      `.sort-checkbox[data-sort="${sortType}"]`
    );
    if (selectedCheckbox) {
      selectedCheckbox.checked = true;
    }

    // Here you can implement the actual sorting logic
    console.log(`Sorting by: ${sortType}`);
    // Implement your sorting logic based on sortType
  }

  function handleSidebarKeys(e) {
    if (isSortOptionsOpen) return;

    const items = Array.from(sidebar.querySelectorAll("li.sidebar-link"));
    if (!items.length) return;

    let activeIndex = items.findIndex((item) =>
      item.classList.contains("active")
    );
    if (activeIndex === -1) activeIndex = 0;

    const activeItem = items[activeIndex];
    const text = activeItem.textContent.trim();

    switch (e.key) {
      case "ArrowDown":
        activeIndex = (activeIndex + 1) % items.length;
        updateSidebarSelection(items, activeIndex);
        break;
      case "ArrowUp":
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateSidebarSelection(items, activeIndex);
        break;
      case "Enter":
        // Handle dynamic page-specific options
        if (activeItem.classList.contains("dynamic-sidebar-option")) {
          const action = activeItem.dataset.action;
          if (action === "remove-all-movies") {
            removeAllFromHistory("continueWatchingMovies");
            localStorage.setItem("currentPage", "moviesPage");
            Router.showPage("moviesPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          } else if (action === "remove-all-series") {
            removeAllFromHistory("continueWatchingSeries");
            localStorage.setItem("currentPage", "seriesPage");
            Router.showPage("seriesPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          } else if (action === "remove-movie") {
            removeItemFromHistoryById(
              localStorage.getItem("selectedMovieId"),
              "continueWatchingMovies"
            );
            localStorage.setItem("isContinueWatchingMovie", "false");
            localStorage.setItem("currentPage", "movieDetailPage");
            Router.showPage("movieDetailPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          } else if (action === "remove-series") {
            localStorage.setItem("isContinueWatchingSeries", "false");
            removeItemFromHistoryById(
              localStorage.getItem("selectedSeriesId"),
              "continueWatchingSeries"
            );
            localStorage.setItem("currentPage", "seriesDetailPage");
            Router.showPage("seriesDetailPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          }
          closeSidebar();
          break;
        }

        if (text === "Sort") {
          openSortMenu();
        } else if (text === "Sign Out") {
          handleLogOut();
        } else if (text === "Settings") {
          disposeLiveTvPlayer();
          localStorage.setItem("currentPage", "settingsPage");
          Router.showPage("settingsPage");
          closeSidebar();
        } else if (text === "List User") {
          disposeLiveTvPlayer();
          localStorage.setItem("isLogin", false);
          Router.showPage("listPage");
          closeSidebar();
        } else if (text === "My Account") {
          disposeLiveTvPlayer();
          localStorage.setItem("currentPage", "accountPage");
          Router.showPage("accountPage");
          closeSidebar();
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        closeSidebar();
        break;
    }
  }

  function handleSortOptionsKeys(e) {
    const sortOptionItems = Array.from(
      sortOptions.querySelectorAll(".sort-option")
    );
    if (!sortOptionItems.length) return;

    let activeIndex = sortOptionItems.findIndex((item) =>
      item.classList.contains("active")
    );
    if (activeIndex === -1) activeIndex = 0;

    switch (e.key) {
      case "ArrowDown":
        activeIndex = (activeIndex + 1) % sortOptionItems.length;
        updateSortOptionsSelection(sortOptionItems, activeIndex);
        break;
      case "ArrowUp":
        activeIndex =
          (activeIndex - 1 + sortOptionItems.length) % sortOptionItems.length;
        updateSortOptionsSelection(sortOptionItems, activeIndex);
        break;
      case "Enter":
        const activeSortItem = sortOptionItems[activeIndex];
        const checkbox = activeSortItem.querySelector(".sort-checkbox");
        if (checkbox) {
          checkbox.checked = true;
          setSortOption(checkbox.dataset.sort);
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        closeSortMenu();
        break;
    }
  }

  function updateSidebarSelection(items, index) {
    items.forEach((item) => {
      item.classList.remove("active");
      const logo = item.querySelector(".sidebar-link-logo");
      if (logo) logo.classList.remove("sidebar-link-logo-focused");
    });

    const activeItem = items[index];
    if (activeItem) {
      activeItem.classList.add("active");
      const activeLogo = activeItem.querySelector(".sidebar-link-logo");
      if (activeLogo) activeLogo.classList.add("sidebar-link-logo-focused");
      activeItem.focus();
    }
  }

  function updateSortOptionsSelection(items, index) {
    items.forEach((item) => {
      item.classList.remove("active");
    });

    const activeItem = items[index];
    if (activeItem) {
      activeItem.classList.add("active");
      activeItem.focus();
    }
  }
}

window.buildDynamicSidebarOptions = buildDynamicSidebarOptions;
