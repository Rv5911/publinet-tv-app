function ListUsersPage() {
  setTimeout(function () {
    if (ListUsersPage.cleanup) ListUsersPage.cleanup();

    const container = document.querySelector(".playlist-cards-container");
    const cards = document.querySelectorAll(".playlist-card");
    const addUserBtn = document.querySelector(".list-users-navbar button");

    let onAddUser = false;
    let currentRow = 0;
    let currentCol = 0;
    let rows = [];

    function computeRows() {
      rows = [];
      let currentOffsetTop = null;
      let row = [];

      cards.forEach((card) => {
        if (currentOffsetTop === null || card.offsetTop === currentOffsetTop) {
          row.push(card);
          currentOffsetTop = card.offsetTop;
        } else {
          rows.push(row);
          row = [card];
          currentOffsetTop = card.offsetTop;
        }
      });

      if (row.length > 0) rows.push(row);
    }

    computeRows();
    window.addEventListener("resize", computeRows);

function setFocus() {
  cards.forEach((card) => {
    const img = card.querySelector("img");
    card.classList.remove("playlist-card-focused");
    img.src = "/assets/playlist-icon.png";
    img.style.backgroundColor = ""; // reset background
  });

  if (!onAddUser && rows[currentRow] && rows[currentRow][currentCol]) {
    const card = rows[currentRow][currentCol];
    card.classList.add("playlist-card-focused");
    const img = card.querySelector("img");
    img.src = "/assets/playlist-icon-active.png";
    img.style.backgroundColor = "var(--gold)";

    if (currentRow === 0) {
      container.scrollTop = 0;
    } else {
      card.scrollIntoView({
        block: "end",
        inline: "nearest",
      });
    }
  }

if (onAddUser) {
  addUserBtn.classList.add("playlist-card-focused");

  addUserBtn.scrollIntoView({
    behavior: "auto", 
    block: "center",  
    inline: "nearest"
  });
} else {
  addUserBtn.classList.remove("playlist-card-focused");
}


}




    if (cards.length > 0) setFocus();

    function listUsersKeydownEvents(e) {
      const key = e.key;

      switch (key) {
        case "ArrowRight":
          if (onAddUser) break;
          if (currentCol < rows[currentRow].length - 1) {
            currentCol++;
            setFocus();
          }
          break;

        case "ArrowLeft":
          if (onAddUser) break;
          if (currentCol > 0) {
            currentCol--;
            setFocus();
          }
          break;

        case "ArrowDown":
          if (onAddUser) {
            onAddUser = false;
            currentRow = 0;
            currentCol = 0;
            setFocus();
            break;
          }
          if (currentRow < rows.length - 1) {
            currentRow++;
            currentCol = Math.min(currentCol, rows[currentRow].length - 1);
            setFocus();
          }
          break;

        case "ArrowUp":
          if (onAddUser) break;
          if (currentRow > 0) {
            currentRow--;
            currentCol = Math.min(currentCol, rows[currentRow].length - 1);
            setFocus();
          } else {
            onAddUser = true;
            setFocus();
          }
          break;

        case "Enter":
          if (onAddUser) {
                localStorage.setItem("currentPage", "loginPage");
              ListUsersPage.cleanup();
              Router.showPage("login");
          } else {
            const usernameElement = rows[currentRow][currentCol].querySelector(
              ".playlist-card-username"
            );
            const username = usernameElement ? usernameElement.textContent : "Unknown";
            alert("Card Enter: " + username);
          }
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
      }
    }

    document.addEventListener("keydown", listUsersKeydownEvents);

    ListUsersPage.cleanup = function () {
      document.removeEventListener("keydown", listUsersKeydownEvents);
      window.removeEventListener("resize", computeRows);
    };
  }, 0);

  const usersList = Array.from({ length: 20 }, (_, i) => ({
    title: `User Title ${i + 1}`,
    username: `Username ${i + 1}`,
  }));

  const cardsHTML = usersList
    .map(
      (user) => `
      <div class="playlist-card">
        <img src="/assets/playlist-icon.png" alt="Logo" class="logo" />
        <div class="playlist-card-content">
          <p class="playlist-card-title">${user.title}</p>
          <p class="playlist-card-username">${user.username}</p>
        </div>
      </div>
    `
    )
    .join("");

  return `
    <div class="list-users-container">
      <div class="list-users-navbar">
        <img src="/assets/main-logo.png" alt="Logo" class="logo" />
        <p>List Users</p>
        <button>Add User</button>
      </div>

      <div class="playlist-cards-container">
        ${cardsHTML}
      </div>
    </div>
  `;
}
