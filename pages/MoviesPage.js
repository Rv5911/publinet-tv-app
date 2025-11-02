// === MEMORY OPTIMIZATION: Global navigation state ===
let moviesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

// Track if navigation is initialized
var isNavigationInitialized = false;

// Prevent rapid repeated key presses
var lastKeyPressTime = {};
var keyPressDelay = 100; // milliseconds

// Chunk loading state - memory optimization for 512MB RAM
var chunkLoadingState = {
    // Track loaded chunks per category
    loadedChunks: {},
    // Chunk size for horizontal loading
    horizontalChunkSize: 10,
    // Current loading state
    isLoading: false
};

// Enter key press tracking for long press detection
var enterKeyState = {
    isPressed: false,
    pressStartTime: 0,
    longPressThreshold: 500, // milliseconds
    timeoutId: null
};

// === FORMAT MOVIE DATA FROM API ===
function formatMovieData(movieStream) {
    if (!movieStream) return null;
    
    return {
        id: movieStream.stream_id || movieStream.tmdb_id || movieStream.num,
        stream_id: movieStream.stream_id,
        tmdb_id: movieStream.tmdb_id,
        title: movieStream.name || "Unknown",
        genre: movieStream.category_name || "Movie",
        duration: formatDuration(movieStream),
        year: formatYear(movieStream.added),
        image: movieStream.stream_icon || "./assets/demo-img-card.png",
        rating: movieStream.rating || "0",
        rating_5based: movieStream.rating_5based || 0,
        added: movieStream.added,
        stream_type: movieStream.stream_type || "movie",
        category_id: movieStream.category_id,
        originalData: movieStream // Keep original for favorites/history
    };
}

function formatDuration(movie) {
    // You can calculate duration if available in API
    // For now, return a default or calculate from available data
    return "2h 0m"; // Default placeholder
}

function formatYear(timestamp) {
    if (!timestamp) return "Unknown";
    try {
        var date = new Date(Number(timestamp) * 1000);
        return date.getFullYear().toString();
    } catch (e) {
        return "Unknown";
    }
}

// === GET CATEGORIES DATA ===
function getMoviesCategoriesData() {
    var allMoviesCategoriesData = window.moviesCategories || [];
    var allMoviesStreamsData = window.allMoviesStreams || [];
    
    var hasData = allMoviesCategoriesData.length > 0 && allMoviesStreamsData.length > 0;
    
    if (!hasData) {
        return [];
    }
    
    // Map categories with their movies
    var categories = allMoviesCategoriesData.map(function(category) {
        return {
            category_id: category.category_id,
            category_name: category.category_name,
            parent_id: category.parent_id,
            movies: allMoviesStreamsData.filter(function(stream) {
                return String(stream.category_id) === String(category.category_id);
            })
        };
    });
    
    return categories;
}

// === GET FAVORITES FROM LOCALSTORAGE ===
function getFavoriteMovies() {
    try {
        var username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        var playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        var playlist = null;
        for (var i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                playlist = playlists[i];
                break;
            }
        }
        
        if (!playlist || !playlist.favoritesMovies) return [];
        
        return playlist.favoritesMovies.map(formatMovieData).filter(function(m) {
            return m !== null;
        });
    } catch (e) {
        console.log('Error getting favorites:', e);
        return [];
    }
}

// === GET RECENTLY WATCHED FROM LOCALSTORAGE ===
function getRecentlyWatchedMovies() {
    try {
        var username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        var playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        var playlist = null;
        for (var i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                playlist = playlists[i];
                break;
            }
        }
        
        if (!playlist || !playlist.continueWatchingMovies) return [];
        
        // Return recently watched movies (limit to last 50 for memory optimization)
        var recent = playlist.continueWatchingMovies.slice(0, 50);
        return recent.map(formatMovieData).filter(function(m) {
            return m !== null;
        });
    } catch (e) {
        console.log('Error getting recently watched:', e);
        return [];
    }
}

