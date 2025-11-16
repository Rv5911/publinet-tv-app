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

let seriesNavigationDebounce = {
    lastKeyPress: 0,
    debounceTime: 300,
    isDebouncing: false
};

function formatSeriesData(seriesStream) {
    if (!seriesStream) return null;


    console.log(seriesStream,"seriesStreamseriesStream")
    
    return {
        id: seriesStream.series_id || seriesStream.num,
        series_id: seriesStream.series_id,
        title: seriesStream.name || "Unknown",
        genre: seriesStream.category_name || "Series",
        year: formatSeriesYear(seriesStream.added),
        image: seriesStream.cover || seriesStream.stream_icon || "./assets/demo-img-card.png",
        rating: seriesStream.rating_5based ? seriesStream.rating_5based : "0",
        seasons: seriesStream.seasons || "1",
        category_id:seriesStream.category_id? seriesStream.category_id : null
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

function formatSeriesSeasons(series) {
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
            return playlist.series.map(id => id.toString());
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
        console.log(sorted,"SORTED")
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
    
    let isSeriesFav = Array.isArray(favoriteSeriesIds) && 
                     favoriteSeriesIds.some(favId => String(favId) === String(seriesId));
    
    let imageUrl = seriesData.image || "./assets/demo-img-card.png";
    let titleClass = 'series-title-marquee';

        let currentCardCategory = window.allseriesCategories ? 
        window.allseriesCategories.filter((cat) => cat.category_id == seriesData.category_id) : 
        [];
    
    let categoryName = currentCardCategory.length > 0 ? 
        currentCardCategory[0].category_name : 
        seriesData.genre || "Series"; 
    
    return `<div class="${cardClass}" 
            data-category="${categoryIndex}" 
            data-index="${seriesIndex}" 
            data-series-id="${seriesId}" 
            style="background-image: url('${imageUrl ? imageUrl : "./assets/demo-img-card.png"}')">
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
                        <h3>${categoryName}</h3>
                        <h2 class="${titleClass}">${seriesData.title || "Unknown"}</h2>
                    </div>
                    <div class="series-card-bottom-right">
                        <h3>-</h3>
                    <span class="movie-card-rating"> <img src="./assets/rating-star.png" class="movie-card-star-icon" />${seriesData.rating ? seriesData.rating : "0"}</span>
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

function seriesCategoryHasSeries(categoryIndex) {
    let categories = window.allSeriesCategories || [];
    let category = categories[categoryIndex];
    
    if (!category || !category.series || category.series.length === 0) {
        return false;
    }
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    return loadedCount > 0;
}

function findNextSeriesCategoryWithSeries(startIndex, direction) {
    let allCategories = window.allSeriesCategories || [];
    
    if (direction === 1) {
        for (let i = startIndex; i < allCategories.length; i++) {
            if (seriesCategoryHasSeries(i)) {
                return i;
            }
        }
    } else {
        for (let i = startIndex; i >= 0; i--) {
            if (seriesCategoryHasSeries(i)) {
                return i;
            }
        }
    }
    
    return -1;
}

function loadMoreSeriesCategories() {
    if (seriesChunkLoadingState.isLoading) return;
    
    let allCategories = window.allSeriesCategories || [];
    let currentLoaded = seriesChunkLoadingState.loadedCategories;
    
    if (currentLoaded >= allCategories.length) {
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
    }, 5000);
    
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
                
                if (category.series && category.series.length > 0) {
                    try {
                        let categoryHTML = createSeriesCategorySection(category, i);
                        container.insertAdjacentHTML('beforeend', categoryHTML);
                        categoriesAdded++;
                    } catch (e) {
                        console.error('Error creating series category section:', e);
                    }
                }
            }
            
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

function createSeriesNoDataMessage(categoryTitle) {
    return '<div class="no-data-container">' +
           '<div class="no-data-content">' +
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
            seriesEnterKeyState.isPressed = true;
            seriesEnterKeyState.pressStartTime = Date.now();
            
            seriesEnterKeyState.timeoutId = setTimeout(function() {
                if (seriesEnterKeyState.isPressed) {
                    handleSeriesLongPressEnter();
                    seriesEnterKeyState.isPressed = false;
                }
            }, seriesEnterKeyState.longPressThreshold);
        } else if (e.type === "keyup") {
            if (seriesEnterKeyState.isPressed) {
                let pressDuration = Date.now() - seriesEnterKeyState.pressStartTime;
                
                if (pressDuration < seriesEnterKeyState.longPressThreshold) {
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

        const selectedSeriesItem =  window.allSeriesStreams.find(item => item.series_id == seriesId);
        if (selectedSeriesItem) {
            localStorage.setItem("selectedSeriesItem", JSON.stringify(selectedSeriesItem));
        }

        cleanupSeriesNavigation();
        
        document.querySelector("#loading-progress").style.display = "none";
        
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
        const result = toggleFavoriteItem(Number(seriesId), "favouriteSeries", getCurrentPlaylistUsername());
        const heartEl = currentCard.querySelector('.series-card-heart');
        if (heartEl) {
            heartEl.style.display = result.isFav ? 'block' : 'none';
        }
        
        // Also update hearts on all duplicate series cards across categories
        document.querySelectorAll('.series-card[data-series-id="' + seriesId + '"] .series-card-heart').forEach(function(h){
            h.style.display = result.isFav ? 'block' : 'none';
        });
        
        if (typeof Toaster !== 'undefined' && Toaster.showToast) {
            Toaster.showToast(result.isFav ? 'success' : 'error', result.isFav ? 'Added to Favorites' : 'Removed from Favorites');
        }
        
        // Refresh My Fav list in real time
        if (typeof refreshSeriesFavoritesList === 'function') {
            refreshSeriesFavoritesList();
        }
        
        const listEl = currentCard.closest('.series-card-list');
        const isFavCategory = listEl && listEl.classList.contains('fav-list');
        if (isFavCategory && !result.isFav) {
            // Remove from DOM and adjust focus when removing from My Fav
            currentCard.remove();
            const remainingCards = listEl.querySelectorAll('.series-card');
            seriesNavigationState.currentCardIndex = Math.min(seriesNavigationState.currentCardIndex, Math.max(remainingCards.length - 1, 0));
            
            // If last item removed, delete the entire My Fav category section
            if (remainingCards.length === 0) {
                const favContainer = listEl.closest('.series-fav-container');
                if (favContainer) {
                    favContainer.remove();
                }
                // Reset loaded chunk count for this category index
                const categoryIdxAttr = listEl.getAttribute('data-category');
                const favIdx = categoryIdxAttr ? parseInt(categoryIdxAttr, 10) : seriesNavigationState.currentCategoryIndex;
                setSeriesLoadedChunkCount(favIdx, 0);
                
                // If focus was on the fav category, move to the next available category
                if (seriesNavigationState.currentCategoryIndex === favIdx) {
                    const nextIdx = findNextSeriesCategoryWithSeries(favIdx + 1, 1);
                    seriesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
                    seriesNavigationState.currentCardIndex = 0;
                }
            }
        }
        
        updateSeriesFocus();
        saveSeriesNavigationState();
    }
}

function refreshSeriesFavoritesList() {
    const currentPlaylist = getCurrentPlaylist();
    const favIdsRaw = currentPlaylist ? (currentPlaylist.favouriteSeries || []) : [];
    const favIds = Array.isArray(favIdsRaw) ? favIdsRaw.map(id => String(id)) : [];
    favoriteSeriesIds = favIds; // used by createSeriesCard heart display

    const favouriteSeries = (window.allSeriesStreams && favIds.length)
        ? window.allSeriesStreams.filter(s => s && favIds.includes(String(s.series_id)))
        : [];

    // If there are no favorites, remove the entire My Fav category section
    if (!favouriteSeries.length) {
        const favContainer = document.querySelector('.series-fav-container');
        const favListForIdx = document.querySelector('.series-card-list.fav-list');
        if (favListForIdx) {
            const categoryIndexAttr = favListForIdx.getAttribute('data-category');
            const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;
            setSeriesLoadedChunkCount(categoryIndex, 0);
        }
        if (favContainer) {
            favContainer.remove();
        }
        // If focus points to a non-existent list, shift focus
        const currentList = document.querySelector('.series-card-list[data-category="' + seriesNavigationState.currentCategoryIndex + '"]');
        if (!currentList) {
            const nextIdx = findNextSeriesCategoryWithSeries(seriesNavigationState.currentCategoryIndex + 1, 1);
            seriesNavigationState.currentCategoryIndex = nextIdx !== -1 ? nextIdx : 0;
            seriesNavigationState.currentCardIndex = 0;
            updateSeriesFocus();
            saveSeriesNavigationState();
        }
        return;
    }

    // Ensure My Fav container exists; if not, create it at the top
    let favContainer = document.querySelector('.series-fav-container');
    let favList = document.querySelector('.series-card-list.fav-list');

    if (!favContainer || !favList) {
        const pageContainer = document.querySelector('.series-page-container');
        if (pageContainer) {
            const favCategory = {
                title: "My Fav",
                series: favouriteSeries,
                id: "fav",
                containerClass: "series-fav-container"
            };
            const favHTML = createSeriesCategorySection(favCategory, 0);
            pageContainer.insertAdjacentHTML('afterbegin', favHTML);
            favContainer = document.querySelector('.series-fav-container');
            favList = document.querySelector('.series-card-list.fav-list');
        }
    }

    if (!favList) return;

    const categoryIndexAttr = favList.getAttribute('data-category');
    const categoryIndex = categoryIndexAttr ? parseInt(categoryIndexAttr, 10) : 0;

    let html = '';
    for (let i = 0; i < favouriteSeries.length; i++) {
        const seriesData = formatSeriesData(favouriteSeries[i]);
        if (!seriesData) continue;
        html += createSeriesCard(seriesData, 'normal', categoryIndex, i);
    }

    favList.innerHTML = html;
    setSeriesLoadedChunkCount(categoryIndex, favouriteSeries.length);
}

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
    
    const now = Date.now();
    if (now - seriesNavigationDebounce.lastKeyPress < seriesNavigationDebounce.debounceTime) {
        e.preventDefault();
        return;
    }
    
    e.preventDefault();
    
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
    
    // Clear any pending timeouts
    if (seriesEnterKeyState.timeoutId) {
        clearTimeout(seriesEnterKeyState.timeoutId);
        seriesEnterKeyState.timeoutId = null;
    }
    seriesEnterKeyState.isPressed = false;
}

function getSeriesCurrentVisibleIndex(categoryIndex, cardIndex) {
    let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return cardIndex;
    
    let containerWidth = cardList.offsetWidth;
    let firstCard = cardList.querySelector('.series-card');
    if (!firstCard) return cardIndex;
    
    let cardWidth = firstCard.offsetWidth + 16;
    let visibleCardsCount = Math.floor(containerWidth / cardWidth);
    
    if (cardIndex >= visibleCardsCount) {
        return cardIndex % visibleCardsCount;
    }
    
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
    
    if (seriesNavigationState.currentCardIndex < loadedCount - 1) {
        seriesNavigationState.currentCardIndex++;
    } else {
        if (loadedCount < totalSeries) {
            loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
        }
    }
    
    seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
    seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
}

function moveSeriesLeft() {
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        return;
    }
    
    if (seriesNavigationState.currentCardIndex > 0) {
        seriesNavigationState.currentCardIndex--;
    }
    
    seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
    seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
}

function moveSeriesDown() {
    let allCategories = window.allSeriesCategories || [];
    if (allCategories.length === 0) return;
    
    let currentIndex = seriesNavigationState.currentCategoryIndex;
    let currentCardIndex = seriesNavigationState.currentCardIndex;
    
    let nextCategoryIndex = findNextSeriesCategoryWithSeries(currentIndex + 1, 1);

    if(nextCategoryIndex > 2){
        const navbarEl = document.querySelector("#navbar-root");
        if(navbarEl){
            navbarEl.style.display = "none";
        }
    }
    
    if (nextCategoryIndex !== -1) {
        seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
        
        let newCategory = getCurrentSeriesCategory();
        if (newCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            let visiblePosition = getSeriesCurrentVisibleIndex(currentIndex, currentCardIndex);
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
            
            let visiblePosition = getSeriesCurrentVisibleIndex(currentIndex, currentCardIndex);
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

            const navbarEl = document.querySelector("#navbar-root");
            if(navbarEl){
                navbarEl.style.display = "block";
            }
            
        } catch (e) {
            console.log('Series scroll to top failed:', e);
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
    
    let categories = window.allSeriesCategories || [];
    if (categoryIndex < 0 || categoryIndex >= categories.length) return;
    
    let category = categories[categoryIndex];
    if (!category) return;
    
    let loadedCount = getSeriesLoadedChunkCount(categoryIndex);
    let totalSeries = category.series ? category.series.length : 0;
    
    if (loadedCount >= totalSeries) {
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
    }, 3000);
    
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
        if (seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
            let currentCard = document.querySelector(
                '.series-card[data-category="' + seriesNavigationState.currentCategoryIndex + '"][data-index="' + seriesNavigationState.currentCardIndex + '"]'
            );
            
            if (currentCard) {
                currentCard.classList.add("focused");
                scrollToSeriesElement(currentCard);
                
                seriesNavigationState.lastFocusedCategory = seriesNavigationState.currentCategoryIndex;
                seriesNavigationState.lastFocusedCard = seriesNavigationState.currentCardIndex;
                
                activateSeriesMarquee(currentCard);
            }
        }
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

function scrollToSeriesElement(element) {
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
                console.log('Series scroll failed');
            }
        }
    }
}

function saveSeriesNavigationState() {
    try {
        localStorage.setItem('seriesNavState', JSON.stringify({
            currentCategoryIndex: seriesNavigationState.currentCategoryIndex,
            currentCardIndex: seriesNavigationState.currentCardIndex,
            lastFocusedCategory: seriesNavigationState.lastFocusedCategory,
            lastFocusedCard: seriesNavigationState.lastFocusedCard
        }));
    } catch (e) {
        console.log('Error saving series navigation state:', e);
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
            
            setTimeout(() => {
                validateAndAdjustRestoredSeriesState();
            }, 100);
        }
    } catch (e) {
        console.log('Error restoring series navigation state:', e);
    }
}

function doesSeriesCardExist(categoryIndex, cardIndex) {
    let cardList = document.querySelector('.series-card-list[data-category="' + categoryIndex + '"]');
    if (!cardList) return false;
    
    let card = cardList.querySelector('.series-card[data-index="' + cardIndex + '"]');
    return card !== null;
}

function validateAndAdjustRestoredSeriesState() {
    if (!seriesCategoryHasSeries(seriesNavigationState.currentCategoryIndex)) {
        let nextCategoryIndex = findNextSeriesCategoryWithSeries(0, 1);
        if (nextCategoryIndex !== -1) {
            seriesNavigationState.currentCategoryIndex = nextCategoryIndex;
            seriesNavigationState.currentCardIndex = 0;
        } else {
            seriesNavigationState.currentCategoryIndex = 0;
            seriesNavigationState.currentCardIndex = 0;
        }
    } else {
        let currentCategory = getCurrentSeriesCategory();
        if (currentCategory) {
            let loadedCount = getSeriesLoadedChunkCount(seriesNavigationState.currentCategoryIndex);
            
            if (seriesNavigationState.currentCardIndex >= loadedCount) {
                seriesNavigationState.currentCardIndex = Math.max(0, loadedCount - 1);
            }
            
            if (!doesSeriesCardExist(seriesNavigationState.currentCategoryIndex, seriesNavigationState.currentCardIndex) && 
                loadedCount < currentCategory.series.length) {
                loadMoreSeriesForCategory(seriesNavigationState.currentCategoryIndex);
            }
        }
    }
    
    setTimeout(() => {
        updateSeriesFocus();
    }, 50);
}

function getCurrentSeriesCategory() {
    let categories = window.allSeriesCategories || [];
    return categories[seriesNavigationState.currentCategoryIndex];
}

function initSeriesNavigation() {
    if (isSeriesNavigationInitialized) {
        cleanupSeriesNavigation();
    }
    
    document.addEventListener("keydown", handleSeriesKeyNavigation);
    document.addEventListener("keyup", handleSeriesKeyNavigation);
    isSeriesNavigationInitialized = true;
}

function hasAnySeriesCategoryData() {
    let categories = window.allSeriesCategories || [];
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].series && categories[i].series.length > 0) {
            return true;
        }
    }
    return false;
}

function SeriesPage() {

    let loadingHTML = 
    window.allSeriesStreams.length==0||window.allseriesCategories.length==0?
`
<div class="series-page-no-data">
<p>No Series Data Available</p>
</div>


`
    :
'<div class="series-page-loading">' + 
                     '<div class="loading-spinner"></div>' +
                     '<p>Loading Series...</p>' +
                     '</div>';
    
    localStorage.setItem("previousPage", localStorage.getItem("currentPage") || "");
    localStorage.setItem("currentPage", "seriesPage");
    localStorage.setItem("navigationFocus", "seriesPage");
    
    favoriteSeriesIds = [];
    
    setTimeout(function() {
        const currentPlaylist = getCurrentPlaylist();   
        const currentPlaylistFavIds = currentPlaylist ? currentPlaylist.favouriteSeries : [];   
        
        favoriteSeriesIds = currentPlaylistFavIds || [];

        
        let favouriteSeries = window.allSeriesStreams && currentPlaylistFavIds ? 
            window.allSeriesStreams.filter(s => currentPlaylistFavIds.includes(s.series_id)) : [];
        let popularSeries = window.allSeriesStreams ? 
            window.allSeriesStreams.filter(s => s.rating_5based > 4).slice(0, 10) : [];

            let recentlyWatchedSeriesIds = currentPlaylist && currentPlaylist.continueWatchingSeries ? 
    currentPlaylist.continueWatchingSeries.filter(m => m !== null && m !== undefined).map((item)=>item.itemId) : [];   

    let recentSeriesArray=window.allSeriesStreams && recentlyWatchedSeriesIds ? window.allSeriesStreams.filter(m => recentlyWatchedSeriesIds.includes(m.series_id.toString())) : [];
    console.log(recentSeriesArray,"recentSeriesArrayrecentSeriesArray")
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
                series: recentSeriesArray, 
                id: "recent", 
                containerClass: "recently-watched-container"
            }
        ];
        
        let apiCategoriesToLoad = apiCategories.slice(0, 3);
        initialCategories = initialCategories.concat(apiCategoriesToLoad);
        
        window.allSeriesCategories = initialCategories.concat(apiCategories.slice(3));
        
        seriesChunkLoadingState.loadedCategories = initialCategories.length;
        seriesChunkLoadingState.loadedChunks = {};
        seriesChunkLoadingState.isLoading = false;
        
        if (!hasAnySeriesCategoryData()) {
            let noDataHTML = '<div class="series-page-container">' +
                           createSeriesNoDataMessage("series") +
                           '</div>';
            document.querySelector('.series-page-container').innerHTML = noDataHTML;
            return;
        }
        
        let html = '<div class="series-page-container">';
        
        for (let i = 0; i < initialCategories.length; i++) {
            let category = initialCategories[i];
            if (category.series && category.series.length > 0) {
                html += createSeriesCategorySection(category, i);
            }
        }
        
        let hasMoreCategories = false;
        for (let i = initialCategories.length; i < window.allSeriesCategories.length; i++) {
            let category = window.allSeriesCategories[i];
            if (category && category.series && category.series.length > 0) {
                hasMoreCategories = true;
                break;
            }
        }
        
        if (hasMoreCategories) {
            html += '<div class="categories-loading-indicator"><p>Loading more categories...</p></div>';
        }
        
        html += '</div>';
        
        let container = document.querySelector('.series-page-loading');
        if (container) {
            container.outerHTML = html;
        }
        
        restoreSeriesNavigationState();
        
        setTimeout(function() {
            initSeriesNavigation();
        }, 100);
        
    }, 500); 
    
    return loadingHTML;
}

// Export cleanup function for global access
window.cleanupSeriesNavigation = cleanupSeriesNavigation;
window.seriesNavigationState = seriesNavigationState;
window.updateSeriesFocus = updateSeriesFocus;
window.saveSeriesNavigationState = saveSeriesNavigationState;
window.rerenderSeriesPage = SeriesPage;