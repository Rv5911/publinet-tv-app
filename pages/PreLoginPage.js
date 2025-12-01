function PreLoginPage() {
  setTimeout(() => {
    const loadingEl=document.querySelector("#loading-overlay")
    if(loadingEl){
      loadingEl.style.background="transparent"
      loadingEl.style.marginTop="40%"

    }
    const selectedPlaylist = JSON.parse(
      localStorage.getItem("selectedPlaylist")
    );
    if (selectedPlaylist) {
      loginApi(
        "",
        "",
        selectedPlaylist.playlistName,
        true,
        selectedPlaylist.playlistUrl
      ).then((response) => {
        const res = response;
      });
    }
  }, 0);
  return `
    <div class="prelogin-page-container">
    <img src="/assets/main-logo.png" alt="Logo" class="prelogin-logo" />
    </div>
    `;
}
