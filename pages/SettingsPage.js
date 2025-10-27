function SettingsPage() {
  setTimeout(function () {
    if (SettingsPage.cleanup) SettingsPage.cleanup();

    const container = document.querySelector(".settings-pages-container");
    const items = Array.from(container.querySelectorAll("p"));
    let activeIndex = 0;
    let isInSubPage = false; 

    // Show StreamFormat by default
    const secondContainer = document.querySelector(".settings-second-container");
    secondContainer.innerHTML = StreamFormat();
    isInSubPage = true;

    function updateActiveItem() {
      items.forEach((item, index) => {
        if (index === activeIndex) {
          item.classList.add("settings-pages-container-active");
          const img = item.querySelector("img");
          if (img) img.classList.add("settings-pages-container-image-active");
        } else {
          item.classList.remove("settings-pages-container-active");
          const img = item.querySelector("img");
          if (img)
            img.classList.remove("settings-pages-container-image-active");
        }
      });
    }

    updateActiveItem();

    function settingsKeydownEvents(e) {
      if (isInSubPage) return;
      
      if (localStorage.getItem("currentPage") !== "settingsPage" && localStorage.getItem("settingPage") !== "settingsPage") return;
      
      const key = e.key;
      const selectedItem = items[activeIndex];
      console.log(selectedItem, "selectedItem");
      
      switch (key) {
        case "ArrowDown":
          if (selectedItem.classList.contains("clear-app-cache")) return;
          activeIndex = (activeIndex + 1) % items.length;
          updateActiveItem();
          break;

        case "ArrowUp":
          if (selectedItem.classList.contains("stream-format")) return;
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          updateActiveItem();
          break;
        case "ArrowRight":
          localStorage.setItem("settingPage", "settingsPage");
          break;

        case "Enter":
          handleSelection(selectedItem);
          break;

        case "Backspace":
        case "Escape":
        case "Back":
        case "BrowserBack":
        case "XF86Back":
        case "10009":
          SettingsPage.cleanup();

          localStorage.setItem("currentPage", "homePage");

          Router.showPage("homePage");
          break;

        default:
          break;
      }
    }

    function handleSelection(item) {
      const container = document.querySelector(".settings-second-container");

      isInSubPage = true;

      if (item.classList.contains("stream-format")) {
        container.innerHTML = StreamFormat();
        // Set up cleanup for when returning from StreamFormat
        setupSubPageCleanup();
      } else if (item.classList.contains("time-format")) {
        container.innerHTML = TimeFormat();
        setupSubPageCleanup();
      } else if (item.classList.contains("parental-control")) {
        container.innerHTML = ParentalControl();
        setupSubPageCleanup();
      } else if (item.classList.contains("clear-app-cache")) {
        alert("Clear App Cache selected");
      }
    }

    function setupSubPageCleanup() {
      // No-op: Subpages handle their own Back/Exit keys to avoid conflicts
    }

    // Set up cleanup for the default StreamFormat view
    setupSubPageCleanup();

    // Observe changes to subpage container to keep isInSubPage in sync
    const subPageContainerObserver = new MutationObserver(function() {
      const subContainer = document.querySelector(".settings-second-container");
      if (!subContainer) return;
      const hasContent = subContainer.innerHTML.trim() !== "";
      isInSubPage = hasContent;
      if (!hasContent) {
        updateActiveItem();
      }
    });
    subPageContainerObserver.observe(document.querySelector(".settings-second-container"), { childList: true, subtree: true });

    document.addEventListener("keydown", settingsKeydownEvents);

    SettingsPage.cleanup = function () {
      document.removeEventListener("keydown", settingsKeydownEvents);
      isInSubPage = false;
      try { subPageContainerObserver.disconnect(); } catch (e) {}
    };
  }, 0);

  return `
    <div class="settings-main-container">
      <div class="settings-first-container">
        <div class="settings-first-content">
          <h1>Settings</h1>
          <div class="settings-pages-container">
            <p class="stream-format"><img src="/assets/stream-icon-white.png"/>Stream Format</p>
            <p class="time-format"><img src="/assets/time-icon-white.png"/>Time Format</p>
            <p class="parental-control"><img src="/assets/parental-icon-white.png"/>Parental Control</p>
            <!-- <p class="clear-app-cache"><img src="/assets/clear-cache-icon-white.png"/>Clear App Cache</p> -->
          </div>
        </div>
      </div>
      <div class="settings-second-container"></div>
    </div>
  `;
}