// === GET POPULAR MOVIES ===
function getPopularMovies() {
    try {
        var allMoviesStreamsData = window.allMoviesStreams || [];
        if (allMoviesStreamsData.length === 0) return [];
        
        // Sort by rating (descending) and take top movies
        var sorted = allMoviesStreamsData.slice().sort(function(a, b) {
            var ratingA = parseFloat(a.rating_5based || 0);
            var ratingB = parseFloat(b.rating_5based || 0);
            return ratingB - ratingA;
        });
        
        // Take top 100 for popular section
        var topMovies = sorted.slice(0, 100);
        return topMovies.map(formatMovieData).filter(function(m) {
            return m !== null;
        });
    } catch (e) {
        console.log('Error getting popular movies:', e);
        return [];
    }
}

// === CREATE MOVIE CARD WITH CHUNK LOADING ===
function createMovieCard(movieData, size, categoryIndex, movieIndex) {
    var isLarge = size === "large";
    var cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
    
    var imageUrl = movieData.image || "./assets/demo-img-card.png";
    var title = movieData.title || "Unknown";
    var genre = movieData.genre || "Movie";
    var duration = movieData.duration || "N/A";
    var year = movieData.year || "Unknown";
    
    return '<div class="' + cardClass + '" ' +
           'data-category="' + categoryIndex + '" ' +
           'data-index="' + movieIndex + '" ' +
           'data-stream-id="' + (movieData.stream_id || movieData.id) + '" ' +
           'style="background: url(\'' + imageUrl + '\')">' +
           '<div class="movie-card-content">' +
           '<div>' +
           '<img src="./assets/heartIcon.png" alt="img" class="movie-card-heart" />' +
           '</div>' +
           '<div class="movie-card-bottom">' +
           '<div class="movie-card-bottom-left">' +
           '<h3>' + genre + '</h3>' +
           '<h2>' + title + '</h2>' +
           '</div>' +
           '<div class="movie-card-bottom-right">' +
           '<h3>' + duration + '</h3>' +
           '<h2>' + year + '</h2>' +
           '</div>' +
           '</div>' +
           '</div>' +
           '</div>';
}

// === CREATE LOADING INDICATOR ===
function createLoadingIndicator(categoryIndex) {
    return '<div class="movies-loading-indicator" data-category="' + categoryIndex + '">' +
           '<p>Loading movies...</p>' +
           '</div>';
}

// === GET LOADED CHUNK COUNT FOR CATEGORY ===
function getLoadedChunkCount(categoryIndex) {
    return chunkLoadingState.loadedChunks[categoryIndex] || 0;
}

// === SET LOADED CHUNK COUNT FOR CATEGORY ===
function setLoadedChunkCount(categoryIndex, count) {
    chunkLoadingState.loadedChunks[categoryIndex] = count;
}

// === LOAD MOVIES CHUNK FOR CATEGORY ===
function loadMoviesChunk(category, categoryIndex, forceReload) {
    if (!category || !category.movies) return '';
    
    var loadedCount = forceReload ? 0 : getLoadedChunkCount(categoryIndex);
    var chunkSize = chunkLoadingState.horizontalChunkSize;
    var totalMovies = category.movies.length;
    
    if (loadedCount >= totalMovies) {
        return ''; // All movies loaded
    }
    
    var endIndex = Math.min(loadedCount + chunkSize, totalMovies);
    var moviesToLoad = category.movies.slice(loadedCount, endIndex);
    
    var cardsHTML = '';
    for (var i = 0; i < moviesToLoad.length; i++) {
        var movieData = formatMovieData(moviesToLoad[i]);
        if (!movieData) continue;
        
        var size = category.id === "popular" ? "large" : "normal";
        var cardIndex = loadedCount + i;
        cardsHTML += createMovieCard(movieData, size, categoryIndex, cardIndex);
    }
    
    setLoadedChunkCount(categoryIndex, endIndex);
    
    return cardsHTML;
}

// === MOVIE CARD SELECTION HANDLER ===
function selectMovieCard(categoryIndex, cardIndex) {
    moviesNavigationState.currentCategoryIndex = categoryIndex;
    moviesNavigationState.currentCardIndex = cardIndex;
    moviesNavigationState.lastFocusedCategory = categoryIndex;
    moviesNavigationState.lastFocusedCard = cardIndex;
    
    try {
        localStorage.setItem('moviesNavState', JSON.stringify({
            currentCategoryIndex: categoryIndex,
            currentCardIndex: cardIndex,
            lastFocusedCategory: categoryIndex,
            lastFocusedCard: cardIndex
        }));
    } catch (e) {
        console.log('Error saving selected card:', e);
    }
    
    updateFocus();
    console.log('Selected movie - Category:', categoryIndex, 'Card:', cardIndex);
}

