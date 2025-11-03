// === MEMORY OPTIMIZATION: Global navigation state ===
let moviesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

// Track if navigation is initialized
let isNavigationInitialized = false;

// Increased key debouncing to prevent fast movement
let lastKeyPressTime = 0;
let keyPressDelay = 300; // Increased from 150 to 300ms

// Chunk loading state - optimized for 512MB RAM
let chunkLoadingState = {
    loadedCategories: 0,
    categoryChunkSize: 4,
    loadedChunks: {},
    horizontalChunkSize: 12,
    isLoading: false
};

// Enter key press tracking for long press detection
let enterKeyState = {
    isPressed: false,
    pressStartTime: 0,
    longPressThreshold: 500,
    timeoutId: null
};

// === SIMPLIFIED MOVIE DATA FORMAT ===
function formatMovieData(movieStream) {
    if (!movieStream) return null;
    
    return {
        id: movieStream.stream_id || movieStream.num,
        stream_id: movieStream.stream_id,
        title: movieStream.name || "Unknown",
        genre: movieStream.category_name || "Movie",
        year: formatYear(movieStream.added),
        image: movieStream.stream_icon || "./assets/demo-img-card.png",
        rating: movieStream.rating || "0",
        duration: formatDuration(movieStream)
    };
}

function formatYear(timestamp) {
    if (!timestamp) return "Unknown";
    try {
        return new Date(Number(timestamp) * 1000).getFullYear().toString();
    } catch (e) {
        return "Unknown";
    }
}

function formatDuration(movie) {
    return "2h 0m";
}

// === SIMPLIFIED DATA GETTERS ===
function getFavoriteMovies() {
    try {
        let username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        for (let i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                let favorites = playlists[i].favoritesMovies || [];
                return favorites.slice(0, 20).map(formatMovieData).filter(m => m !== null);
            }
        }
        return [];
    } catch (e) {
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
        let allMoviesStreamsData = window.allMoviesStreams || [];
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
        let movies = [];
        
        for (let j = 0; j < allMoviesStreamsData.length; j++) {
            let stream = allMoviesStreamsData[j];
            if (stream.category_id == category.category_id) {
                movies.push(stream);
                if (movies.length >= 50) break;
            }
        }
        
        categories.push({
            title: category.category_name || "Category",
            movies: movies,
            id: category.category_id,
            containerClass: "movies-category-container",
            category_id: category.category_id
        });
    }
    
    return categories;
}

// === FIXED MOVIE CARD CREATION WITH IMAGES AND MARQUEE ===
function createMovieCard(movieData, size, categoryIndex, movieIndex) {
    let isLarge = size === "large";
    let cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
    
    let imageUrl = movieData.image || "./assets/demo-img-card.png";
    let titleClass = 'movie-title-marquee';
    
    return '<div class="' + cardClass + '" ' +
           'data-category="' + categoryIndex + '" ' +
           'data-index="' + movieIndex + '" ' +
           'data-stream-id="' + (movieData.stream_id || movieData.id) + '" ' +
           'style="background-image: url(\'' + imageUrl + '\')">' +
           '<div class="movie-card-content">' +
           '<div class="movie-card-top">' +
           '<img src="./assets/heartIcon.png" alt="img" class="movie-card-heart" />' +
           '</div>' +
           '<div class="movie-card-play-div">' +
           '<img src="./assets/card-play-icon.png" alt="Play" class="movie-card-play" />' +
           '</div>' +
           '<div class="movie-card-bottom">' +
           '<div class="movie-card-bottom-left">' +
           '<h3>' + (movieData.genre || "Movie") + '</h3>' +
           '<h2 class="' + titleClass + '">' + (movieData.title || "Unknown") + '</h2>' +
           '</div>' +
           '<div class="movie-card-bottom-right">' +
           '<h3>' + (movieData.duration || "2h 0m") + '</h3>' +
           '<h2>' + (movieData.year || "Unknown") + '</h2>' +
           '</div>' +
           '</div>' +
           '</div>' +
           '</div>';
}

