function HomeCarousel() {
  setTimeout(function () {
    if (HomeCarousel.cleanup) HomeCarousel.cleanup();

    const slidesContainer = document.querySelector(".carousel-slides");
    const slides = Array.from(slidesContainer.querySelectorAll(".slide"));
    const dots = Array.from(document.querySelectorAll(".carousel-dot"));
    let activeIndex = 0;
    let autoSlideFrame;

    slidesContainer.style.willChange = "transform";
    function updateCarousel() {
      requestAnimationFrame(() => {
        slidesContainer.style.transition = "transform 0.3s ease-in-out";
        slidesContainer.style.transform = `translateX(${-activeIndex * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
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

    function startAutoSlide() {
      cancelAnimationFrame(autoSlideFrame);
      function slide() {
        goNextSlide();
        autoSlideFrame = requestAnimationFrame(() => setTimeout(slide, 4000)); // 4s
      }
      slide();
    }

    function resetAutoSlide() {
      cancelAnimationFrame(autoSlideFrame);
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
      cancelAnimationFrame(autoSlideFrame);
    };
  }, 0);

  return `
    <div class="carousel-container">
      <div class="carousel-slides">
        <div class="slide"><img loading="lazy" src="https://images.unsplash.com/photo-1526779259212-939e64788e3c?ixlib=rb-4.1.0&fm=jpg&q=60&w=1200" alt="Slide 1"/></div>
        <div class="slide"><img loading="lazy" src="https://gratisography.com/wp-content/uploads/2024/11/gratisography-augmented-reality-800x525.jpg" alt="Slide 2"/></div>
        <div class="slide"><img loading="lazy" src="https://images.unsplash.com/photo-1526779259212-939e64788e3c?ixlib=rb-4.1.0&fm=jpg&q=60&w=1200" alt="Slide 3"/></div>
        <div class="slide"><img loading="lazy" src="https://gratisography.com/wp-content/uploads/2024/11/gratisography-augmented-reality-800x525.jpg" alt="Slide 4"/></div>
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
