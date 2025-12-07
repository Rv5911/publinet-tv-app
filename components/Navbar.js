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

    // Handle Sort Option Visibility
    const sortItem = sidebar.querySelector(".sidebar-sort");
    if (sortItem) {
      const SORT_ENABLED_PAGES = ["moviesPage", "seriesPage", "liveTvPage"];
      if (SORT_ENABLED_PAGES.includes(currentPage)) {
        sortItem.classList.remove("option-remove");
        sortItem.style.display = ""; // Revert to CSS default

        // Hide Top Rated for Live TV
        const topRatedOption = sidebar.querySelector(
          '.sort-checkbox[data-sort="top-rated"]'
        );
        if (topRatedOption) {
          const li = topRatedOption.closest("li");
          if (li) {
            if (currentPage === "liveTvPage") {
              li.style.display = "none";
              li.classList.add("option-remove");
            } else {
              li.style.display = "";
              li.classList.remove("option-remove");
            }
          }
        }
      } else {
        sortItem.classList.add("option-remove");
        sortItem.style.display = "none";
      }
    }
    let label = "";
    let action = "";
    const currentPlaylist = getCurrentPlaylist();

    // Return early if no playlist is available
    if (!currentPlaylist) {
      return;
    }

    const allRecentlyWatchedMovies = currentPlaylist.continueWatchingMovies;
    const allRecentlyWatchedSeries = currentPlaylist.continueWatchingSeries;
    const allRecentlyWatchedChannels = currentPlaylist.ChannelListLive;
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
        (series) => series && series.itemId == selectedSeriesId
      );

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
    } else if (currentPage === "liveTvPage") {
      if (allRecentlyWatchedChannels && allRecentlyWatchedChannels.length > 0) {
        label = "Clear Channel History";
        action = "clear-channel-history";
      } else {
        return;
      }
    }
    // FIX: Use consistent page name and proper boolean check
    else if (currentPage === "movieDetailPage") {
      if (isIncludedInRecentlyWatchedMovies) {
        label = "Remove Movie From Recently Watched";
        action = "remove-movie";
      } else {
        console.log(
          "Not showing remove option - movie not in recently watched"
        );
        return;
      }
    } else if (currentPage === "seriesDetailPage") {
      if (isIncludedInRecentlyWatchedSeries) {
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
    if (!name)
      return {
        success: false,
      };
    const updated = playlists.map((pl) => {
      if (pl.playlistName === name) {
        return updateFn(pl);
      }
      return pl;
    });
    localStorage.setItem("playlistsData", JSON.stringify(updated));
    return {
      success: true,
    };
  } catch (e) {
    console.error("updatePlaylistsData error", e);
    return {
      success: false,
      error: e,
    };
  }
}

