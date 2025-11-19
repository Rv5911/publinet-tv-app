function HomePage() {
const selectedPlaylistData= localStorage.getItem("selectedPlaylist") ? JSON.parse(localStorage.getItem("selectedPlaylist")):{}

setTimeout(function () {
    if (HomePage.cleanup) HomePage.cleanup();
        const loadingEl=document.querySelector("#loading-overlay")
    if(loadingEl){
      loadingEl.style.background="black"
      loadingEl.style.marginTop="0px"

    }
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
