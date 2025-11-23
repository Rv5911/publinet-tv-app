function HomeCarousel() {
let filteredItems = window.allMoviesStreams.filter(item => {
  const name = (item.name || "").toLowerCase();

  return !adultsCategories.some(keyword => name.includes(keyword));
});

    let randomIndex = Math.floor(Math.random() * filteredItems.length);
    let sliderData = filteredItems.slice(randomIndex, randomIndex + 5);



    console.log(sliderData,"SLDIEDDATA")
  setTimeout(function () {
    if (HomeCarousel.cleanup) HomeCarousel.cleanup();

    const slidesContainer = document.querySelector(".carousel-slides");
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
        dots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
        window.carouselActiveIndex = activeIndex;
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
      }, 4000); // 4s
      
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

  return `
    <div class="carousel-container">
      <!--
      <div class="carousel-slides">
      
        <div class="slide"><img loading="lazy" src="${sliderData[0].stream_icon}" alt="Slide 1"/></div>
        <div class="slide"><img loading="lazy" src="${sliderData[1].stream_icon}" alt="Slide 2"/></div>
        <div class="slide"><img loading="lazy"  src="${sliderData[2].stream_icon}"alt="Slide 3"/></div>
        <div class="slide"><img loading="lazy"  src="${sliderData[3].stream_icon}"alt="Slide 4"/></div>
      </div>
      -->

        <div class="carousel-slides">
        <div class="slide" data-index="0">
          <img loading="lazy" src="https://images.unsplash.com/photo-1526779259212-939e64788e3c?ixlib=rb-4.1.0&fm=jpg&q=60&w=1200" alt="Slide 1"/>
          <button class="carousel-watch-now-btn" tabindex="0">Watch Now</button>
        </div>
        <div class="slide" data-index="1">
          <img loading="lazy" src="https://gratisography.com/wp-content/uploads/2024/11/gratisography-augmented-reality-800x525.jpg" alt="Slide 2"/>
          <button class="carousel-watch-now-btn" tabindex="0">Watch Now</button>
        </div>
        <div class="slide" data-index="2">
          <img loading="lazy" src="https://images.unsplash.com/photo-1526779259212-939e64788e3c?ixlib=rb-4.1.0&fm=jpg&q=60&w=1200" alt="Slide 3"/>
          <button class="carousel-watch-now-btn" tabindex="0">Watch Now</button>
        </div>
        <div class="slide" data-index="3">
          <img loading="lazy" src="https://gratisography.com/wp-content/uploads/2024/11/gratisography-augmented-reality-800x525.jpg" alt="Slide 4"/>
          <button class="carousel-watch-now-btn" tabindex="0">Watch Now</button>
        </div>
      </div>
      <div class="carousel-dots">
        <div class="carousel-dot active" data-index="0"></div>
        <div class="carousel-dot" data-index="1"></div>
        <div class="carousel-dot" data-index="2"></div>
        <div class="carousel-dot" data-index="3"></div>
      </div>
    </div>
  `;
}
