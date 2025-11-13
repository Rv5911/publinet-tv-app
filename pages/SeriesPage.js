let seriesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

let allSeriesStreamsData = window.allSeriesStreams || [];
let favoriteSeriesIds = [];

let isSeriesNavigationInitialized = false;

let seriesChunkLoadingState = {
    loadedCategories: 0,
    categoryChunkSize: 4,
    loadedChunks: {},
    horizontalChunkSize: 12,
    isLoading: false
};

let seriesEnterKeyState = {
    isPressed: false,
    pressStartTime: 0,
    longPressThreshold: 400,
    timeoutId: null
};

function formatSeriesData(seriesStream) {
    if (!seriesStream) return null;
    
    return {
        id: seriesStream.series_id || seriesStream.num,
        series_id: seriesStream.series_id,
        title: seriesStream.name || "Unknown",
        genre: seriesStream.category_name || "Series",
        year: formatSeriesYear(seriesStream.added),
        image: seriesStream.cover || seriesStream.stream_icon || "./assets/demo-img-card.png",
        rating: seriesStream.rating || "0",
        seasons: seriesStream.seasons || "1"
    };
}

function formatSeriesYear(timestamp) {
    if (!timestamp) return "Unknown";
    try {
        return new Date(Number(timestamp) * 1000).getFullYear().toString();
    } catch (e) {
        return "Unknown";
    }
}

function formatSeasons(series) {
    return (series.seasons || "1") + " Seasons";
}

function getFavoriteSeries() {
    try {
        const username = getCurrentPlaylistUsername();
        if (!username) return [];

        const playlists = getPlaylistsData();
        const playlist = playlists.find(p => p.playlistName === username);
        
        if (playlist && playlist.series) {
            console.log(playlist.series, "PLAYLIST SERIES");
            return playlist.series.map(id => id.toString()); // Ensure all IDs are strings
        }
        
        return [];
    } catch (e) {
        console.error("Error getting favorite series:", e);
        return [];
    }
}

function getRecentlyWatchedSeries() {
    try {
        let username = window.getCurrentPlaylistUsername ? window.getCurrentPlaylistUsername() : null;
        if (!username) return [];
        
        let playlists = window.getPlaylistsData ? window.getPlaylistsData() : [];
        for (let i = 0; i < playlists.length; i++) {
            if (playlists[i].playlistUsername === username) {
                let recent = playlists[i].continueWatchingSeries || [];
                return recent.slice(0, 15).map(formatSeriesData).filter(s => s !== null);
            }
        }
        return [];
    } catch (e) {
        return [];
    }
}

function getPopularSeries() {
    try {
        if (allSeriesStreamsData.length === 0) return [];
        
        let sorted = allSeriesStreamsData.slice(0, 50);
        sorted.sort(function(a, b) {
            return (parseFloat(b.rating_5based) || 0) - (parseFloat(a.rating_5based) || 0);
        });
        
        return sorted.slice(0, 30).map(formatSeriesData).filter(s => s !== null);
    } catch (e) {
        return [];
    }
}

function getAPISeriesCategories() {
    let allSeriesCategoriesData = window.allseriesCategories || [];
    let allSeriesStreamsData = window.allSeriesStreams || [];
    
    if (allSeriesCategoriesData.length === 0 || allSeriesStreamsData.length === 0) {
        return [];
    }
    
    let categories = [];
    for (let i = 0; i < allSeriesCategoriesData.length; i++) {
        let category = allSeriesCategoriesData[i];
        let series = [];
        
        for (let j = 0; j < allSeriesStreamsData.length; j++) {
            let stream = allSeriesStreamsData[j];
            if (stream.category_id == category.category_id) {
                series.push(stream);
                if (series.length >= 50) break;
            }
        }
        
        categories.push({
            title: category.category_name || "Category",
            series: series,
            id: category.category_id,
            containerClass: "series-category-container",
            category_id: category.category_id
        });
    }
    
    return categories;
}

