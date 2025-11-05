let isSortOptionsOpen = false;

function Navbar() {
  return `
    <div class="navbar-container">
      <div class="navbar-left">
        <img src="/assets/main-logo.png" alt="Logo" class="logo" />
        <div class="search-bar-container">
          <img src="/assets/search-icon-navbar.png" alt="Search Icon" class="nav-search-bar" />
          <input type="text" id="search-input" placeholder="Search" tabindex="0" class="search-bar" />
        </div>
      </div>
      <div class="navbar-right">
        <div class="nav-item" data-page="homePage" tabindex="0">Home</div>
        <div class="nav-item" data-page="liveTvPage" tabindex="0">Live TV</div>
        <div class="nav-item" data-page="moviesPage" tabindex="0">Movies</div>
        <div class="nav-item" data-page="seriesPage" tabindex="0">Series</div>
        <div class="navbar-profile">
          <svg width="50" id="profileIcon" tabindex="0" height="50" viewBox="0 0 12 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="6" fill="white"/>
            <circle cx="6" cy="24" r="6" fill="white"/>
            <circle cx="6" cy="42" r="6" fill="white"/>
          </svg>
        </div>
      </div>
    </div>

    <div id="sidebar" class="sidebar hidden">
      <div class="sidebar-content">
        <ul>
          <li class="sidebar-link" tabindex="0"><img src="/assets/sidebar-settings.png" alt="Logo" class="sidebar-link-logo" />Settings</li>
          <li class="sidebar-link" tabindex="0"><img src="/assets/sidebar-list-user.png" alt="Logo" class="sidebar-link-logo" />List User</li>
          <li class="account-navbar sidebar-link" tabindex="0"><img src="/assets/sidebar-account.png" alt="Logo" class="sidebar-link-logo" />My Account</li>
          
          <!-- ✅ Sort with expandable submenu -->
          <li class="sidebar-link sidebar-sort" tabindex="0">
            <span class="sidebar-link-sort-container">
              <img src="/assets/sidebar-sort.png" alt="Logo" class="sidebar-link-logo" />
              Sort
            </span>
            <span class="arrow-icon"><img src="/assets/down-arrow.png" alt="Logo" /></span>
          </li>
          <div id="sort-options" class="sort-options hidden">
            <ul>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="default">
                  <span class="checkmark"></span>
                  Default
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="recently-added">
                  <span class="checkmark"></span>
                  Recently Added
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="a-z">
                  <span class="checkmark"></span>
                  A-Z
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="z-a">
                  <span class="checkmark"></span>
                  Z-A
                </label>
              </li>
              <li class="sort-option" tabindex="0">
                <label class="checkbox-container">
                  <input type="checkbox" class="sort-checkbox" data-sort="top-rated">
                  <span class="checkmark"></span>
                  Top Rated
                </label>
              </li>
            </ul>
          </div>

          <li class="logout-navbar sidebar-link" tabindex="0">Sign Out</li>
        </ul>
      </div>
    </div>
  `;
}

function initNavbar() {
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const sidebar = document.getElementById("sidebar");
  const profileIcon = document.getElementById("profileIcon");
  const searchInput = document.getElementById("search-input");
  const sortItem = sidebar.querySelector(".sidebar-sort");
  const sortOptions = document.getElementById("sort-options");
  const arrowIcon = sortItem.querySelector(".arrow-icon");
  const sortCheckboxes = Array.from(
    document.querySelectorAll(".sort-checkbox")
  );

  let currentIndex = 0;
  const totalItems = navItems.length + 2;

  const pageIndexMap = {
    homePage: 0,
    liveTvPage: 1,
    moviesPage: 2,
    seriesPage: 3,
  };

  setSortOption("default");

  updateNavbarActive(localStorage.getItem("currentPage"));

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.getAttribute("data-page");
      Router.showPage(page);
      updateNavbarActive(page);
    });
  });

  profileIcon.addEventListener("click", openSidebar);
  profileIcon.addEventListener("focus", () => {
    profileIcon.classList.add("active");
    localStorage.setItem("navigationFocus", "navbar");
  });
  profileIcon.addEventListener("blur", () => {
    profileIcon.classList.remove("active");
  });

  sortItem.addEventListener("click", toggleSortMenu);

  sortCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        setSortOption(e.target.dataset.sort);
      }
    });
  });

