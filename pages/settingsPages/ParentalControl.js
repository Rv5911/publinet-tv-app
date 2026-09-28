function ParentalControl() {
  setTimeout(function () {
    var container = document.querySelector(".parental-control-container");
    if (!container) return;

    var inputs = container.querySelectorAll(".parental-input");
    var saveButton = container.querySelector("#parentalSaveBtn");
    var clearButton = container.querySelector("#parentalClearBtn");
    var inputFields = container.querySelectorAll(".parental-field");
    var buttons = [saveButton, clearButton];
    var currentFocus = 0;
    var totalElements = inputs.length + buttons.length;

    // Load saved values from currentPlaylist
    var currentPlaylist = getCurrentPlaylist();
    var savedPassword =
      currentPlaylist && currentPlaylist.parentalPassword
        ? currentPlaylist.parentalPassword
        : null;
    var passwordLocked = !!(savedPassword && savedPassword.length > 0);
    var editLockToastShown = false;

    function showEditLockedToast() {
      if (editLockToastShown) return;
      editLockToastShown = true;

      if (typeof Toaster !== "undefined" && Toaster.showToast) {
        Toaster.showToast(
          "error",
          "Please clear fields to edit the password."
        );
      }

      setTimeout(function () {
        editLockToastShown = false;
      }, 1500);
    }

    function lockPasswordFields() {
      passwordLocked = true;
      inputs.forEach(function (inp) {
        inp.type = "password";
        inp.readOnly = true;
      });
    }

    function unlockPasswordFields() {
      passwordLocked = false;
      inputs.forEach(function (inp) {
        inp.readOnly = false;
      });
    }

    if (passwordLocked) {
      lockPasswordFields();
      // Autofill both fields
      inputs[0].value = savedPassword;
      inputs[1].value = savedPassword;
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.5";
        saveButton.style.pointerEvents = "none";
      }
    } else {
      inputs.forEach(function (inp) {
        inp.type = "text";
        inp.readOnly = false;
      });
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.style.opacity = "1";
        saveButton.style.pointerEvents = "auto";
      }
    }

    // Set initial focus styles without focusing the input
    updateFocusStyles();

    function updateFocusStyles() {
      // Remove focus from all fields
      inputFields.forEach(function (field) {
        field.classList.remove("parental-focused");
      });

      // (No eye icons present anymore)

      // Remove focus from all buttons
      buttons.forEach(function (btn) {
        btn.classList.remove("parental-save-btn-focused");
      });

      // Add focus to current element
      if (currentFocus < inputs.length) {
        // Focus the input field
        inputFields[currentFocus].classList.add("parental-focused");
      } else {
        var buttonIndex = currentFocus - inputs.length;
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
          buttons[buttonIndex].classList.add("parental-save-btn-focused");
        }
      }
    }

    function removeAllFocusStyles() {
      // Completely remove all focus styles
      inputFields.forEach(function (field) {
        field.classList.remove("parental-focused");
      });
      buttons.forEach(function (btn) {
        btn.classList.remove("parental-save-btn-focused");
      });
      // (No eye icons present anymore)
    }

    function validatePasswords() {
      var password = inputs[0].value;
      var confirmPassword = inputs[1].value;

      if (password !== confirmPassword) {
        Toaster.showToast("error", "Passwords do not match!");
        return false;
      }

      if (password.length < 4) {
        Toaster.showToast(
          "error",
          "Password must be at least 4 characters long!"
        );
        return false;
      }

      return true;
    }

    // No password visibility toggle: eye icons were removed

    function parentalControlKeydownEvents(e) {
      if (localStorage.getItem("currentPage") === "parentalPinDialog") {
        return;
      }

      var activeInput = document.activeElement;
      var isFocusedParentalInput =
        activeInput &&
        activeInput.tagName === "INPUT" &&
        activeInput.classList.contains("parental-input");

      if (isFocusedParentalInput) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          return; // Let the browser move the text cursor normally
        }

        if (isBackKey(e) || e.key === "Delete") {
          return; // Let the browser delete at the current cursor position
        }
      }

      if (isBackKey(e)) {
        // Remove all focus styles before exiting
        removeAllFocusStyles();

        if (
          document.activeElement &&
          typeof document.activeElement.blur === "function"
        ) {
          document.activeElement.blur();
        }
        buttons.forEach(function (btn) {
          if (btn && typeof btn.blur === "function") {
            btn.blur();
          }
        });

        document.removeEventListener("keydown", parentalControlKeydownEvents);
        localStorage.setItem("currentPage", "homePage");
        Router.showPage("homePage");
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          if (
            document.activeElement &&
            document.activeElement.tagName === "INPUT"
          ) {
            document.activeElement.blur();
          }
          currentFocus = (currentFocus + 1) % totalElements;
          if (currentFocus === inputs.length && saveButton && saveButton.disabled) {
            currentFocus = (currentFocus + 1) % totalElements;
          }
          updateFocusStyles();
          e.preventDefault();
          break;

        case "ArrowUp":
          if (
            document.activeElement &&
            document.activeElement.tagName === "INPUT"
          ) {
            document.activeElement.blur();
          }
          currentFocus = (currentFocus - 1 + totalElements) % totalElements;
          if (currentFocus === inputs.length && saveButton && saveButton.disabled) {
            currentFocus = (currentFocus - 1 + totalElements) % totalElements;
          }
          updateFocusStyles();
          e.preventDefault();
          break;

        case "ArrowLeft":
          // If Clear button is focused, move to Save button
          if (currentFocus === inputs.length + 1) {
            if (saveButton && !saveButton.disabled) {
              currentFocus = inputs.length;
              updateFocusStyles();
              e.preventDefault();
              break;
            }
          }

          // Exit subpage back to Settings list
          removeAllFocusStyles();
          if (
            document.activeElement &&
            typeof document.activeElement.blur === "function"
          ) {
            document.activeElement.blur();
          }
          buttons.forEach(function (btn) {
            if (btn && typeof btn.blur === "function") {
              btn.blur();
            }
          });
          document.removeEventListener("keydown", parentalControlKeydownEvents);

          // Dispatch exit event
          document.dispatchEvent(new Event("settings-subpage-exit"));

          localStorage.setItem("currentPage", "settingsPage");
          localStorage.setItem("settingPage", "settingsPage");
          e.preventDefault();
          break;

        case "ArrowRight":
          // When an input is focused, Right arrow should do nothing
          if (currentFocus < inputs.length) {
            e.preventDefault();
            break;
          }

          // Navigate between buttons only
          if (saveButton && saveButton.disabled) {
            // Stay on clear button
            currentFocus = inputs.length + 1;
          } else {
            var buttonIndex = currentFocus - inputs.length;
            buttonIndex = (buttonIndex + 1) % buttons.length;
            currentFocus = inputs.length + buttonIndex;
          }
          updateFocusStyles();
          e.preventDefault();
          break;

        case "Enter":
          if (currentFocus < inputs.length) {
            if (passwordLocked) {
              showEditLockedToast();
            } else {
              // Focus the input when Enter is pressed
              inputs[currentFocus].focus();
            }
          } else {
            // Click the appropriate button
            var buttonIndex = currentFocus - inputs.length;
            if (buttonIndex >= 0 && buttonIndex < buttons.length) {
              buttons[buttonIndex].click();
            }
          }
          e.preventDefault();
          break;

        default:
          break;
      }
    }

    document.addEventListener("keydown", parentalControlKeydownEvents);

    // Add click handlers for custom input fields
    inputFields.forEach(function (field, index) {
      field.addEventListener("click", function (e) {
        currentFocus = index;
        updateFocusStyles();
        if (passwordLocked) {
          e.preventDefault();
          showEditLockedToast();
          return;
        }
        // Focus the input on click
        var input = this.querySelector(".parental-input");
        input.focus();
      });
    });

    // (No eye icons to add click handlers for)

    // Add focus event listeners to update styles when input is actually focused
    inputs.forEach(function (input, index) {
      input.addEventListener("click", function (e) {
        if (passwordLocked) {
          e.preventDefault();
          showEditLockedToast();
        }
      });

      input.addEventListener("keydown", function (e) {
        if (!passwordLocked) return;

        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          showEditLockedToast();
          return;
        }

        var allowedKeys = [
          "Tab",
          "Shift",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Escape",
        ];

        if (allowedKeys.indexOf(e.key) !== -1) {
          return;
        }

        e.preventDefault();
        showEditLockedToast();
      });

      input.addEventListener("paste", function (e) {
        if (!passwordLocked) return;
        e.preventDefault();
        showEditLockedToast();
      });

      input.addEventListener("focus", function () {
        currentFocus = index;
        updateFocusStyles();
        if (passwordLocked) {
          showEditLockedToast();
        }
      });

      // Remove focus styles when input loses focus
      input.addEventListener("blur", function () {
        // Only update styles if we're not moving to another element in our navigation
        if (
          document.activeElement !== saveButton &&
          !Array.from(inputs).includes(document.activeElement)
        ) {
          inputFields[index].classList.remove("parental-focused");
        }
      });
    });

    // Add focus/blur listeners for both buttons
    buttons.forEach(function (btn, index) {
      btn.addEventListener("focus", function () {
        currentFocus = inputs.length + index;
        updateFocusStyles();
      });

      btn.addEventListener("blur", function () {
        // Only remove if not moving to an input field or another button
        if (
          !Array.from(inputs).includes(document.activeElement) &&
          !buttons.includes(document.activeElement)
        ) {
          btn.classList.remove("parental-save-btn-focused");
        }
      });
    });

    saveButton.addEventListener("click", function () {
      // Validate passwords before saving
      if (validatePasswords()) {
        var password = inputs[0].value;

        // Save to currentPlaylist
        const currentPlaylist = getCurrentPlaylist();
        updatePlaylistData(
          currentPlaylist.playlistName,
          "parentalPassword",
          password
        );

        savedPassword = password;
        lockPasswordFields();
        inputs[0].value = password;
        inputs[1].value = password;
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.style.opacity = "0.5";
          saveButton.style.pointerEvents = "none";
        }

        // Remove focus styles after saving
        removeAllFocusStyles();

        // Reset focus to first input (visual only, not actual focus)
        if (inputs.length > 0) {
          currentFocus = 0;
          updateFocusStyles();
        }

        Toaster.showToast(
          "success",
          "Parental control password saved successfully!"
        );
        console.log("Parental control password saved");
      }
    });

    clearButton.addEventListener("click", function () {
      const currentPlaylist = getCurrentPlaylist();
      const hasPassword =
        currentPlaylist &&
        currentPlaylist.parentalPassword &&
        currentPlaylist.parentalPassword.length > 0;

      const clearAction = function () {
        // Clear both input fields
        inputs[0].value = "";
        inputs[1].value = "";
        unlockPasswordFields();
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.style.opacity = "1";
          saveButton.style.pointerEvents = "auto";
        }

        updatePlaylistData(
          currentPlaylist.playlistName,
          "parentalPassword",
          ""
        );
        // Remove focus styles after clearing
        removeAllFocusStyles();

        // Reset focus to first input
        currentFocus = 0;
        updateFocusStyles();

        Toaster.showToast("success", "Password fields cleared!");
        console.log("Password fields cleared");
        // No saved password → show text inputs
        inputs.forEach(function (inp) {
          if (inp) inp.type = "text";
        });
      };

      if (hasPassword) {
        // Require PIN before clearing
        ParentalPinDialog(
          clearAction,
          () => console.log("Clear action canceled by user"),
          currentPlaylist,
          "settingsPage"
        );
      } else {
        // No password set, just clear local fields
        clearAction();
      }
    });

    // Clean up when component is destroyed
    return function cleanup() {
      document.removeEventListener("keydown", parentalControlKeydownEvents);
      removeAllFocusStyles();
    };
  }, 0);

  return `
    <div class="parental-control-container" tabindex="0">
      <div class="parental-input-group">
        <label class="parental-field">
          <div class="parental-input-container">
            <input type="password" class="parental-input" placeholder="Enter password">
          </div>
        </label>
        <label class="parental-field">
          <div class="parental-input-container">
            <input type="password" class="parental-input" placeholder="Confirm password">
          </div>
        </label>
      </div>
      <div class="parental-saveBtn-div">
        <button id="parentalSaveBtn">Save Changes</button>
        <button id="parentalClearBtn">Clear Fields</button>
      </div>
    </div>`;
}
