// === MEMORY OPTIMIZATION: Global navigation state ===
let moviesNavigationState = {
    currentCategoryIndex: 0,
    currentCardIndex: 0,
    lastFocusedCategory: 0,
    lastFocusedCard: 0
};

// Track if navigation is initialized
let isNavigationInitialized = false;

function createMovieCard(movieData, size, categoryIndex, movieIndex) {
    let isLarge = size === "large";
    let cardClass = isLarge ? "movie-card movie-card-large" : "movie-card";
    
    return `
    <div class="${cardClass}" 
         data-category="${categoryIndex}" 
         data-index="${movieIndex}"
         style="background: url('${movieData.image}')">
        <div class="movie-card-content">
            <div>
                <img src="./assets/heartIcon.png" alt="img" class="movie-card-heart" />
            </div>
            <div class="movie-card-bottom">
                <div class="movie-card-bottom-left">
                    <h3>${movieData.genre}</h3>
                    <h2>${movieData.title}</h2>
                </div>
                <div class="movie-card-bottom-right">
                    <h3>${movieData.duration}</h3>
                    <h2>${movieData.year}</h2>
                </div>
            </div>
        </div>
    </div>`;
}

// === MOVIE CARD SELECTION HANDLER ===
function selectMovieCard(categoryIndex, cardIndex) {
    // Update navigation state
    moviesNavigationState.currentCategoryIndex = categoryIndex;
    moviesNavigationState.currentCardIndex = cardIndex;
    moviesNavigationState.lastFocusedCategory = categoryIndex;
    moviesNavigationState.lastFocusedCard = cardIndex;
    
    // Save to localStorage for persistence
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
    
    // Update UI focus
    updateFocus();
    
    console.log('Selected movie - Category:', categoryIndex, 'Card:', cardIndex);
}

// === ENHANCED SCROLLING FOR TIZEN OS 5.5 ===
function scrollToElement(element) {
    if (!element) return;
    
    // Method 1: Try multiple scrollIntoView configurations
    const scrollConfigs = [
        { behavior: "smooth", block: "center", inline: "center" },
        { behavior: "smooth", block: "nearest", inline: "nearest" },
        { block: "center", inline: "center" },
        { block: "nearest", inline: "nearest" }
    ];
    
    for (let config of scrollConfigs) {
        try {
            element.scrollIntoView(config);
            console.log('Scroll successful with config:', config);
            return;
        } catch (e) {
            console.log('Scroll failed with config:', config, e);
            continue;
        }
    }
    
    // Method 2: Manual scroll calculation as fallback
    fallbackScrollToElement(element);
}

function fallbackScrollToElement(element) {
    if (!element) return;
    
    // Find the scrollable container
    let container = findScrollableContainer(element);
    if (!container) {
        console.log('No scrollable container found');
        return;
    }
    
    try {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate the position to scroll to
        const scrollLeft = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
        const scrollTop = element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2);
        
        // Apply scroll with animation
        container.scrollTo({
            left: scrollLeft,
            top: scrollTop,
            behavior: 'smooth'
        });
        
        console.log('Manual scroll applied:', { scrollLeft, scrollTop });
    } catch (e) {
        console.log('Manual scroll failed:', e);
        
        // Last resort: Simple scroll
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

// === KEYBOARD NAVIGATION HANDLER ===
function handleKeyNavigation(e) {
    // Only handle arrow keys
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        return;
    }
    
    let currentPage = localStorage.getItem("currentPage");
    let navigationFocus = localStorage.getItem("navigationFocus");
    
    // Only process if we're on movies page and focused
    if (currentPage !== "moviesPage" || navigationFocus !== "moviesPage") {
        return;
    }
    
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
    
    // Update UI and save state
    updateFocus();
    saveNavigationState();
}

function moveRight() {
    let currentCategory = getCurrentCategory();
    if (!currentCategory) return;
    
    if (moviesNavigationState.currentCardIndex < currentCategory.movies.length - 1) {
        moviesNavigationState.currentCardIndex++;
    } else {
        // Stay at the last card, don't loop
        moviesNavigationState.currentCardIndex = currentCategory.movies.length - 1;
    }
}

function moveLeft() {
    if (moviesNavigationState.currentCardIndex > 0) {
        moviesNavigationState.currentCardIndex--;
    } else {
        // Stay at the first card, don't loop
        moviesNavigationState.currentCardIndex = 0;
    }
}