function createLoadingIndicator(categoryIndex) {
    return '<div class="movies-loading-indicator" data-category="' + categoryIndex + '">' +
           '<p>Loading...</p>' +
           '</div>';
}

// === SIMPLIFIED CHUNK LOADING ===
function getLoadedChunkCount(categoryIndex) {
    return chunkLoadingState.loadedChunks[categoryIndex] || 0;
}

function setLoadedChunkCount(categoryIndex, count) {
    chunkLoadingState.loadedChunks[categoryIndex] = count;
}

function loadMoviesChunk(category, categoryIndex) {
    if (!category || !category.movies || category.movies.length === 0) return '';
    
    let loadedCount = getLoadedChunkCount(categoryIndex);
    let chunkSize = chunkLoadingState.horizontalChunkSize;
    let totalMovies = category.movies.length;
    
    if (loadedCount >= totalMovies) return '';
    
    let endIndex = Math.min(loadedCount + chunkSize, totalMovies);
    let cardsHTML = '';
    
    for (let i = loadedCount; i < endIndex; i++) {
        let movieData = formatMovieData(category.movies[i]);
        if (!movieData) continue;
        
        let size = category.id === "popular" ? "large" : "normal";
        cardsHTML += createMovieCard(movieData, size, categoryIndex, i);
    }
    
    setLoadedChunkCount(categoryIndex, endIndex);
    return cardsHTML;
}

// === NEW FUNCTION: CHECK IF CATEGORY HAS MOVIES ===
function categoryHasMovies(categoryIndex) {
    let categories = window.allMoviesCategories || [];
    let category = categories[categoryIndex];
    
    if (!category || !category.movies || category.movies.length === 0) {
        return false;
    }
    
    let loadedCount = getLoadedChunkCount(categoryIndex);
    return loadedCount > 0;
}

// === NEW FUNCTION: FIND NEXT CATEGORY WITH MOVIES ===
function findNextCategoryWithMovies(startIndex, direction) {
    let allCategories = window.allMoviesCategories || [];
    
    // direction: 1 = down, -1 = up
    if (direction === 1) {
        // Search downwards
        for (let i = startIndex; i < allCategories.length; i++) {
            if (categoryHasMovies(i)) {
                return i;
            }
        }
    } else {
        // Search upwards
        for (let i = startIndex; i >= 0; i--) {
            if (categoryHasMovies(i)) {
                return i;
            }
        }
    }
    
    return -1; // No category with movies found
}

// === LOAD MORE CATEGORIES WHEN REACHING END ===
function loadMoreCategories() {
    if (chunkLoadingState.isLoading) return;
    
    let allCategories = window.allMoviesCategories || [];
    let currentLoaded = chunkLoadingState.loadedCategories;
    
    if (currentLoaded >= allCategories.length) return;
    
    chunkLoadingState.isLoading = true;
    
    let nextChunk = Math.min(currentLoaded + chunkLoadingState.categoryChunkSize, allCategories.length);
    
    setTimeout(function() {
        let container = document.querySelector('.movies-page-container');
        if (!container) {
            chunkLoadingState.isLoading = false;
            return;
        }
        
        let categoriesLoading = container.querySelector('.categories-loading-indicator');
        if (categoriesLoading) {
            categoriesLoading.remove();
        }
        
        for (let i = currentLoaded; i < nextChunk; i++) {
            let category = allCategories[i];
            if (!category) continue;
            
            let categoryHTML = createCategorySection(category, i);
            container.insertAdjacentHTML('beforeend', categoryHTML);
        }
        
        if (nextChunk < allCategories.length) {
            container.insertAdjacentHTML('beforeend', '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>');
        }
        
        chunkLoadingState.loadedCategories = nextChunk;
        chunkLoadingState.isLoading = false;
        
        updateFocus();
        
    }, 200);
}

