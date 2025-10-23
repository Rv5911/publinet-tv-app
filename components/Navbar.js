var isNavbarFocused = true;

function Navbar() {
  return `
    <div class="navbar-container" style="position: fixed; top: 2%; width: 100%;  z-index: 999;">
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
        <h3>Profile</h3>
        <ul>
          <li tabindex="0">Account</li>
          <li tabindex="0">Settings</li>
          <li tabindex="0">Switch User</li>
          <li tabindex="0">Logout</li>
        </ul>
      </div>
    </div>
  `;
}

function initNavbar() {
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item"));
  var sidebar = document.getElementById("sidebar");
  var profileIcon = document.getElementById("profileIcon");
  var searchInput = document.getElementById("search-input");
  var currentIndex = 0;
  var totalItems = navItems.length + 2; // search + nav items + profile

  var pageIndexMap = {
    homePage: 0,
    liveTvPage: 1,
    moviesPage: 2,
    seriesPage: 3
  };

  updateNavbarActive(localStorage.getItem("currentPage") || "homePage");

  navItems.forEach(function(item) {
    item.addEventListener("click", function() {
      var page = item.getAttribute("data-page");
      Router.showPage(page);
      updateNavbarActive(page);
    });
  });

  profileIcon.addEventListener("click", openSidebar);
  profileIcon.addEventListener("focus", function() { profileIcon.classList.add("active"); isNavbarFocused = true; });
  profileIcon.addEventListener("blur", function() { profileIcon.classList.remove("active"); });

  document.addEventListener("keydown", function(e) {
    var key = e.key;

    if (sidebar && !sidebar.classList.contains("hidden")) {
      if (["ArrowUp","ArrowDown","Enter","Escape","Backspace","XF86Back"].indexOf(key) > -1) {
        e.preventDefault();
        handleSidebarKeys(e);
        return;
      }
    }

    if (!isNavbarFocused) return;

    if (["ArrowLeft","ArrowRight"].indexOf(key) > -1) e.preventDefault();

    switch (key) {
      case "ArrowRight":
        currentIndex = (currentIndex + 1) % totalItems;
        highlightNavItem(currentIndex);
        break;
      case "ArrowLeft":
        currentIndex = (currentIndex - 1 + totalItems) % totalItems;
        highlightNavItem(currentIndex);
        break;
      case "Enter":
        if (currentIndex === 0) searchInput.focus();
        else if (currentIndex === totalItems - 1) openSidebar();
        else {
          var page = navItems[currentIndex - 1].getAttribute("data-page");
          Router.showPage(page);
          updateNavbarActive(page);
        }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        if (sidebar && !sidebar.classList.contains("hidden")) closeSidebar();
        break;
    }
  });

  function highlightNavItem(index) {
    searchInput.classList.remove("active");
    navItems.forEach(function(i){ i.classList.remove("active"); });
    profileIcon.classList.remove("active");

    if (index === 0) { searchInput.classList.add("active");  }
    else if (index === totalItems - 1) { profileIcon.classList.add("active"); profileIcon.focus(); }
    else { navItems[index-1].classList.add("active"); navItems[index-1].focus(); }
  }

  function updateNavbarActive(page) {
    var index = pageIndexMap[page] || 0;
    currentIndex = index + 1; // search = 0
    highlightNavItem(currentIndex);
    isNavbarFocused = true;
  }

  function openSidebar() {
    sidebar.classList.remove("hidden");
    isNavbarFocused = false;
    var firstItem = sidebar.querySelector("li");
    if (firstItem) { firstItem.classList.add("active"); firstItem.focus(); }
  }

  function closeSidebar() {
    sidebar.classList.add("hidden");
    isNavbarFocused = true;
    profileIcon.focus();
    profileIcon.classList.add("active");
  }

  function handleSidebarKeys(e) {
    var items = Array.prototype.slice.call(sidebar.querySelectorAll("li"));
    if (!items.length) return;
    var activeIndex = items.findIndex(function(item){ return item.classList.contains("active"); });

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
        var text = items[activeIndex].textContent.trim();
        if (text === "Logout") closeSidebar();
        else if (text === "Settings") { Router.showPage("settingsPage"); closeSidebar(); }
        else if (text === "Switch User") { Router.showPage("listPage"); closeSidebar(); }
        break;
      case "Escape":
      case "Backspace":
      case "XF86Back":
        closeSidebar();
        break;
    }
  }

  function updateSidebarSelection(items, index) {
    items.forEach(function(i){ i.classList.remove("active"); });
    items[index].classList.add("active");
    items[index].focus();
  }
}
