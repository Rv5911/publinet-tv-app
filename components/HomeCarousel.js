function HomeCarousel() {
  // Use window.allStream or fallback to window.allMoviesStreams
  const allStreams = window.allStream || window.allMoviesStreams || [];

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
    // Mock data for development if needed or just empty
    console.warn("HomeCarousel: No streams found.");
  }

  // Get 4 items as requested (slice 4)
  // If we want random 4 items:
  let randomIndex = 0;
  if (filteredItems.length > 4) {
    randomIndex = Math.floor(Math.random() * (filteredItems.length - 4));
  }
  let sliderData = filteredItems.slice(randomIndex, randomIndex + 4);

  // If still less than 4, just take what we have
  if (sliderData.length === 0 && filteredItems.length > 0) {
    sliderData = filteredItems.slice(0, 4);
  }

  console.log(sliderData, "SLDIEDDATA");

  setTimeout(function () {
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
      }, 5000); // Increased to 5s for better readability

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

    HomeCarousel.cleanup = function () {
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

  // Helper to generate slide HTML
  const generateSlide = (item, index) => {
    const image = item.stream_icon || item.cover || "assets/demo-img-card.png"; // Fallback image
    const name = item.name || "Unknown Title";
    const rating = item.rating_5based || "N/A";
    // Limit description length?
    const description =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam..."; // Placeholder as real description might be missing or too long, or use item.description if available

    return `
        <div class="slide" data-index="${index}">
          <img class="carousel-image" loading="lazy" src="${image}" alt="${name}"/>
          <div class="carousel-content">
              <div class="carousel-logo-area">
                  <!-- Optional: If you have a logo image, put it here. For now using text as title -->
                  <!-- <img src="logo.png" alt="Logo" class="carousel-logo" /> -->
              </div>
              <h1 class="carousel-title">${name}</h1>
              <div class="carousel-meta">
                  <span class="carousel-duration">2h 35min</span>
             <span class="carousel-rating-badge"> <img src="./assets/rating-star.png" class="carousel-card-star-icon" />${
               rating ? rating : "0"
             }</span>
              </div>
              <p class="carousel-description">${description}</p>
              <button class="carousel-watch-now-btn" tabindex="0">
                  Watch Now
              </button>
          </div>
        </div>
      `;
  };

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
