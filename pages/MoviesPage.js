// === MEMORY OPTIMIZATION: Global navigation state ===
let moviesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

// Track if navigation is initialized
let isNavigationInitialized = false;

// Prevent rapid repeated key presses
let lastKeyPressTime = {};
let keyPressDelay = 100; // milliseconds

// Chunk loading state - memory optimization for 512MB RAM
let chunkLoadingState = {
    // Track loaded chunks per category
    loadedChunks: {},
    // Chunk size for horizontal loading
    horizontalChunkSize: 10,
    // Current loading state
    isLoading: false
};

// Enter key press tracking for long press detection
let enterKeyState = {
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
        let date = new Date(Number(timestamp) * 1000);
        return date.getFullYear().toString();
    } catch (e) {
        return "Unknown";
    }
}

// === GET CATEGORIES DATA ===
function getMoviesCategoriesData() {
    let allMoviesCategoriesData = window.moviesCategories || [];
    let allMoviesStreamsData = window.allMoviesStreams || [];
    
    let hasData = allMoviesCategoriesData.length > 0 && allMoviesStreamsData.length > 0;
    
    if (!hasData) {
        return [];
    }
    
    // Map categories with their movies
    let categories = allMoviesCategoriesData.map(function(category) {
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
        let username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        let playlist = null;
        for (let i = 0; i < playlists.length; i++) {
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
        let username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        let playlist = null;
        for (let i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                playlist = playlists[i];
                break;
            }
        }
        
        if (!playlist || !playlist.continueWatchingMovies) return [];
        
        // Return recently watched movies (limit to last 50 for memory optimization)
        let recent = playlist.continueWatchingMovies.slice(0, 50);
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
        let allMoviesStreamsData = window.allMoviesStreams || [];
        if (allMoviesStreamsData.length === 0) return [];
        
        // Sort by rating (descending) and take top movies
        let sorted = allMoviesStreamsData.slice().sort(function(a, b) {
            let ratingA = parseFloat(a.rating_5based || 0);
            let ratingB = parseFloat(b.rating_5based || 0);
            return ratingB - ratingA;
        });
        
        // Take top 100 for popular section
        let topMovies = sorted.slice(0, 100);
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
    let isLarge = size === "large";
    let cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
    
    let imageUrl = movieData.image || "./assets/demo-img-card.png";
    let title = movieData.title || "Unknown";
    let genre = movieData.genre || "Movie";
    let duration = movieData.duration || "N/A";
    let year = movieData.year || "Unknown";
    
    // Always apply marquee class - will activate when focused if text overflows
    let titleClass = 'movie-title-marquee';
    
    return '<div class="' + cardClass + '" ' +
           'data-category="' + categoryIndex + '" ' +
           'data-index="' + movieIndex + '" ' +
           'data-stream-id="' + (movieData.stream_id || movieData.id) + '" ' +
           'style="background: url(\'' + imageUrl + '\')">' +
           '<div class="movie-card-content">' +
           '<div class="movie-card-top">' +
           '<img src="./assets/heartIcon.png" alt="img" class="movie-card-heart" />' +
           '</div>' +
           '<div class="movie-card-play-div">' +
           '<img src="./assets/card-play-icon.png" alt="Play" class="movie-card-play" />' +
           '</div>' +
           '<div class="movie-card-bottom">' +
           '<div class="movie-card-bottom-left">' +
           '<h3>' + genre + '</h3>' +
           '<h2 class="' + titleClass + '">' + title + '</h2>' +
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
    
    let loadedCount = forceReload ? 0 : getLoadedChunkCount(categoryIndex);
    let chunkSize = chunkLoadingState.horizontalChunkSize;
    let totalMovies = category.movies.length;
    
    if (loadedCount >= totalMovies) {
        return ''; // All movies loaded
    }
    
    let endIndex = Math.min(loadedCount + chunkSize, totalMovies);
    let moviesToLoad = category.movies.slice(loadedCount, endIndex);
    
    let cardsHTML = '';
    for (let i = 0; i < moviesToLoad.length; i++) {
        let movieData = formatMovieData(moviesToLoad[i]);
        if (!movieData) continue;
        
        let size = category.id === "popular" ? "large" : "normal";
        let cardIndex = loadedCount + i;
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
    
    let scrollConfigs = [
        { behavior: "smooth", block: "center", inline: "center" },
        { behavior: "smooth", block: "nearest", inline: "nearest" },
        { block: "center", inline: "center" },
        { block: "nearest", inline: "nearest" }
    ];
    
    for (let i = 0; i < scrollConfigs.length; i++) {
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
    
    let container = findScrollableContainer(element);
    if (!container) {
        console.log('No scrollable container found');
        return;
    }
    
    try {
        let scrollLeft = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
        let scrollTop = element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2);
        
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
    let parent = element.parentElement;
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
    let categoryIndex = moviesNavigationState.currentCategoryIndex;
    let cardIndex = moviesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
        console.log('Simple Enter click on movie:', streamId);
        alert('Simple Enter click');
        
        // Here you can navigate to movie detail page or play movie
        // Example: navigateToMovieDetail(streamId);
    }
}

function handleLongPressEnter() {
    let categoryIndex = moviesNavigationState.currentCategoryIndex;
    let cardIndex = moviesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.movie-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let streamId = currentCard.getAttribute('data-stream-id');
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
    
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    
    // Prevent rapid repeated key presses (debounce)
    let now = Date.now();
    let lastPress = lastKeyPressTime[e.key] || 0;
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
    let currentCategory = getCurrentCategory();
    if (!currentCategory) return;
    
    let loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
    let totalMovies = currentCategory.movies ? currentCategory.movies.length : 0;
    
    // If we're at the last loaded card, and there are more movies to load
    if (moviesNavigationState.currentCardIndex >= loadedCount - 1 && loadedCount < totalMovies) {
        // Show loading and load more movies
        loadMoreMoviesForCategory(moviesNavigationState.currentCategoryIndex);
        // After loading completes, the card index will be updated automatically
        // For now, stay at current position - navigation will continue after loading
        setTimeout(function() {
            // After loading, try to move to next card if more were loaded
            let newLoadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
            if (newLoadedCount > loadedCount && moviesNavigationState.currentCardIndex < newLoadedCount - 1) {
                moviesNavigationState.currentCardIndex++;
                updateFocus();
            }
        }, 350); // Wait for loading to complete
        return;
    }
    
    // Move to next card if available
    if (moviesNavigationState.currentCardIndex < loadedCount - 1) {
        moviesNavigationState.currentCardIndex++;
    } else {
        // Already at last card
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
    let categories = getCategories();
    if (categories.length === 0) return;
    
    // Only move exactly one category forward
    let currentIndex = moviesNavigationState.currentCategoryIndex;
    if (currentIndex >= categories.length - 1) {
        // Already at last category - show loading indicator if we can load more
        let currentCategory = getCurrentCategory();
        if (currentCategory && currentCategory.movies) {
            let loadedCount = getLoadedChunkCount(currentIndex);
            let totalMovies = currentCategory.movies.length;
            // If there are more movies to load in the last category, show loading
            if (loadedCount < totalMovies) {
                loadMoreMoviesForCategory(currentIndex);
            }
        }
        return;
    }
    
    // Move to the next category (exactly one step)
    let nextCategoryIndex = currentIndex + 1;
    let previousCategoryIndex = currentIndex;
    moviesNavigationState.currentCategoryIndex = nextCategoryIndex;
    
    let newCategory = getCurrentCategory();
    if (!newCategory) {
        // If next category doesn't exist, revert
        moviesNavigationState.currentCategoryIndex = previousCategoryIndex;
        return;
    }
    
    let loadedCount = getLoadedChunkCount(nextCategoryIndex);
    
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
        let maxCardIndex = Math.max(0, loadedCount - 1);
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
        let newCategory = getCurrentCategory();
        let loadedCount = getLoadedChunkCount(moviesNavigationState.currentCategoryIndex);
        
        if (newCategory && newCategory.movies && moviesNavigationState.currentCardIndex >= loadedCount) {
            moviesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
        }
    } else {
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

// === LOAD MORE MOVIES FOR CATEGORY (CHUNK LOADING) ===
function loadMoreMoviesForCategory(categoryIndex) {
    // Prevent multiple simultaneous loads
    let loadingKey = 'loading_' + categoryIndex;
    if (chunkLoadingState[loadingKey]) {
        return; // Already loading this category
    }
    
    let categories = getCategories();
    let category = categories[categoryIndex];
    if (!category) return;
    
    let loadedCount = getLoadedChunkCount(categoryIndex);
    let totalMovies = category.movies ? category.movies.length : 0;
    
    // Check if there are more movies to load
    if (loadedCount >= totalMovies) {
        return; // All movies already loaded
    }
    
    chunkLoadingState[loadingKey] = true;
    
    let cardList = document.querySelector('.movies-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) {
        chunkLoadingState[loadingKey] = false;
        return;
    }
    
    // Remove existing loading indicator if exists
    let existingLoading = cardList.querySelector('.movies-loading-indicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    // Add loading indicator
    let loadingHTML = createLoadingIndicator(categoryIndex);
    cardList.insertAdjacentHTML('beforeend', loadingHTML);
    
    // Scroll to show loading indicator
    setTimeout(function() {
        let loadingEl = cardList.querySelector('.movies-loading-indicator');
        if (loadingEl) {
            loadingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, 50);
    
    // Simulate async loading (for smooth UX)
    setTimeout(function() {
        let newCardsHTML = loadMoviesChunk(category, categoryIndex, false);
        
        // Remove loading indicator
        let loadingEl = cardList.querySelector('.movies-loading-indicator');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        if (newCardsHTML) {
            // Add new cards before loading indicator position (or at end)
            cardList.insertAdjacentHTML('beforeend', newCardsHTML);
            
            // Update focus to current card
            updateFocus();
        }
        
        chunkLoadingState[loadingKey] = false;
    }, 300); // Small delay for smooth loading experience
}

// === FOCUS MANAGEMENT ===
function removeAllFocus() {
    let allCards = document.querySelectorAll(".movie-card");
    for (let i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove("focused");
    }
}

function updateFocus() {
    removeAllFocus();
    
    let navigationFocus = localStorage.getItem("navigationFocus");
    if (navigationFocus === "moviesPage") {
        let currentCard = document.querySelector(
            '.movie-card[data-category="' + moviesNavigationState.currentCategoryIndex + '"][data-index="' + moviesNavigationState.currentCardIndex + '"]'
        );
        
        if (currentCard) {
            currentCard.classList.add("focused");
            scrollToElement(currentCard);
            moviesNavigationState.lastFocusedCategory = moviesNavigationState.currentCategoryIndex;
            moviesNavigationState.lastFocusedCard = moviesNavigationState.currentCardIndex;
            
            // Check if title text overflows and enable marquee if needed
            checkAndEnableMarquee(currentCard);
        }
    }
}

// === CHECK AND ENABLE MARQUEE FOR OVERFLOWING TITLES ===
function checkAndEnableMarquee(card) {
    if (!card) return;
    
    let titleElement = card.querySelector('.movie-title-marquee');
    if (!titleElement) return;
    
    // Check if text actually overflows the container
    let container = titleElement.parentElement; // .movie-card-bottom-left
    if (!container) return;
    
    // Temporarily remove ellipsis to measure actual width
    let originalOverflow = titleElement.style.overflow;
    let originalTextOverflow = titleElement.style.textOverflow;
    let originalMaxWidth = titleElement.style.maxWidth;
    
    titleElement.style.overflow = 'visible';
    titleElement.style.textOverflow = 'clip';
    titleElement.style.maxWidth = 'none';
    
    // Measure widths
    let containerWidth = container.offsetWidth;
    let textWidth = titleElement.scrollWidth;
    
    // Restore original styles
    titleElement.style.overflow = originalOverflow;
    titleElement.style.textOverflow = originalTextOverflow;
    titleElement.style.maxWidth = originalMaxWidth;
    
    // If text is wider than container, ensure marquee class is present
    if (textWidth > containerWidth) {
        titleElement.classList.add('movie-title-marquee');
    } else {
        // Text fits, remove marquee animation but keep class for CSS
        titleElement.classList.remove('movie-title-needs-marquee');
    }
}

// === HELPER FUNCTIONS ===
function getCategories() {
    return window.moviesCategories || [];
}

function getCurrentCategory() {
    let categories = getCategories();
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
        let saved = localStorage.getItem('moviesNavState');
        if (saved) {
            let state = JSON.parse(saved);
            
            let previousPage = localStorage.getItem("previousPage");
            let currentPage = localStorage.getItem("currentPage");
            
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
    let container = document.querySelector('.movies-page-container');
    if (!container) {
        console.log('Movies page container not found');
        return;
    }
    
    // Call MoviesPage to get new HTML
    let newHTML = MoviesPage();
    
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
    let allMoviesCategoriesData = window.moviesCategories || [];
    let allMoviesStreamsData = window.allMoviesStreams || [];
    
    let hasData = allMoviesCategoriesData.length > 0 && allMoviesStreamsData.length > 0;
    
    // Get three categories: My Fav, Popular Movies, Recently Watched
    let favoriteMovies = getFavoriteMovies();
    let popularMovies = getPopularMovies();
    let recentlyWatchedMovies = getRecentlyWatchedMovies();
    
    // Create categories array
    let categories = [
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
        let apiCategories = allMoviesCategoriesData.map(function(category) {
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
    let currentPage = localStorage.getItem("currentPage");
    localStorage.setItem("previousPage", currentPage || "");
    localStorage.setItem("currentPage", "moviesPage");
    localStorage.setItem("navigationFocus", "moviesPage");
    
    // Reset chunk loading for fresh render
    chunkLoadingState.loadedChunks = {};
    
    // === CREATE CATEGORY CARDS WITH CHUNK LOADING ===
    function createCategoryCards(category, categoryIndex) {
        let cardsHTML = '';
        
        // Load initial chunk (10 movies)
        let initialChunk = loadMoviesChunk(category, categoryIndex, true);
        cardsHTML += initialChunk;
        
        // Add loading indicator if more movies to load
        let totalMovies = category.movies ? category.movies.length : 0;
        let loadedCount = getLoadedChunkCount(categoryIndex);
        
        if (loadedCount < totalMovies) {
            cardsHTML += createLoadingIndicator(categoryIndex);
        }
        
        return cardsHTML;
    }
    
    // === RENDER MOVIES PAGE ===
    let html = '<div class="movies-page-container">';
    
    for (let i = 0; i < categories.length; i++) {
        let category = categories[i];
        let size = category.id === "popular" ? "large" : "normal";
        
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