function createSeriesCard(seriesData, size, categoryIndex, seriesIndex) {
    let isLarge = size === "large";
    let cardClass = isLarge ? "series-card series-card-large" : "series-card";
    let seriesId = String(seriesData.series_id || seriesData.id);
    
    // Safe check for favoriteSeriesIds
    let isSeriesFav = Array.isArray(favoriteSeriesIds) && 
                     favoriteSeriesIds.some(favId => String(favId) === String(seriesId));
    
    let imageUrl = seriesData.image || "./assets/demo-img-card.png";
    let titleClass = 'series-title-marquee';
    
    return `<div class="${cardClass}" 
            data-category="${categoryIndex}" 
            data-index="${seriesIndex}" 
            data-series-id="${seriesId}" 
            style="background-image: url('${imageUrl}')">
            <div class="series-card-content">
                <div class="series-card-top">
                    <img src="./assets/heartIcon.png" 
                         style="display: ${isSeriesFav ? 'block' : 'none'}" 
                         alt="Favorite" 
                         class="series-card-heart" />
                </div>
                <div class="series-card-play-div">
                    <img src="./assets/card-play-icon.png" alt="Play" class="series-card-play" />
                </div>
                <div class="series-card-bottom">
                    <div class="series-card-bottom-left">
                        <h3>${seriesData.genre || "Series"}</h3>
                        <h2 class="${titleClass}">${seriesData.title || "Unknown"}</h2>
                    </div>
                    <div class="series-card-bottom-right">
                        <h3>${seriesData.seasons || "1 Season"}</h3>
                        <h2>${seriesData.year || "Unknown"}</h2>
                    </div>
                </div>
            </div>
        </div>`;
}

function createSeriesLoadingIndicator(categoryIndex) {
    return '<div class="series-loading-indicator" data-category="' + categoryIndex + '">' +
           '<p>Loading...</p>' +
           '</div>';
}

// === SIMPLIFIED CHUNK LOADING ===
function getSeriesLoadedChunkCount(categoryIndex) {
    return seriesChunkLoadingState.loadedChunks[categoryIndex] || 0;
}

function setSeriesLoadedChunkCount(categoryIndex, count) {
    seriesChunkLoadingState.loadedChunks[categoryIndex] = count;
}

function loadSeriesChunk(category, categoryIndex) {
    if (!category || !category.series || category.series.length === 0) return '';
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    let chunkSize = seriesChunkLoadingState.horizontalChunkSize;
    let totalSeries = category.series.length;
    
    if (loadedCount >= totalSeries) return '';
    
    let endIndex = Math.min(loadedCount + chunkSize, totalSeries);
    let cardsHTML = '';
    
    for (let i = loadedCount; i < endIndex; i++) {
        let seriesData = formatSeriesData(category.series[i]);
        if (!seriesData) continue;
        
        let size = category.id === "popular" ? "large" : "normal";
        cardsHTML += createSeriesCard(seriesData, size, categoryIndex, i);
    }
    
    setSeriesLoadedChunkCount(categoryIndex, endIndex);
    return cardsHTML;
}

// === NEW FUNCTION: CHECK IF CATEGORY HAS SERIES ===
function seriesCategoryHasSeries(categoryIndex) {
    let categories = window.allseriesCategories || [];
    let category = categories[categoryIndex];
    
    if (!category || !category.series || category.series.length === 0) {
        return false;
    }
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    return loadedCount > 0;
}

// === NEW FUNCTION: FIND NEXT CATEGORY WITH SERIES ===
function findNextSeriesCategoryWithSeries(startIndex, direction) {
    let allCategories = window.allseriesCategories || [];
    
    // direction: 1 = down, -1 = up
    if (direction === 1) {
        // Search downwards
        for (let i = startIndex; i < allCategories.length; i++) {
            if (seriesCategoryHasSeries(i)) {
                return i;
            }
        }
    } else {
        // Search upwards
        for (let i = startIndex; i >= 0; i--) {
            if (seriesCategoryHasSeries(i)) {
                return i;
            }
        }
    }
    
    return -1; // No category with series found
}

