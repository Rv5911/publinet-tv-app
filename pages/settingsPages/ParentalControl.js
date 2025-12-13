function ParentalControl() {
  setTimeout(function () {
    var container = document.querySelector(".parental-control-container");
    if (!container) return;

    var inputs = container.querySelectorAll(".parental-input");
    var saveButton = container.querySelector("#parentalSaveBtn");
    var clearButton = container.querySelector("#parentalClearBtn");
    var inputFields = container.querySelectorAll(".parental-field");
    var eyeIcons = container.querySelectorAll(".parental-eye-icon");
    var buttons = [saveButton, clearButton];
    var currentFocus = 0;
    var totalElements = inputs.length + buttons.length;
    var isOnEyeIcon = false; // Track if focus is on eye icon

    // Load saved values from currentPlaylist
    var currentPlaylist = getCurrentPlaylist();
    var savedPassword =
      currentPlaylist && currentPlaylist.parentalPassword
        ? currentPlaylist.parentalPassword
        : null;

    if (savedPassword) {
      // Autofill both password fields with saved value
      inputs[0].value = savedPassword;
      inputs[1].value = savedPassword;
    }

    // Set initial focus styles without focusing the input
    updateFocusStyles();

    function updateFocusStyles() {
      // Remove focus from all fields
      inputFields.forEach(function (field) {
        field.classList.remove("parental-focused");
      });

      // Remove focus from all eye icons
      eyeIcons.forEach(function (icon) {
        icon.classList.remove("parental-eye-focused");
      });

      // Remove focus from all buttons
      buttons.forEach(function (btn) {
        btn.classList.remove("parental-save-btn-focused");
      });

      // Add focus to current element
      if (currentFocus < inputs.length) {
        if (isOnEyeIcon) {
          // Focus the eye icon
          eyeIcons[currentFocus].classList.add("parental-eye-focused");
        } else {
          // Focus the input field
          inputFields[currentFocus].classList.add("parental-focused");
        }
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
      eyeIcons.forEach(function (icon) {
        icon.classList.remove("parental-eye-focused");
      });
      buttons.forEach(function (btn) {
        btn.classList.remove("parental-save-btn-focused");
      });
      isOnEyeIcon = false;
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

    function togglePasswordVisibility(index) {
      var input = inputs[index];
      var eyeIcon = eyeIcons[index];
      var currentValue = input.value; // Store the current value

      if (input.type === "password") {
        input.type = "text";
        eyeIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      } else {
        input.type = "password";
        eyeIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        `;
      }

      input.value = currentValue; // Restore the value after type change
    }

    function parentalControlKeydownEvents(e) {
      switch (e.key) {
        case "ArrowDown":
          if (
            document.activeElement &&
            document.activeElement.tagName === "INPUT"
          ) {
            document.activeElement.blur();
          }
          isOnEyeIcon = false;
          currentFocus = (currentFocus + 1) % totalElements;
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
          isOnEyeIcon = false;
          currentFocus = (currentFocus - 1 + totalElements) % totalElements;
          updateFocusStyles();
          e.preventDefault();
          break;

        case "ArrowLeft":
          // If on eye icon, move back to input
          if (currentFocus < inputs.length && isOnEyeIcon) {
            isOnEyeIcon = false;
            updateFocusStyles();
            e.preventDefault();
            break;
          }

          // If Clear button is focused, move to Save button
          if (currentFocus === inputs.length + 1) {
            currentFocus = inputs.length;
            updateFocusStyles();
            e.preventDefault();
            break;
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
          if (
            document.activeElement &&
            document.activeElement.tagName === "INPUT"
          ) {
            document.activeElement.blur();
          }
          // Handle navigation between input and eye icon
          if (currentFocus < inputs.length) {
            if (isOnEyeIcon) {
              // Move from eye icon to next input
              isOnEyeIcon = false;
              currentFocus = (currentFocus + 1) % inputs.length;
            } else {
              // Move from input to its eye icon
              isOnEyeIcon = true;
            }
            updateFocusStyles();
          } else {
            // Navigate between buttons
            var buttonIndex = currentFocus - inputs.length;
            buttonIndex = (buttonIndex + 1) % buttons.length;
            currentFocus = inputs.length + buttonIndex;
            updateFocusStyles();
          }
          e.preventDefault();
          break;

        case "Enter":
          if (currentFocus < inputs.length) {
            if (isOnEyeIcon) {
              // Toggle password visibility
              togglePasswordVisibility(currentFocus);
            } else {
              // Only focus the input when Enter is pressed
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

        case "Escape":
        case "Back":
        case "XF86Back":
        case "10009":
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
          break;

        default:
          break;
      }
    }

    document.addEventListener("keydown", parentalControlKeydownEvents);

    // Add click handlers for custom input fields
    inputFields.forEach(function (field, index) {
      field.addEventListener("click", function () {
        currentFocus = index;
        updateFocusStyles();
        // Focus the input on click
        var input = this.querySelector(".parental-input");
        input.focus();
      });
    });

    // Add click handlers for eye icons
    eyeIcons.forEach(function (icon, index) {
      icon.addEventListener("click", function () {
        togglePasswordVisibility(index);
      });
    });

    // Add focus event listeners to update styles when input is actually focused
    inputs.forEach(function (input, index) {
      input.addEventListener("focus", function () {
        currentFocus = index;
        updateFocusStyles();
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
      // Clear both input fields
      inputs[0].value = "";
      inputs[1].value = "";

      const currentPlaylist = getCurrentPlaylist();
      updatePlaylistData(currentPlaylist.playlistName, "parentalPassword", "");
      // Remove focus styles after clearing
      removeAllFocusStyles();

      // Reset focus to first input
      currentFocus = 0;
      updateFocusStyles();

      Toaster.showToast("success", "Password fields cleared!");
      console.log("Password fields cleared");
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
            <span class="parental-eye-icon" tabindex="-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </span>
          </div>
        </label>
        <label class="parental-field">
          <div class="parental-input-container">
            <input type="password" class="parental-input" placeholder="Confirm password">
            <span class="parental-eye-icon" tabindex="-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </span>
          </div>
        </label>
      </div>
      <div class="parental-saveBtn-div">
        <button id="parentalSaveBtn">Save Changes</button>
        <button id="parentalClearBtn">Clear Fields</button>
      </div>
    </div>`;
}
