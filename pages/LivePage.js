function LivePage() {
  setTimeout(() => {
    const handleKeydown = (e) => {
      if (localStorage.getItem("currentPage") === "liveTvPage") {
        switch (e.key) {
          case "ArrowRight":
            console.log("ArrowRight pressed");
            break;
          case "ArrowLeft":
            console.log("ArrowLeft pressed");
            break;
          case "ArrowUp":
            console.log("ArrowUp pressed");
            break;
          case "ArrowDown":
            console.log("ArrowDown pressed");
            break;
          case "Backspace":
          case "Escape":
            LivePage.cleanup();
            Router.showPage("homePage");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeydown);

    LivePage.cleanup = () => {
      document.removeEventListener("keydown", handleKeydown);
    };

    setTimeout(() => {
      LivePage.cleanup();
    }, 0);
  }, 0);

  return `
        <div class="lp-main-container">

<div class="lp-left-categories-container">
dw
</div>


<div class="lp-right-categories-container">


<div class="lp-video-player-and-epg-div-container">
VIDEO PLAYER
</div>

<div class="lp-channel-list-container">

</div>
</div>
       
        </div>
    `;
}