// === ENHANCED SCROLLING FOR TIZEN OS 5.5 ===
function scrollToElement(element) {
    if (!element) return;
    
    var scrollConfigs = [
        { behavior: "smooth", block: "center", inline: "center" },
        { behavior: "smooth", block: "nearest", inline: "nearest" },
        { block: "center", inline: "center" },
        { block: "nearest", inline: "nearest" }
    ];
    
    for (var i = 0; i < scrollConfigs.length; i++) {
        try {
            element.scrollIntoView(scrollConfigs[i]);
            console.log('Scroll successful with config:', scrollConfigs[i]);
            return;
        } catch (e) {
            console.log('Scroll failed with config:', scrollConfigs[i], e);
            continue;
        }
    }
    
    fallbackScrollToElement(element);
}

function fallbackScrollToElement(element) {
    if (!element) return;
    
    var container = findScrollableContainer(element);
    if (!container) {
        console.log('No scrollable container found');
        return;
    }
    
    try {
        var scrollLeft = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
        var scrollTop = element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2);
        
        container.scrollTo({
            left: scrollLeft,
            top: scrollTop,
            behavior: 'smooth'
        });
        
        console.log('Manual scroll applied:', { scrollLeft: scrollLeft, scrollTop: scrollTop });
    } catch (e) {
        console.log('Manual scroll failed:', e);
        try {
            element.scrollIntoView();
        } catch (finalError) {
            console.log('Final scroll attempt failed:', finalError);
        }
    }
}

function findScrollableContainer(element) {
    var parent = element.parentElement;
    while (parent) {
        if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
            return parent;
        }
        parent = parent.parentElement;
    }
    return document.querySelector('.movies-page-container') || document.documentElement;
}

// === HANDLE ENTER KEY (SIMPLE CLICK AND LONG PRESS) ===
function handleEnterKey(e) {
    var currentPage = localStorage.getItem("currentPage");
    var navigationFocus = localStorage.getItem("navigationFocus");
    
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
                var pressDuration = Date.now() - enterKeyState.pressStartTime;
                
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
    var categoryIndex = moviesNavigationState.currentCategoryIndex;
    var cardIndex = moviesNavigationState.currentCardIndex;
    
    var currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        var streamId = currentCard.getAttribute('data-stream-id');
        console.log('Simple Enter click on movie:', streamId);
        alert('Simple Enter click');
        
        // Here you can navigate to movie detail page or play movie
        // Example: navigateToMovieDetail(streamId);
    }
}

function handleLongPressEnter() {
    var categoryIndex = moviesNavigationState.currentCategoryIndex;
    var cardIndex = moviesNavigationState.currentCardIndex;
    
    var currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        var streamId = currentCard.getAttribute('data-stream-id');
        console.log('Long press Enter on movie:', streamId);
        alert('Long press Enter');
        
        // Here you can show options menu or add to favorites
        // Example: showMovieOptions(streamId);
    }
}

// === KEYBOARD NAVIGATION HANDLER ===
function handleKeyNavigation(e) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
        return;
    }
    
    var currentPage = localStorage.getItem("currentPage");
    var navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    
    // Prevent rapid repeated key presses (debounce)
    var now = Date.now();
    var lastPress = lastKeyPressTime[e.key] || 0;
    if (now - lastPress < keyPressDelay && e.key !== "Enter") {
        e.preventDefault();
        return;
    }
    lastKeyPressTime[e.key] = now;
    
    // Handle Enter key separately
    if (e.key === "Enter") {
        handleEnterKey(e);
        return;
    }
    
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling
    
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
    var currentCategory = getCurrentCategory();
    if (!currentCategory) return;
    
    var loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
    var totalMovies = currentCategory.movies ? currentCategory.movies.length : 0;
    
    // Check if we need to load more movies
    if (moviesNavigationState.currentCardIndex >= loadedCount - 2 && loadedCount < totalMovies) {
        loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
    }
    
    if (moviesNavigationState.currentCardIndex < loadedCount - 1) {
        moviesNavigationState.currentCardIndex++;
    } else {
        moviesNavigationState.currentCardIndex = loadedCount - 1;
    }
}