function removeAllFavoriteMovies() {
  const res = updatePlaylistsData((pl) => ({
    ...pl,
    favouriteMovies: [],
  }));
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
  const res = updatePlaylistsData((pl) => ({
    ...pl,
    favouriteSeries: [],
  }));
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

function removeAllChannelHistory() {
  const res = updatePlaylistsData((pl) => ({
    ...pl,
    ChannelListLive: [],
  }));
  if (res.success) {
    if (typeof Toaster !== "undefined" && Toaster.showToast) {
      Toaster.showToast("success", "Cleared channel history");
    }
  }
}

function removeFavoriteMovieById(streamId) {
  if (!streamId) return;
  const res = updatePlaylistsData((pl) => {
    const fav = Array.isArray(pl.favouriteMovies) ? pl.favouriteMovies : [];
    const filtered = fav.filter((id) => String(id) !== String(streamId));
    return {
      ...pl,
      favouriteMovies: filtered,
    };
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
    return {
      ...pl,
      favouriteSeries: filtered,
    };
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

  // Navbar scroll logic
  // Navbar scroll logic refactored
  let currentScrollContainer = null;
  const navbarContainer = document.querySelector(".navbar-container");

  function handleNavbarScroll() {
    if (!navbarContainer) return;

    let scrollTop = 0;
    // Lower threshold to 20% of viewport
    const threshold = window.innerHeight * 0.2;

    if (currentScrollContainer === window) {
      scrollTop = window.scrollY;
    } else if (currentScrollContainer) {
      scrollTop = currentScrollContainer.scrollTop;
    }

    if (scrollTop > threshold) {
      navbarContainer.classList.add("navbar-hidden");
    } else {
      navbarContainer.classList.remove("navbar-hidden");
    }
  }

  function setupNavbarScrollListener() {
    const currentPage = localStorage.getItem("currentPage");
    let newContainer = window; // Default to window

    // Determine the scroll container based on the current page
    if (currentPage === "movieDetailPage") {
      const el = document.querySelector(".movie-detail-page-container");
      if (el) newContainer = el;
    } else if (currentPage === "seriesDetailPage") {
      const el = document.querySelector(
        ".series-detail-page-content-container"
      );
      if (el) newContainer = el;
    }
    // MoviesPage and SeriesPage typically scroll via window, so default applies

    // Only update if the container has changed or we need to re-attach
    // (Equality check for window works, DOM elements work by ref)
    if (currentScrollContainer !== newContainer || !currentScrollContainer) {
      // Clean up old listener
      if (currentScrollContainer) {
        currentScrollContainer.removeEventListener(
          "scroll",
          handleNavbarScroll
        );
      }

      currentScrollContainer = newContainer;

      // Attach new listener
      if (currentScrollContainer) {
        currentScrollContainer.addEventListener("scroll", handleNavbarScroll);
        // Reset visibility state when switching pages
        if (navbarContainer) navbarContainer.classList.remove("navbar-hidden");
      }
    }
  }

  // Initial setup
  setupNavbarScrollListener();

  // Watch for page changes (DOM updates) to re-attach listeners
  const appContainer = document.getElementById("main-app-container");
  if (appContainer) {
    const observer = new MutationObserver(() => {
      // Re-run setup when DOM changes (navigation)
      setupNavbarScrollListener();
    });
    // Observer options: check for child list changes (new pages loading)
    observer.observe(appContainer, { childList: true, subtree: false });
  }
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

  const resetParentalControlState = () => {
    if (typeof window.resetMoviesParentalState === "function") {
      window.resetMoviesParentalState();
    }
    if (typeof window.resetSeriesParentalState === "function") {
      window.resetSeriesParentalState();
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
      new CustomEvent("global-search", {
        detail: window.searchQuery,
      })
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

  navItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      const page = item.getAttribute("data-page");
      disposeLiveTvPlayer();
      resetParentalControlState();
      Router.showPage(page);
      updateNavbarActive(page);
      buildDynamicSidebarOptions();
    });

    item.addEventListener("focus", () => {
      localStorage.setItem("navigationFocus", "navbar");
      setActiveItem(index + 1);
    });
  });

  profileIcon.addEventListener("click", openSidebar);
  profileIcon.addEventListener("focus", () => {
    localStorage.setItem("navigationFocus", "navbar");
    setActiveItem(totalItems - 1);
  });
  profileIcon.addEventListener("blur", () => {
    profileIcon.classList.remove("active");
  });

  sortItem.addEventListener("click", toggleSortMenu);

  sortCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        setSortOption(e.target.dataset.sort);

        // Dispatch custom event for sort change
        const sortEvent = new CustomEvent("sortChanged", {
          detail: {
            sortType: e.target.dataset.sort,
            page: localStorage.getItem("currentPage"),
          },
        });
        document.dispatchEvent(sortEvent);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    const navigationFocus = localStorage.getItem("navigationFocus");
    const currentPage = localStorage.getItem("currentPage");
    const key = e.key;

    // Pages where navbar should not be active
    const NAVBAR_INACTIVE_PAGES = ["loginPage", "listPage", "settingsPage"];
    if (NAVBAR_INACTIVE_PAGES.includes(currentPage)) {
      return; // Don't process any navbar keydown events on these pages
    }

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

    // Allow ArrowLeft/ArrowRight default behavior if search input is focused
    if (isSearchFocused && ["ArrowLeft", "ArrowRight"].includes(key)) {
      // Do not prevent default
    } else if (["ArrowLeft", "ArrowRight"].includes(key)) {
      e.preventDefault();
    }

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
        // Handle ArrowDown for homePage, moviesPage, liveTvPage, and seriesPage
        if (
          (currentPage === "homePage" ||
            currentPage === "moviesPage" ||
            currentPage === "liveTvPage" ||
            currentPage == "movieDetailPage" ||
            currentPage == "seriesDetailPage" ||
            currentPage === "seriesPage") &&
          navigationFocus === "navbar"
        ) {
          // For moviesPage and seriesPage, prevent default immediately to avoid flickering
          if (currentPage === "moviesPage" || currentPage === "seriesPage") {
            e.preventDefault();
            e.stopImmediatePropagation();
          }

          searchInput.blur();

          navItems.forEach((item) => item.classList.remove("active"));
          searchInput.classList.remove("active");
          profileIcon.classList.remove("active");

          // For homePage, just set navigation focus and let HomePage.js handle it
          if (currentPage === "homePage") {
            localStorage.setItem("navigationFocus", currentPage);
            // Don't prevent default or stop propagation - let HomePage.js handle it
            return;
          }

          // For liveTvPage, focus on category search input
          if (currentPage === "liveTvPage") {
            localStorage.setItem("navigationFocus", "sidebarSearch");

            // Dispatch event to let LivePage know focus has changed
            window.dispatchEvent(new CustomEvent("navigation-focus-change"));

            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          if (currentPage === "seriesDetailPage") {
            localStorage.setItem("navigationFocus", "seriesDetailPage");

            setTimeout(() => {
              // Remove navbar focus
              navItems.forEach((item) => item.classList.remove("active"));
              searchInput.classList.remove("active");
              profileIcon.classList.remove("active");

              // Focus on play button in series detail
              const playBtn = document.querySelector(
                ".series-detail-play-button"
              );
              if (playBtn) {
                playBtn.classList.add("series-detail-button-focused");
                playBtn.focus();
              }
            }, 10);

            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }

          if (currentPage === "movieDetailPage") {
            localStorage.setItem("navigationFocus", "movieDetailPage");
            setTimeout(() => {
              const firstDetailPlayBtn = document.querySelector(
                ".movie-detail-play-button"
              );
              if (firstDetailPlayBtn) {
                document
                  .querySelectorAll(".movie-detail-button-focused")
                  .forEach((btn) =>
                    btn.classList.remove("movie-detail-button-focused")
                  );
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
            setTimeout(function () {
              // Move focus from navbar to movies page ONLY after timeout
              localStorage.setItem("navigationFocus", "moviesPage");

              let targetCard = null;
              let targetCategoryIndex = 0;

              // Iterate through all category lists to find the first one with cards
              const allCategoryLists =
                document.querySelectorAll(".movies-card-list");
              for (let i = 0; i < allCategoryLists.length; i++) {
                const list = allCategoryLists[i];
                const firstCard = list.querySelector(".movie-card");
                if (firstCard) {
                  targetCard = firstCard;
                  targetCategoryIndex = parseInt(
                    list.getAttribute("data-category") || "0",
                    10
                  );
                  break; // Found the first category with cards
                }
              }

              if (targetCard) {
                window.moviesNavigationState.currentCategoryIndex =
                  targetCategoryIndex;
                window.moviesNavigationState.currentCardIndex = 0;

                // Persist and update focus using MoviesPage helpers
                if (typeof window.saveMoviesNavigationState === "function") {
                  window.saveMoviesNavigationState();
                }
                targetCard.focus();
                if (typeof window.updateMoviesFocus === "function") {
                  window.updateMoviesFocus();
                }
              }
            }, 150);
            return;
          }

          // SeriesPage: prioritize My Fav on initial down from navbar
          if (currentPage === "seriesPage" && window.seriesNavigationState) {
            setTimeout(function () {
              // Move focus from navbar to series page ONLY after timeout
              localStorage.setItem("navigationFocus", "seriesPage");

              let targetCard = null;
              let targetCategoryIndex = 0;

              // Iterate through all category lists to find the first one with cards
              const allCategoryLists =
                document.querySelectorAll(".series-card-list");
              for (let i = 0; i < allCategoryLists.length; i++) {
                const list = allCategoryLists[i];
                const firstCard = list.querySelector(".series-card");
                if (firstCard) {
                  targetCard = firstCard;
                  targetCategoryIndex = parseInt(
                    list.getAttribute("data-category") || "0",
                    10
                  );
                  break; // Found the first category with cards
                }
              }

              if (targetCard) {
                window.seriesNavigationState.currentCategoryIndex =
                  targetCategoryIndex;
                window.seriesNavigationState.currentCardIndex = 0;

                // Persist and update focus using SeriesPage helpers
                if (typeof window.saveSeriesNavigationState === "function") {
                  window.saveSeriesNavigationState();
                }
                targetCard.focus();
                if (typeof window.updateSeriesFocus === "function") {
                  window.updateSeriesFocus();
                }
              }
            }, 150);
            return;
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
          window.searchQuery = "";
          clearMoviesAndSeriesLocalStorage();
          disposeLiveTvPlayer();
          resetParentalControlState();
          Router.showPage(page);
          updateNavbarActive(page);
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        if (sidebar && !sidebar.classList.contains("option-remove")) {
          closeSidebar();
        } else {
          // Handle back navigation from Navbar for Detail Pages
          if (currentPage === "seriesDetailPage") {
            localStorage.removeItem("selectedSeriesId");
            localStorage.removeItem("lastPlayedEpisodeId");
            localStorage.setItem("currentPage", "seriesPage");
            Router.showPage("seriesPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          } else if (currentPage === "movieDetailPage") {
            localStorage.removeItem("selectedMovieId");
            localStorage.setItem("currentPage", "moviesPage");
            Router.showPage("moviesPage");
            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          }
        }
        break;
    }
  });
  searchInput.addEventListener("focus", () => {
    localStorage.setItem("navigationFocus", "navbar");
    setActiveItem(0);
  });

  searchInput.addEventListener("blur", () => {
    searchInput.classList.remove("active");
  });

  function setActiveItem(index) {
    currentIndex = index;
    searchInput.classList.remove("active");
    navItems.forEach((i) => i.classList.remove("active"));
    profileIcon.classList.remove("active");

    if (index === 0) {
      searchInput.classList.add("active");
    } else if (index === totalItems - 1) {
      profileIcon.classList.add("active");
    } else {
      const item = navItems[index - 1];
      if (item) item.classList.add("active");
    }
  }

  function highlightNavItem(index) {
    setActiveItem(index);

    if (index === 0) {
      // Don't focus the search input when navigating with arrows
      // Only add the active class - actual focus happens on Enter key
      searchInput.blur(); // Ensure it's not focused
    } else if (index === totalItems - 1) {
      profileIcon.focus();
    } else {
      const item = navItems[index - 1];
      if (item) item.focus();
    }
  }

  function updateSearchVisibility(page) {
    // Pages where search input should be visible
    const PAGES_WITH_SEARCH = ["moviesPage", "seriesPage"];

    // Handle search input visibility
    const searchContainer = document.querySelector(".search-bar-container");
    const searchInput = document.getElementById("search-input");
    const searchIcon = document.querySelector(".nav-search-bar");

    if (searchContainer) {
      if (PAGES_WITH_SEARCH.includes(page)) {
        searchContainer.style.visibility = "visible";
        // Reset display property that might have been set by other pages (e.g., LivePage)
        if (searchInput) searchInput.style.display = "";
        if (searchIcon) searchIcon.style.display = "";
      } else {
        searchContainer.style.visibility = "hidden";
      }
    }
  }

  function updateNavbarActive(page) {
    const index = pageIndexMap[page] || 0;
    currentIndex = index + 1;
    highlightNavItem(currentIndex);
    localStorage.setItem("navigationFocus", "navbar");

    updateSearchVisibility(page);
  }

  window.updateSearchVisibility = updateSearchVisibility;

  function openSidebar() {
    buildDynamicSidebarOptions();
    sidebar.classList.remove("option-remove");
    // Manually set display block
    sidebar.style.display = "block";
    localStorage.setItem("navigationFocus", "sidebar");
    isSortOptionsOpen = false;
    const items = Array.from(
      sidebar.querySelectorAll("li.sidebar-link")
    ).filter(
      (item) =>
        !item.classList.contains("option-remove") &&
        item.style.display !== "none"
    );
    updateSidebarSelection(items, 0);
    const firstItem = items[0];
    if (firstItem) firstItem.focus();
  }

  window.setNavbarFocus = function (pageName) {
    const index = pageIndexMap[pageName];
    if (index !== undefined) {
      currentIndex = index + 1; // +1 because 0 is search
      highlightNavItem(currentIndex);
      localStorage.setItem("navigationFocus", "navbar");
    }
  };

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

    const playlistsData = localStorage.getItem("playlistsData")
      ? JSON.parse(localStorage.getItem("playlistsData"))
      : [];

    if (playlistsData.length > 0) {
      localStorage.removeItem("currentPlaylistData");
      localStorage.removeItem("selectedPlaylist");
      localStorage.setItem("navigationFocus", "");
      localStorage.setItem("isLogin", false);
      Router.showPage("listPage");
    } else {
      resetParentalControlState();
      localStorage.removeItem("currentPlaylistData");
      localStorage.removeItem("selectedPlaylist");
      localStorage.setItem("currentPage", "login");
      Router.showPage("login");
    }

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
      ).filter(
        (item) =>
          !item.classList.contains("option-remove") &&
          item.style.display !== "none"
      );
      const sortIndex = sidebarItems.indexOf(sortMenuItem);
      updateSidebarSelection(sidebarItems, sortIndex);
    }
  }

  function setSortOption(sortType) {
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

    localStorage.setItem("sortvalue", sortType);

    // Dispatch sort changed event
    const sortEvent = new CustomEvent("sortChanged", {
      detail: {
        sortType: sortType,
        page: localStorage.getItem("currentPage"),
      },
    });
    document.dispatchEvent(sortEvent);

    console.log(`Sorting by: ${sortType}`);

    // FIX: Restore navigationFocus to sidebar because page re-render might have stolen it
    if (sidebar && !sidebar.classList.contains("option-remove")) {
      localStorage.setItem("navigationFocus", "sidebar");
    }
  }

  function handleSidebarKeys(e) {
    if (isSortOptionsOpen) return;

    const items = Array.from(
      sidebar.querySelectorAll("li.sidebar-link")
    ).filter(
      (item) =>
        !item.classList.contains("option-remove") &&
        item.style.display !== "none"
    );
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
          } else if (action === "clear-channel-history") {
            removeAllChannelHistory();
            disposeLiveTvPlayer();
            localStorage.setItem("currentPage", "liveTvPage");
            Router.showPage("liveTvPage");
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
          resetParentalControlState();
          localStorage.setItem("currentPage", "settingsPage");

          Router.showPage("settingsPage");
          closeSidebar();
        } else if (text === "List User") {
          disposeLiveTvPlayer();
          resetParentalControlState();
          localStorage.removeItem("currentPlaylistData");
          localStorage.removeItem("selectedPlaylist");
          localStorage.setItem("navigationFocus", "");
          localStorage.setItem("isLogin", false);
          Router.showPage("listPage");

          closeSidebar();
        } else if (text === "My Account") {
          disposeLiveTvPlayer();
          resetParentalControlState();
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

          // Close sort menu after selection
          closeSortMenu();
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