function createCategorySection(category, categoryIndex) {
    let size = category.id === "popular" ? "large" : "normal";
    
    let html = '<div class="' + category.containerClass + '">';
    html += '<h1>' + category.title + '</h1>';
    html += '<div class="movies-card-list ' + category.id + '-list" data-category="' + categoryIndex + '">';
    
    let initialMovies = loadMoviesChunk(category, categoryIndex);
    html += initialMovies;
    
    if (category.movies && category.movies.length > getLoadedChunkCount(categoryIndex)) {
        html += createLoadingIndicator(categoryIndex);
    }
    
    html += '</div>';
    html += '</div>';
    
    return html;
}

// === CREATE NO DATA MESSAGE ===
function createNoDataMessage(categoryTitle) {
    return '<div class="no-data-container">' +
           '<div class="no-data-content">' +
           '<h2>No Data Available</h2>' +
           '<p>No ' + categoryTitle + ' found</p>' +
           '</div>' +
           '</div>';
}

// === FIXED ENTER KEY HANDLING ===
function handleEnterKey(e) {
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    
    if (e.key === "Enter") {
        e.preventDefault();
        
        if (e.type === "keydown") {
            // Start tracking enter press
            enterKeyState.isPressed = true;
            enterKeyState.pressStartTime = Date.now();
            
            // Set timeout for long press detection
            enterKeyState.timeoutId = setTimeout(function() {
                if (enterKeyState.isPressed) {
                    // Long press detected
                    handleLongPressEnter();
                    enterKeyState.isPressed = false;
                }
            }, enterKeyState.longPressThreshold);
        } else if (e.type === "keyup") {
            // End of enter press
            if (enterKeyState.isPressed) {
                let pressDuration = Date.now() - enterKeyState.pressStartTime;
                
                if (pressDuration < enterKeyState.longPressThreshold) {
                    // Simple click
                    clearTimeout(enterKeyState.timeoutId);
                    handleSimpleEnter();
                }
                
                enterKeyState.isPressed = false;
            }
        }
    }
}

function handleSimpleEnter() {
    // FIXED: Check if current category has movies before handling enter
    if (!categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let categoryIndex = moviesNavigationState.currentCategoryIndex;
    let cardIndex = moviesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
        console.log('Simple Enter click on movie:', streamId);
        alert('Simple Enter click - Play Movie: ' + streamId);
        
        // Here you can navigate to movie detail page or play movie
        // Example: navigateToMovieDetail(streamId);
    }
}

function handleLongPressEnter() {
    // FIXED: Check if current category has movies before handling enter
    if (!categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let categoryIndex = moviesNavigationState.currentCategoryIndex;
    let cardIndex = moviesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
        console.log('Long press Enter on movie:', streamId);
        alert('Long press Enter - Show Options: ' + streamId);
        
        // Here you can show options menu or add to favorites
        // Example: showMovieOptions(streamId);
    }
}

// === FIXED KEYBOARD NAVIGATION ===
function handleKeyNavigation(e) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
        return;
    }
    
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    
    // Handle Enter key separately
    if (e.key === "Enter") {
        handleEnterKey(e);
        return;
    }
    
    // Enhanced debouncing with proper timing
    let now = Date.now();
    if (now - lastKeyPressTime < keyPressDelay) {
        e.preventDefault();
        return;
    }
    lastKeyPressTime = now;
    
    e.preventDefault();
    
    switch(e.key) {
        case "ArrowRight":
            moveRight();
            break;
        case "ArrowLeft":
            moveLeft();
            break;
        case "ArrowDown":
            moveDown();
            break;
        case "ArrowUp":
            moveUp();
            break;
    }
    
    updateFocus();
    saveNavigationState();
}

