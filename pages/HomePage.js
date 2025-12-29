async function HomePage() {
    const selectedPlaylistData = localStorage.getItem("selectedPlaylist") ?
        JSON.parse(localStorage.getItem("selectedPlaylist")) :
        {};

    // Create and show custom home page loader immediately (before setTimeout)
    const homeLoader = document.createElement("div");
    homeLoader.id = "home-page-loader";
    homeLoader.innerHTML = `
    <div class="home-loader-content">
      <div class="home-loader-spinner"></div>
    </div>
  `;
    document.body.appendChild(homeLoader);

    // Function to update loader progress
    window.updateHomeLoaderProgress = function(percentage) {
        const percentageEl = document.getElementById("home-loader-percentage");
        const barFillEl = document.getElementById("home-loader-bar-fill");
        if (percentageEl) {
            percentageEl.textContent = Math.round(percentage) + "%";
        }
        if (barFillEl) {
            barFillEl.style.width = percentage + "%";
        }
    };

    // Simulate initial progress
    window.updateHomeLoaderProgress(10);

    setTimeout(function() {
        if (HomePage.cleanup) HomePage.cleanup();
        const loadingEl = document.querySelector("#loading-overlay");
        if (loadingEl) {
            loadingEl.style.background = "black";
            loadingEl.style.marginTop = "0px";
        }
        console.log(selectedPlaylistData, "selectedPlaylistData");

        // Navigation state
        let navState = {
            focus: "carousel", // 'carousel', 'watchNow', 'categories'
            currentCategory: 0,
            currentCard: 0,
            carouselStopped: false,
        };

        // Scroll to element function (from MoviesPage)
        function scrollToHomeElement(element) {
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
                        console.log("Home scroll failed");
                    }
                }
            }
        }

        function updateFocus() {
            // Remove all previous focus states
            document
                .querySelectorAll(".carousel-watch-now-btn.focused")
                .forEach((btn) => {
                    btn.classList.remove("focused");
                });
            document.querySelectorAll(".home-card.focused").forEach((card) => {
                card.classList.remove("focused");
            });

            if (navState.focus === "watchNow") {
                // Use the globally tracked carousel index
                const activeIndex = window.carouselActiveIndex || 0;
                const activeSlide = document.querySelector(
                    `.slide[data-index="${activeIndex}"]`
                );

                if (activeSlide) {
                    const btn = activeSlide.querySelector(".carousel-watch-now-btn");
                    if (btn) {
                        btn.classList.add("focused");
                        btn.focus(); // Set browser focus
                    }
                }
            } else if (navState.focus === "categories") {
                const currentCard = document.querySelector(
                    `.home-card[data-category="${navState.currentCategory}"][data-index="${navState.currentCard}"]`
                );
                console.log(
                    "updateFocus - looking for card:",
                    `category=${navState.currentCategory}, index=${navState.currentCard}`,
                    "found:",
                    !!currentCard
                );
                if (currentCard) {
                    currentCard.classList.add("focused");
                    currentCard.focus(); // Set browser focus
                    scrollToHomeElement(currentCard);

                    // Conditional Marquee
                    const title = currentCard.querySelector(".home-title-marquee");
                    if (title) {
                        // Reset first to ensure accurate measurement
                        title.classList.remove("marquee-active");
                        if (title.scrollWidth > title.clientWidth) {
                            title.classList.add("marquee-active");
                        }
                    }
                } else {
                    console.warn(
                        "Card not found in DOM!",
                        `category=${navState.currentCategory}, index=${navState.currentCard}`
                    );
                }
            }
        }

        function stopCarousel() {
            // Access the cleanup function from the carousel
            const slidesContainer = document.querySelector(".carousel-slides");
            if (slidesContainer) {
                // Stop any ongoing animations by canceling animation frames
                if (HomeCarousel.cleanup) {
                    HomeCarousel.cleanup();
                }
            }
            navState.carouselStopped = true;
        }

        function homePageKeydownEvents(e) {
            const key = e.key;
            const navigationFocus = localStorage.getItem("navigationFocus");

            // Only handle events when navigation focus is on homePage
            if (navigationFocus !== "homePage") {
                return;
            }

            switch (key) {
                case "ArrowDown":
                    e.preventDefault();

                    if (navState.focus === "carousel" || navState.focus === "watchNow") {
                        // If we're at carousel level, move to Watch Now
                        if (navState.focus === "carousel") {
                            stopCarousel();
                            navState.focus = "watchNow";
                            updateFocus();
                        }
                        // If already at Watch Now, move to categories
                        else if (navState.focus === "watchNow") {
                            // From Watch Now to first available category
                            const firstCard = document.querySelector(".home-card");

                            if (firstCard) {
                                const category = parseInt(
                                    firstCard.getAttribute("data-category")
                                );
                                const index = parseInt(firstCard.getAttribute("data-index"));

                                console.log(
                                    "ArrowDown from Watch Now - Found first card:",
                                    `category=${category}, index=${index}`
                                );

                                navState.focus = "categories";
                                navState.currentCategory = category;
                                navState.currentCard = index;
                                updateFocus();
                            } else {
                                console.log(
                                    "ArrowDown from Watch Now - No cards found in any category"
                                );
                            }
                        }
                    } else if (navState.focus === "categories") {
                        // Move to next category - dynamically find available categories
                        console.log(
                            "ArrowDown in categories - currentCategory:",
                            navState.currentCategory
                        );

                        // Get all available categories from DOM
                        const allCategoryLists = document.querySelectorAll(
                            ".home-card-list[data-category]"
                        );
                        const availableCategories = Array.from(allCategoryLists)
                            .map((list) => parseInt(list.getAttribute("data-category")))
                            .filter((catId) => {
                                const list = document.querySelector(
                                    `.home-card-list[data-category="${catId}"]`
                                );
                                return list && list.querySelectorAll(".home-card").length > 0;
                            })
                            .sort((a, b) => {
                                // Sort by preferred order: 1, 0, 2, 3
                                const order = [1, 0, 2, 3];
                                return order.indexOf(a) - order.indexOf(b);
                            });

                        console.log("Available categories:", availableCategories);

                        const currentIndex = availableCategories.indexOf(
                            navState.currentCategory
                        );
                        if (
                            currentIndex >= 0 &&
                            currentIndex < availableCategories.length - 1
                        ) {
                            // Move to next available category
                            const nextCategory = availableCategories[currentIndex + 1];

                            // Get the number of cards in the next category
                            const nextCategoryList = document.querySelector(
                                `.home-card-list[data-category="${nextCategory}"]`
                            );
                            const nextCategoryCards = nextCategoryList ?
                                nextCategoryList.querySelectorAll(".home-card").length :
                                0;

                            // Maintain horizontal position, or use last card if next category has fewer items
                            const targetCardIndex = Math.min(
                                navState.currentCard,
                                nextCategoryCards - 1
                            );

                            navState.currentCategory = nextCategory;
                            navState.currentCard = Math.max(0, targetCardIndex);
                            console.log(
                                `Moving to category ${navState.currentCategory}, card ${navState.currentCard}`
                            );
                            updateFocus();
                        }
                    }
                    break;

                case "ArrowUp":
                    e.preventDefault();

                    if (navState.focus === "watchNow") {
                        // From Watch Now back to carousel/navbar
                        navState.focus = "carousel";
                        navState.carouselStopped = false;

                        // Remove focus from watch now button
                        document
                            .querySelectorAll(".carousel-watch-now-btn.focused")
                            .forEach((btn) => {
                                btn.classList.remove("focused");
                            });

                        // Scroll to top
                        try {
                            const homeContainer = document.querySelector(
                                ".home-page-container"
                            );
                            if (homeContainer) {
                                homeContainer.scrollTop = 0;
                            }
                            window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                            });
                        } catch (err) {
                            console.log("Scroll to top failed:", err);
                        }

                        // Focus navbar
                        localStorage.setItem("navigationFocus", "navbar");

                        setTimeout(() => {
                            const homeNavItem = document.querySelector(
                                '.nav-item[data-page="homePage"]'
                            );
                            if (homeNavItem) {
                                homeNavItem.focus();
                                homeNavItem.classList.add("active");
                            }
                        }, 50);
                    } else if (navState.focus === "categories") {
                        // Move to previous category - dynamically find available categories
                        // Get all available categories from DOM
                        const allCategoryLists = document.querySelectorAll(
                            ".home-card-list[data-category]"
                        );
                        const availableCategories = Array.from(allCategoryLists)
                            .map((list) => parseInt(list.getAttribute("data-category")))
                            .filter((catId) => {
                                const list = document.querySelector(
                                    `.home-card-list[data-category="${catId}"]`
                                );
                                return list && list.querySelectorAll(".home-card").length > 0;
                            })
                            .sort((a, b) => {
                                // Sort by preferred order: 1, 0, 2, 3
                                const order = [1, 0, 2, 3];
                                return order.indexOf(a) - order.indexOf(b);
                            });

                        console.log("Available categories (ArrowUp):", availableCategories);

                        const currentIndex = availableCategories.indexOf(
                            navState.currentCategory
                        );

                        if (currentIndex > 0) {
                            // Move to previous available category
                            const prevCategory = availableCategories[currentIndex - 1];

                            // Get the number of cards in the previous category
                            const prevCategoryList = document.querySelector(
                                `.home-card-list[data-category="${prevCategory}"]`
                            );
                            const prevCategoryCards = prevCategoryList ?
                                prevCategoryList.querySelectorAll(".home-card").length :
                                0;

                            // Maintain horizontal position, or use last card if previous category has fewer items
                            const targetCardIndex = Math.min(
                                navState.currentCard,
                                prevCategoryCards - 1
                            );

                            navState.currentCategory = prevCategory;
                            navState.currentCard = Math.max(0, targetCardIndex);
                            updateFocus();
                        } else {
                            // Already at first category, go to Watch Now
                            navState.focus = "watchNow";
                            updateFocus();
                        }
                    }
                    break;

                case "ArrowRight":
                    e.preventDefault();

                    if (navState.focus === "categories") {
                        const categoryList = document.querySelector(
                            `.home-card-list[data-category="${navState.currentCategory}"]`
                        );
                        const cards = categoryList ?
                            categoryList.querySelectorAll(".home-card") :
                            [];

                        if (navState.currentCard < cards.length - 1) {
                            navState.currentCard++;
                            updateFocus();
                        }
                    }
                    break;

                case "ArrowLeft":
                    e.preventDefault();

                    if (navState.focus === "categories") {
                        if (navState.currentCard > 0) {
                            navState.currentCard--;
                            updateFocus();
                        }
                    }
                    break;

                case "Enter":
                    e.preventDefault();

                    if (navState.focus === "watchNow") {
                        const activeIndex = window.carouselActiveIndex || 0;

                        const activeSlide = document.querySelector(
                            `.slide[data-index="${activeIndex}"]`
                        );
                        let streamIdFromDOM = null;
                        if (activeSlide) {
                            const btn = activeSlide.querySelector(".carousel-watch-now-btn");
                            if (btn) {
                                streamIdFromDOM = btn.getAttribute("data-stream-id");
                            }
                        }

                        const selectedItem =
                            window.homeCarouselSliderData &&
                            window.homeCarouselSliderData[activeIndex] ?
                            window.homeCarouselSliderData[activeIndex] :
                            null;

                        let currentPlaylistData = localStorage.getItem(
                            "currentPlaylistData"
                        );
                        if (!currentPlaylistData) return;
                        currentPlaylistData = JSON.parse(currentPlaylistData);

                        let movieVideoUrl = "";
                        if (
                            currentPlaylistData.server_info &&
                            currentPlaylistData.user_info &&
                            selectedItem.movie_data &&
                            selectedItem.movie_data.stream_id &&
                            selectedItem.movie_data.container_extension
                        ) {
                            movieVideoUrl =
                                currentPlaylistData.server_info.server_protocol +
                                "://" +
                                currentPlaylistData.server_info.url +
                                ":" +
                                currentPlaylistData.server_info.port +
                                "/movie/" +
                                currentPlaylistData.user_info.username +
                                "/" +
                                currentPlaylistData.user_info.password +
                                "/" +
                                selectedItem.movie_data.stream_id +
                                "." +
                                selectedItem.movie_data.container_extension;
                        }

                        localStorage.setItem(
                            "playingItemData",
                            JSON.stringify(selectedItem.movie_data)
                        );
                        localStorage.setItem("selectedVideoItemUrl", movieVideoUrl);
                        localStorage.setItem(
                            "selectedMovieId",
                            selectedItem.movie_data.stream_id
                        );
                        localStorage.setItem("from", "movie");
                        localStorage.setItem("fromHome", "true");

                        localStorage.setItem("currentPage", "videojsPlayer");

                        Router.showPage("videoJsPlayer");
                        const navbarEl = document.querySelector("#navbar-root");
                        if (navbarEl) {
                            navbarEl.style.display = "none";
                        }
                        document.body.style.backgroundImage = "none";
                        document.body.style.backgroundColor = "black";
                        document.removeEventListener("keydown", homePageKeydownEvents);
                        return;
                    } else if (navState.focus === "categories") {
                        const currentCard = document.querySelector(
                            `.home-card[data-category="${navState.currentCategory}"][data-index="${navState.currentCard}"]`
                        );
                        if (currentCard) {
                            const streamId = currentCard.getAttribute("data-stream-id");
                            const type = currentCard.getAttribute("data-type"); // 'movie' or 'series'

                            console.log("CATEGORY SELECTED:", {
                                category: navState.currentCategory,
                                index: navState.currentCard,
                                streamId,
                                type,
                            });

                            if (type === "movie") {
                                // Navigate to Movie Detail Page
                                let isContinueWatchingMovie = false;
                                localStorage.setItem(
                                    "moviesCategoryIndex",
                                    navState.currentCategory
                                );
                                localStorage.setItem("moviesCardIndex", navState.currentCard);
                                localStorage.setItem(
                                    "moviesSelectedCategoryId",
                                    navState.currentCategory
                                ); // Just a placeholder if needed

                                localStorage.setItem("selectedMovieId", streamId);
                                const currentPlaylist = getCurrentPlaylist();
                                const allRecentlyWatchedMovies =
                                    currentPlaylist.continueWatchingMovies;
                                if (
                                    allRecentlyWatchedMovies &&
                                    Array.isArray(allRecentlyWatchedMovies)
                                ) {
                                    isContinueWatchingMovie = allRecentlyWatchedMovies.some(
                                        (movie) => movie && movie.itemId == streamId
                                    );
                                }

                                localStorage.setItem(
                                    "isContinueWatchingMovie",
                                    isContinueWatchingMovie.toString()
                                );

                                // buildDynamicSidebarOptions(); // This might be needed if it exists globally or we need to replicate logic

                                const selectedMovieItem = window.allMoviesStreams.find(
                                    (item) => item.stream_id == streamId
                                );
                                if (selectedMovieItem) {
                                    localStorage.setItem(
                                        "selectedMovieData",
                                        JSON.stringify(selectedMovieItem)
                                    );
                                }

                                if (HomePage.cleanup) HomePage.cleanup();
                                document.querySelector("#loading-progress").style.display =
                                    "none";
                                localStorage.setItem("currentPage", "movieDetailPage");
                                localStorage.setItem("navigationFocus", "movieDetailPage");
                                Router.showPage("movieDetailPage");
                            } else if (type === "series") {
                                // Navigate to Series Detail Page
                                localStorage.setItem(
                                    "seriesCategoryIndex",
                                    navState.currentCategory
                                );
                                localStorage.setItem("seriesCardIndex", navState.currentCard);
                                localStorage.setItem(
                                    "seriesSelectedCategoryId",
                                    navState.currentCategory
                                );

                                localStorage.setItem("selectedSeriesId", streamId);

                                const selectedSeriesItem = window.allSeriesStreams.find(
                                    (item) => item.series_id == streamId
                                );
                                if (selectedSeriesItem) {
                                    localStorage.setItem(
                                        "selectedSeriesItem",
                                        JSON.stringify(selectedSeriesItem)
                                    );
                                }

                                if (HomePage.cleanup) HomePage.cleanup();
                                document.querySelector("#loading-progress").style.display =
                                    "none";
                                localStorage.setItem("currentPage", "seriesDetailPage");
                                localStorage.setItem("navigationFocus", "seriesDetailPage");
                                Router.showPage("seriesDetailPage");
                            }
                        }
                    }
                    break;

                case "Backspace":
                case "Escape":
                case "Back":
                case "BrowserBack":
                case "XF86Back":
                case 10009:
                    // localStorage.setItem("currentPage", "loginPage");
                    // HomePage.cleanup();
                    // Router.showPage("login");
                    break;

                default:
                    break;
            }
        }

        document.addEventListener("keydown", homePageKeydownEvents);
        document.addEventListener("keydown", (e) => {
            if (localStorage.getItem("currentPage") == "dashboard") {
                const backKeys = [
                    10009,
                    "Escape",
                    "Back",
                    "BrowserBack",
                    "XF86Back",
                    "Backspace",
                ];
                if (
                    e.key === "XF86Exit" ||
                    e.key === "XF86Home" ||
                    e.keyCode === 10071 ||
                    backKeys.includes(e.keyCode) ||
                    backKeys.includes(e.key)
                ) {
                    e.preventDefault();
                    localStorage.setItem("returnPage", "homePage");
                    localStorage.setItem("returnFocus", "homePage");
                    localStorage.setItem("currentPage", "exitModal");
                    Router.showPage("exitModal");
                }
            }
        });

        HomePage.cleanup = function() {
            document.removeEventListener("keydown", homePageKeydownEvents);
        };
    }, 0);

    // Get favorite and recently added movies and series
    const currentPlaylist = getCurrentPlaylist();

    console.log("currentPlaylist", currentPlaylist);

    const deduplicateByName = (items) => {
        const seen = new Set();
        return items.filter((item) => {
            const name = (item && item.name ? item.name : "").toLowerCase().trim();
            if (!name) return true;
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    };

    // --- FAVORITES ---
    const favoriteMovieIds = currentPlaylist.favouriteMovies ?
        currentPlaylist.favouriteMovies.map((id) => String(id)) :
        [];
    const favoriteSeriesIds = currentPlaylist.favouriteSeries ?
        currentPlaylist.favouriteSeries.map((id) => String(id)) :
        [];

    const allMoviesStreams = window.allMoviesStreams || [];
    const allSeriesStreams = window.allSeriesStreams || [];

    // Map IDs to Objects
    const favoriteMovies = allMoviesStreams
        .filter((stream) => favoriteMovieIds.includes(String(stream.stream_id)))
        .map((m) => ({
            ...m,
            type: "movie",
        }));

    const favoriteSeries = allSeriesStreams
        .filter((stream) => favoriteSeriesIds.includes(String(stream.series_id)))
        .map((s) => ({
            ...s,
            type: "series",
        }));

    // Merge Favorites
    const allFavorites = deduplicateByName([
        ...favoriteMovies,
        ...favoriteSeries,
    ]);
    // You might want to sort them, e.g., by name or added date, but for now just merging
    // If we had a 'favoritedAt' timestamp, we could sort by that.

    // --- RECENTLY WATCHED ---
    // Extract itemIds from continueWatching arrays
    const continueWatchingMovies = currentPlaylist.continueWatchingMovies || [];
    const continueWatchingSeries = currentPlaylist.continueWatchingSeries || [];

    // We need to map these back to the full stream objects
    // continueWatching items usually have { itemId: "...", ... }

    const recentMovies = continueWatchingMovies
        .map((cw) => {
            const stream = allMoviesStreams.find(
                (s) => String(s.stream_id) === String(cw.itemId)
            );
            return stream ?
                {
                    ...stream,
                    type: "movie",
                    lastWatched: cw.date || 0,
                } :
                null; // Assuming there might be a date/timestamp
        })
        .filter(Boolean);

    const recentSeries = continueWatchingSeries
        .map((cw) => {
            const stream = allSeriesStreams.find(
                (s) => String(s.series_id) === String(cw.itemId)
            );
            return stream ?
                {
                    ...stream,
                    type: "series",
                    lastWatched: cw.date || 0,
                } :
                null;
        })
        .filter(Boolean);

    // Merge Recently Watched
    const allRecentlyWatched = deduplicateByName([
        ...recentMovies,
        ...recentSeries,
    ]);

    const mergedRecentlyWatched = allRecentlyWatched.slice(0, 20); // Limit to 20 total?

    // --- RECENTLY ADDED (Combined Movies and Series) ---
    // Get top 10 most recently added movies
    const recentlyAddedMovies = [...allMoviesStreams]
        .sort((a, b) => (b.added || 0) - (a.added || 0))
        .slice(0, 10)
        .map((m) => ({
            ...m,
            type: "movie",
        }));

    // Get top 10 most recently added series
    const recentlyAddedSeries = [...allSeriesStreams]
        .sort((a, b) => (b.added || 0) - (a.added || 0))
        .slice(0, 10)
        .map((s) => ({
            ...s,
            type: "series",
        }));

    // Combine 10 movies + 10 series and sort by added date for display
    const allRecentlyAdded = deduplicateByName([
        ...recentlyAddedMovies,
        ...recentlyAddedSeries,
    ]).sort((a, b) => (b.added || 0) - (a.added || 0));

    // Helper function to create card HTML
    function createHomeCard(item, categoryIndex, cardIndex) {
        const type = item.type || "movie";
        const isMovie = type === "movie";

        const id = isMovie ? item.stream_id : item.series_id;
        const name = item.name || "Unknown";
        const image = isMovie ?
            item.stream_icon || "./assets/demo-img-card.png" :
            item.cover || item.stream_icon || "./assets/demo-img-card.png";
        const rating = item.rating_5based || "0";
        const categoryName = item.category_name || (isMovie ? "Movie" : "Series");

        // Check favorites
        let isFav = false;
        if (isMovie) {
            isFav = favoriteMovieIds.includes(String(id));
        } else {
            isFav = favoriteSeriesIds.includes(String(id));
        }

        return `
      <div class="home-card" 
           data-category="${categoryIndex}" 
           data-index="${cardIndex}" 
           data-stream-id="${id}"
           data-type="${type}"
           data-image-url="${image}"
           tabindex="0"
           style="background-image: url('${
             image || "./assets/placeholder-img.png"
           }')">
           <img src="${image}" style="display: none;" onerror="this.parentElement.style.backgroundImage = 'url(./assets/placeholder-img.png)'" />
        <div class="home-card-content">
          <div class="home-card-top">
            <img src="./assets/heartIcon.png" 
                 style="display: ${isFav ? "block" : "none"}" 
                 alt="Favorite" 
                 class="home-card-heart" />
          </div>
          <div class="home-card-play-div">
            <img src="./assets/card-play-icon.png" alt="Play" class="home-card-play" />
          </div>
          <div class="home-card-bottom">
            <div class="home-card-bottom-left">
              <h3>${categoryName}</h3>
              <h2 class="home-title-marquee">${name}</h2>
            </div>
            <div class="home-card-bottom-right">
              <h3 style="opacity: 0">${
                isMovie ? "2h 0m" : item.seasons ? item.seasons + " S" : ""
              }</h3>
              <span class="home-card-rating">
                <img src="./assets/rating-star.png" class="home-card-star-icon" />
                ${rating}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    // Await the carousel HTML (this is async and fetches movie details)
    const carouselHtml = await HomeCarousel();

    // Hide custom home page loader after carousel is loaded
    const loaderElement = document.querySelector("#home-page-loader");
    if (loaderElement) {
        loaderElement.style.animation = "fadeOut 0.3s ease-out";
        setTimeout(() => {
            if (loaderElement && loaderElement.parentNode) {
                loaderElement.parentNode.removeChild(loaderElement);
            }
        }, 300);
    }

    if (
        (!carouselHtml ||
            carouselHtml.length === 0 ||
            carouselHtml.includes("No content available")) &&
        mergedRecentlyWatched.length === 0 &&
        allFavorites.length === 0 &&
        allRecentlyAdded.length === 0
    ) {
        return `
      <div class="home-page-no-data">
        <p>No Data found</p>
      </div>
    `;
    }

    return `
    <div class="home-page-container">
      <div class="home-poster">
        ${carouselHtml}
      </div>
      
      ${
        mergedRecentlyWatched.length > 0
          ? `
      <div class="home-recent-container">
        <h1>Recently Watched</h1>
        <div class="home-card-list" data-category="1">
          ${mergedRecentlyWatched
            .map((item, index) => createHomeCard(item, 1, index))
            .join("")}
        </div>
      </div>
      `
          : ""
      }
      ${
        allFavorites.length > 0
          ? `
      <div class="home-fav-container">
        <h1>My Fav</h1>
        <div class="home-card-list" data-category="0">
          ${allFavorites
            .map((item, index) => createHomeCard(item, 0, index))
            .join("")}
        </div>
      </div>
      `
          : ""
      }
      
      ${
        allRecentlyAdded.length > 0
          ? `
      <div class="home-recently-added-container">
        <h1 class="home-recently-added-h1">Recently Added</h1>
        <div class="home-card-list" data-category="2">
          ${allRecentlyAdded
            .map((item, index) => createHomeCard(item, 2, index))
            .join("")}
        </div>
      </div>
      `
          : ""
      }

      
    </div>
  `;
}