function moveDown() {
    if (moviesNavigationState.currentCategoryIndex < getCategories().length - 1) {
        moviesNavigationState.currentCategoryIndex++;
        // Adjust card index if needed
        let newCategory = getCurrentCategory();
        if (moviesNavigationState.currentCardIndex >= newCategory.movies.length) {
            moviesNavigationState.currentCardIndex = newCategory.movies.length - 1;
        }
    }
}

function moveUp() {
    if (moviesNavigationState.currentCategoryIndex > 0) {
        moviesNavigationState.currentCategoryIndex--;
        // Adjust card index if needed
        let newCategory = getCurrentCategory();
        if (moviesNavigationState.currentCardIndex >= newCategory.movies.length) {
            moviesNavigationState.currentCardIndex = newCategory.movies.length - 1;
        }
    } else {
        // Remove focus from all cards when moving up from first category
        removeAllFocus();
        saveNavigationState();
        localStorage.setItem("navigationFocus", "navbar");
        
        // Focus on navbar
        let moviesNavItem = document.querySelector('.nav-item[data-page="moviesPage"]');
        if (moviesNavItem) {
            moviesNavItem.focus();
            moviesNavItem.classList.add("active");
        }
    }
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
            `.movie-card[data-category="${moviesNavigationState.currentCategoryIndex}"][data-index="${moviesNavigationState.currentCardIndex}"]`
        );
        
        if (currentCard) {
            currentCard.classList.add("focused");
            
            // Use enhanced scrolling for Tizen
            scrollToElement(currentCard);
            
            // Update last focused position
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
            
            // Check if we're coming from movie detail page
            let previousPage = localStorage.getItem("previousPage");
            let currentPage = localStorage.getItem("currentPage");
            
            if (previousPage === "movieDetailPage" && currentPage === "moviesPage") {
                // Reset to initial state when coming back from detail page
                moviesNavigationState.currentCategoryIndex = 0;
                moviesNavigationState.currentCardIndex = 0;
                moviesNavigationState.lastFocusedCategory = 0;
                moviesNavigationState.lastFocusedCard = 0;
                
                // Clear the saved state to avoid restoring again
                localStorage.removeItem('moviesNavState');
                
                console.log("Reset navigation state - coming from movie detail page");
            } else {
                // Normal restore behavior
                moviesNavigationState.currentCategoryIndex = state.currentCategoryIndex || 0;
                moviesNavigationState.currentCardIndex = state.currentCardIndex || 0;
                moviesNavigationState.lastFocusedCategory = state.lastFocusedCategory || 0;
                moviesNavigationState.lastFocusedCard = state.lastFocusedCard || 0;
                
                console.log("Restored navigation state - Category:", moviesNavigationState.currentCategoryIndex, "Card:", moviesNavigationState.currentCardIndex);
            }
        } else {
            // No saved state, initialize to defaults
            moviesNavigationState.currentCategoryIndex = 0;
            moviesNavigationState.currentCardIndex = 0;
            moviesNavigationState.lastFocusedCategory = 0;
            moviesNavigationState.lastFocusedCard = 0;
        }
    } catch (e) {
        console.log('Error restoring navigation state:', e);
        // Initialize to defaults on error
        moviesNavigationState.currentCategoryIndex = 0;
        moviesNavigationState.currentCardIndex = 0;
        moviesNavigationState.lastFocusedCategory = 0;
        moviesNavigationState.lastFocusedCard = 0;
    }
}

// === NAVIGATION INITIALIZATION ===
function initNavigation() {
    // Clean up existing event listener
    if (isNavigationInitialized) {
        document.removeEventListener("keydown", handleKeyNavigation);
    }
    
    // Add new event listener
    document.addEventListener("keydown", handleKeyNavigation);
    isNavigationInitialized = true;
    
    console.log("Movie navigation initialized");
}

function cleanupNavigation() {
    document.removeEventListener("keydown", handleKeyNavigation);
    isNavigationInitialized = false;
    console.log("Movie navigation cleaned up");
}

