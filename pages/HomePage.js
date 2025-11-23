function HomePage() {
  const selectedPlaylistData = localStorage.getItem("selectedPlaylist") ? JSON.parse(localStorage.getItem("selectedPlaylist")) : {};

  setTimeout(function () {
    if (HomePage.cleanup) HomePage.cleanup();
    const loadingEl = document.querySelector("#loading-overlay");
    if (loadingEl) {
      loadingEl.style.background = "black";
      loadingEl.style.marginTop = "0px";
    }
    console.log(selectedPlaylistData, "selectedPlaylistData");

    // Navigation state
    let navState = {
      focus: 'carousel', // 'carousel', 'watchNow', 'categories'
      currentCategory: 0,
      currentCard: 0,
      carouselStopped: false
    };

    // Scroll to element function (from MoviesPage)
    function scrollToHomeElement(element) {
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
            console.log('Home scroll failed');
          }
        }
      }
    }

    function updateFocus() {
      // Remove all previous focus states
      document.querySelectorAll('.carousel-watch-now-btn.focused').forEach(btn => {
        btn.classList.remove('focused');
      });
      document.querySelectorAll('.home-card.focused').forEach(card => {
        card.classList.remove('focused');
      });

      if (navState.focus === 'watchNow') {
        // Use the globally tracked carousel index
        const activeIndex = window.carouselActiveIndex || 0;
        const activeSlide = document.querySelector(`.slide[data-index="${activeIndex}"]`);

        if (activeSlide) {
          const btn = activeSlide.querySelector('.carousel-watch-now-btn');
          if (btn) {
            btn.classList.add('focused');
            btn.focus(); // Set browser focus
          }
        }
      } else if (navState.focus === 'categories') {
        const currentCard = document.querySelector(
          `.home-card[data-category="${navState.currentCategory}"][data-index="${navState.currentCard}"]`
        );
        console.log('updateFocus - looking for card:', `category=${navState.currentCategory}, index=${navState.currentCard}`, 'found:', !!currentCard);
        if (currentCard) {
          currentCard.classList.add('focused');
          currentCard.focus(); // Set browser focus
          scrollToHomeElement(currentCard);
        } else {
          console.warn('Card not found in DOM!', `category=${navState.currentCategory}, index=${navState.currentCard}`);
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

          if (navState.focus === 'carousel' || navState.focus === 'watchNow') {
            // If we're at carousel level, move to Watch Now
            if (navState.focus === 'carousel') {
              stopCarousel();
              navState.focus = 'watchNow';
              updateFocus();
            }
            // If already at Watch Now, move to categories
            else if (navState.focus === 'watchNow') {
              // From Watch Now to first available category
              const firstCard = document.querySelector('.home-card');
              
              if (firstCard) {
                const category = parseInt(firstCard.getAttribute('data-category'));
                const index = parseInt(firstCard.getAttribute('data-index'));
                
                console.log('ArrowDown from Watch Now - Found first card:', `category=${category}, index=${index}`);
                
                navState.focus = 'categories';
                navState.currentCategory = category;
                navState.currentCard = index;
                updateFocus();
              } else {
                console.log('ArrowDown from Watch Now - No cards found in any category');
              }
            }
          } else if (navState.focus === 'categories') {
            // Move to next category (only from My Fav to Recently Added)
            console.log('ArrowDown in categories - currentCategory:', navState.currentCategory);
            if (navState.currentCategory === 0) {
              const recentList = document.querySelector(`.home-card-list[data-category="1"]`);
              const hasRecentCards = recentList && recentList.querySelectorAll('.home-card').length > 0;

              if (hasRecentCards) {
                navState.currentCategory = 1;
                navState.currentCard = 0;
                console.log('Moving from My Fav to Recently Added');
                updateFocus();
              }
            } else {
              console.log('Already at Recently Added (category 1), cannot go further down');
            }
          }
          break;

        case "ArrowUp":
          e.preventDefault();

          if (navState.focus === 'watchNow') {
            // From Watch Now back to navbar
            navState.focus = 'carousel';
            navState.carouselStopped = false;
            updateFocus();

            // Scroll to top
            try {
              const homeContainer = document.querySelector('.home-page-container');
              if (homeContainer) {
                homeContainer.scrollTop = 0;
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
              console.log('Scroll to top failed:', e);
            }

            // Focus navbar
            localStorage.setItem("navigationFocus", "navbar");

            setTimeout(() => {
              const homeNavItem = document.querySelector('.nav-item[data-page="homePage"]');
              if (homeNavItem) {
                homeNavItem.focus();
                homeNavItem.classList.add("active");
              }
            }, 50);
          } else if (navState.focus === 'categories') {
            if (navState.currentCategory === 1) {
              // From Recently Added to My Fav
              const favList = document.querySelector(`.home-card-list[data-category="0"]`);
              const hasFavCards = favList && favList.querySelectorAll('.home-card').length > 0;

              if (hasFavCards) {
                navState.currentCategory = 0;
                navState.currentCard = 0;
                updateFocus();
              } else {
                // My Fav empty, go to Watch Now
                navState.focus = 'watchNow';
                updateFocus();
              }
            } else {
              // From My Fav to Watch Now
              navState.focus = 'watchNow';
              updateFocus();
            }
          }
          break;

        case "ArrowRight":
          e.preventDefault();

          if (navState.focus === 'categories') {
            const categoryList = document.querySelector(`.home-card-list[data-category="${navState.currentCategory}"]`);
            const cards = categoryList ? categoryList.querySelectorAll('.home-card') : [];

            if (navState.currentCard < cards.length - 1) {
              navState.currentCard++;
              updateFocus();
            }
          }
          break;

        case "ArrowLeft":
          e.preventDefault();

          if (navState.focus === 'categories') {
            if (navState.currentCard > 0) {
              navState.currentCard--;
              updateFocus();
            }
          }
          break;

        case "Enter":
          e.preventDefault();

          if (navState.focus === 'watchNow') {
            // Alert the current slide index
            const activeIndex = window.carouselActiveIndex || 0;
            alert(`Watch Now - Card Index: ${activeIndex}`);
          } else if (navState.focus === 'categories') {
            const currentCard = document.querySelector(
              `.home-card[data-category="${navState.currentCategory}"][data-index="${navState.currentCard}"]`
            );
            if (currentCard) {
              const streamId = currentCard.getAttribute('data-stream-id');
              alert(`Category ${navState.currentCategory}, Card Index: ${navState.currentCard}, Stream ID: ${streamId}`);
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
        const backKeys = [10009, "Escape", "Back", "BrowserBack", "XF86Back"];
        if (
          (e.key === "XF86Exit" || e.key === "XF86Home" || e.keyCode === 10071 || backKeys.includes(e.keyCode) || backKeys.includes(e.key)) &&
          typeof tizen !== "undefined"
        ) {
          e.preventDefault();
          localStorage.setItem("currentPage", "exitPage");
          Router.showPage("exitModal");
        }
      }
    });

    HomePage.cleanup = function () {
      document.removeEventListener("keydown", homePageKeydownEvents);
    };
  }, 0);

  // Get favorite and recently added movies
  const currentPlaylist = localStorage.getItem("selectedPlaylist") ? JSON.parse(localStorage.getItem("selectedPlaylist")) : {};
  const favoriteIds = currentPlaylist.favouriteMovies || [];
  const allStreams = window.allMoviesStreams || [];

  // Get favorite movies (first 10)
  const favoriteMovies = allStreams.filter(stream =>
    favoriteIds.includes(stream.stream_id)
  ).slice(0, 10);

  // Get recently added movies (first 10, sorted by added date)
  const recentlyAddedMovies = allStreams
    .sort((a, b) => (b.added || 0) - (a.added || 0))
    .slice(0, 10);

  // Helper function to create card HTML
  function createHomeCard(movie, categoryIndex, cardIndex) {
    const isFav = favoriteIds.includes(movie.stream_id);
    const categoryName = movie.category_name || "Movie";
    const rating = movie.rating_5based || "0";

    return `
      <div class="home-card" 
           data-category="${categoryIndex}" 
           data-index="${cardIndex}" 
           data-stream-id="${movie.stream_id}"
           tabindex="0"
           style="background-image: url('${movie.stream_icon || './assets/demo-img-card.png'}')">
        <div class="home-card-content">
          <div class="home-card-top">
            <img src="./assets/heartIcon.png" 
                 style="display: ${isFav ? 'block' : 'none'}" 
                 alt="Favorite" 
                 class="home-card-heart" />
          </div>
          <div class="home-card-play-div">
            <img src="./assets/card-play-icon.png" alt="Play" class="home-card-play" />
          </div>
          <div class="home-card-bottom">
            <div class="home-card-bottom-left">
              <h3>${categoryName}</h3>
              <h2 class="home-title-marquee">${movie.name || "Unknown"}</h2>
            </div>
            <div class="home-card-bottom-right">
              <h3>2h 0m</h3>
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

  return `
    <div class="home-page-container">
      <div class="home-poster">
        ${HomeCarousel()}
      </div>
      
      ${favoriteMovies.length > 0 ? `
      <div class="home-fav-container">
        <h1>My Fav</h1>
        <div class="home-card-list" data-category="0">
          ${favoriteMovies.map((movie, index) => createHomeCard(movie, 0, index)).join('')}
        </div>
      </div>
      ` : `
      <div class="home-fav-container">
        <h1>My Fav</h1>
        <div class="home-card-list" data-category="0">
          <p class="home-no-cards-message">No cards to show</p>
        </div>
      </div>
      `}

      ${recentlyAddedMovies.length > 0 ? `
      <div class="home-recent-container">
        <h1>Recently Added</h1>
        <div class="home-card-list" data-category="1">
          ${recentlyAddedMovies.map((movie, index) => createHomeCard(movie, 1, index)).join('')}
        </div>
      </div>
      ` : `
      <div class="home-recent-container">
        <h1>Recently Added</h1>
        <div class="home-card-list" data-category="1">
          <p class="home-no-cards-message">No cards to show</p>
        </div>
      </div>
      `}
    </div>
  `;
}
