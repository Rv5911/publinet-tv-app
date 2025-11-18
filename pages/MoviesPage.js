// MoviesPage.js file
let moviesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

let allMoviesStreamsData = window.allMoviesStreams || [];
let favoriteMoviesIds = [];

let isMoviesNavigationInitialized = false;

let moviesChunkLoadingState = {
    loadedCategories: 0,
    categoryChunkSize: 4,
    loadedChunks: {},
    horizontalChunkSize: 12,
    isLoading: false
};

let moviesEnterKeyState = {
    isPressed: false,
    pressStartTime: 0,
    longPressThreshold: 400,
    timeoutId: null
};

let moviesNavigationDebounce = {
    lastKeyPress: 0,
    debounceTime: 300,
    isDebouncing: false
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
    return (streams || []).filter(s => normalizeText(s && s.name).includes(q));
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
        category_id: movieStream.category_id ? movieStream.category_id : null
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
        const playlist = playlists.find(p => p.playlistName === username);
        
        if (playlist && playlist.movies) {
            return playlist.movies.map(id => id.toString());
        }
        
        return [];
    } catch (e) {
        console.error("Error getting favorite movies:", e);
        return [];
    }
}

function getRecentlyWatchedMovies() {
    try {
        let username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        for (let i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                let recent = playlists[i].continueWatchingMovies || [];
                return recent.slice(0, 15).map(formatMovieData).filter(m => m !== null);
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
        sorted.sort(function(a, b) {
            return (parseFloat(b.rating_5based) || 0) - (parseFloat(a.rating_5based) || 0);
        });
        
        return sorted.slice(0, 30).map(formatMovieData).filter(m => m !== null);
    } catch (e) {
        return [];
    }
}

function getAPICategories() {
    let allMoviesCategoriesData = window.moviesCategories || [];
    let allMoviesStreamsData = window.allMoviesStreams || [];
    
    if (allMoviesCategoriesData.length === 0 || allMoviesStreamsData.length === 0) {
        return [];
    }
    
    let categories = [];
    for (let i = 0; i < allMoviesCategoriesData.length; i++) {
        let category = allMoviesCategoriesData[i];
        if (!category) continue; // Skip if category is undefined
        
        let movies = [];
        
        for (let j = 0; j < allMoviesStreamsData.length; j++) {
            let stream = allMoviesStreamsData[j];
            if (!stream) continue; // Skip if stream is undefined
            
            if (stream.category_id == category.category_id) {
                movies.push(stream);
            }
        }
        movies = filterStreamsByQuery(movies).slice(0, 50);
        
        categories.push({
            title: category.category_name ? category.category_name.replace(/[*]/g, "") : "Category",
            movies: movies,
            id: category.category_id,
            containerClass: "movies-category-container",
            category_id: category.category_id
        });
    }
    
    return categories;
}

function createMovieCard(movieData, size, categoryIndex, movieIndex) {
    if (!movieData) return ''; // Add safety check
    
    let isLarge = size === "large";
    let cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
    let movieId = String(movieData.stream_id || movieData.id);
    
    let isMovieFav = Array.isArray(favoriteMoviesIds) && 
                     favoriteMoviesIds.some(favId => String(favId) === String(movieId));
    
    let imageUrl = movieData.image || "./assets/demo-img-card.png";
    let titleClass = 'movie-title-marquee';
    
    // Safely get category name
    let currentCardCategory = window.moviesCategories ? 
        window.moviesCategories.filter((cat) => cat.category_id == movieData.category_id) : 
        [];
    
    let categoryName = currentCardCategory.length > 0 ? 
        currentCardCategory[0].category_name : 
        movieData.genre || "Movie"; // Use genre as fallback

    return `<div class="${cardClass}" 
            data-category="${categoryIndex}" 
            data-index="${movieIndex}" 
            data-stream-id="${movieId}" 
            style="background-image: url('${imageUrl ? imageUrl : "./assets/demo-img-card.png"}')">
            <div class="movie-card-content">
                <div class="movie-card-top">
                    <img src="./assets/heartIcon.png" 
                         style="display: ${isMovieFav ? 'block' : 'none'}" 
                         alt="Favorite" 
                         class="movie-card-heart" />
                </div>
                <div class="movie-card-play-div">
                    <img src="./assets/card-play-icon.png" alt="Play" class="movie-card-play" />
                </div>
                <div class="movie-card-bottom">
                    <div class="movie-card-bottom-left">
                        <h3>${categoryName}</h3>
                        <h2 class="${titleClass}">${movieData.title || "Unknown"}</h2>
                    </div>
                    <div class="movie-card-bottom-right">
                        <h3>${movieData.duration || "2h 0m"}</h3>
                        <span class="movie-card-rating"> <img src="./assets/rating-star.png" class="movie-card-star-icon" />${movieData.rating ? movieData.rating : "0"}</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function createMoviesLoadingIndicator(categoryIndex) {
    return '<div class="movies-loading-indicator" data-category="' + categoryIndex + '">' +
           '<p>Loading...</p>' +
           '</div>';
}

function getMoviesLoadedChunkCount(categoryIndex) {
    return moviesChunkLoadingState.loadedChunks[categoryIndex] || 0;
}

function setMoviesLoadedChunkCount(categoryIndex, count) {``
    moviesChunkLoadingState.loadedChunks[categoryIndex] = count;
}

function loadMoviesChunk(category, categoryIndex) {
    if (!category || !category.movies || category.movies.length === 0) return '';
    
    let loadedCount = getMoviesLoadedChunkCount(categoryIndex);
    let chunkSize = moviesChunkLoadingState.horizontalChunkSize;
    let totalMovies = category.movies.length;
    
    if (loadedCount >= totalMovies) return '';
    
    let endIndex = Math.min(loadedCount + chunkSize, totalMovies);
    let cardsHTML = '';
    
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
    
    if (!category || !category.movies || category.movies.length === 0) {
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
    
    if (currentLoaded >= allCategories.length) {
        let container = document.querySelector('.movies-page-container');
        if (container) {
            let categoriesLoading = container.querySelector('.categories-loading-indicator');
            if (categoriesLoading) {
                categoriesLoading.remove();
            }
        }
        return;
    }
    
    moviesChunkLoadingState.isLoading = true;
    
    let nextChunk = Math.min(currentLoaded + moviesChunkLoadingState.categoryChunkSize, allCategories.length);
    
    let safetyTimeout = setTimeout(function() {
        if (moviesChunkLoadingState.isLoading) {
            console.warn('loadMoreMoviesCategories: Safety timeout triggered, resetting loading state');
            moviesChunkLoadingState.isLoading = false;
            let container = document.querySelector('.movies-page-container');
            if (container) {
                let categoriesLoading = container.querySelector('.categories-loading-indicator');
                if (categoriesLoading) {
                    categoriesLoading.remove();
                }
            }
        }
    }, 5000);
    
    setTimeout(function() {
        try {
            let container = document.querySelector('.movies-page-container');
            if (!container) {
                clearTimeout(safetyTimeout);
                moviesChunkLoadingState.isLoading = false;
                return;
            }
            
            let categoriesLoading = container.querySelector('.categories-loading-indicator');
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
                        container.insertAdjacentHTML('beforeend', categoryHTML);
                        categoriesAdded++;
                    } catch (e) {
                        console.error('Error creating movies category section:', e);
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
            
            if (hasMoreCategories) {
                container.insertAdjacentHTML('beforeend', '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>');
            }
            
            moviesChunkLoadingState.loadedCategories = nextChunk;
            clearTimeout(safetyTimeout);
            moviesChunkLoadingState.isLoading = false;
            
            if (categoriesAdded > 0) {
                updateMoviesFocus();
            }
        } catch (e) {
            console.error('Error in loadMoreMoviesCategories:', e);
            clearTimeout(safetyTimeout);
            moviesChunkLoadingState.isLoading = false;
            
            let container = document.querySelector('.movies-page-container');
            if (container) {
                let categoriesLoading = container.querySelector('.categories-loading-indicator');
                if (categoriesLoading) {
                    categoriesLoading.remove();
                }
            }
        }
    }, 200);
}

function createMoviesCategorySection(category, categoryIndex) {
    let size = category.id === "popular" ? "large" : "normal";
    
    let html = '<div class="' + category.containerClass + '">';
    html += '<h1>' + category.title + '</h1>';
    html += '<div class="movies-card-list ' + category.id + '-list" data-category="' + categoryIndex + '">';
    
    let initialMovies = loadMoviesChunk(category, categoryIndex);
    html += initialMovies;
    
    if (category.movies && category.movies.length > getMoviesLoadedChunkCount(categoryIndex)) {
        html += createMoviesLoadingIndicator(categoryIndex);
    }
    
    html += '</div>';
    html += '</div>';
    
    return html;
}

function createMoviesNoDataMessage(categoryTitle) {
    return '<div class="no-data-container">' +
           '<div class="no-data-content">' +
           '<h2>No Data Available</h2>' +
           '<p>No ' + categoryTitle + ' found</p>' +
           '</div>' +
           '</div>';
}

function createMoviesNoSearchMessage() {
    return '<div class="no-data-container">' +
           '<div class="no-data-content">' +
           '<h2>No Search Results Found</h2>' +
           '</div>' +
           '</div>';
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
            
            moviesEnterKeyState.timeoutId = setTimeout(function() {
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
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
        let isContinueWatchingMovie = false;
        localStorage.setItem("moviesCategoryIndex", categoryIndex);
        localStorage.setItem("moviesCardIndex", cardIndex);
        localStorage.setItem("moviesSelectedCategoryId", categoryIndex);
        
        localStorage.setItem("selectedMovieId", streamId);
        const currentPlaylist = getCurrentPlaylist();
        const allRecentlyWatchedMovies = currentPlaylist.continueWatchingMovies;
        if(allRecentlyWatchedMovies && Array.isArray(allRecentlyWatchedMovies)){
            isContinueWatchingMovie = allRecentlyWatchedMovies.some(movie => 
                movie && movie.itemId == streamId
            );
        }
        
        localStorage.setItem("isContinueWatchingMovie", isContinueWatchingMovie.toString());
        
        buildDynamicSidebarOptions();

        const selectedMovieItem = window.allMoviesStreams.find(item => item.stream_id == streamId);
        if (selectedMovieItem) {
            localStorage.setItem("selectedMovieData", JSON.stringify(selectedMovieItem));
        }

        cleanupMoviesNavigation();
        
        document.querySelector("#loading-progress").style.display = "none";
        
        localStorage.setItem("currentPage", "movieDetailPage");
        localStorage.setItem("navigationFocus", "movieDetailPage");
        
        Router.showPage("movieDetailPage"); 
    }
}

function handleMoviesLongPressEnter() {
    if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let categoryIndex = moviesNavigationState.currentCategoryIndex;
    let cardIndex = moviesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
        const result = toggleFavoriteItem(Number(streamId), "favouriteMovies", getCurrentPlaylistUsername());
        const heartEl = currentCard.querySelector('.movie-card-heart');
        if (heartEl) {
            heartEl.style.display = result.isFav ? 'block' : 'none';
        }
        
        // Also update hearts on all duplicate cards across categories
        document.querySelectorAll('.movie-card[data-stream-id="' + streamId + '"] .movie-card-heart').forEach(function(h){
            h.style.display = result.isFav ? 'block' : 'none';
        });
        
        if (typeof Toaster !== 'undefined' && Toaster.showToast) {
            Toaster.showToast(result.isFav ? 'success' : 'error', result.isFav ? 'Added to Favorites' : 'Removed from Favorites');
        }
        
        // Refresh My Fav list in real time
        if (typeof refreshMoviesFavoritesList === 'function') {
            refreshMoviesFavoritesList();
        }
        
        const listEl = currentCard.closest('.movies-card-list');
        const isFavCategory = listEl && listEl.classList.contains('fav-list');
        if (isFavCategory && !result.isFav) {
            // Remove from DOM and adjust focus when removing from My Fav
            currentCard.remove();
            const remainingCards = listEl.querySelectorAll('.movie-card');
            moviesNavigationState.currentCardIndex = Math.min(moviesNavigationState.currentCardIndex, Math.max(remainingCards.length - 1, 0));
            
            // If last item removed, delete the entire My Fav category section
            if (remainingCards.length === 0) {
                const favContainer = listEl.closest('.movies-fav-container');
                if (favContainer) {
                    favContainer.remove();
                }
                // Reset loaded chunk count for this category index
                const categoryIdxAttr = listEl.getAttribute('data-category');
                const favIdx = categoryIdxAttr ? parseInt(categoryIdxAttr, 10) : moviesNavigationState.currentCategoryIndex;
                setMoviesLoadedChunkCount(favIdx, 0);
                
                // If focus was on the fav category, move to the next available category
                if (moviesNavigationState.currentCategoryIndex === favIdx) {
                    const nextIdx = findNextMoviesCategoryWithMovies(favIdx + 1, 1);
                    moviesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
                    moviesNavigationState.currentCardIndex = 0;
                }
            }
        }
        
        updateMoviesFocus();
        saveMoviesNavigationState();
    }
}

function refreshMoviesFavoritesList() {
    const currentPlaylist = getCurrentPlaylist();
    const favIdsRaw = currentPlaylist ? (currentPlaylist.favouriteMovies || []) : [];
    const favIds = Array.isArray(favIdsRaw) ? favIdsRaw.map(id => String(id)) : [];
    favoriteMoviesIds = favIds; // used by createMovieCard heart display

    const favouriteMovies = (window.allMoviesStreams && favIds.length)
        ? window.allMoviesStreams.filter(m => m && favIds.includes(String(m.stream_id)))
        : [];

    // If in search mode, do not show My Fav section; keep page focused on search results
    const isSearchMode = !!getMoviesSearchQuery();
    if (isSearchMode) {
        const favContainerSearch = document.querySelector('.movies-fav-container');
        const favListSearch = document.querySelector('.movies-card-list.fav-list');
        if (favListSearch) {
            const categoryIndexAttr = favListSearch.getAttribute('data-category');
            const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;
            setMoviesLoadedChunkCount(categoryIndex, 0);
        }
        if (favContainerSearch) {
            favContainerSearch.remove();
        }
        // If focus points to removed fav category, shift to next available category
        const currentList = document.querySelector('.movies-card-list[data-category="' + moviesNavigationState.currentCategoryIndex + '"]');
        if (!currentList) {
            const nextIdx = findNextMoviesCategoryWithMovies(moviesNavigationState.currentCategoryIndex + 1, 1);
            moviesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
            moviesNavigationState.currentCardIndex = 0;
            updateMoviesFocus();
            saveMoviesNavigationState();
        }
        return;
    }

    // If there are no favorites, remove the entire My Fav category section
    if (!favouriteMovies.length) {
        const favContainer = document.querySelector('.movies-fav-container');
        const favListForIdx = document.querySelector('.movies-card-list.fav-list');
        if (favListForIdx) {
            const categoryIndexAttr = favListForIdx.getAttribute('data-category');
            const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;
            setMoviesLoadedChunkCount(categoryIndex, 0);
        }
        if (favContainer) {
            favContainer.remove();
        }
        // If focus points to a non-existent list, shift focus
        const currentList = document.querySelector('.movies-card-list[data-category="' + moviesNavigationState.currentCategoryIndex + '"]');
        if (!currentList) {
            const nextIdx = findNextMoviesCategoryWithMovies(moviesNavigationState.currentCategoryIndex + 1, 1);
            moviesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
            moviesNavigationState.currentCardIndex = 0;
            updateMoviesFocus();
            saveMoviesNavigationState();
        }
        return;
    }

    // Ensure My Fav container exists; if not, create it at the top
    let favContainer = document.querySelector('.movies-fav-container');
    let favList = document.querySelector('.movies-card-list.fav-list');

    if (!favContainer || !favList) {
        const pageContainer = document.querySelector('.movies-page-container');
        if (pageContainer) {
            const favCategory = {
                title: "My Fav",
                movies: favouriteMovies,
                id: "fav",
                containerClass: "movies-fav-container"
            };
            const favHTML = createMoviesCategorySection(favCategory, 0);
            pageContainer.insertAdjacentHTML('afterbegin', favHTML);
            favContainer = document.querySelector('.movies-fav-container');
            favList = document.querySelector('.movies-card-list.fav-list');
        }
    }

    if (!favList) return;

    const categoryIndexAttr = favList.getAttribute('data-category');
    const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;

    let html = '';
    for (let i = 0; i < favouriteMovies.length; i++) {
        const movieData = formatMovieData(favouriteMovies[i]);
        if (!movieData) continue;
        html += createMovieCard(movieData, 'normal', categoryIndex, i);
    }

    favList.innerHTML = html;
    setMoviesLoadedChunkCount(categoryIndex, favouriteMovies.length);
}


function handleMoviesKeyNavigation(e) {
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
    }
    
    if (e.key === "Enter") {
        handleMoviesEnterKey(e);
        return;
    }
    
    const now = Date.now();
    if (now - moviesNavigationDebounce.lastKeyPress < moviesNavigationDebounce.debounceTime) {
        e.preventDefault();
        return;
    }
    
    e.preventDefault();
    
    moviesNavigationDebounce.lastKeyPress = now;
    
    switch(e.key) {
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
    let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return cardIndex;
    
    let containerWidth = cardList.offsetWidth;
    let firstCard = cardList.querySelector('.movie-card');
    if (!firstCard) return cardIndex;
    
    let cardWidth = firstCard.offsetWidth + 16;
    let visibleCardsCount = Math.floor(containerWidth / cardWidth);
    
    if (cardIndex >= visibleCardsCount) {
        return cardIndex % visibleCardsCount;
    }
    
    return cardIndex;
}

function moveMoviesRight() {
    if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let currentCategory = getCurrentMoviesCategory();
    if (!currentCategory) return;
    
    let loadedCount = getMoviesLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
    let totalMovies = currentCategory.movies ? currentCategory.movies.length : 0;
    
    if (moviesNavigationState.currentCardIndex < loadedCount - 1) {
        moviesNavigationState.currentCardIndex++;
    } else {
        if (loadedCount < totalMovies) {
            loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
        }
    }
    
    moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
}

function moveMoviesLeft() {
    if (!moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    if (moviesNavigationState.currentCardIndex > 0) {
        moviesNavigationState.currentCardIndex--;
    }
    
    moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
}

function moveMoviesDown() {
    let allCategories = window.allMoviesCategories || [];
    if (allCategories.length === 0) return;
    
    let currentIndex = moviesNavigationState.currentCategoryIndex;
    let currentCardIndex = moviesNavigationState.currentCardIndex;
    
    let nextCategoryIndex = findNextMoviesCategoryWithMovies(currentIndex + 1, 1);

    if(nextCategoryIndex > 2){
        const navbarEl = document.querySelector("#navbar-root");
        if(navbarEl){
            navbarEl.style.display = "none";
        }
    }
    
    if (nextCategoryIndex !== -1) {
        moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
        
        let newCategory = getCurrentMoviesCategory();
        if (newCategory) {
            let loadedCount = getMoviesLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            
            let visiblePosition = getMoviesCurrentVisibleIndex(currentIndex, currentCardIndex);
            moviesNavigationState.currentCardIndex = loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
        } else {
            moviesNavigationState.currentCardIndex = 0;
        }
        
        let loadedCategoriesCount = moviesChunkLoadingState.loadedCategories;
        if (moviesNavigationState.currentCategoryIndex >= loadedCategoriesCount - 2) {
            loadMoreMoviesCategories();
        }
    } else {
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
    
    let prevCategoryIndex = findNextMoviesCategoryWithMovies(currentIndex - 1, -1);
    
    if (prevCategoryIndex !== -1) {
        moviesNavigationState.currentCategoryIndex = prevCategoryIndex;
        
        let newCategory = getCurrentMoviesCategory();
        if (newCategory) {
            let loadedCount = getMoviesLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            
            let visiblePosition = getMoviesCurrentVisibleIndex(currentIndex, currentCardIndex);
            moviesNavigationState.currentCardIndex = loadedCount > 0 ? Math.min(visiblePosition, loadedCount - 1) : 0;
        } else {
            moviesNavigationState.currentCardIndex = 0;
        }
    } else {
        try {
            const moviesContainer = document.querySelector('.movies-page-container');
            if (moviesContainer) {
                moviesContainer.scrollTop = 0;
            }

            const navbarEl = document.querySelector("#navbar-root");
            if(navbarEl){
                navbarEl.style.display = "block";
            }
            
        } catch (e) {
            console.log('Movies scroll to top failed:', e);
        }
        
        removeAllMoviesFocus();
        saveMoviesNavigationState();
        localStorage.setItem("navigationFocus", "navbar");

        setTimeout(() => {
            const moviesNavItem = document.querySelector('.nav-item[data-page="moviesPage"]');
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
        let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
        if (cardList) {
            let loadingEl = cardList.querySelector('.movies-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
        return;
    }
    
    moviesChunkLoadingState.isLoading = true;
    
    let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) {
        moviesChunkLoadingState.isLoading = false;
        return;
    }
    
    let existingLoading = cardList.querySelector('.movies-loading-indicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    cardList.insertAdjacentHTML('beforeend', createMoviesLoadingIndicator(categoryIndex));
    
    let safetyTimeout = setTimeout(function() {
        if (moviesChunkLoadingState.isLoading) {
            console.warn('loadMoreMoviesForCategory: Safety timeout triggered, resetting loading state');
            moviesChunkLoadingState.isLoading = false;
            let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
            if (cardList) {
                let loadingEl = cardList.querySelector('.movies-loading-indicator');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
        }
    }, 3000);
    
    setTimeout(function() {
        try {
            let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
            if (!cardList) {
                clearTimeout(safetyTimeout);
                moviesChunkLoadingState.isLoading = false;
                return;
            }
            
            let newCardsHTML = loadMoviesChunk(category, categoryIndex);
            
            let loadingEl = cardList.querySelector('.movies-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            if (newCardsHTML) {
                cardList.insertAdjacentHTML('beforeend', newCardsHTML);
                
                if (moviesNavigationState.currentCategoryIndex === categoryIndex) {
                    updateMoviesFocus();
                }
            }
            
            clearTimeout(safetyTimeout);
            moviesChunkLoadingState.isLoading = false;
        } catch (e) {
            console.error('Error in loadMoreMoviesForCategory:', e);
            clearTimeout(safetyTimeout);
            moviesChunkLoadingState.isLoading = false;
            
            let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
            if (cardList) {
                let loadingEl = cardList.querySelector('.movies-loading-indicator');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
        }
    }, 100);
}

function removeAllMoviesFocus() {
    let allCards = document.querySelectorAll(".movie-card");
    for (let i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove("focused");
        
        let titleElement = allCards[i].querySelector('.movie-title-marquee');
        if (titleElement) {
            titleElement.classList.remove('marquee-active');
        }
    }
}

function updateMoviesFocus() {
    removeAllMoviesFocus();
    
    let navigationFocus = localStorage.getItem("navigationFocus");
    if (navigationFocus === "moviesPage") {
        if (moviesCategoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
            let currentCard = document.querySelector(
                '.movie-card[data-category="' + moviesNavigationState.currentCategoryIndex + '"][data-index="' + moviesNavigationState.currentCardIndex + '"]'
            );
            
            if (currentCard) {
                currentCard.classList.add("focused");
                scrollToMoviesElement(currentCard);
                
                moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
                moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
                
                activateMoviesMarquee(currentCard);
            }
        }
    }
}

function activateMoviesMarquee(card) {
    if (!card) return;
    
    let titleElement = card.querySelector('.movie-title-marquee');
    if (!titleElement) return;
    
    let container = titleElement.parentElement;
    if (!container) return;
    
    if (titleElement.scrollWidth > container.offsetWidth) {
        titleElement.classList.add('marquee-active');
    } else {
        titleElement.classList.remove('marquee-active');
    }
}

function scrollToMoviesElement(element) {
    if (!element) return;
    
    try {
        document.body.scrollTop = 30;
        element.scrollIntoView({ 
            block: "nearest", 
            inline: "nearest" 
        });
    } catch (e) {
        try {
            element.scrollIntoView({ 
                block: "nearest", 
                inline: "nearest" 
            });
        } catch (finalError) {
            try {
                element.scrollIntoView();
            } catch (error) {
                console.log('Movies scroll failed');
            }
        }
    }
}

function saveMoviesNavigationState() {
    try {
        localStorage.setItem('moviesNavState', JSON.stringify({
            currentCategoryIndex: moviesNavigationState.currentCategoryIndex,
            currentCardIndex: moviesNavigationState.currentCardIndex,
            lastFocusedCategory: moviesNavigationState.lastFocusedCategory,
            lastFocusedCard: moviesNavigationState.lastFocusedCard
        }));
    } catch (e) {
        console.log('Error saving movies navigation state:', e);
    }
}

function restoreMoviesNavigationState() {
    try {
        let saved = localStorage.getItem('moviesNavState');
        if (saved) {
            let state = JSON.parse(saved);
            moviesNavigationState.currentCategoryIndex = state.currentCategoryIndex || 0;
            moviesNavigationState.currentCardIndex = state.currentCardIndex || 0;
            moviesNavigationState.lastFocusedCategory = state.lastFocusedCategory || 0;
            moviesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;
            
            setTimeout(() => {
                validateAndAdjustRestoredMoviesState();
            }, 100);
        }
    } catch (e) {
        console.log('Error restoring movies navigation state:', e);
    }
}

function doesMoviesCardExist(categoryIndex, cardIndex) {
    let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return false;
    
    let card = cardList.querySelector('.movie-card[data-index="' + cardIndex + '"]');
    return card !== null;
}

function validateAndAdjustRestoredMoviesState() {
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
            let loadedCount = getMoviesLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            
            if (moviesNavigationState.currentCardIndex >= loadedCount) {
                moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
            }
            
            if (!doesMoviesCardExist(moviesNavigationState.currentCategoryIndex, moviesNavigationState.currentCardIndex) && 
                loadedCount < currentCategory.movies.length) {
                loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
            }
        }
    }
    
    setTimeout(() => {
        updateMoviesFocus();
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
        window.allMoviesStreams = window.allMoviesStreams.filter(movie => 
            movie !== null && 
            movie !== undefined && 
            typeof movie === 'object'
        );
    }
    
    // Clean up window.moviesCategories
    if (window.moviesCategories && Array.isArray(window.moviesCategories)) {
        window.moviesCategories = window.moviesCategories.filter(category => 
            category !== null && 
            category !== undefined && 
            typeof category === 'object'
        );
    }
}

function MoviesPage() {
validateMoviesData();
    let loadingHTML =
        window.moviesCategories.length==0||window.allMoviesStreams.length==0?
`
<div class="movies-page-no-data">
<p>No Movies Data Available</p>
</div>
`
:
    '<div class="movies-page-loading">' + 
                     '<div class="loading-spinner"></div>' +
                     '<p>Loading Movies...</p>' +
                     '</div>';
    
    localStorage.setItem("previousPage", localStorage.getItem("currentPage") || "");
    localStorage.setItem("currentPage", "moviesPage");
    const activeEl = document.activeElement;
    const isSearchFocused = activeEl && activeEl.id === "search-input";
    if (!isSearchFocused) {
        localStorage.setItem("navigationFocus", "moviesPage");
    }
    
    favoriteMoviesIds = [];
    
    setTimeout(function() {
        const currentPlaylist = getCurrentPlaylist();   
        const currentPlaylistFavIds = currentPlaylist ? currentPlaylist.favouriteMovies : [];   
        
        favoriteMoviesIds = currentPlaylistFavIds || [];

        
let favouriteMovies = window.allMoviesStreams && currentPlaylistFavIds ? 
    filterStreamsByQuery(window.allMoviesStreams.filter(m => m && currentPlaylistFavIds.includes(m.stream_id))) : [];

let popularMovies = window.allMoviesStreams ? 
    filterStreamsByQuery(window.allMoviesStreams.filter(m => m && m.rating_5based > 4)).slice(0, 10) : []; 

let recentlyWatchedMoviesIds = currentPlaylist && currentPlaylist.continueWatchingMovies ? 
    currentPlaylist.continueWatchingMovies.filter(m => m !== null && m !== undefined).map((item)=>item.itemId) : [];   

    let recentMoviesArray=window.allMoviesStreams && recentlyWatchedMoviesIds ? filterStreamsByQuery(window.allMoviesStreams.filter(m => recentlyWatchedMoviesIds.includes(m.stream_id.toString()))) : [];
    console.log(recentMoviesArray,"recentMoviesArrayrecentMoviesArray")
        let apiCategories = getAPICategories();
        
        let initialCategories = [];
        if (!getMoviesSearchQuery()) {
            initialCategories.push({ 
                title: "My Fav", 
                movies: favouriteMovies, 
                id: "fav", 
                containerClass: "movies-fav-container"
            });
        }
        initialCategories.push({ 
            title: "Popular Movies", 
            movies: popularMovies, 
            id: "popular", 
            containerClass: "movies-popular-container"
        });
        initialCategories.push({ 
            title: "Recently Watched", 
            movies:recentMoviesArray,
            id: "recent", 
            containerClass: "recently-watched-container"
        });
        
        let apiCategoriesToLoad = apiCategories.slice(0, 3);
        initialCategories = initialCategories.concat(apiCategoriesToLoad);
        
        window.allMoviesCategories = initialCategories.concat(apiCategories.slice(3));
        
        moviesChunkLoadingState.loadedCategories = initialCategories.length;
        moviesChunkLoadingState.loadedChunks = {};
        moviesChunkLoadingState.isLoading = false;
        
        if (!hasAnyMoviesCategoryData()) {
            let noDataHTML = '<div class="movies-page-container">' +
                           (getMoviesSearchQuery() ? createMoviesNoSearchMessage() : createMoviesNoDataMessage("movies")) +
                           '</div>';
            const loadingEl = document.querySelector('.movies-page-loading');
            if (loadingEl) {
                loadingEl.outerHTML = noDataHTML;
            } else {
                const pageEl = document.getElementById('movies-page');
                if (pageEl) pageEl.innerHTML = noDataHTML;
            }
            return;
        }
        
        let html = '<div class="movies-page-container">';
        
        for (let i = 0; i < initialCategories.length; i++) {
            let category = initialCategories[i];
            if (category.movies && category.movies.length > 0) {
                html += createMoviesCategorySection(category, i);
            }
        }
        
        let hasMoreCategories = false;
        for (let i = initialCategories.length; i < window.allMoviesCategories.length; i++) {
            let category = window.allMoviesCategories[i];
            if (category && category.movies && category.movies.length > 0) {
                hasMoreCategories = true;
                break;
            }
        }
        
        if (hasMoreCategories) {
            html += '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>';
        }
        
        html += '</div>';
        
        let container = document.querySelector('.movies-page-loading');
        if (container) {
            container.outerHTML = html;
        }
        
        restoreMoviesNavigationState();
        
        setTimeout(function() {
            initMoviesNavigation();
        }, 100);
        
    }, 500); 
    
    return loadingHTML;
}

// Export cleanup function for global access
window.cleanupMoviesNavigation = cleanupMoviesNavigation;
window.moviesNavigationState = moviesNavigationState;
window.updateMoviesFocus = updateMoviesFocus;
window.saveMoviesNavigationState = saveMoviesNavigationState;
window.rerenderMoviesPage = MoviesPage;