// === FUNCTION TO RESET NAVIGATION STATE ===
function resetMoviesNavigationState() {
    moviesNavigationState.currentCategoryIndex = 0;
    moviesNavigationState.currentCardIndex = 0;
    moviesNavigationState.lastFocusedCategory = 0;
    moviesNavigationState.lastFocusedCard = 0;
    
    try {
        localStorage.removeItem('moviesNavState');
    } catch (e) {
        console.log('Error resetting navigation state:', e);
    }
    
    console.log("Movies navigation state reset to initial values");
}

// === MAIN MOVIES PAGE FUNCTION ===
function MoviesPage() {
    // Movie data arrays
    let favoriteMovies = [
        { id: 1, title: "The Matrix", genre: "Sci-Fi", duration: "2h 16m", year: "1999", image: "./assets/demo-img-card.png" },
        { id: 2, title: "Inception", genre: "Action", duration: "2h 28m", year: "2010", image: "./assets/demo-img-card.png" },
        { id: 3, title: "Interstellar", genre: "Sci-Fi", duration: "2h 49m", year: "2014", image: "./assets/demo-img-card.png" },
        { id: 9, title: "The Shawshank Redemption", genre: "Drama", duration: "2h 22m", year: "1994", image: "./assets/demo-img-card.png" },
        { id: 10, title: "The Godfather", genre: "Crime", duration: "2h 55m", year: "1972", image: "./assets/demo-img-card.png" }
    ];
    
    let popularMovies = [
        { id: 4, title: "Avengers: Endgame", genre: "Action", duration: "3h 1m", year: "2019", image: "./assets/demo-img-card.png" },
        { id: 5, title: "The Dark Knight", genre: "Action", duration: "2h 32m", year: "2008", image: "./assets/demo-img-card.png" },
        { id: 6, title: "Pulp Fiction", genre: "Crime", duration: "2h 34m", year: "1994", image: "./assets/demo-img-card.png" },
        { id: 11, title: "Forrest Gump", genre: "Drama", duration: "2h 22m", year: "1994", image: "./assets/demo-img-card.png" },
        { id: 12, title: "Fight Club", genre: "Drama", duration: "2h 19m", year: "1999", image: "./assets/demo-img-card.png" }
    ];
    
    let continueWatchingMovies = [
        { id: 7, title: "Breaking Bad", genre: "Drama", duration: "47m", year: "2008", image: "./assets/demo-img-card.png" },
        { id: 8, title: "Stranger Things", genre: "Horror", duration: "51m", year: "2016", image: "./assets/demo-img-card.png" },
        { id: 13, title: "The Crown", genre: "Drama", duration: "58m", year: "2016", image: "./assets/demo-img-card.png" },
        { id: 14, title: "Money Heist", genre: "Action", duration: "45m", year: "2017", image: "./assets/demo-img-card.png" }
    ];

    let categories = [
        { title: "My Fav", movies: favoriteMovies, id: "fav", containerClass: "movies-fav-container" },
        { title: "Most Popular", movies: popularMovies, id: "popular", containerClass: "movies-popular-container" },
        { title: "Recently Watched", movies: continueWatchingMovies, id: "recent", containerClass: "recently-watched-container" }
    ];

    // Store categories globally for navigation functions to access
    window.moviesCategories = categories;

    restoreNavigationState();

    // Update page tracking
    let currentPage = localStorage.getItem("currentPage");
    localStorage.setItem("previousPage", currentPage || "");
    localStorage.setItem("currentPage", "moviesPage");
    localStorage.setItem("navigationFocus", "moviesPage");

    // === CREATE MOVIE CARDS FOR EACH CATEGORY ===
    function createCategoryCards(category, categoryIndex) {
        let cardsHTML = '';
        for (let i = 0; i < category.movies.length; i++) {
            let size = category.id === "popular" ? "large" : "normal";
            cardsHTML += createMovieCard(category.movies[i], size, categoryIndex, i);
        }
        return cardsHTML;
    }

    // === RENDER MOVIES PAGE ===
    let html = `
    <div class="movies-page-container">
        ${categories.map(function(category, categoryIndex) {
            return `
            <div class="${category.containerClass}">
                <h1>${category.title}</h1>
                <div class="movies-card-list ${category.id}-list">
                    ${createCategoryCards(category, categoryIndex)}
                </div>
            </div>
            `;
        }).join("")}
    </div>`;

    // Initialize navigation after render
    setTimeout(function() {
        initNavigation();
        updateFocus(); // Set initial focus
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

console.log("MoviesPage function loaded successfully");