function moveRight() {
    // FIXED: Check if current category has movies
    if (!categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let currentCategory = getCurrentCategory();
    if (!currentCategory) return;
    
    let loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
    let totalMovies = currentCategory.movies ? currentCategory.movies.length : 0;
    
    // Fixed: Always move exactly one card right
    if (moviesNavigationState.currentCardIndex < loadedCount - 1) {
        moviesNavigationState.currentCardIndex++;
    } else {
        // If at end and more movies available, load more
        if (loadedCount < totalMovies) {
            loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
        }
    }
    
    // Store last focused position for this category
    moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
}

function moveLeft() {
    // FIXED: Check if current category has movies
    if (!categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    // Fixed: Always move exactly one card left
    if (moviesNavigationState.currentCardIndex > 0) {
        moviesNavigationState.currentCardIndex--;
    }
    
    // Store last focused position for this category
    moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
}

function moveDown() {
    let allCategories = window.allMoviesCategories || [];
    if (allCategories.length === 0) return;
    
    let currentIndex = moviesNavigationState.currentCategoryIndex;
    
    // Store current position before moving
    moviesNavigationState.lastFocusedCategory = currentIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
    
    // FIXED: Find next category that has movies
    let nextCategoryIndex = findNextCategoryWithMovies(currentIndex + 1, 1); // direction 1 = down
    
    if (nextCategoryIndex !== -1) {
        moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
        
        // FIXED: Try to focus on same index in next category, or last available card
        let newCategory = getCurrentCategory();
        if (newCategory) {
            let loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            let previousCardIndex = moviesNavigationState.lastFocusedCard;
            
            // If same index exists in new category, use it. Otherwise use last available card.
            if (previousCardIndex < loadedCount) {
                moviesNavigationState.currentCardIndex = previousCardIndex;
            } else {
                moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
            }
        } else {
            moviesNavigationState.currentCardIndex = 0;
        }
        
        // Check if we're at the last loaded category and load more if needed
        let loadedCategoriesCount = chunkLoadingState.loadedCategories;
        if (moviesNavigationState.currentCategoryIndex >= loadedCategoriesCount - 2) {
            loadMoreCategories();
        }
    } else {
        // Already at last category with movies
        let currentCategory = getCurrentCategory();
        if (currentCategory && currentCategory.movies) {
            let loadedCount = getLoadedChunkCount(currentIndex);
            let totalMovies = currentCategory.movies.length;
            if (loadedCount < totalMovies) {
                loadMoreMoviesForCategory(currentIndex);
            }
        }
    }
}

function moveUp() {
    let currentIndex = moviesNavigationState.currentCategoryIndex;
    
    // Store current position before moving
    moviesNavigationState.lastFocusedCategory = currentIndex;
    moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
    
    // FIXED: Find previous category that has movies
    let prevCategoryIndex = findNextCategoryWithMovies(currentIndex - 1, -1); // direction -1 = up
    
    if (prevCategoryIndex !== -1) {
        moviesNavigationState.currentCategoryIndex = prevCategoryIndex;
        
        // FIXED: Try to focus on same index in previous category, or last available card
        let newCategory = getCurrentCategory();
        if (newCategory) {
            let loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            let previousCardIndex = moviesNavigationState.lastFocusedCard;
            
            // If same index exists in previous category, use it. Otherwise use last available card.
            if (previousCardIndex < loadedCount) {
                moviesNavigationState.currentCardIndex = previousCardIndex;
            } else {
                moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
            }
        } else {
            moviesNavigationState.currentCardIndex = 0;
        }
    } else {
        // Go back to navbar (no more categories with movies above)
        removeAllFocus();
        saveNavigationState();
        localStorage.setItem("navigationFocus", "navbar");
        
        let moviesNavItem = document.querySelector('.nav-item[data-page="moviesPage"]');
        if (moviesNavItem) {
            moviesNavItem.focus();
            moviesNavItem.classList.add("active");
        }
    }
}

// === LOAD MORE MOVIES FOR CURRENT CATEGORY ===
function loadMoreMoviesForCategory(categoryIndex) {
    if (chunkLoadingState.isLoading) return;
    
    let categories = window.allMoviesCategories || [];
    let category = categories[categoryIndex];
    if (!category) return;
    
    let loadedCount = getLoadedChunkCount(categoryIndex);
    let totalMovies = category.movies ? category.movies.length : 0;
    
    if (loadedCount >= totalMovies) return;
    
    chunkLoadingState.isLoading = true;
    
    let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) {
        chunkLoadingState.isLoading = false;
        return;
    }
    
    let existingLoading = cardList.querySelector('.movies-loading-indicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    cardList.insertAdjacentHTML('beforeend', createLoadingIndicator(categoryIndex));
    
    setTimeout(function() {
        let newCardsHTML = loadMoviesChunk(category, categoryIndex);
        
        let loadingEl = cardList.querySelector('.movies-loading-indicator');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        if (newCardsHTML) {
            cardList.insertAdjacentHTML('beforeend', newCardsHTML);
            updateFocus();
        }
        
        chunkLoadingState.isLoading = false;
    }, 100);
}

// === FOCUS MANAGEMENT WITH MARQUEE ACTIVATION ===
function removeAllFocus() {
    let allCards = document.querySelectorAll(".movie-card");
    for (let i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove("focused");
        
        let titleElement = allCards[i].querySelector('.movie-title-marquee');
        if (titleElement) {
            titleElement.classList.remove('marquee-active');
        }
    }
}

function updateFocus() {
    removeAllFocus();
    
    let navigationFocus = localStorage.getItem("navigationFocus");
    if (navigationFocus === "moviesPage") {
        // FIXED: Only set focus if category has movies
        if (categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
            let currentCard = document.querySelector(
                '.movie-card[data-category="' + moviesNavigationState.currentCategoryIndex + '"][data-index="' + moviesNavigationState.currentCardIndex + '"]'
            );
            
            if (currentCard) {
                currentCard.classList.add("focused");
                scrollToElement(currentCard);
                
                // Store last focused position
                moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
                moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
                
                activateMarquee(currentCard);
            }
        }
        // If category has no movies, don't set any focus initially
    }
}

function activateMarquee(card) {
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

// === FIXED SCROLLING WITH NEAREST ===
function scrollToElement(element) {
    if (!element) return;
    
    try {
        // Use nearest for smooth scrolling
        element.scrollIntoView({ 
            block: "nearest", 
            inline: "nearest" 
        });
    } catch (e) {
        try {
            // Fallback without smooth behavior
            element.scrollIntoView({ 
                block: "nearest", 
                inline: "nearest" 
            });
        } catch (finalError) {
            try {
                // Final fallback
                element.scrollIntoView();
            } catch (error) {
                console.log('Scroll failed');
            }
        }
    }
}

// === NAVIGATION STATE MANAGEMENT ===
function saveNavigationState() {
    try {
        localStorage.setItem('moviesNavState', JSON.stringify({
            currentCategoryIndex: moviesNavigationState.currentCategoryIndex,
            currentCardIndex: moviesNavigationState.currentCardIndex,
            lastFocusedCategory: moviesNavigationState.lastFocusedCategory,
            lastFocusedCard: moviesNavigationState.lastFocusedCard
        }));
    } catch (e) {
        console.log('Error saving navigation state:', e);
    }
}

function restoreNavigationState() {
    try {
        let saved = localStorage.getItem('moviesNavState');
        if (saved) {
            let state = JSON.parse(saved);
            moviesNavigationState.currentCategoryIndex = state.currentCategoryIndex || 0;
            moviesNavigationState.currentCardIndex = state.currentCardIndex || 0;
            moviesNavigationState.lastFocusedCategory = state.lastFocusedCategory || 0;
            moviesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;
            
            // FIXED: Ensure we start with a category that has movies
            if (!categoryHasMovies(moviesNavigationState.currentCategoryIndex)) {
                let nextCategoryIndex = findNextCategoryWithMovies(0, 1);
                if (nextCategoryIndex !== -1) {
                    moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
                    moviesNavigationState.currentCardIndex = 0;
                }
            }
        }
    } catch (e) {
        console.log('Error restoring navigation state:', e);
    }
}

// === HELPER FUNCTIONS ===
function getCurrentCategory() {
    let categories = window.allMoviesCategories || [];
    return categories[moviesNavigationState.currentCategoryIndex];
}

// === NAVIGATION INITIALIZATION ===
function initNavigation() {
    if (isNavigationInitialized) {
        document.removeEventListener("keydown", handleKeyNavigation);
        document.removeEventListener("keyup", handleKeyNavigation);
    }
    
    document.addEventListener("keydown", handleKeyNavigation);
    document.addEventListener("keyup", handleKeyNavigation);
    isNavigationInitialized = true;
}

function cleanupNavigation() {
    document.removeEventListener("keydown", handleKeyNavigation);
    document.removeEventListener("keyup", handleKeyNavigation);
    isNavigationInitialized = false;
}

// === CHECK IF ANY CATEGORY HAS DATA ===
function hasAnyCategoryData() {
    let categories = window.allMoviesCategories || [];
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].movies && categories[i].movies.length > 0) {
            return true;
        }
    }
    return false;
}