// === LOAD MORE CATEGORIES WHEN REACHING END ===
function loadMoreSeriesCategories() {
    if (seriesChunkLoadingState.isLoading) return;
    
    let allCategories = window.allseriesCategories || [];
    let currentLoaded = seriesChunkLoadingState.loadedCategories;
    
    if (currentLoaded >= allCategories.length) {
        // Remove loading indicator if no more categories to load
        let container = document.querySelector('.series-page-container');
        if (container) {
            let categoriesLoading = container.querySelector('.categories-loading-indicator');
            if (categoriesLoading) {
                categoriesLoading.remove();
            }
        }
        return;
    }
    
    seriesChunkLoadingState.isLoading = true;
    
    let nextChunk = Math.min(currentLoaded + seriesChunkLoadingState.categoryChunkSize, allCategories.length);
    
    // Safety timeout to prevent infinite loading
    let safetyTimeout = setTimeout(function() {
        if (seriesChunkLoadingState.isLoading) {
            console.warn('loadMoreSeriesCategories: Safety timeout triggered, resetting loading state');
            seriesChunkLoadingState.isLoading = false;
            let container = document.querySelector('.series-page-container');
            if (container) {
                let categoriesLoading = container.querySelector('.categories-loading-indicator');
                if (categoriesLoading) {
                    categoriesLoading.remove();
                }
            }
        }
    }, 5000); // 5 second safety timeout
    
    setTimeout(function() {
        try {
            let container = document.querySelector('.series-page-container');
            if (!container) {
                clearTimeout(safetyTimeout);
                seriesChunkLoadingState.isLoading = false;
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
                
                // Only add category if it has series
                if (category.series && category.series.length > 0) {
                    try {
                        let categoryHTML = createSeriesCategorySection(category, i);
                        container.insertAdjacentHTML('beforeend', categoryHTML);
                        categoriesAdded++;
                    } catch (e) {
                        console.error('Error creating category section:', e);
                    }
                }
            }
            
            // Check if there are more categories with series to load
            let hasMoreCategories = false;
            for (let i = nextChunk; i < allCategories.length; i++) {
                let category = allCategories[i];
                if (category && category.series && category.series.length > 0) {
                    hasMoreCategories = true;
                    break;
                }
            }
            
            if (hasMoreCategories) {
                container.insertAdjacentHTML('beforeend', '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>');
            }
            
            seriesChunkLoadingState.loadedCategories = nextChunk;
            clearTimeout(safetyTimeout);
            seriesChunkLoadingState.isLoading = false;
            
            if (categoriesAdded > 0) {
                updateSeriesFocus();
            }
        } catch (e) {
            console.error('Error in loadMoreSeriesCategories:', e);
            clearTimeout(safetyTimeout);
            seriesChunkLoadingState.isLoading = false;
            
            // Remove loading indicator on error
            let container = document.querySelector('.series-page-container');
            if (container) {
                let categoriesLoading = container.querySelector('.categories-loading-indicator');
                if (categoriesLoading) {
                    categoriesLoading.remove();
                }
            }
        }
    }, 200);
}

function createSeriesCategorySection(category, categoryIndex) {
    let size = category.id === "popular" ? "large" : "normal";
    
    let html = '<div class="' + category.containerClass + '">';
    html += '<h1>' + category.title + '</h1>';
    html += '<div class="series-card-list ' + category.id + '-list" data-category="' + categoryIndex + '">';
    
    let initialSeries = loadSeriesChunk(category, categoryIndex);
    html += initialSeries;
    
    if (category.series && category.series.length > getSeriesLoadedChunkCount(categoryIndex)) {
        html += createSeriesLoadingIndicator(categoryIndex);
    }
    
    html += '</div>';
    html += '</div>';
    
    return html;
}

// === CREATE NO DATA MESSAGE ===
function createNoSeriesDataMessage(categoryTitle) {
    return '<div class="no-series-data-container">' +
           '<div class="no-series-data-content">' +
           '<h2>No Data Available</h2>' +
           '<p>No ' + categoryTitle + ' found</p>' +
           '</div>' +
           '</div>';
}