function moveLeft() {
    if (moviesNavigationState.currentCardIndex > 0) {
        moviesNavigationState.currentCardIndex--;
    } else {
        moviesNavigationState.currentCardIndex = 0;
    }
}

function moveDown() {
    var categories = getCategories();
    if (categories.length === 0) return;
    
    // Only move exactly one category forward
    var currentIndex = moviesNavigationState.currentCategoryIndex;
    if (currentIndex >= categories.length - 1) {
        // Already at last category, don't move
        return;
    }
    
    // Move to the next category (exactly one step)
    var nextCategoryIndex = currentIndex + 1;
    var previousCategoryIndex = currentIndex;
    moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
    
    var newCategory = getCurrentCategory();
    if (!newCategory) {
        // If next category doesn't exist, revert
        moviesNavigationState.currentCategoryIndex = previousCategoryIndex;
        return;
    }
    
    var loadedCount = getLoadedChunkCount(nextCategoryIndex);
    
    // Adjust card index to be within bounds of the new category
    if (loadedCount === 0) {
        // Load initial chunk if not loaded yet
        if (newCategory.movies && newCategory.movies.length > 0) {
            loadMoreMoviesForCategory(nextCategoryIndex);
        }
        // Set card index to 0
        moviesNavigationState.currentCardIndex = 0;
    } else {
        // Ensure card index is within loaded cards
        var maxCardIndex = Math.max(0, loadedCount - 1);
        // Clamp card index to valid range
        if (moviesNavigationState.currentCardIndex > maxCardIndex) {
            moviesNavigationState.currentCardIndex = maxCardIndex;
        }
        // If card index is still valid, keep it (maintain horizontal position)
    }
    
    console.log('Moved down: Category ' + previousCategoryIndex + ' -> ' + nextCategoryIndex + ', Card: ' + moviesNavigationState.currentCardIndex);
}

function moveUp() {
    if (moviesNavigationState.currentCategoryIndex > 0) {
        moviesNavigationState.currentCategoryIndex--;
        var newCategory = getCurrentCategory();
        var loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
        
        if (newCategory && newCategory.movies && moviesNavigationState.currentCardIndex >= loadedCount) {
            moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
        }
    } else {
        removeAllFocus();
        saveNavigationState();
        localStorage.setItem("navigationFocus", "navbar");
        
        var moviesNavItem = document.querySelector('.nav-item[data-page="moviesPage"]');
        if (moviesNavItem) {
            moviesNavItem.focus();
            moviesNavItem.classList.add("active");
        }
    }
}

