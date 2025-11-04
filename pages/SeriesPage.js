let seriesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

let allSeriesStreamsData = window.allSeriesStreams || [];
let favoriteSeriesIds = [];

let isSeriesNavigationInitialized = false;

let seriesLastKeyPressTime = 0;
let seriesKeyPressDelay = 500; 
let favoritesSeriesArray = [];

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
    longPressThreshold: 500,
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
    let allSeriesCategoriesData = window.seriesCategories || [];
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
    let isSeriesFav = favoriteSeriesIds.some(favId => String(favId) === seriesId);
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
    
    if (currentLoaded >= allCategories.length) return;
    
    seriesChunkLoadingState.isLoading = true;
    
    let nextChunk = Math.min(currentLoaded + seriesChunkLoadingState.categoryChunkSize, allCategories.length);
    
    setTimeout(function() {
        let container = document.querySelector('.series-page-container');
        if (!container) {
            seriesChunkLoadingState.isLoading = false;
            return;
        }
        
        let categoriesLoading = container.querySelector('.series-categories-loading-indicator');
        if (categoriesLoading) {
            categoriesLoading.remove();
        }
        
        for (let i = currentLoaded; i < nextChunk; i++) {
            let category = allCategories[i];
            if (!category) continue;
            
            let categoryHTML = createSeriesCategorySection(category, i);
            container.insertAdjacentHTML('beforeend', categoryHTML);
        }
        
        if (nextChunk < allCategories.length) {
            container.insertAdjacentHTML('beforeend', '<div class="series-categories-loading-indicator"><p>Loading more categories...</p></div>');
        }
        
        seriesChunkLoadingState.loadedCategories = nextChunk;
        seriesChunkLoadingState.isLoading = false;
        
        updateSeriesFocus();
        
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

// === FIXED ENTER KEY HANDLING ===
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
        alert("Short Press ", seriesId)

        //         localStorage.setItem("seriesCategoryIndex", categoryIndex);
        // localStorage.setItem("seriesCardIndex", cardIndex);
        // localStorage.setItem("seriesSelectedCategoryId", categoryIndex);
        
        // localStorage.setItem("selectedSeriesId", seriesId);
        // localStorage.setItem("currentPage", "seriesDetailPage");
        // console.log(seriesId,"seriesId")

        //  const selectedSeriesItem=allSeriesStreams.find(item=>item.series_id==seriesId);
        //  if(selectedSeriesItem){

        //      localStorage.setItem("selectedSeriesData", JSON.stringify(selectedSeriesItem));
        //      console.log("selected seriesId",seriesId)
        //  }
        // document.querySelector("#loading-progress").style.display = "none";
        // Router.showPage("seriesDetailPage");

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
        alert("LONG PRESS " + seriesId);
        // console.log("seriesId",seriesId)
        // toggleFavoriteItem(seriesId, "series", getCurrentPlaylistUsername());
        // Example: showSeriesOptions(seriesId);
    }
}

// === FIXED KEYBOARD NAVIGATION ===
function handleSeriesKeyNavigation(e) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
        return;
    }
    
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    if (currentPage !== "seriesPage" || navigationFocus !== "seriesPage") {
        return;
    }
    
    // Handle Enter key separately
    if (e.key === "Enter") {
        handleSeriesEnterKey(e);
        return;
    }
    
    // Enhanced debouncing with proper timing
    let now = Date.now();
    if (now - seriesLastKeyPressTime < seriesKeyPressDelay) {
        e.preventDefault();
        return;
    }
    seriesLastKeyPressTime = now;
    
    e.preventDefault();
    
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

