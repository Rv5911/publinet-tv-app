function TrailerDialog(onConfirm, onCancel) {
  // Remove existing dialog and listeners if any
  const existingDialog = document.querySelector(".trailer-dialog-container");
  if (existingDialog) {
    existingDialog.remove();
    if (TrailerDialog.cleanup) TrailerDialog.cleanup();
  }

  function handleDialogClick(target) {
    if (target instanceof Event) target = target.target;
    if (!target) return;

    const yesBtn = document.querySelector("#trailerYesBtn");
    const noBtn = document.querySelector("#trailerNoBtn");

    if (target === yesBtn) {
      closeDialog();
      if (onConfirm) onConfirm();
    }

    if (target === noBtn) {
      closeDialog();
      if (onCancel) onCancel();
    }
  }

  function closeDialog() {
    if (TrailerDialog.cleanup) TrailerDialog.cleanup();
    const dialog = document.querySelector(".trailer-dialog-container");
    if (dialog) dialog.remove();
    // Reset focus handled by caller (onCancel or onConfirm)
  }

  setTimeout(() => {
    if (TrailerDialog.cleanup) TrailerDialog.cleanup();

    let focusIndex = 0; // Default to "Yes"
    const buttons = [
      document.querySelector("#trailerYesBtn"),
      document.querySelector("#trailerNoBtn"),
    ].filter(Boolean);

    function setFocus(index) {
      buttons.forEach((btn, i) => {
        btn.classList.toggle("trailer-focused", i === index);
        if (i === index) btn.focus();
      });
    }

    function dialogKeydownHandler(e) {
      // Block all other events
      e.stopImmediatePropagation();
      e.preventDefault();

      switch (e.key) {
        case "ArrowRight":
        case "39":
        case "40": // Treat down as right for simple 2-button layout
          if (focusIndex < buttons.length - 1) focusIndex++;
          setFocus(focusIndex);
          break;

        case "ArrowLeft":
        case "37":
        case "38": // Treat up as left for simple 2-button layout
          if (focusIndex > 0) focusIndex--;
          setFocus(focusIndex);
          break;

        case "Enter":
        case "13":
          handleDialogClick(buttons[focusIndex]);
          break;

        case "Escape":
        case "Back":
        case "BrowserBack":
        case "XF86Back":
        case "SoftLeft":
        case "Backspace":
        case 10009:
          closeDialog();
          if (onCancel) onCancel();
          break;
      }
    }

    const dialogContainer = document.querySelector(".trailer-dialog-container");
    dialogContainer.addEventListener("click", handleDialogClick);
    document.addEventListener("keydown", dialogKeydownHandler, true);

    TrailerDialog.cleanup = function () {
      dialogContainer.removeEventListener("click", handleDialogClick);
      document.removeEventListener("keydown", dialogKeydownHandler, true);
    };

    setFocus(focusIndex);
  }, 0);

  return `
      <div class="trailer-dialog-container">
          <div class="trailer-dialog-panel" role="dialog" aria-labelledby="trailerDialogTitle">
            <h1 class="trailer-dialog-title" id="trailerDialogTitle">Trailer will be open on external browser do you want to open that?</h1>
            <div class="trailer-dialog-actions">
              <button class="trailer-btn yes" id="trailerYesBtn">Yes</button>
              <button class="trailer-btn no" id="trailerNoBtn">No</button>
            </div>
          </div>
      </div>
    `;
}
