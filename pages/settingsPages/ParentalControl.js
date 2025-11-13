function ParentalControl() {
  setTimeout(function() {
    var container = document.querySelector(".parental-control-container");
    if (!container) return;

    var inputs = container.querySelectorAll(".parental-input");
    var saveButton = container.querySelector("#parentalSaveBtn");
    var inputFields = container.querySelectorAll(".parental-field");
    var currentFocus = 0;

    // Load saved values from localStorage
    var savedPassword = localStorage.getItem("parentalPassword");
    if (savedPassword) {
      // You might want to handle this differently for security
      // inputs[0].value = savedPassword;
      // inputs[1].value = savedPassword;
    }

    // Set initial focus styles without focusing the input
    updateFocusStyles();

    function updateFocusStyles() {
      // Remove focus from all fields
      inputFields.forEach(function(field) {
        field.classList.remove("parental-focused");
      });
      
      // Remove focus from save button
      saveButton.classList.remove("parental-save-btn-focused");
      
      // Add focus to current element
      if (currentFocus < inputs.length) {
        inputFields[currentFocus].classList.add("parental-focused");
      } else {
        saveButton.classList.add("parental-save-btn-focused");
      }
    }

    function removeAllFocusStyles() {
      // Completely remove all focus styles
      inputFields.forEach(function(field) {
        field.classList.remove("parental-focused");
      });
      saveButton.classList.remove("parental-save-btn-focused");
    }

    function validatePasswords() {
      var password = inputs[0].value;
      var confirmPassword = inputs[1].value;
      
      if (password !== confirmPassword) {
        Toaster.showToast("error", "Passwords do not match!");
        return false;
      }
      
      if (password.length < 4) {
        Toaster.showToast("error", "Password must be at least 4 characters long!");
        return false;
      }
      
      return true;
    }

    function parentalControlKeydownEvents(e) {
      switch(e.key) {
        case "ArrowDown":
          currentFocus = (currentFocus + 1) % (inputs.length + 1);
          updateFocusStyles();
          e.preventDefault();
          break;

        case "ArrowUp":
          currentFocus = (currentFocus - 1 + inputs.length + 1) % (inputs.length + 1);
          updateFocusStyles();
          e.preventDefault();
          break;

        case "ArrowLeft":
          // Exit subpage back to Settings list
          removeAllFocusStyles();
          if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
          }
          if (saveButton && typeof saveButton.blur === "function") {
            saveButton.blur();
          }
          document.removeEventListener("keydown", parentalControlKeydownEvents);
          document.querySelector(".settings-second-container").innerHTML = "";
          localStorage.setItem("currentPage", "settingsPage");
          localStorage.setItem("settingPage", "settingsPage");
          e.preventDefault();
          break;

        case "ArrowRight":
          // Move to next input in group
          if (currentFocus < inputs.length) {
            currentFocus = (currentFocus + 1) % inputs.length;
            updateFocusStyles();
          }
          e.preventDefault();
          break;

        case "Enter":
          if (currentFocus < inputs.length) {
            // Only focus the input when Enter is pressed
            inputs[currentFocus].focus();
          } else {
            saveButton.click();
          }
          e.preventDefault();
          break;

        case "Backspace":
        case "Escape":
        case "Back":
        case "BrowserBack":
        case "XF86Back":
        case "10009":
          // Remove all focus styles before exiting
          removeAllFocusStyles();
          if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
          }
          if (saveButton && typeof saveButton.blur === "function") {
            saveButton.blur();
          }
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
    inputFields.forEach(function(field, index) {
      field.addEventListener("click", function() {
        currentFocus = index;
        updateFocusStyles();
        // Focus the input on click
        var input = this.querySelector(".parental-input");
        input.focus();
      });
    });

    // Add focus event listeners to update styles when input is actually focused
    inputs.forEach(function(input, index) {
      input.addEventListener("focus", function() {
        currentFocus = index;
        updateFocusStyles();
      });
      
      // Remove focus styles when input loses focus
      input.addEventListener("blur", function() {
        // Only update styles if we're not moving to another element in our navigation
        if (document.activeElement !== saveButton && 
            !Array.from(inputs).includes(document.activeElement)) {
          inputFields[index].classList.remove("parental-focused");
        }
      });
    });

    saveButton.addEventListener("focus", function() {
      currentFocus = inputs.length;
      updateFocusStyles();
    });

    saveButton.addEventListener("blur", function() {
      // Only remove if not moving to an input field
      if (!Array.from(inputs).includes(document.activeElement)) {
        saveButton.classList.remove("parental-save-btn-focused");
      }
    });

    saveButton.addEventListener("click", function() {
      // Validate passwords before saving
      if (validatePasswords()) {
        var password = inputs[0].value;
        
        // Save to localStorage
              const currentPlaylist=getCurrentPlaylist();

      updatePlaylistData(currentPlaylist.playlistName, "parentalPassword", password);

        // Remove focus styles after saving
        removeAllFocusStyles();
        
        // Reset focus to first input (visual only, not actual focus)
        if (inputs.length > 0) {
          currentFocus = 0;
          updateFocusStyles();
        }
        
        Toaster.showToast("success", "Parental control password saved successfully!");
        console.log("Parental control password saved");
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
      </div>
    </div>`;
}