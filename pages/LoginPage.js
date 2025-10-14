function LoginPage() {
  setTimeout(function () {
    if (LoginPage.cleanup) LoginPage.cleanup();

    // Get all focusable elements in proper order
    var inputs = [
      document.querySelector(".playlistname-input"),
      document.querySelector(".username-input"),
      document.querySelector(".password-input"),
      document.querySelector(".login-button"),
      document.querySelector(".list-button"),
    ].filter(Boolean); // filter nulls just in case

    var passwordInput = document.querySelector(".password-input");
    var currentIndex = 0;
    var lastFocusedInput = null;

    // Wrap password input for eye icon
    var passwordWrapper = document.createElement("div");
    passwordWrapper.className = "password-wrapper";
    passwordInput.parentNode.insertBefore(passwordWrapper, passwordInput);
    passwordWrapper.appendChild(passwordInput);

    // Add eye icon
    var eyeIcon = document.createElement("img");
    eyeIcon.src = "../assets/eye-open.png";
    eyeIcon.className = "eye-icon-login";
    passwordWrapper.appendChild(eyeIcon);

    var passwordVisible = false;
    function togglePassword() {
      passwordVisible = !passwordVisible;
      passwordInput.type = passwordVisible ? "text" : "password";
      eyeIcon.src = passwordVisible
        ? "../assets/eye-open.png"
        : "../assets/eye-closed.png";
    }

    // Highlight first input only visually
    if (inputs.length > 0) {
      inputs[currentIndex].classList.add("login-input-focused");
    }

    // Clear all highlight classes
    function clearFocusStyles() {
      document
        .querySelectorAll(
          ".login-input-focused, .login-button-focused, .list-button-focused, .eye-icon-focused"
        )
        .forEach(function (el) {
          el.classList.remove(
            "login-input-focused",
            "login-button-focused",
            "list-button-focused",
            "eye-icon-focused"
          );
        });
    }

    // Apply focus highlight
    function updateFocus(newIndex) {
      if (newIndex < 0 || newIndex >= inputs.length) return;

      if (lastFocusedInput) {
        lastFocusedInput.blur();
        lastFocusedInput = null;
      }

      clearFocusStyles();
      currentIndex = newIndex;
      var focused = inputs[currentIndex];

      if (focused.classList.contains("login-input")) {
        focused.classList.add("login-input-focused");
      } else if (focused.classList.contains("login-button")) {
        focused.classList.add("login-button-focused");
      } else if (focused.classList.contains("list-button")) {
        focused.classList.add("list-button-focused");
      }
    }

    // Handle login button
    function handleLogin() {
      var playlistName = document.querySelector(".playlistname-input").value.trim();
      var username = document.querySelector(".username-input").value.trim();
      var password = document.querySelector(".password-input").value.trim();

      console.log("📥 Login Info:", { playlistName, username, password });
      alert("Login info saved to console!");
    }

    // Keyboard navigation
    function loginPageKeydownEvents(e) {
      var key = e.key;
      var focused = inputs[currentIndex];
      var eyeFocused = eyeIcon.classList.contains("eye-icon-focused");

      switch (key) {
        case "ArrowDown":
          if (eyeFocused) {
            eyeIcon.classList.remove("eye-icon-focused");
            passwordInput.classList.add("login-input-focused");
          }
          updateFocus(currentIndex + 1);
          break;

        case "ArrowUp":
          if (eyeFocused) {
            eyeIcon.classList.remove("eye-icon-focused");
            passwordInput.classList.add("login-input-focused");
          }
          updateFocus(currentIndex - 1);
          break;

        case "ArrowRight":
          if (inputs[currentIndex] === passwordInput) {
            clearFocusStyles();
            if (lastFocusedInput) lastFocusedInput.blur();
            eyeIcon.classList.add("eye-icon-focused");
          }
          break;

        case "ArrowLeft":
          if (eyeFocused) {
            clearFocusStyles();
            passwordInput.classList.add("login-input-focused");
          }
          break;

        case "Enter":
          if (eyeFocused) {
            togglePassword();
            break;
          }

          if (lastFocusedInput && lastFocusedInput !== focused) {
            lastFocusedInput.blur();
          }

          if (focused.classList.contains("login-input")) {
            focused.focus();
            lastFocusedInput = focused;
          } else if (focused.classList.contains("login-button")) {
            handleLogin();
          } else if (focused.classList.contains("list-button")) {
            console.log("📋 List User button clicked");
          }
          break;
      }
    }

    document.addEventListener("keydown", loginPageKeydownEvents);
    document.querySelector(".login-button").addEventListener("click", handleLogin);

    LoginPage.cleanup = function () {
      document.removeEventListener("keydown", loginPageKeydownEvents);
    };
  }, 0);

  // HTML UI
  return `
    <div class="login-page-container">
      <div class="login-form-div">
        <img class="login-logo" src="../assets/main-logo.png" alt="">
        <h2 class="login-heading">Login Details</h2>

        <div class="login-inputs-div">
          <div><input class="playlistname-input login-input" type="text" placeholder="Enter Any Name"></div>
          <div><input class="username-input login-input" type="text" placeholder="Enter User Name"></div>
          <div><input class="password-input login-input" type="password" placeholder="Enter Password"></div>

          <div class="login-buttons-div">
            <button class="login-button">Login</button>
          </div>

          <div class="list-user-button-div">
            <button class="list-button">
              <img src="../assets/list-users.png" alt=""> List User
            </button>
          </div>
        </div>
      </div>

      <div class="login-image-div">
        <img class="login-right-image" src="../assets/login-right-image.png" alt="">
      </div>
    </div>
  `;
}
