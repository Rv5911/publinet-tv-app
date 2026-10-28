function LoginPage() {
  localStorage.removeItem("loginDns");
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

    const moveCaretToEnd = (input) => {
      if (!input) return;
      requestAnimationFrame(() => {
        if (document.activeElement !== input) return;
        const len = input.value.length;
        if (typeof input.setSelectionRange === "function") {
          input.setSelectionRange(len, len);
        }
      });
    };

    let lastFocusedInput = null;

    // The ONLY places that give an input real focus / take it away.
    // Inputs are readonly until opened, so arrows and hover (which only move
    // the focus class) can never pop the keyboard.
    function openInput(el) {
      if (!el) return;
      if (lastFocusedInput && lastFocusedInput !== el) closeInput(lastFocusedInput);
      el.removeAttribute("readonly");
      el.focus();
      lastFocusedInput = el;
      moveCaretToEnd(el);
    }

    // Keeps the focus class on the field; never re-focuses anything.
    function closeInput(el) {
      if (!el) return;
      el.setAttribute("readonly", "readonly");
      if (document.activeElement === el) el.blur();
      if (lastFocusedInput === el) lastFocusedInput = null;
    }

    [playlistInput, usernameInput, passwordInput].forEach(function (inp) {
      if (!inp) return;
      inp.setAttribute("readonly", "readonly");
      // keyboard closed (Done / back) -> readonly again, focus class stays
      inp.addEventListener("blur", function () {
        closeInput(inp);
      });
    });

    passwordInput.addEventListener("focus", () => {
      document.querySelector(".login-form-div").classList.add("shift-up");
      moveCaretToEnd(passwordInput);
    });

    passwordInput.addEventListener("blur", () => {
      document.querySelector(".login-form-div").classList.remove("shift-up");
    });

    const restoreLoginDraft = () => {
      const draftPlaylist = localStorage.getItem("loginDraftPlaylistName");
      const draftUsername = localStorage.getItem("loginDraftUsername");
      const draftPassword = localStorage.getItem("loginDraftPassword");

      if (draftPlaylist !== null && playlistInput) {
        playlistInput.value = draftPlaylist;
      }
      if (draftUsername !== null && usernameInput) {
        usernameInput.value = draftUsername;
      }
      if (draftPassword !== null && passwordInput) {
        passwordInput.value = draftPassword;
      }

      localStorage.removeItem("loginDraftPlaylistName");
      localStorage.removeItem("loginDraftUsername");
      localStorage.removeItem("loginDraftPassword");
    };

    restoreLoginDraft();

    usernameInput.addEventListener("focus", () => {
      document.querySelector(".login-form-div").classList.add("shift-up");
      moveCaretToEnd(usernameInput);
    });

    usernameInput.addEventListener("blur", () => {
      document.querySelector(".login-form-div").classList.remove("shift-up");
    });

    if (playlistInput) {
      playlistInput.addEventListener("focus", () => {
        moveCaretToEnd(playlistInput);
      });
    }

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

    // Wrap password input safely
    const passwordWrapper = document.createElement("div");
    passwordWrapper.className = "password-wrapper";
    passwordInput.parentNode.insertBefore(passwordWrapper, passwordInput);
    passwordWrapper.appendChild(passwordInput);

    const eyeIcon = document.createElement("img");
    eyeIcon.src = "./assets/eye-closed.png";
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
        ? "./assets/eye-open.png" // When password IS visible, show OPEN eye
        : "./assets/eye-closed.png"; // When password is NOT visible, show CLOSED eye

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
          ".login-input-focused, .login-button-focused, .list-button-focused, .eye-icon-focused",
        )
        .forEach(function (el) {
          el.classList.remove(
            "login-input-focused",
            "login-button-focused",
            "list-button-focused",
            "eye-icon-focused",
          );
        });
    }

    function updateFocus(newIndex) {
      if (newIndex < 0 || newIndex >= inputs.length) return;

      if (lastFocusedInput) closeInput(lastFocusedInput);

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
          localStorage.removeItem("loginDraftPlaylistName");
          localStorage.removeItem("loginDraftUsername");
          localStorage.removeItem("loginDraftPassword");
          LoginPage.cleanup();
        }
      });
    }

    function showExitModal() {
      localStorage.setItem(
        "loginDraftPlaylistName",
        playlistInput ? playlistInput.value : "",
      );
      localStorage.setItem(
        "loginDraftUsername",
        usernameInput ? usernameInput.value : "",
      );
      localStorage.setItem(
        "loginDraftPassword",
        passwordInput ? passwordInput.value : "",
      );
      localStorage.setItem("returnPage", "login");
      localStorage.setItem("returnFocus", "login");
      localStorage.setItem("currentPage", "exitModal");
      LoginPage.cleanup();
      Router.showPage("exitModal");
    }

    function getLoginNavigationKey(e) {
      const key = e.key;
      const keyCode = e.keyCode || e.which;

      if (key === "ArrowDown" || keyCode === 40 || key === "Down") {
        return "ArrowDown";
      }
      if (key === "ArrowUp" || keyCode === 38 || key === "Up") {
        return "ArrowUp";
      }
      if (key === "ArrowLeft" || keyCode === 37 || key === "Left") {
        return "ArrowLeft";
      }
      if (key === "ArrowRight" || keyCode === 39 || key === "Right") {
        return "ArrowRight";
      }
      if (key === "Enter" || keyCode === 13 || key === "Return") {
        return "Enter";
      }

      return key;
    }

    function loginPageKeydownEvents(e) {
      if (localStorage.getItem("currentPage") !== "login") {
        return;
      }
      const key = getLoginNavigationKey(e);
      const keyCode = e.keyCode || e.which;
      const focused = inputs[currentIndex];
      const eyeFocused = eyeIcon.classList.contains("eye-icon-focused");

      // Check if an input is actually focused (user is typing)
      const isInputFocused =
        document.activeElement &&
        (document.activeElement === playlistInput ||
          document.activeElement === usernameInput ||
          document.activeElement === passwordInput);

      const isTextBackspaceKey = key === "Backspace" || keyCode === 8;

      if (isInputFocused && isTextBackspaceKey) {
        return; // Let the browser delete at the current cursor position
      }

      if (isBackKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        showExitModal();
        return;
      }

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

      if (
        isInputFocused &&
        (key === "ArrowLeft" || key === "ArrowRight")
      ) {
        return; // Let the browser move the text cursor normally
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
            if (lastFocusedInput) closeInput(lastFocusedInput);
            eyeIcon.classList.add("eye-icon-focused");
          }
          e.stopPropagation();
          e.preventDefault();
          break;

        case "ArrowLeft":
          if (eyeFocused) {
            clearFocusStyles();
            passwordInput.classList.add("login-input-focused");
          }
          e.stopPropagation();
          e.preventDefault();
          break;

        case "Enter":
          if (eyeFocused) {
            togglePassword();
            e.preventDefault();
            break;
          }

          if (lastFocusedInput && lastFocusedInput !== focused) {
            closeInput(lastFocusedInput);
          }

          if (focused.classList.contains("login-input")) {
            // OK on an open field = Done; otherwise open it
            if (document.activeElement === focused) closeInput(focused);
            else openInput(focused);
          } else if (focused.classList.contains("login-button")) {
            handleLogin();
          } else if (focused.classList.contains("list-button")) {
            const playlistsData = localStorage.getItem("playlistsData")
              ? JSON.parse(localStorage.getItem("playlistsData"))
              : [];
            if (playlistsData.length === 0) {
              Toaster.showToast(
                "error",
                "No playlists available. Please add a playlist!",
              );
              e.preventDefault();
              return;
          } else {
            localStorage.removeItem("loginDraftPlaylistName");
            localStorage.removeItem("loginDraftUsername");
            localStorage.removeItem("loginDraftPassword");
            localStorage.setItem("currentPage", "listUsersPage");
            LoginPage.cleanup();
            Router.showPage("listPage");
            }
          }
          e.stopPropagation();
          e.preventDefault();
          break;
      }
    }

    document.addEventListener("keydown", loginPageKeydownEvents);

    // Exposed for js/ui/focus.js (delegated Magic Remote pointer support).
    // eyeIcon and loginButton already have their own real click listeners
    // (above), so activate() skips them to avoid a double action; the
    // inputs and list-button have none, so those reuse the existing
    // Enter-key logic directly (opens the keyboard / navigates).
    function loginHoverSync(el) {
      if (el === eyeIcon) {
        clearFocusStyles();
        if (lastFocusedInput) closeInput(lastFocusedInput);
        eyeIcon.classList.add("eye-icon-focused");
        return;
      }
      var idx = inputs.indexOf(el);
      if (idx === -1) return;
      updateFocus(idx);
    }
    function loginActivate(el) {
      loginHoverSync(el);
      if (el === eyeIcon || el === loginButton) return;
      if (el.classList.contains("login-input")) {
        openInput(el); // click / pointer OK opens the field (never toggles it closed)
        return;
      }
      loginPageKeydownEvents({
        key: "Enter",
        keyCode: 13,
        preventDefault: function () {},
        stopPropagation: function () {},
      });
    }
    window.loginHoverSync = loginHoverSync;
    window.loginActivate = loginActivate;
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
        <img class="login-logo" src="./assets/main-logo.png" alt="">
        <h2 class="login-heading">Login Details</h2>

        <div class="login-inputs-div">
          <div><input class="playlistname-input  login-input"  type="text" readonly autocomplete="off" placeholder="Enter Any Name"></div>
          <div><input class="username-input login-input"  type="text" readonly autocomplete="off" placeholder="Enter User Name"></div>
          <div><input class="password-input login-input"  type="password" readonly autocomplete="off" placeholder="Enter Password"></div>

          <div class="login-buttons-div">
            <button class="login-button">Login</button>
          </div>

          <div class="list-user-button-div">
            <button class="list-button">
              <img src="./assets/list-users.png" alt=""> List User
            </button>
          </div>
        </div>
      </div>

      <div class="login-image-div">
        <img class="login-right-image" src="./assets/login-right-image.png" alt="">
      </div>
    </div>
  `;
}
