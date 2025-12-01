async function HomeCarousel() {
    // Use window.allStream or fallback to window.allMoviesStreams
    const allStreams = window.allMoviesStreams ? window.allMoviesStreams : [];

    // Filter out adult content if needed, similar to previous logic
    let filteredItems = allStreams.filter((item) => {
        const name = (item.name || "").toLowerCase();
        // Ensure adultsCategories is defined or default to empty array
        const categories =
            typeof adultsCategories !== "undefined" ? adultsCategories : [];
        return !categories.some((keyword) => name.includes(keyword));
    });

    // Fallback if no items found
    if (filteredItems.length === 0) {
        console.warn("HomeCarousel: No streams found.");
        return `
      <div class="carousel-container">
        <div class="carousel-slides">
          <div class="slide">
            <p>No content available</p>
          </div>
        </div>
      </div>
    `;
    }

    // Get 4 random items
    let randomIndex = 0;
    if (filteredItems.length > 4) {
        randomIndex = Math.floor(Math.random() * (filteredItems.length - 4));
    }
    const selectedItems = filteredItems.slice(randomIndex, randomIndex + 4);
    // const selectedItems = filteredItems.slice(0, 4);
    //

    // Show loading state while fetching
    const loadingHtml = `
    <div class="carousel-container">
      <div class="carousel-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading carousel...</div>
      </div>
    </div>
  `;

    // Fetch movie details for all selected items
    const movieDetailsPromises = selectedItems.map((movie) =>
        getMovieDetail(movie.stream_id)
    );
    const movieDetails = await Promise.all(movieDetailsPromises);

    // Filter out any null responses and ensure we have valid data
    const sliderData = movieDetails
        .filter((detail) => detail !== null && detail.info)
        .map((detail, idx) => {
            // Ensure the data format matches the expected structure
            return {
                info: detail.info,
                movie_data: detail.movie_data || selectedItems[idx],
            };
        });

    // console.log(sliderData, "SLIDER DATA WITH MOVIE DETAILS");
    window.homeCarouselSliderData = sliderData;

    // If no valid details were fetched, return empty carousel
    if (sliderData.length === 0) {
        console.warn("HomeCarousel: No valid movie details found.");
        return `
      <div class="carousel-container">
        <div class="carousel-slides">
          <div class="slide">
            <p>No content available</p>
          </div>
        </div>
      </div>
    `;
    }

    // Helper to format duration
    const formatDuration = (durationSecs) => {
        if (!durationSecs) return "N/A";
        const hours = Math.floor(durationSecs / 3600);
        const minutes = Math.floor((durationSecs % 3600) / 60);
        return `${hours}h ${minutes}min`;
    };

    // Helper to generate slide HTML
    const generateSlide = (item, index) => {
        const backdrop =
            (item.info && item.info.backdrop_path && item.info.backdrop_path[0]) ||
            (item.info && item.info.backdrop) ||
            "assets/demo-img-card.png";
        const name =
            (item.info && item.info.name) ||
            (item.movie_data && item.movie_data.name) ||
            "Unknown Title";
        const rating =
            (item.info &&
                item.info.rating &&
                String(item.info.rating).split(".")[0]) ||
            "N/A";
        const plot = (item.info && item.info.plot) || "No description available.";
        const duration = formatDuration(item.info && item.info.duration_secs);
        const genre = (item.info && item.info.genre) || "";

        return `
        <div class="slide" data-index="${index}">
          <img class="carousel-image" loading="lazy" src="${backdrop}" alt="${name}"/>
          <div class="carousel-content">
              <div class="carousel-logo-area">
                  <!-- Optional: If you have a logo image, put it here. For now using text as title -->
              </div>
              <h1 class="carousel-title">${name}</h1>
              <div class="carousel-meta">
                  <span class="carousel-duration">${duration}</span>
          
                  <span class="carousel-rating-badge">
                    <img src="./assets/rating-star.png" class="carousel-card-star-icon" />
                    ${rating}
                  </span>
              </div>
              <p class="carousel-description">${plot}</p>
              <button class="carousel-watch-now-btn" tabindex="0" data-stream-id="${
                (item.movie_data && item.movie_data.stream_id) || ""
              }">
                  Watch Now
              </button>
          </div>
        </div>
      `;
    };

    // Setup carousel functionality after DOM is ready
    setTimeout(function() {
        if (HomeCarousel.cleanup) HomeCarousel.cleanup();

        const slidesContainer = document.querySelector(".carousel-slides");
        if (!slidesContainer) return;

        const slides = Array.from(slidesContainer.querySelectorAll(".slide"));
        const dots = Array.from(document.querySelectorAll(".carousel-dot"));
        let activeIndex = 0;

        slidesContainer.style.willChange = "transform";

        // Expose active index globally
        window.carouselActiveIndex = 0;

        function updateCarousel() {
            requestAnimationFrame(() => {
                slidesContainer.style.transition = "transform 0.3s ease-in-out";
                slidesContainer.style.transform = `translateX(${-activeIndex * 100}%)`;
                dots.forEach((dot, i) =>
                    dot.classList.toggle("active", i === activeIndex)
                );
                window.carouselActiveIndex = activeIndex;

                // Update active class on slides for CSS animations if needed
                slides.forEach((slide, i) => {
                    if (i === activeIndex) slide.classList.add("active");
                    else slide.classList.remove("active");
                });
            });
        }

        function goNextSlide() {
            activeIndex = (activeIndex + 1) % slides.length;
            updateCarousel();
        }

        function goPrevSlide() {
            activeIndex = (activeIndex - 1 + slides.length) % slides.length;
            updateCarousel();
        }

        let autoSlideInterval;

        function startAutoSlide() {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
            }
            autoSlideInterval = setInterval(() => {
                goNextSlide();
            }, 5000);

            // Store globally for cleanup access
            window.carouselAutoSlideInterval = autoSlideInterval;
        }

        function resetAutoSlide() {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
            }
            startAutoSlide();
        }

        dots.forEach((dot, i) => {
            dot.addEventListener("click", () => {
                activeIndex = i;
                updateCarousel();
                resetAutoSlide();
            });
        });

        // Add focus listeners to Watch Now buttons to pause/resume auto-slide
        const watchNowBtns = Array.from(
            document.querySelectorAll(".carousel-watch-now-btn")
        );
        watchNowBtns.forEach((btn) => {
            btn.addEventListener("focus", () => {
                if (autoSlideInterval) {
                    clearInterval(autoSlideInterval);
                    autoSlideInterval = null;
                }
            });
            btn.addEventListener("blur", () => {
                startAutoSlide();
            });
        });

        updateCarousel();
        startAutoSlide();

        HomeCarousel.cleanup = function() {
            // Use the globally stored interval
            if (window.carouselAutoSlideInterval) {
                clearInterval(window.carouselAutoSlideInterval);
                window.carouselAutoSlideInterval = null;
            }
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
                autoSlideInterval = null;
            }
        };

        // Expose cleanup globally immediately
        window.HomeCarousel = HomeCarousel;
    }, 0);

    return `
    <div class="carousel-container">
      <div class="carousel-slides">
        ${sliderData.map((item, index) => generateSlide(item, index)).join("")}
      </div>
      <div class="carousel-dots">
        ${sliderData
          .map(
            (_, index) =>
              `<div class="carousel-dot ${
                index === 0 ? "active" : ""
              }" data-index="${index}"></div>`
          )
          .join("")}
      </div>
    </div>
  `;
}