// === LOAD MORE MOVIES FOR CATEGORY (CHUNK LOADING) ===
function loadMoreMoviesForCategory(categoryIndex) {
    if (chunkLoadingState.isLoading) return;
    
    var categories = getCategories();
    var category = categories[categoryIndex];
    if (!category) return;
    
    chunkLoadingState.isLoading = true;
    
    var cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) {
        chunkLoadingState.isLoading = false;
        return;
    }
    
    // Remove loading indicator if exists
    var loadingIndicator = cardList.querySelector('.movies-loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    // Add loading indicator
    var loadingHTML = createLoadingIndicator(categoryIndex);
    cardList.insertAdjacentHTML('beforeend', loadingHTML);
    
    // Simulate async loading (for smooth UX)
    setTimeout(function() {
        var newCardsHTML = loadMoviesChunk(category, categoryIndex, false);
        
        if (newCardsHTML) {
            // Remove loading indicator
            var loadingEl = cardList.querySelector('.movies-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            // Add new cards
            cardList.insertAdjacentHTML('beforeend', newCardsHTML);
            
            // Update focus if needed
            updateFocus();
        } else {
            // Remove loading indicator when all loaded
            var loadingEl = cardList.querySelector('.movies-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
        
        chunkLoadingState.isLoading = false;
    }, 100); // Small delay for smooth loading experience
}

// === FOCUS MANAGEMENT ===
function removeAllFocus() {
    var allCards = document.querySelectorAll(".movie-card");
    for (var i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove("focused");
    }
}

function updateFocus() {
    removeAllFocus();
    
    var navigationFocus = localStorage.getItem("navigationFocus");
    if (navigationFocus === "moviesPage") {
        var currentCard = document.querySelector(
            '.movie-card[data-category="' + moviesNavigationState.currentCategoryIndex + '"][data-index="' + moviesNavigationState.currentCardIndex + '"]'
        );
        
        if (currentCard) {
            currentCard.classList.add("focused");
            scrollToElement(currentCard);
            moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
            moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
        }
    }
}

// === HELPER FUNCTIONS ===
function getCategories() {
    return window.moviesCategories || [];
}

function getCurrentCategory() {
    var categories = getCategories();
    return categories[moviesNavigationState.currentCategoryIndex];
}

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
        var saved = localStorage.getItem('moviesNavState');
        if (saved) {
            var state = JSON.parse(saved);
            
            var previousPage = localStorage.getItem("previousPage");
            var currentPage = localStorage.getItem("currentPage");
            
            if (previousPage === "movieDetailPage" && currentPage === "moviesPage") {
                moviesNavigationState.currentCategoryIndex = 0;
                moviesNavigationState.currentCardIndex = 0;
                moviesNavigationState.lastFocusedCategory = 0;
                moviesNavigationState.lastFocusedCard = 0;
                localStorage.removeItem('moviesNavState');
                console.log("Reset navigation state - coming from movie detail page");
            } else {
                moviesNavigationState.currentCategoryIndex = state.currentCategoryIndex || 0;
                moviesNavigationState.currentCardIndex = state.currentCardIndex || 0;
                moviesNavigationState.lastFocusedCategory = state.lastFocusedCategory || 0;
                moviesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;
                console.log("Restored navigation state - Category:", moviesNavigationState.currentCategoryIndex, "Card:", moviesNavigationState.currentCardIndex);
            }
        } else {
            moviesNavigationState.currentCategoryIndex = 0;
            moviesNavigationState.currentCardIndex = 0;
            moviesNavigationState.lastFocusedCategory = 0;
            moviesNavigationState.lastFocusedCard = 0;
        }
    } catch (e) {
        console.log('Error restoring navigation state:', e);
        moviesNavigationState.currentCategoryIndex = 0;
        moviesNavigationState.currentCardIndex = 0;
        moviesNavigationState.lastFocusedCategory = 0;
        moviesNavigationState.lastFocusedCard = 0;
    }
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
    
    console.log("Movie navigation initialized");
}

function cleanupNavigation() {
    document.removeEventListener("keydown", handleKeyNavigation);
    document.removeEventListener("keyup", handleKeyNavigation);
    isNavigationInitialized = false;
    console.log("Movie navigation cleaned up");
}

// === FUNCTION TO RESET NAVIGATION STATE ===
function resetMoviesNavigationState() {
    moviesNavigationState.currentCategoryIndex = 0;
    moviesNavigationState.currentCardIndex = 0;
    moviesNavigationState.lastFocusedCategory = 0;
    moviesNavigationState.lastFocusedCard = 0;
    
    // Reset chunk loading state
    chunkLoadingState.loadedChunks = {};
    
    try {
        localStorage.removeItem('moviesNavState');
    } catch (e) {
        console.log('Error resetting navigation state:', e);
    }
    
    console.log("Movies navigation state reset to initial values");
}

// === RE-RENDER MOVIES PAGE ===
function rerenderMoviesPage() {
    // Clean up existing navigation
    cleanupNavigation();
    
    // Reset chunk loading state
    chunkLoadingState.loadedChunks = {};
    chunkLoadingState.isLoading = false;
    
    // Get current container
    var container = document.querySelector('.movies-page-container');
    if (!container) {
        console.log('Movies page container not found');
        return;
    }
    
    // Call MoviesPage to get new HTML
    var newHTML = MoviesPage();
    
    // Replace container content
    container.innerHTML = newHTML;
    
    // Reinitialize navigation
    setTimeout(function() {
        initNavigation();
        updateFocus();
    }, 100);
    
    console.log("Movies page re-rendered");
}

// === MAIN MOVIES PAGE FUNCTION ===
function MoviesPage() {
    // Get real data from global variables
    var allMoviesCategoriesData = window.moviesCategories || [];
    var allMoviesStreamsData = window.allMoviesStreams || [];
    
    var hasData = allMoviesCategoriesData.length > 0 && allMoviesStreamsData.length > 0;
    
    // Get three categories: My Fav, Popular Movies, Recently Watched
    var favoriteMovies = getFavoriteMovies();
    var popularMovies = getPopularMovies();
    var recentlyWatchedMovies = getRecentlyWatchedMovies();
    
    // Create categories array
    var categories = [
        { 
            title: "My Fav", 
            movies: favoriteMovies, 
            id: "fav", 
            containerClass: "movies-fav-container",
            category_id: "fav"
        },
        { 
            title: "Popular Movies", 
            movies: popularMovies, 
            id: "popular", 
            containerClass: "movies-popular-container",
            category_id: "popular"
        },
        { 
            title: "Recently Watched", 
            movies: recentlyWatchedMovies, 
            id: "recent", 
            containerClass: "recently-watched-container",
            category_id: "recent"
        }
    ];
    
    // Add other categories from API data if available
    if (hasData) {
        var apiCategories = allMoviesCategoriesData.map(function(category) {
            return {
                title: category.category_name || "Category",
                movies: allMoviesStreamsData.filter(function(stream) {
                    return String(stream.category_id) === String(category.category_id);
                }),
                id: category.category_id,
                containerClass: "movies-category-container",
                category_id: category.category_id,
                parent_id: category.parent_id
            };
        });
        
        // Append API categories after the three fixed ones
        categories = categories.concat(apiCategories);
    }
    
    // Store categories globally for navigation functions to access
    window.moviesCategories = categories;
    
    restoreNavigationState();
    
    // Update page tracking
    var currentPage = localStorage.getItem("currentPage");
    localStorage.setItem("previousPage", currentPage || "");
    localStorage.setItem("currentPage", "moviesPage");
    localStorage.setItem("navigationFocus", "moviesPage");
    
    // Reset chunk loading for fresh render
    chunkLoadingState.loadedChunks = {};
    
    // === CREATE CATEGORY CARDS WITH CHUNK LOADING ===
    function createCategoryCards(category, categoryIndex) {
        var cardsHTML = '';
        
        // Load initial chunk (10 movies)
        var initialChunk = loadMoviesChunk(category, categoryIndex, true);
        cardsHTML += initialChunk;
        
        // Add loading indicator if more movies to load
        var totalMovies = category.movies ? category.movies.length : 0;
        var loadedCount = getLoadedChunkCount(categoryIndex);
        
        if (loadedCount < totalMovies) {
            cardsHTML += createLoadingIndicator(categoryIndex);
        }
        
        return cardsHTML;
    }
    
    // === RENDER MOVIES PAGE ===
    var html = '<div class="movies-page-container">';
    
    for (var i = 0; i < categories.length; i++) {
        var category = categories[i];
        var size = category.id === "popular" ? "large" : "normal";
        
        html += '<div class="' + category.containerClass + '">';
        html += '<h1>' + category.title + '</h1>';
        html += '<div class="movies-card-list ' + category.id + '-list" data-category="' + i + '">';
        html += createCategoryCards(category, i);
        html += '</div>';
        html += '</div>';
    }
    
    html += '</div>';
    
    // Initialize navigation after render
    setTimeout(function() {
        initNavigation();
        updateFocus();
    }, 100);
    
    return html;
}

// Clean up when leaving the page
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', function() {
        cleanupNavigation();
    });
}

// Make functions globally available
window.moviesNavigationState = moviesNavigationState;
window.updateFocus = updateFocus;
window.saveNavigationState = saveNavigationState;
window.scrollToElement = scrollToElement;
window.rerenderMoviesPage = rerenderMoviesPage;
window.resetMoviesNavigationState = resetMoviesNavigationState;

console.log("MoviesPage function loaded successfully");