document.addEventListener("keydown", (e) => {
  const navigationFocus = localStorage.getItem("navigationFocus");
  const currentPage = localStorage.getItem("currentPage");
  const key = e.key;

    if (currentPage === "moviesDetailPage") {
    return;
  }

  if(currentPage=="settingsPage") return;

  if (isSortOptionsOpen) {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "Escape",
        "Backspace",
        "XF86Back",
      ].includes(key)
    ) {
      e.preventDefault();
      handleSortOptionsKeys(e);
      return;
    }
  }

  // Handle sidebar keys when sidebar is open (regardless of navigation focus)
  if (sidebar && !sidebar.classList.contains("hidden")) {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "Escape",
        "Backspace",
        "XF86Back",
      ].includes(key)
    ) {
      e.preventDefault();
      handleSidebarKeys(e);
      return;
    }
  }

  // Only process navbar keys if navigation focus is navbar
  if (navigationFocus !== "navbar") {
    return;
  }

  if (["ArrowLeft", "ArrowRight"].includes(key)) e.preventDefault();

  switch (key) {
    case "ArrowRight":
      if (profileIcon.classList.contains("active")) {
        return;
      } else {
        currentIndex = (currentIndex + 1) % totalItems;
        highlightNavItem(currentIndex);
        break;
      }
    case "ArrowLeft":
      if (searchInput.classList.contains("active")) {
        // Blur input first so it no longer looks focused
        searchInput.blur();

        // Move to Home
        currentIndex = 1;
        highlightNavItem(currentIndex);
      } else {
        currentIndex = (currentIndex - 1 + totalItems) % totalItems;
        highlightNavItem(currentIndex);
      }
      break;
case "ArrowDown":
  // Handle ArrowDown for both moviesPage and liveTvPage
  if ((currentPage === "moviesPage" || currentPage === "liveTvPage") && navigationFocus === "navbar") {
    localStorage.setItem("navigationFocus", currentPage);
    
    navItems.forEach(item => item.classList.remove("active"));
    searchInput.classList.remove("active");
    profileIcon.classList.remove("active");
    
    // For liveTvPage, focus on first category
    if (currentPage === "liveTvPage") {
      setTimeout(() => {
        if (typeof focusCategories === 'function') {
          focusCategories(0); // Focus on first category
        }
        const firstCategory = document.querySelector(".livetv-channel-category");
        if (firstCategory) {
          firstCategory.focus();
          firstCategory.classList.add("livetv-channel-category-focused");
        }
      }, 10);
    }
    
    // Existing moviesPage logic
    if (currentPage === "moviesPage" && window.moviesNavigationState) {
      window.moviesNavigationState.currentCategoryIndex = 0;
      window.moviesNavigationState.currentCardIndex = 0;
      if (window.saveNavigationState) {
        window.saveNavigationState(); 
      }
      
      setTimeout(() => {
        const firstCard = document.querySelector(".movie-card");
        if (firstCard) {
          firstCard.focus();
          if (window.updateFocus) {
            window.updateFocus();
          }
        }
      }, 10);
    }
  }
  break;
    case "Enter":
      if (currentIndex === 0) {
        searchInput.focus();
      } else if (currentIndex === totalItems - 1) {
        openSidebar();
      } else {
        const page = navItems[currentIndex - 1].getAttribute("data-page");
        Router.showPage(page);
        updateNavbarActive(page);
      }
      break;
    case "Escape":
    case "Backspace":
    case "XF86Back":
      if (sidebar && !sidebar.classList.contains("hidden")) {
        closeSidebar();
      }
      break;
  }
});

  function highlightNavItem(index) {
    searchInput.classList.remove("active");
    navItems.forEach((i) => i.classList.remove("active"));
    profileIcon.classList.remove("active");

    if (index === 0) {
      searchInput.classList.add("active");
      searchInput.focus();
    } else if (index === totalItems - 1) {
      profileIcon.classList.add("active");
      profileIcon.focus();
    } else {
      const item = navItems[index - 1];
      item.classList.add("active");
      item.focus();
    }
  }

  function updateNavbarActive(page) {
    const index = pageIndexMap[page] || 0;
    currentIndex = index + 1;
    highlightNavItem(currentIndex);
    localStorage.setItem("navigationFocus", "navbar");
  }

  function openSidebar() {
    sidebar.classList.remove("hidden");
    sidebar.style.right = "40px";
    localStorage.setItem("navigationFocus", "sidebar");
    isSortOptionsOpen = false;
    const items = Array.from(sidebar.querySelectorAll("li.sidebar-link"));
    updateSidebarSelection(items, 0);
    const firstItem = items[0];
    if (firstItem) firstItem.focus();
  }

  function closeSidebar() {
    sidebar.classList.add("hidden");
    sidebar.style.right = "0px";
    localStorage.setItem("navigationFocus", "navbar");
    isSortOptionsOpen = false;

    setTimeout(() => {
      if (profileIcon) {
        profileIcon.focus();
        profileIcon.classList.add("active");
      }
    }, 10);
  }

  function handleLogOut() {
    localStorage.setItem("currentPage", "login");
    Router.showPage("login");
    closeSidebar();
  }

  function toggleSortMenu() {
    const expanded = !sortOptions.classList.contains("hidden");
    if (expanded) {
      closeSortMenu();
    } else {
      openSortMenu();
    }
  }

  function openSortMenu() {
    sortOptions.classList.remove("hidden");
    arrowIcon.classList.add("rotated");
    isSortOptionsOpen = true;

    const sortOptionItems = Array.from(
      sortOptions.querySelectorAll(".sort-option")
    );
    if (sortOptionItems.length > 0) {
      updateSortOptionsSelection(sortOptionItems, 0);
    }
  }

  function closeSortMenu() {
    sortOptions.classList.add("hidden");
    arrowIcon.classList.remove("rotated");
    isSortOptionsOpen = false;

    // Focus back on the Sort menu item
    const sortMenuItem = sidebar.querySelector(".sidebar-sort");
    if (sortMenuItem) {
      sortMenuItem.focus();
      const sidebarItems = Array.from(
        sidebar.querySelectorAll("li.sidebar-link")
      );
      const sortIndex = sidebarItems.indexOf(sortMenuItem);
      updateSidebarSelection(sidebarItems, sortIndex);
    }
  }

  function setSortOption(sortType) {
    // Uncheck all checkboxes
    sortCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // Check the selected one
    const selectedCheckbox = document.querySelector(
      `.sort-checkbox[data-sort="${sortType}"]`
    );
    if (selectedCheckbox) {
      selectedCheckbox.checked = true;
    }

    // Here you can implement the actual sorting logic
    console.log(`Sorting by: ${sortType}`);
    // Implement your sorting logic based on sortType
  }

  function handleSidebarKeys(e) {
    if (isSortOptionsOpen) return;

    const items = Array.from(sidebar.querySelectorAll("li.sidebar-link"));
    if (!items.length) return;

    let activeIndex = items.findIndex((item) =>
      item.classList.contains("active")
    );
    if (activeIndex === -1) activeIndex = 0;

    const activeItem = items[activeIndex];
    const text = activeItem.textContent.trim();

    switch (e.key) {
      case "ArrowDown":
        activeIndex = (activeIndex + 1) % items.length;
        updateSidebarSelection(items, activeIndex);
        break;
      case "ArrowUp":
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateSidebarSelection(items, activeIndex);
        break;
      case "Enter":
        if (text === "Sort") {
          openSortMenu();
        } else if (text === "Sign Out") {
          handleLogOut();
        } else if (text === "Settings") {
          localStorage.setItem("currentPage", "settingsPage");
          Router.showPage("settingsPage");
          closeSidebar();
        } else if (text === "List User") {
          Router.showPage("listPage");
          closeSidebar();
        } else if (text === "My Account") {
               localStorage.setItem("currentPage", "accountPage");
          Router.showPage("accountPage");
          closeSidebar();
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        closeSidebar();
        break;
    }
  }

  function handleSortOptionsKeys(e) {
    const sortOptionItems = Array.from(
      sortOptions.querySelectorAll(".sort-option")
    );
    if (!sortOptionItems.length) return;

    let activeIndex = sortOptionItems.findIndex((item) =>
      item.classList.contains("active")
    );
    if (activeIndex === -1) activeIndex = 0;

    switch (e.key) {
      case "ArrowDown":
        activeIndex = (activeIndex + 1) % sortOptionItems.length;
        updateSortOptionsSelection(sortOptionItems, activeIndex);
        break;
      case "ArrowUp":
        activeIndex =
          (activeIndex - 1 + sortOptionItems.length) % sortOptionItems.length;
        updateSortOptionsSelection(sortOptionItems, activeIndex);
        break;
      case "Enter":
        const activeSortItem = sortOptionItems[activeIndex];
        const checkbox = activeSortItem.querySelector(".sort-checkbox");
        if (checkbox) {
          checkbox.checked = true;
          setSortOption(checkbox.dataset.sort);
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        closeSortMenu();
        break;
    }
  }

  function updateSidebarSelection(items, index) {
    items.forEach((item) => {
      item.classList.remove("active");
      const logo = item.querySelector(".sidebar-link-logo");
      if (logo) logo.classList.remove("sidebar-link-logo-focused");
    });

    const activeItem = items[index];
    if (activeItem) {
      activeItem.classList.add("active");
      const activeLogo = activeItem.querySelector(".sidebar-link-logo");
      if (activeLogo) activeLogo.classList.add("sidebar-link-logo-focused");
      activeItem.focus();
    }
  }

  function updateSortOptionsSelection(items, index) {
    items.forEach((item) => {
      item.classList.remove("active");
    });

    const activeItem = items[index];
    if (activeItem) {
      activeItem.classList.add("active");
      activeItem.focus();
    }
  }
}