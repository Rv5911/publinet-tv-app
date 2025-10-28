function MoviesPage() {
  return `
    <div class="movies-page-container">
    
    <div class="movies-fav-container">
    <h1>My Fav</h1>
    <div class="movies-fav-list">
    ${Array.from({ length: 100 })
      .map(
        (
          _,
          i
        ) => `<div class="movies-fav-card" style="background: url('./assets/demo-img-card.png');">
    
    <div class="movies-fav-card-content">
<div>
<img src="./assets/heartIcon.png" alt="img" class="movies-fav-heart" />
</div>
<div class="movies-fav-play-div">
<img src="./assets/card-play-icon.png" alt="img" class="movies-fav-play" />
</div>

    <div class="bottom-card-content">
  <div class="bottom-card-first">
  <h3>Action</h3>
  <h2>Movie Name</h2>

  </div>

  <div class="bottom-card-second">
  
    <h3>2h 30m</h3>
  <h2>2022</h2>
  </div>

    </div>

    </div>
    
    
    </div>`
      )
      .join("")}
    </div>
    </div>

    <div class="movies-popular-container">
    <h1>Popular</h1> 
    <div class="movies-popular-list">
    </div>
    </div>

    <div class="recently-watched-container">
    </div>
    
    </div>
    `;
}
