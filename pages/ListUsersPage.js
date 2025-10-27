function ListUsersPage() {
  const listPlaylistsData = localStorage.getItem("playlistsData")
    ? JSON.parse(localStorage.getItem("playlistsData"))
    : [];


  setTimeout(() => {
    if (ListUsersPage.cleanup) ListUsersPage.cleanup();

    const container = document.querySelector(".playlist-cards-container");
    const addUserBtn = document.querySelector(".list-users-navbar button");

    let onAddUser = false;
    let currentRow = 0;
    let currentCol = 0;
    let rows = [];
    let enterPressTimer = null;
    let dialogOpen = false;

    function updateCards() {
      return document.querySelectorAll(".playlist-card");
    }

    function computeRows() {
      const cards = updateCards();
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
      const cards = updateCards();
      cards.forEach((card) => {
        const img = card.querySelector("img");
        card.classList.remove("playlist-card-focused");
        img.src = "/assets/playlist-icon.png";
        img.style.backgroundColor = "";
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
          card.scrollIntoView({ block: "end", inline: "nearest" });
        }
      }

      if (onAddUser) {
        addUserBtn.classList.add("playlist-card-focused");
        addUserBtn.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest",
        });
      } else {
        addUserBtn.classList.remove("playlist-card-focused");
      }
    }

    if (updateCards().length > 0) setFocus();

    function listUsersKeydownEvents(e) {
      if (dialogOpen) return;
      if (localStorage.getItem("currentPage") !== "listPage") return;

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

    function handleEnterKeyDown(e) {
      if (dialogOpen) return;
      if (localStorage.getItem("currentPage") !== "listPage") return;
      if (e.key !== "Enter") return;
      if (enterPressTimer) return;

      enterPressTimer = setTimeout(() => {
        if (!onAddUser) {
          computeRows();
          const card = rows[currentRow] && rows[currentRow][currentCol];
          if (card) showRemoveDialog(currentRow, currentCol);
        }
        enterPressTimer = null;
      }, 500);
    }

    function handleEnterKeyUp(e) {
      if (dialogOpen) return;
      if (localStorage.getItem("currentPage") !== "listPage") return;
      if (e.key !== "Enter") return;

      if (enterPressTimer) {
        clearTimeout(enterPressTimer);
        enterPressTimer = null;

        if (onAddUser) {
          localStorage.setItem("currentPage", "login");
          ListUsersPage.cleanup();
          Router.showPage("login");
        } else {
          const card = rows[currentRow] && rows[currentRow][currentCol];
          if (card) {
            const titleElement = card.querySelector(".playlist-card-title");
            const playlistName = titleElement
              ? titleElement.textContent
              : "Unknown";

            const playlistsData =
              JSON.parse(localStorage.getItem("playlistsData")) || [];
            const targetIndex = playlistsData.findIndex(
              (pl) => pl.playlistName === playlistName
            );

            if (targetIndex === -1) {
              console.error("Playlist not found:", playlistName);
              return;
            }

            loginApi(
              "",
              "",
              playlistsData[targetIndex].playlistName,
              true,
              playlistsData[targetIndex].playlistUrl
            ).then((response) => {
              if (response) {
                localStorage.setItem(
                  "selectedPlaylist",
                  JSON.stringify(playlistsData[targetIndex])
                );
                ListUsersPage.cleanup();
              }
            });
          }
        }
      }
    }

    document.addEventListener("keydown", handleEnterKeyDown);
    document.addEventListener("keyup", handleEnterKeyUp);

    // --- Remove dialog ---
    function showRemoveDialog(row, col) {
      dialogOpen = true;
      computeRows();
      const card = rows[row] && rows[row][col];
      if (!card) return;

      const titleElement = card.querySelector(".playlist-card-title");
      const title = titleElement ? titleElement.textContent : "Unknown";

      const dialog = document.createElement("div");
      dialog.className = "remove-dialog";
      dialog.innerHTML = `
        <div class="remove-dialog-content" tabindex="0">
          <h2>Remove Profile</h2>
          <p>Do you want to delete <strong>${title}</strong>?</p>
          <div class="remove-dialog-buttons">
            <button class="delete-btn">Delete</button>
            <button class="cancel-btn">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);

      const deleteBtn = dialog.querySelector(".delete-btn");
      const cancelBtn = dialog.querySelector(".cancel-btn");

      let dialogActiveBtn = "delete";
      function updateDialogFocus() {
        deleteBtn.style.border = "3px solid transparent";
        cancelBtn.style.border = "3px solid transparent";

        if (dialogActiveBtn === "delete") {
          deleteBtn.style.border = "3px solid var(--gold)";
        } else {
          cancelBtn.style.border = "3px solid var(--gold)";
        }
      }
      updateDialogFocus();

      function dialogKeydown(e) {
        if (!dialogOpen) return;

        switch (e.key) {
          case "ArrowRight":
          case "Tab":
            e.preventDefault();
            dialogActiveBtn =
              dialogActiveBtn === "delete" ? "cancel" : "delete";
            updateDialogFocus();
            break;
          case "ArrowLeft":
            e.preventDefault();
            dialogActiveBtn =
              dialogActiveBtn === "cancel" ? "delete" : "cancel";
            updateDialogFocus();
            break;
          case "Enter":
            e.preventDefault();
            if (dialogActiveBtn === "delete") deleteBtn.click();
            else cancelBtn.click();
            break;
          case "Escape":
            e.preventDefault();
            closeDialog();
            break;
        }
      }

      function closeDialog() {
        dialogOpen = false;
        document.body.removeChild(dialog);
        document.removeEventListener("keydown", dialogKeydown);
        setFocus(); // Restore focus to cards page
      }

      document.addEventListener("keydown", dialogKeydown);

      deleteBtn.addEventListener("click", () => {
        removePlaylist(row, col);
        closeDialog();
      });

      cancelBtn.addEventListener("click", closeDialog);
    }

 function removePlaylist(row, col) {
  computeRows();

  // Calculate which card index to remove (flattened index)
  const indexToRemove =
    rows.slice(0, row).reduce((acc, r) => acc + r.length, 0) + col;

  // Get current data from localStorage
  const data = JSON.parse(localStorage.getItem("playlistsData")) || [];

  // Remove selected item
  data.splice(indexToRemove, 1);

  // Save updated list
  localStorage.setItem("playlistsData", JSON.stringify(data));

  // ✅ Check updated list and route accordingly
  if (data.length === 0) {
    localStorage.setItem("currentPage", "loginPage");
    ListUsersPage.cleanup();
    Router.showPage("login");
  } else {
    ListUsersPage.cleanup();
    Router.showPage("listUsersPage"); 
  }
}


    ListUsersPage.cleanup = function () {
      document.removeEventListener("keydown", listUsersKeydownEvents);
      document.removeEventListener("keydown", handleEnterKeyDown);
      document.removeEventListener("keyup", handleEnterKeyUp);
      window.removeEventListener("resize", computeRows);
    };
  }, 0);

  const cardsHTML = listPlaylistsData
    .map(
      (user) => `
      <div class="playlist-card">
        <img src="/assets/playlist-icon.png" alt="Logo" class="list-top-logo" />
        <div class="playlist-card-content">
          <p class="playlist-card-title">${user ? user.playlistName : "N/A"}</p>
          <p class="playlist-card-username">${
            user ? user.playlistUsername : "N/A"
          }</p>
        </div>
      </div>
    `
    )
    .join("");

  return `
    <div class="list-users-container">
 
      <div class="list-users-navbar">
        <img src="/assets/main-logo.png" alt="Logo" class="list-logo" />
        <p>List Users</p>
        <button>Add User</button>
      </div>
      <div class="playlist-cards-container">
        ${cardsHTML}
      </div>
         <div class="playlist-instructions">
         <p >Hold To Remove Playlist</p>
         </div>
    </div>
  `;
}
