function HomePage() {
const selectedPlaylistData= localStorage.getItem("selectedPlaylist") ? JSON.parse(localStorage.getItem("selectedPlaylist")):{}

setTimeout(function () {
    if (HomePage.cleanup) HomePage.cleanup();
    console.log(selectedPlaylistData,"selectedPlaylistData")
 
    function homePageKeydownEvents(e) {
      const key = e.key;
 
      switch (key) {
        case "ArrowDown":
          // handle arrow down
          break;
 
        case "ArrowUp":
          // handle arrow up
          break;
 
        case "ArrowRight":
          // handle arrow right
          break;
 
        case "ArrowLeft":
          // handle arrow left
          break;
 
        case "Enter":
          // handle enter
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
 
    HomePage.cleanup = function () {
      document.removeEventListener("keydown", homePageKeydownEvents);
    };
  }, 0);

  return `
    <div class="home-page-container">
    <div class="poster">
${HomeCarousel()}
    </div>
    <h1>${selectedPlaylistData.playlistName}
    </div>
      </div>
  `;
}