function handleSeriesEnterKey(e) {
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "seriesPage" || navigationFocus !== "seriesPage") {
        return;
    }
    
    if (e.key === "Enter") {
        e.preventDefault();
        
        if (e.type === "keydown") {
            // Start tracking enter press
            seriesEnterKeyState.isPressed = true;
            seriesEnterKeyState.pressStartTime = Date.now();
            
            // Set timeout for long press detection
            seriesEnterKeyState.timeoutId = setTimeout(function() {
                if (seriesEnterKeyState.isPressed) {
                    // Long press detected
                    handleSeriesLongPressEnter();
                    seriesEnterKeyState.isPressed = false;
                }
            }, seriesEnterKeyState.longPressThreshold);
        } else if (e.type === "keyup") {
            // End of enter press
            if (seriesEnterKeyState.isPressed) {
                let pressDuration = Date.now() - seriesEnterKeyState.pressStartTime;
                
                if (pressDuration < seriesEnterKeyState.longPressThreshold) {
                    // Simple click
                    clearTimeout(seriesEnterKeyState.timeoutId);
                    handleSeriesSimpleEnter();
                }
                
                seriesEnterKeyState.isPressed = false;
            }
        }
    }
}

function handleSeriesSimpleEnter() {
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let categoryIndex = seriesNavigationState.currentCategoryIndex;
    let cardIndex = seriesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.series-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let seriesId = currentCard.getAttribute('data-series-id');

        localStorage.setItem("seriesCategoryIndex", categoryIndex);
        localStorage.setItem("seriesCardIndex", cardIndex);
        localStorage.setItem("seriesSelectedCategoryId", categoryIndex);
        
        localStorage.setItem("selectedSeriesId", seriesId);

        const selectedSeriesItem = window.allSeriesStreams && window.allSeriesStreams.find ? window.allSeriesStreams.find(item => item.series_id == seriesId) : null;
        if (selectedSeriesItem) {
            localStorage.setItem("selectedSeriesData", JSON.stringify(selectedSeriesItem));
        }

        // CLEANUP: Remove series page event listeners
        cleanupSeriesNavigation();
        
        document.querySelector("#loading-progress").style.display = "none";
        
        // SET CORRECT PAGE STATE
        localStorage.setItem("currentPage", "seriesDetailPage");
        localStorage.setItem("navigationFocus", "seriesDetailPage");
        
        Router.showPage("seriesDetailPage"); 
    }
}

function handleSeriesLongPressEnter() {
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let categoryIndex = seriesNavigationState.currentCategoryIndex;
    let cardIndex = seriesNavigationState.currentCardIndex;
    
    let currentCard = document.querySelector(
        '.series-card[data-category="' + categoryIndex + '"][data-index="' + cardIndex + '"]'
    );
    
    if (currentCard) {
        let seriesId = currentCard.getAttribute('data-series-id');
        // alert("LONG PRESS " + seriesId);
        console.log("seriesId",seriesId)
        alert("seriesId",seriesId)
        toggleFavoriteItem(seriesId, "series", getCurrentPlaylistUsername());
        // Example: showSeriesOptions(seriesId);
    }
}

let seriesNavigationDebounce = {
    lastKeyPress: 0,
    debounceTime: 300,
    isDebouncing: false
};

function handleSeriesKeyNavigation(e) {
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "seriesPage" || navigationFocus !== "seriesPage") {
        return;
    }
    
    if (e.key === "Enter") {
        handleSeriesEnterKey(e);
        return;
    }
    
    // DEBOUNCE CHECK - Prevent too fast navigation
    const now = Date.now();
    if (now - seriesNavigationDebounce.lastKeyPress < seriesNavigationDebounce.debounceTime) {
        e.preventDefault();
        return;
    }
    
    e.preventDefault();
    
    // Set debounce timestamp
    seriesNavigationDebounce.lastKeyPress = now;
    
    switch(e.key) {
        case "ArrowRight":
            moveSeriesRight();
            break;
        case "ArrowLeft":
            moveSeriesLeft();
            break;
        case "ArrowDown":
            moveSeriesDown();
            break;
        case "ArrowUp":
            moveSeriesUp();
            break;
    }
    
    updateSeriesFocus();
    saveSeriesNavigationState();
}