// === MAIN MOVIES PAGE FUNCTION ===
function MoviesPage() {
    // Show loading state immediately
    let loadingHTML = '<div class="movies-page-loading">' +
                     '<div class="loading-spinner"></div>' +
                     '<p>Loading Movies...</p>' +
                     '</div>';
    
    // Update page tracking
    localStorage.setItem("previousPage", localStorage.getItem("currentPage") || "");
    localStorage.setItem("currentPage", "moviesPage");
    localStorage.setItem("navigationFocus", "moviesPage");
    
    // Get categories data after a short delay to show loading
    setTimeout(function() {
        let favoriteMovies = getFavoriteMovies();
        let popularMovies = getPopularMovies();
        let recentlyWatchedMovies = getRecentlyWatchedMovies();
        let apiCategories = getAPICategories();
        
        // Create initial categories array
        let initialCategories = [
            { 
                title: "My Fav", 
                movies: favoriteMovies, 
                id: "fav", 
                containerClass: "movies-fav-container"
            },
            { 
                title: "Popular Movies", 
                movies: popularMovies, 
                id: "popular", 
                containerClass: "movies-popular-container"
            },
            { 
                title: "Recently Watched", 
                movies: recentlyWatchedMovies, 
                id: "recent", 
                containerClass: "recently-watched-container"
            }
        ];
        
        // Add first 3 API categories if available
        let apiCategoriesToLoad = apiCategories.slice(0, 3);
        initialCategories = initialCategories.concat(apiCategoriesToLoad);
        
        // Store all categories for later loading
        window.allMoviesCategories = initialCategories.concat(apiCategories.slice(3));
        
        // Reset loading state
        chunkLoadingState.loadedCategories = initialCategories.length;
        chunkLoadingState.loadedChunks = {};
        chunkLoadingState.isLoading = false;
        
        // Check if we have any data
        if (!hasAnyCategoryData()) {
            let noDataHTML = '<div class="movies-page-container">' +
                           createNoDataMessage("movies") +
                           '</div>';
            document.querySelector('.movies-page-container').innerHTML = noDataHTML;
            return;
        }
        
        // Build page HTML with initial categories
        let html = '<div class="movies-page-container">';
        
        for (let i = 0; i < initialCategories.length; i++) {
            let category = initialCategories[i];
            // Only show category if it has movies
            if (category.movies && category.movies.length > 0) {
                html += createCategorySection(category, i);
            }
        }
        
        if (window.allMoviesCategories.length > initialCategories.length) {
            html += '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>';
        }
        
        html += '</div>';
        
        // Replace loading with actual content
        let container = document.querySelector('.movies-page-loading');
        if (container) {
            container.outerHTML = html;
        }
        
        // Initialize navigation
        setTimeout(function() {
            initNavigation();
            updateFocus();
        }, 100);
        
    }, 500); 
    
    return loadingHTML;
}

window.moviesNavigationState = moviesNavigationState;
window.updateFocus = updateFocus;
window.saveNavigationState = saveNavigationState;
window.rerenderMoviesPage = MoviesPage;

console.log("Complete MoviesPage loaded - Fixed navigation speed and empty categories");