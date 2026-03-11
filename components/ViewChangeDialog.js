/**
 * ViewChangeDialog.js
 * A dialog to choose between Poster view and Category view.
 */

function ViewChangeDialog(onSelect, onCancel, currentView) {
  const dialogId = "view-change-dialog";
  let existing = document.getElementById(dialogId);
  if (existing) existing.remove();

  const html = `
    <div id="${dialogId}" class="view-change-overlay">
      <div class="view-change-content">
        <h2>Categories View Mode</h2>
        <div class="view-options">
          <div class="view-option ${currentView === 'poster' ? 'active' : ''}" data-view="poster" id="view-opt-poster">
           <img src="./assets/category-poster.webp" alt="poster-icon" loading="lazy" id="category-poster" />
            <span>Categories with Posters</span>
          </div>
          <div class="view-option ${currentView === 'category' ? 'active' : ''}" data-view="category" id="view-opt-category">
           <img src="./assets/category-all.webp" alt="poster-icon" loading="lazy" id="category-all" />

            <span>View All Categories</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  const overlay = document.getElementById(dialogId);
  let focusedOption = currentView === 'category' ? 1 : 0;
  
  const options = [
      document.getElementById("view-opt-poster"),
      document.getElementById("view-opt-category")
  ];

  function updateFocus() {
      options.forEach((opt, idx) => {
          if (idx === focusedOption) opt.classList.add("focused");
          else opt.classList.remove("focused");
      });
  }

  function handleKeyDown(e) {
      e.preventDefault();
      switch (e.key) {
          case "ArrowRight":
              if (focusedOption < 1) focusedOption++;
              break;
          case "ArrowLeft":
              if (focusedOption > 0) focusedOption--;
              break;
          case "Enter":
              const view = options[focusedOption].getAttribute("data-view");
              cleanup();
              onSelect(view);
              break;
          case "ArrowUp":
              options.forEach(opt => opt.classList.remove("focused"));
              cleanup();
              onCancel();
              return;
          case "Escape":
          case "Back":
          case "BrowserBack":
          case "XF86Back":
          case "Backspace":
          case 10009:
              cleanup();
              onCancel();
              break;
      }
      updateFocus();
  }

  function cleanup() {
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      localStorage.setItem("navigationFocus", localStorage.getItem("lastNavFocus") || "moviesPage");
  }

  localStorage.setItem("lastNavFocus", localStorage.getItem("navigationFocus"));
  localStorage.setItem("navigationFocus", "viewChangeDialog");
  
  document.addEventListener("keydown", handleKeyDown);
  updateFocus();
}

window.ViewChangeDialog = ViewChangeDialog;
