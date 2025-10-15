function ListUsersPage() {
  setTimeout(function () {
    if (ListUsersPage.cleanup) ListUsersPage.cleanup();

    function listUsersKeydownEvents(e) {
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
          localStorage.setItem("currentPage", "loginPage");
          ListUsersPage.cleanup();
          Router.showPage("login");
          break;

        default:
          break;
      }
    }

    document.addEventListener("keydown", listUsersKeydownEvents);

    ListUsersPage.cleanup = function () {
      document.removeEventListener("keydown", listUsersKeydownEvents);
    };
  }, 0);

  return `
    <div class="list-users-container">
        <h1>List Users Page</h1>
    </div>
  `;
}
