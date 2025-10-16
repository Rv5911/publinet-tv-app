function SettingsPage() {
  setTimeout(function () {
    if (SettingsPage.cleanup) SettingsPage.cleanup();

    function settingsKeydownEvents(e) {
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
          SettingsPage.cleanup();

          localStorage.setItem("currentPage", "homePage");
          Router.showPage("homePage");
          break;

        default:
          break;
      }
    }

    document.addEventListener("keydown", settingsKeydownEvents);

    SettingsPage.cleanup = function () {
      document.removeEventListener("keydown", settingsKeydownEvents);
    };
  }, 0);

  return `
    <div class="settings-users-container">
        <h1>Settings Users Page</h1>
    </div>
  `;
}
