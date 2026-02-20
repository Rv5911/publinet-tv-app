function ExitModal() {
  // Remove existing modal and listeners if any
  const existingModal = document.querySelector(".exit-main-container");
  if (existingModal) {
    existingModal.remove();
    if (ExitModal.cleanup) ExitModal.cleanup();
  }

  function handleExitClick(target) {
    if (localStorage.getItem("currentPage") !== "exitModal") return;
    if (target instanceof Event) target = target.target;
    if (!target) return;

    const saveBtnExit = document.querySelector("#saveBtnExit");
    const backBtnExit = document.querySelector("#backBtnExit");

    if (target === saveBtnExit) {
      if (ExitModal.cleanup) ExitModal.cleanup();

      try {
        const app = tizen.application.getCurrentApplication();
        if (app) app.exit();
      } catch (err) {
        Toaster.showToast("error", "Failed to exit app");
      }

      closeModal();
    }

    if (target === backBtnExit) {
      closeModal();
    }
  }

  function closeModal() {
    if (ExitModal.cleanup) ExitModal.cleanup();

    const modal = document.querySelector(".exit-main-container");
    if (modal) modal.remove();

    const returnPage = localStorage.getItem("returnPage") || "homePage";
    const returnFocus = localStorage.getItem("returnFocus");

    // Clear return state
    localStorage.removeItem("returnPage");
    localStorage.removeItem("returnFocus");

    localStorage.setItem("currentPage", returnPage);
    // Router.showPage(returnPage); // Removed to prevent reload/re-render. Background is already visible.
    document.body.style.backgroundImage = "none"; // Ensure background is correct
    document.body.style.backgroundColor = "black";

    // Force Scroll to Top
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    setTimeout(() => {
      // Special Handling for Movies and Series - Focus FIRST CARD
      if (returnPage === "moviesPage" && window.resetMoviesFocus) {
        window.resetMoviesFocus();
        return;
      }
      if (returnPage === "seriesPage" && window.resetSeriesFocus) {
        window.resetSeriesFocus();
        return;
      }

      // Default Behavior: Focus Navbar
      const navItems = document.querySelectorAll(".nav-item");
      let targetItem = null;

      // Find the navbar item that corresponds to the returnPage
      navItems.forEach((item) => {
        if (item.getAttribute("data-page") === returnPage) {
          targetItem = item;
        }
      });

      if (targetItem) {
        targetItem.focus();
        // Trigger any active state logic if needed
        navItems.forEach((item) => item.classList.remove("active"));
        targetItem.classList.add("active");
      } else {
        if (navItems.length > 0) navItems[0].focus();
      }
    }, 100);
  }

  setTimeout(() => {
    // Cleanup previous listeners
    if (ExitModal.cleanup) ExitModal.cleanup();

    let focusIndex = 0;
    const buttons = [
      document.querySelector("#saveBtnExit"),
      document.querySelector("#backBtnExit"),
    ].filter(Boolean);

    function setFocus(index) {
      buttons.forEach((btn, i) => {
        btn.classList.toggle("exit-focused", i === index);
        if (i === index) btn.focus();
      });
    }

    function exitKeydownHandler(e) {
      if (localStorage.getItem("currentPage") !== "exitModal") return;

      // STRICT BLOCKING: Stop all other listeners from receiving this event
      e.stopImmediatePropagation();

      // Prevent default for everything unless we explicitly handle it below
      e.preventDefault();

      switch (e.key) {
        case "ArrowRight":
        case "39":
        case "40":
          if (focusIndex < buttons.length - 1) focusIndex++;
          setFocus(focusIndex);
          break;

        case "ArrowLeft":
        case "37":
        case "38":
          if (focusIndex > 0) focusIndex--;
          setFocus(focusIndex);
          break;

        case "Enter":
        case "13":
          handleExitClick(buttons[focusIndex]);
          break;

        case "Escape":
        case "Back":
        case "BrowserBack":
        case "XF86Back":
        case "SoftLeft":
        case "Backspace":
        case 10009:
        case 461:
          closeModal();
          break;
      }
    }

    const modalContainer = document.querySelector(".exit-main-container");
    modalContainer.addEventListener("click", handleExitClick);

    // Use Capture Phase (true) to intercept events before other listeners
    document.addEventListener("keydown", exitKeydownHandler, true);

    ExitModal.cleanup = function () {
      modalContainer.removeEventListener("click", handleExitClick);
      document.removeEventListener("keydown", exitKeydownHandler, true);
    };

    setFocus(focusIndex);
  }, 0);

  return `
    <div class="exit-main-container">
   
      <div class="clear-wrap">
        <div class="clear-panel" role="dialog" aria-labelledby="dialogTitle">
          <h1 class="clear-title" id="dialogTitle">Do you want to Exit the App?</h1>
          <div class="clear-actions">
            <button class="btn save" id="saveBtnExit">Yes</button>
            <button class="btn back" id="backBtnExit">No</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