function moveSeriesRight() {
    // FIXED: Check if current category has series
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

    if(nextCategoryIndex > 4){
       const navbarEl=document.querySelector("#navbar-root");

    if(navbarEl){
        navbarEl.style.display="none";
    }
    }
    // console.log(nextCategoryIndex,"nextCategoryIndex")
    if (nextCategoryIndex !== -1) {
        seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
        
        // FIXED: Maintain same card index position when moving between categories
        let newCategory = getCurrentSeriesCategory();
        if (newCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            // Keep the same card index if it exists in the new category
            if (currentCardIndex < loadedCount) {
                seriesNavigationState.currentCardIndex = currentCardIndex;
            } else {
                // If current index doesn't exist, go to first card
                seriesNavigationState.currentCardIndex = 0;
            }
        } else {
            seriesNavigationState.currentCardIndex = 0;
        }
        
        // Check if we're at the last loaded category and load more if needed
        let loadedCategoriesCount = seriesChunkLoadingState.loadedCategories;
        if (seriesNavigationState.currentCategoryIndex >= loadedCategoriesCount - 2) {
            loadMoreSeriesCategories();
        }
    } else {
        // Already at last category with series
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
    
    // Store current card index before moving
    let currentCardIndex = seriesNavigationState.currentCardIndex;
    
    // FIXED: Find previous category that has series
    let prevCategoryIndex = findNextSeriesCategoryWithSeries(currentIndex - 1, -1); // direction -1 = up
    
    if (prevCategoryIndex !== -1) {
        seriesNavigationState.currentCategoryIndex = prevCategoryIndex;
        
        // FIXED: Maintain same card index position when moving between categories
        let newCategory = getCurrentSeriesCategory();
        if (newCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            // Keep the same card index if it exists in the new category
            if (currentCardIndex < loadedCount) {
                seriesNavigationState.currentCardIndex = currentCardIndex;
            } else {
                // If current index doesn't exist, go to first card
                seriesNavigationState.currentCardIndex = 0;
            }
        } else {
            seriesNavigationState.currentCardIndex = 0;
        }
    } else {
  removeAllSeriesFocus();
  saveSeriesNavigationState();
  localStorage.setItem("navigationFocus", "navbar");

  setTimeout(() => {
        const navbarEl=document.querySelector("#navbar-root");

    if(navbarEl){
        navbarEl.style.display="block";
    }
    const scrollable = document.querySelector('.series-page-container') || document.scrollingElement || document.documentElement;

    if (scrollable) {
      scrollable.scrollTop = 0;
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (typeof window.scrollTo === "function") {
      try {
        window.scrollTo(0, 0);
      } catch (_) {}
    }

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
    let category = categories[categoryIndex];
    if (!category) return;
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    let totalSeries = category.series ? category.series.length : 0;
    
    if (loadedCount >= totalSeries) return;
    
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
    
    setTimeout(function() {
        let newCardsHTML = loadSeriesChunk(category, categoryIndex);
        
        let loadingEl = cardList.querySelector('.series-loading-indicator');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        if (newCardsHTML) {
            cardList.insertAdjacentHTML('beforeend', newCardsHTML);
            updateSeriesFocus();
        }
        
        seriesChunkLoadingState.isLoading = false;
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
            
            // FIXED: Ensure we start with a category that has series
            if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
                let nextCategoryIndex = findNextSeriesCategoryWithSeries(0, 1);
                if (nextCategoryIndex !== -1) {
                    seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
                    seriesNavigationState.currentCardIndex = 0;
                }
            }
        }
    } catch (e) {
        console.log('Error restoring navigation state:', e);
    }
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

// === CHECK IF ANY CATEGORY HAS DATA ===
function hasAnySeriesCategoryData() {
    let categories = window.allseriesCategories || [];
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].series && categories[i].series.length > 0) {
            return true;
        }
    }
    return false;
}

// === MAIN SERIES PAGE FUNCTION ===
function SeriesPage() {
    // Show loading state immediately
    let loadingHTML = '<div class="series-page-loading">' +
                     '<div class="loading-spinner"></div>' +
                     '<p>Loading Series...</p>' +
                     '</div>';
    
    // Update page tracking
    localStorage.setItem("previousPage", localStorage.getItem("currentPage") || "");
    localStorage.setItem("currentPage", "seriesPage");
    localStorage.setItem("navigationFocus", "seriesPage");
    
    setTimeout(function() {
        favoriteSeriesIds = getFavoriteSeries();
        
        let favoriteSeriesData = window.allSeriesStreams.filter(s => {
            let seriesIdStr = s.series_id ? s.series_id.toString() : '';
            return favoriteSeriesIds.includes(seriesIdStr);
        });
        
        console.log(favoriteSeriesData, "FAVORITE SERIES DATA");
        console.log("Favorite IDs:", favoriteSeriesIds);
        console.log("Available series IDs:", allSeriesStreamsData.map(s => s.series_id));
        
        let popularSeries = getPopularSeries();
        let recentlyWatchedSeries = getRecentlyWatchedSeries();
        let apiCategories = getAPISeriesCategories();
        
        // Create initial categories array
        let initialCategories = [
            { 
                title: "My Fav", 
                series: favoriteSeriesData, // Use the filtered data
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
            // FIX: Check if the container exists before setting innerHTML
            let container = document.querySelector('.series-page-container') || document.querySelector('.series-page-loading');
            if (container) {
                container.innerHTML = noDataHTML;
            }
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
        
        if (window.allseriesCategories.length > initialCategories.length) {
            html += '<div class="series-categories-loading-indicator"><p>Loading more categories...</p></div>';
        }
        
        html += '</div>';
        
        // FIX: Replace loading with actual content - check if container exists
        let container = document.querySelector('.series-page-loading');
        if (container) {
            container.outerHTML = html;
        } else {
            // If loading container doesn't exist, try to find or create the main container
            let mainContainer = document.querySelector('.series-page-container');
            if (mainContainer) {
                mainContainer.innerHTML = html;
            } else {
                // Create the container if it doesn't exist
                document.body.insertAdjacentHTML('beforeend', html);
            }
        }
        
        // Initialize navigation
        setTimeout(function() {
            initSeriesNavigation();
            updateSeriesFocus();
        }, 100);
        
    }, 500); 
    
    return loadingHTML;
}
window.seriesNavigationState = seriesNavigationState;
window.updateSeriesFocus = updateSeriesFocus;
window.saveSeriesNavigationState = saveSeriesNavigationState;
window.rerenderSeriesPage = SeriesPage;