function cleanupSeriesNavigation() {
    document.removeEventListener("keydown", handleSeriesKeyNavigation);
    document.removeEventListener("keyup", handleSeriesKeyNavigation);
    isSeriesNavigationInitialized = false;
    seriesNavigationDebounce.lastKeyPress = 0;
    seriesNavigationDebounce.isDebouncing = false;
}

function getCurrentVisibleIndex(categoryIndex, cardIndex) {
    let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return cardIndex;
    
    // Get container and card dimensions
    let containerWidth = cardList.offsetWidth;
    let firstCard = cardList.querySelector('.series-card');
    if (!firstCard) return cardIndex;
    
    let cardWidth = firstCard.offsetWidth + 16; // card width + margin
    let visibleCardsCount = Math.floor(containerWidth / cardWidth);
    
    // If we're beyond visible range, return position within visible range
    if (cardIndex >= visibleCardsCount) {
        return cardIndex % visibleCardsCount;
    }
    
    // If within visible range, keep the same position
    return cardIndex;
}

function moveSeriesRight() {
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    let currentCategory = getCurrentSeriesCategory();
    if (!currentCategory) return;
    
    let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
    let totalSeries = currentCategory.series ? currentCategory.series.length : 0;
    
    // Fixed: Always move exactly one card right
    if (seriesNavigationState.currentCardIndex < loadedCount - 1) {
        seriesNavigationState.currentCardIndex++;
    } else {
        // If at end and more series available, load more
        if (loadedCount < totalSeries) {
            loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
        }
    }
    
    // Store last focused position for this category
    seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
    seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
}

function moveSeriesLeft() {
    // FIXED: Check if current category has series
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    // Fixed: Always move exactly one card left
    if (seriesNavigationState.currentCardIndex > 0) {
        seriesNavigationState.currentCardIndex--;
    }
    
    // Store last focused position for this category
    seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
    seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
}

function moveSeriesDown() {
    let allCategories = window.allseriesCategories || [];
    if (allCategories.length === 0) return;
    
    let currentIndex = seriesNavigationState.currentCategoryIndex;
    let currentCardIndex = seriesNavigationState.currentCardIndex;
    
    let nextCategoryIndex = findNextSeriesCategoryWithSeries(currentIndex + 1, 1);

    if(nextCategoryIndex > 2){
       const navbarEl=document.querySelector("#navbar-root");

    if(navbarEl){
        navbarEl.style.display="none";
    }
    }
    if (nextCategoryIndex !== -1) {
        seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
        
        let newCategory = getCurrentSeriesCategory();
        if (newCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            // Maintain same visible position in the new category
            let visiblePosition = getCurrentVisibleIndex(currentIndex, currentCardIndex);
            seriesNavigationState.currentCardIndex = Math.min(visiblePosition, loadedCount - 1);
        } else {
            seriesNavigationState.currentCardIndex = 0;
        }
        
        let loadedCategoriesCount = seriesChunkLoadingState.loadedCategories;
        if (seriesNavigationState.currentCategoryIndex >= loadedCategoriesCount - 2) {
            loadMoreSeriesCategories();
        }
    } else {
        let currentCategory = getCurrentSeriesCategory();
        if (currentCategory && currentCategory.series) {
            let loadedCount = getSeriesLoadedChunkCount(currentIndex);
            let totalSeries = currentCategory.series.length;
            if (loadedCount < totalSeries) {
                loadMoreSeriesForCategory(currentIndex);
            }
        }
    }
}

function moveSeriesUp() {
    let currentIndex = seriesNavigationState.currentCategoryIndex;
    let currentCardIndex = seriesNavigationState.currentCardIndex;
    
    let prevCategoryIndex = findNextSeriesCategoryWithSeries(currentIndex - 1, -1);
    
    if (prevCategoryIndex !== -1) {
        seriesNavigationState.currentCategoryIndex = prevCategoryIndex;
        
        let newCategory = getCurrentSeriesCategory();
        if (newCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            // Maintain same visible position in the new category
            let visiblePosition = getCurrentVisibleIndex(currentIndex, currentCardIndex);
            seriesNavigationState.currentCardIndex = Math.min(visiblePosition, loadedCount - 1);
        } else {
            seriesNavigationState.currentCardIndex = 0;
        }
    } else {
        try {
            const seriesContainer = document.querySelector('.series-page-container');
            if (seriesContainer) {
                seriesContainer.scrollTop = 0;
            }

            const navbarEl=document.querySelector("#navbar-root");

            if(navbarEl){
                navbarEl.style.display="block";
            }
            
        } catch (e) {
            console.log('Scroll to top failed:', e);
        }
        
        removeAllSeriesFocus();
        saveSeriesNavigationState();
        localStorage.setItem("navigationFocus", "navbar");

        setTimeout(() => {
            const seriesNavItem = document.querySelector('.nav-item[data-page="seriesPage"]');
            if (seriesNavItem) {
                seriesNavItem.focus();
                seriesNavItem.classList.add("active");
            }
        }, 50);
    }
}

