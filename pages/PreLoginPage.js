function PreLoginPage() {
  setTimeout(() => {
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
    </div>
    `;
}
