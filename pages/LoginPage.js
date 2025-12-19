function LoginPage() {
  let playlistsData = JSON.parse(localStorage.getItem("playlistsData"))
    ? JSON.parse(localStorage.getItem("playlistsData"))
    : [];

  // Delay setup until after page is in DOM
  setTimeout(function () {
    localStorage.removeItem("navigationFocus");
    if (localStorage.getItem("currentPage") !== "login") return;
    if (LoginPage.cleanup) LoginPage.cleanup();

    const playlistInput = document.querySelector(".playlistname-input");
    const usernameInput = document.querySelector(".username-input");
    const passwordInput = document.querySelector(".password-input");
    const loginButton = document.querySelector(".login-button");
    const listButton = document.querySelector(".list-button");

    passwordInput.addEventListener("focus", () => {
      document.querySelector(".login-form-div").classList.add("shift-up");
    });

    passwordInput.addEventListener("blur", () => {
      document.querySelector(".login-form-div").classList.remove("shift-up");
    });

    usernameInput.addEventListener("focus", () => {
      document.querySelector(".login-form-div").classList.add("shift-up");
    });

    usernameInput.addEventListener("blur", () => {
      document.querySelector(".login-form-div").classList.remove("shift-up");
    });

    // Exit early if passwordInput not found
    if (!passwordInput) return;

    const inputs = [
      playlistInput,
      usernameInput,
      passwordInput,
      loginButton,
      listButton,
    ].filter(Boolean);

    let currentIndex = 0;
    let lastFocusedInput = null;

    // Wrap password input safely
    const passwordWrapper = document.createElement("div");
    passwordWrapper.className = "password-wrapper";
    passwordInput.parentNode.insertBefore(passwordWrapper, passwordInput);
    passwordWrapper.appendChild(passwordInput);

    const eyeIcon = document.createElement("img");
    eyeIcon.src = "../assets/eye-closed.png";
    eyeIcon.className = "eye-icon-login";
    eyeIcon.alt = "Toggle password visibility";

    // Add error handling for image loading
    eyeIcon.onerror = function () {
      console.error("Eye icon image failed to load");
      eyeIcon.alt = passwordVisible ? "Hide" : "Show";
    };

    passwordWrapper.appendChild(eyeIcon);

    let passwordVisible = false;

    function togglePassword() {
      passwordVisible = !passwordVisible;
      passwordInput.type = passwordVisible ? "text" : "password";
      eyeIcon.src = passwordVisible
        ? "../assets/eye-open.png" // When password IS visible, show OPEN eye
        : "../assets/eye-closed.png"; // When password is NOT visible, show CLOSED eye

      // Update alt text for accessibility
      eyeIcon.alt = passwordVisible ? "Hide password" : "Show password";
    }

    // Add click event listener for eye icon
    eyeIcon.addEventListener("click", togglePassword);

    if (inputs.length > 0) {
      inputs[currentIndex].classList.add("login-input-focused");
    }

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

    function updateFocus(newIndex) {
      if (newIndex < 0 || newIndex >= inputs.length) return;

      if (lastFocusedInput) {
        lastFocusedInput.blur();
        lastFocusedInput = null;
      }

      clearFocusStyles();
      currentIndex = newIndex;
      const focused = inputs[currentIndex];

      if (focused.classList.contains("login-input")) {
        focused.classList.add("login-input-focused");
      } else if (focused.classList.contains("login-button")) {
        focused.classList.add("login-button-focused");
      } else if (focused.classList.contains("list-button")) {
        focused.classList.add("list-button-focused");
      }
    }

    function handleLogin() {
      const playlistName = playlistInput.value.trim();
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      if (playlistName === "" || username === "" || password === "") {
        Toaster.showToast("error", "Please complete all fields!");
        return;
      }

      logAllDnsEntries();
      loginApi(username, password, playlistName).then((response) => {
        if (response) {
          LoginPage.cleanup();
        }
      });
    }

    function loginPageKeydownEvents(e) {
      if (localStorage.getItem("currentPage") !== "login") {
        return;
      }
      const key = e.key;
      const focused = inputs[currentIndex];
      const eyeFocused = eyeIcon.classList.contains("eye-icon-focused");

      // Check if an input is actually focused (user is typing)
      const isInputFocused =
        document.activeElement &&
        (document.activeElement === playlistInput ||
          document.activeElement === usernameInput ||
          document.activeElement === passwordInput);

      // If user is typing in an input field, don't prevent default for most keys
      if (
        isInputFocused &&
        key !== "ArrowDown" &&
        key !== "ArrowUp" &&
        key !== "ArrowLeft" &&
        key !== "ArrowRight" &&
        key !== "Enter"
      ) {
        return; // Allow normal typing
      }

      switch (key) {
        case "ArrowDown":
          if (eyeFocused) {
            eyeIcon.classList.remove("eye-icon-focused");
            passwordInput.classList.add("login-input-focused");
          }
          updateFocus(currentIndex + 1);
          e.preventDefault();
          break;

        case "ArrowUp":
          if (eyeFocused) {
            eyeIcon.classList.remove("eye-icon-focused");
            passwordInput.classList.add("login-input-focused");
          }
          updateFocus(currentIndex - 1);
          e.preventDefault();
          break;

        case "ArrowRight":
          if (inputs[currentIndex] === passwordInput) {
            clearFocusStyles();
            if (lastFocusedInput) lastFocusedInput.blur();
            eyeIcon.classList.add("eye-icon-focused");
          }
          e.preventDefault();
          break;

        case "ArrowLeft":
          if (eyeFocused) {
            clearFocusStyles();
            passwordInput.classList.add("login-input-focused");
          }
          e.preventDefault();
          break;

        case "Enter":
          if (eyeFocused) {
            togglePassword();
            e.preventDefault();
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
            const playlistsData = localStorage.getItem("playlistsData")
              ? JSON.parse(localStorage.getItem("playlistsData"))
              : [];
            if (playlistsData.length === 0) {
              Toaster.showToast(
                "error",
                "No playlists available. Please add a playlist!"
              );
              e.preventDefault();
              return;
            } else {
              localStorage.setItem("currentPage", "listUsersPage");
              LoginPage.cleanup();
              Router.showPage("listPage");
            }
          }
          e.preventDefault();
          break;
      }
    }

    document.addEventListener("keydown", loginPageKeydownEvents);
    loginButton.addEventListener("click", handleLogin);

    LoginPage.cleanup = function () {
      document.removeEventListener("keydown", loginPageKeydownEvents);
      // Remove click event listener from eye icon
      eyeIcon.removeEventListener("click", togglePassword);
    };
  }, 0);

  return `
    <div class="login-page-container">
      <div class="login-form-div">
        <img class="login-logo" src="../assets/main-logo.png" alt="">
        <h2 class="login-heading">Login Details</h2>

        <div class="login-inputs-div">
          <div><input class="playlistname-input  login-input"  value="a"  type="text" placeholder="Enter Any Name"></div>
          <div><input class="username-input login-input"  type="text" value="testapp265" placeholder="Enter User Name"></div>
          <div><input class="password-input login-input" type="password" value="MaJWZ7EmGC" placeholder="Enter Password"></div>

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