function loadMoreSeriesForCategory(categoryIndex) {
    if (seriesChunkLoadingState.isLoading) return;
    
    let categories = window.allseriesCategories || [];
    if (categoryIndex < 0 || categoryIndex >= categories.length) return;
    
    let category = categories[categoryIndex];
    if (!category) return;
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    let totalSeries = category.series ? category.series.length : 0;
    
    if (loadedCount >= totalSeries) {
        // Remove loading indicator if no more series to load
        let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
        if (cardList) {
            let loadingEl = cardList.querySelector('.series-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
        return;
    }
    
    seriesChunkLoadingState.isLoading = true;
    
    let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) {
        seriesChunkLoadingState.isLoading = false;
        return;
    }
    
    let existingLoading = cardList.querySelector('.series-loading-indicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    cardList.insertAdjacentHTML('beforeend', createSeriesLoadingIndicator(categoryIndex));
    
    // Safety timeout to prevent infinite loading
    let safetyTimeout = setTimeout(function() {
        if (seriesChunkLoadingState.isLoading) {
            console.warn('loadMoreSeriesForCategory: Safety timeout triggered, resetting loading state');
            seriesChunkLoadingState.isLoading = false;
            let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
            if (cardList) {
                let loadingEl = cardList.querySelector('.series-loading-indicator');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
        }
    }, 3000); // 3 second safety timeout
    
    setTimeout(function() {
        try {
            let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
            if (!cardList) {
                clearTimeout(safetyTimeout);
                seriesChunkLoadingState.isLoading = false;
                return;
            }
            
            let newCardsHTML = loadSeriesChunk(category, categoryIndex);
            
            let loadingEl = cardList.querySelector('.series-loading-indicator');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            if (newCardsHTML) {
                cardList.insertAdjacentHTML('beforeend', newCardsHTML);
                
                // If this is the category we're trying to restore focus to, update focus
                if (seriesNavigationState.currentCategoryIndex === categoryIndex) {
                    updateSeriesFocus();
                }
            }
            
            clearTimeout(safetyTimeout);
            seriesChunkLoadingState.isLoading = false;
        } catch (e) {
            console.error('Error in loadMoreSeriesForCategory:', e);
            clearTimeout(safetyTimeout);
            seriesChunkLoadingState.isLoading = false;
            
            // Remove loading indicator on error
            let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
            if (cardList) {
                let loadingEl = cardList.querySelector('.series-loading-indicator');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
        }
    }, 100);
}

// === FOCUS MANAGEMENT WITH MARQUEE ACTIVATION ===
function removeAllSeriesFocus() {
    let allCards = document.querySelectorAll(".series-card");
    for (let i = 0; i < allCards.length; i++) {
        allCards[i].classList.remove("focused");
        
        let titleElement = allCards[i].querySelector('.series-title-marquee');
        if (titleElement) {
            titleElement.classList.remove('marquee-active');
        }
    }
}

function updateSeriesFocus() {
    removeAllSeriesFocus();
    
    let navigationFocus = localStorage.getItem("navigationFocus");
    if (navigationFocus === "seriesPage") {
        // FIXED: Only set focus if category has series
        if (seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
            let currentCard = document.querySelector(
                '.series-card[data-category="' + seriesNavigationState.currentCategoryIndex + '"][data-index="' + seriesNavigationState.currentCardIndex + '"]'
            );
            
            if (currentCard) {
                currentCard.classList.add("focused");
                scrollToSeriesElement(currentCard);
                
                // Store last focused position
                seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
                seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
                
                activateSeriesMarquee(currentCard);
            }
        }
        // If category has no series, don't set any focus initially
    }
}

function activateSeriesMarquee(card) {
    if (!card) return;
    
    let titleElement = card.querySelector('.series-title-marquee');
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
function scrollToSeriesElement(element) {
    if (!element) return;
    
    try {
        // Use nearest for smooth scrolling
          document.body.scrollTop = 30
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
function saveSeriesNavigationState() {
    try {
        localStorage.setItem('seriesNavState', JSON.stringify({
            currentCategoryIndex: seriesNavigationState.currentCategoryIndex,
            currentCardIndex: seriesNavigationState.currentCardIndex,
            lastFocusedCategory: seriesNavigationState.lastFocusedCategory,
            lastFocusedCard: seriesNavigationState.lastFocusedCard
        }));
    } catch (e) {
        console.log('Error saving navigation state:', e);
    }
}

function restoreSeriesNavigationState() {
    try {
        let saved = localStorage.getItem('seriesNavState');
        if (saved) {
            let state = JSON.parse(saved);
            seriesNavigationState.currentCategoryIndex = state.currentCategoryIndex || 0;
            seriesNavigationState.currentCardIndex = state.currentCardIndex || 0;
            seriesNavigationState.lastFocusedCategory = state.lastFocusedCategory || 0;
            seriesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;
            
            // Wait for content to load before validating
            setTimeout(() => {
                validateAndAdjustRestoredSeriesState();
            }, 100);
        }
    } catch (e) {
        console.log('Error restoring navigation state:', e);
    }
}

function doesSeriesCardExist(categoryIndex, cardIndex) {
    let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return false;
    
    let card = cardList.querySelector('.series-card[data-index="' + cardIndex + '"]');
    return card !== null;
}

function validateAndAdjustRestoredSeriesState() {
    // First, ensure we have at least one category with series
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        let nextCategoryIndex = findNextSeriesCategoryWithSeries(0, 1);
        if (nextCategoryIndex !== -1) {
            seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
            seriesNavigationState.currentCardIndex = 0;
        } else {
            // No categories with series found, reset to defaults
            seriesNavigationState.currentCategoryIndex = 0;
            seriesNavigationState.currentCardIndex = 0;
        }
    } else {
        // Category exists, check if card index is valid
        let currentCategory = getCurrentSeriesCategory();
        if (currentCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            // If the restored card index is beyond loaded count, adjust it
            if (seriesNavigationState.currentCardIndex >= loadedCount) {
                seriesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
            }
            
            // If the specific card doesn't exist but should be loaded, try to load more
            if (!doesSeriesCardExist(seriesNavigationState.currentCategoryIndex, seriesNavigationState.currentCardIndex) && 
                loadedCount < currentCategory.series.length) {
                loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
            }
        }
    }
    
    // Update focus after state is validated
    setTimeout(() => {
        updateSeriesFocus();
    }, 50);
}

// === HELPER FUNCTIONS ===
function getCurrentSeriesCategory() {
    let categories = window.allseriesCategories || [];
    return categories[seriesNavigationState.currentCategoryIndex];
}

// === NAVIGATION INITIALIZATION ===
function initSeriesNavigation() {
    if (isSeriesNavigationInitialized) {
        document.removeEventListener("keydown", handleSeriesKeyNavigation);
        document.removeEventListener("keyup", handleSeriesKeyNavigation);
    }
    
    document.addEventListener("keydown", handleSeriesKeyNavigation);
    document.addEventListener("keyup", handleSeriesKeyNavigation);
    isSeriesNavigationInitialized = true;
}

function cleanupSeriesNavigation() {
    document.removeEventListener("keydown", handleSeriesKeyNavigation);
    document.removeEventListener("keyup", handleSeriesKeyNavigation);
    isSeriesNavigationInitialized = false;
}

function hasAnySeriesCategoryData() {
    let categories = window.allseriesCategories || [];
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].series && categories[i].series.length > 0) {
            return true;
        }
    }
    return false;
}

function SeriesPage() {
    let loadingHTML = '<div class="series-page-loading">' + 
                     '<div class="loading-spinner"></div>' +
                     '<p>Loading Series...</p>' +
                     '</div>';
    
    localStorage.setItem("previousPage", localStorage.getItem("currentPage") || "");
    localStorage.setItem("currentPage", "seriesPage");
    localStorage.setItem("navigationFocus", "seriesPage");
    
    // Initialize favoriteSeriesIds to empty array to prevent the error
    favoriteSeriesIds = [];
    
    setTimeout(function() {
        const currentPlaylist = getCurrentPlaylist();   
        const currentPlaylistFavIds = currentPlaylist ? currentPlaylist.favouriteSeries : [];   
        
        // Assign to the global variable, don't declare a new one
        favoriteSeriesIds = currentPlaylistFavIds || [];

        
        let favouriteSeries = window.allSeriesStreams && currentPlaylistFavIds ? 
            window.allSeriesStreams.filter(s => currentPlaylistFavIds.includes(s.series_id)) : [];
        let popularSeries = window.allSeriesStreams ? 
            window.allSeriesStreams.filter(s => s.rating_5based > 4).slice(0, 10) : [];
        let recentlyWatchedSeries = currentPlaylist && currentPlaylist.continueWatchingSeries ? 
            currentPlaylist.continueWatchingSeries : [];
        let apiCategories = getAPISeriesCategories();
        
        let initialCategories = [
            { 
                title: "My Fav", 
                series: favouriteSeries, 
                id: "fav", 
                containerClass: "series-fav-container"
            },
            { 
                title: "Popular Series", 
                series: popularSeries, 
                id: "popular", 
                containerClass: "series-popular-container"
            },
            { 
                title: "Recently Watched", 
                series: recentlyWatchedSeries, 
                id: "recent", 
                containerClass: "recently-watched-series-container"
            }
        ];
        
        // Add first 3 API categories if available
        let apiCategoriesToLoad = apiCategories.slice(0, 3);
        initialCategories = initialCategories.concat(apiCategoriesToLoad);
        
        // Store all categories for later loading
        window.allseriesCategories = initialCategories.concat(apiCategories.slice(3));
        
        // Reset loading state
        seriesChunkLoadingState.loadedCategories = initialCategories.length;
        seriesChunkLoadingState.loadedChunks = {};
        seriesChunkLoadingState.isLoading = false;
        
        // Check if we have any data
        if (!hasAnySeriesCategoryData()) {
            let noDataHTML = '<div class="series-page-container">' +
                           createNoSeriesDataMessage("series") +
                           '</div>';
            document.querySelector('.series-page-container').innerHTML = noDataHTML;
            return;
        }
        
        // Build page HTML with initial categories
        let html = '<div class="series-page-container">';
        
        for (let i = 0; i < initialCategories.length; i++) {
            let category = initialCategories[i];
            // Only show category if it has series
            if (category.series && category.series.length > 0) {
                html += createSeriesCategorySection(category, i);
            }
        }
        
        // Only show loading indicator if there are more categories with series to load
        let hasMoreCategories = false;
        for (let i = initialCategories.length; i < window.allseriesCategories.length; i++) {
            let category = window.allseriesCategories[i];
            if (category && category.series && category.series.length > 0) {
                hasMoreCategories = true;
                break;
            }
        }
        
        if (hasMoreCategories) {
            html += '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>';
        }
        
        html += '</div>';
        
        // Replace loading with actual content
        let container = document.querySelector('.series-page-loading');
        if (container) {
            container.outerHTML = html;
        }
        
        // Restore navigation state AFTER content is loaded
        restoreSeriesNavigationState();
        
        // Initialize navigation
        setTimeout(function() {
            initSeriesNavigation();
            // Focus will be updated by restoreSeriesNavigationState
        }, 100);
        
    }, 500); 
    
    return loadingHTML;
}

window.seriesNavigationState = seriesNavigationState;
window.updateSeriesFocus = updateSeriesFocus;
window.saveSeriesNavigationState = saveSeriesNavigationState;
window.rerenderSeriesPage = SeriesPage;
