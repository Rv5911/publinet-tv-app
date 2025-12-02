function LivePage() {
  // Create and show custom live page loader immediately (using HomePage loader styles)
  const liveLoader = document.createElement("div");
  liveLoader.id = "home-page-loader";
  liveLoader.innerHTML = `
    <div class="home-loader-content">
      <div class="home-loader-spinner"></div>
    </div>
  `;
  document.body.appendChild(liveLoader);

  let filteredStreams = [];
  let selectedCategoryId = "All";

  // Navigation State
  let focusedSection = "sidebar";
  let sidebarIndex = 0;
  let channelIndex = 0;
  let buttonFocusIndex = -1; // -1 = no button focused, 0 = heart, 1 = remove
  let playerSubFocus = 0; // 0 = Video Border, 1 = Play/Pause, 2 = Aspect Ratio
  let epgIndex = -1; // -1 = Header (Favorite), 0+ = List Items
  let currentEpgData = [];
  let currentPlayingStream = null;
  let lastToggleTime = 0;

  // Search State
  let categorySearchQuery = "";
  let channelSearchQuery = "";
  let currentSortOption = "default";

  // Chunking State
  let categoryChunk = 1;
  let channelChunk = 1;
  const categoryPageSize = 20;
  const channelPageSize = 20;

  // DOM Elements
  let container;

  // Get current playlist - MOVED UP to avoid reference error
  const getCurrentPlaylist = () => {
    try {
      const currentPlaylistName = JSON.parse(
        localStorage.getItem("selectedPlaylist") || "{}"
      ).playlistName;
      const playlistsData = JSON.parse(
        localStorage.getItem("playlistsData") || "[]"
      );
      return playlistsData.find(
        (pl) => pl.playlistName === currentPlaylistName
      );
    } catch (e) {
      return null;
    }
  };

  // Parental Control State
  const unlockedLiveAdultCatIds = new Set();
  const unlockedLiveAdultChannelsInAll = new Set();
  const unlockedLiveAdultChannelsInFavorites = new Set();
  const unlockedLiveAdultChannelsInHistory = new Set();

  // Adult category detection
  const isLiveAdultCategory = (name) => {
    const normalized = (name || "").trim().toLowerCase();
    const configured = Array.isArray(window.adultsCategories)
      ? window.adultsCategories
      : [];
    if (configured.includes(normalized)) return true;
    return /(adult|xxx|18\+|18\s*plus|sex|porn|nsfw)/i.test(normalized);
  };

  // Initialize
  setTimeout(() => {
    if (window.cleanupLivePage) {
      window.cleanupLivePage();
    }
    init();
  }, 0);

  const cleanup = () => {
    const searchInput = document.getElementById("search-input");
    const searchIcon = document.querySelector(".nav-search-bar");
    if (searchInput) searchInput.style.display = "";
    if (searchIcon) searchIcon.style.display = "";

    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("sortChanged", handleSortChange);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange
    );
    document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    document.removeEventListener("msfullscreenchange", handleFullscreenChange);

    const grid = document.getElementById("lp-channels-grid");
    if (grid) {
      grid.removeEventListener("scroll", handleScroll);
    }

    if (window.livePlayer) {
      try {
        window.livePlayer.dispose();
      } catch (e) {}
      window.livePlayer = null;
    }

    window.cleanupLivePage = null;
  };

  const init = () => {
    // Explicitly reset state on init
    focusedSection = "sidebar";
    sidebarIndex = 0;
    channelIndex = 0;
    buttonFocusIndex = -1;
    playerSubFocus = 0;
    epgIndex = -1;
    currentPlayingStream = null;
    lastToggleTime = 0;
    categorySearchQuery = "";
    channelSearchQuery = "";
    selectedCategoryId = "All";
    categoryChunk = 1;
    channelChunk = 1;

    console.log("LivePage init called");

    container = document.querySelector(".lp-main-container");
    if (!container) return;

    const searchInput = document.getElementById("search-input");
    const searchIcon = document.querySelector(".nav-search-bar");
    if (searchInput) searchInput.style.display = "none";
    if (searchIcon) searchIcon.style.display = "none";

    render();
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("sortChanged", handleSortChange);

    // Add fullscreen event listeners
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    window.cleanupLivePage = cleanup;
    // Listen for focus changes from Navbar
    window.addEventListener(
      "navigation-focus-change",
      handleNavigationFocusChange
    );
  };

  const handleNavigationFocusChange = () => {
    const navFocus = localStorage.getItem("navigationFocus");
    if (navFocus === "sidebarSearch") {
      focusedSection = "sidebarSearch";
      updateFocus();
    }
  };

  const getFilteredCategories = () => {
    let cats = [
      {
        category_id: "All",
        category_name: "All Channels",
      },
      {
        category_id: "favorites",
        category_name: "Favorite Channels",
      },
      {
        category_id: "channelHistory",
        category_name: "Channels History",
      },
    ];

    if (window.liveCategories) {
      cats = [...cats, ...window.liveCategories];
    }

    if (categorySearchQuery) {
      cats = cats.filter((c) =>
        c.category_name
          .toLowerCase()
          .includes(categorySearchQuery.toLowerCase())
      );
    }

    // Return only the current chunk
    const start = 0;
    const end = categoryChunk * categoryPageSize;
    return cats.slice(start, end);
  };

  const getAllFilteredCategories = () => {
    let cats = [
      {
        category_id: "All",
        category_name: "All Channels",
      },
      {
        category_id: "favorites",
        category_name: "Favorite Channels",
      },
      {
        category_id: "channelHistory",
        category_name: "Channels History",
      },
    ];

    if (window.liveCategories) {
      cats = [...cats, ...window.liveCategories];
    }

    if (categorySearchQuery) {
      cats = cats.filter((c) =>
        c.category_name
          .toLowerCase()
          .includes(categorySearchQuery.toLowerCase())
      );
    }

    return cats;
  };

  const getFilteredChannels = () => {
    let streams = [];

    if (selectedCategoryId === "All") {
      streams = window.allLiveStreams || [];
    } else if (selectedCategoryId === "favorites") {
      // Always get fresh data from localStorage
      const currentPlaylist = getCurrentPlaylist();
      streams = currentPlaylist ? currentPlaylist.favoritesLiveTV || [] : [];
    } else if (selectedCategoryId === "channelHistory") {
      // Always get fresh data from localStorage
      const currentPlaylist = getCurrentPlaylist();
      streams = currentPlaylist ? currentPlaylist.ChannelListLive || [] : [];
    } else {
      streams = (window.allLiveStreams || []).filter(
        (s) => String(s.category_id) === String(selectedCategoryId)
      );
    }

    if (channelSearchQuery) {
      streams = streams.filter((s) =>
        (s.name || "").toLowerCase().includes(channelSearchQuery.toLowerCase())
      );
    }

    // Apply Sorting
    if (currentSortOption === "a-z") {
      streams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (currentSortOption === "z-a") {
      streams.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    } else if (currentSortOption === "recently-added") {
      streams.sort((a, b) => {
        const timeA = a.added ? parseInt(a.added) : 0;
        const timeB = b.added ? parseInt(b.added) : 0;
        return timeB - timeA;
      });
    }

    return streams;
  };

  const getCategoryCount = (catId) => {
    if (catId === "All") return (window.allLiveStreams || []).length;
    if (catId === "favorites") {
      const currentPlaylist = getCurrentPlaylist();
      return currentPlaylist && currentPlaylist.favoritesLiveTV
        ? currentPlaylist.favoritesLiveTV.length
        : 0;
    }
    if (catId === "channelHistory") {
      const currentPlaylist = getCurrentPlaylist();
      return currentPlaylist && currentPlaylist.ChannelListLive
        ? currentPlaylist.ChannelListLive.length
        : 0;
    }
    return (window.allLiveStreams || []).filter(
      (s) => String(s.category_id) === String(catId)
    ).length;
  };

  const render = () => {
    container.innerHTML = `
      <div class="lp-sidebar">
        <div class="lp-search-box" id="lp-cat-search-box">
          <input type="text" class="lp-search-input" id="lp-cat-search-input" placeholder="Search Categories" value="${categorySearchQuery}">
          <i class="fas fa-search lp-search-icon" style="color: #aaa; margin-right: 10px;"></i>
    
          </div>
        <ul class="lp-category-list" id="lp-category-list"></ul>
      </div>
      <div class="lp-content">
        <div class="lp-top-section">
          <div class="lp-player-container" id="lp-player-container">
            <div class="lp-video-wrapper">
              <div style="width:100%; height:100%; zoom:1.4; background:black; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#666;">
                <i class="fas fa-play-circle" style="font-size: 50px; margin-bottom:10px;"></i>
                <p>Select a channel to play</p>
              </div>
            </div>
          </div>
          <div class="lp-epg-container" id="lp-epg-container">
            <div class="lp-epg-header"><span>Program Guide</span></div>
            <div class="lp-epg-list" id="lp-epg-list">
              <div style="padding:20px; color:#aaa; text-align:center;">
                Select a channel to view program information
              </div>
            </div>
          </div>
        </div>
        <div class="lp-channels-section">
          <div class="lp-channels-header">
            <div class="lp-channel-search-bar" id="lp-chan-search-box">
              <input type="text" class="lp-channel-search-input" id="lp-chan-search-input" placeholder="Search Channels" value="${channelSearchQuery}">
              <i class="fas fa-search lp-search-icon" style="color: #aaa; margin-right: 10px;"></i>
            
              </div>
          </div>
          <div class="lp-channels-grid" id="lp-channels-grid"></div>
        </div>
      </div>
    `;

    renderCategories();
    renderChannels();

    setTimeout(() => {
      setupInputListeners();
      setupScrollListener();
      setupClickListeners();

      // Hide the loader after everything is rendered
      const loaderElement = document.querySelector("#home-page-loader");
      if (loaderElement) {
        loaderElement.style.animation = "fadeOut 0.3s ease-out";
        setTimeout(() => {
          if (loaderElement && loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement);
          }
        }, 300);
      }
    }, 100);
  };

  const renderCategories = () => {
    const list = document.getElementById("lp-category-list");
    if (!list) return;

    const cats = getFilteredCategories();

    if (cats.length === 0) {
      list.innerHTML =
        '<div style="padding:20px; color:#aaa; zoom:1.7; text-align:center;">No category found</div>';
      return;
    }

    list.innerHTML = cats
      .map(
        (cat, idx) => `
        <li class="lp-category-item ${
          String(selectedCategoryId) === String(cat.category_id)
            ? "lp-selected"
            : ""
        }" data-id="${cat.category_id}" data-index="${idx}">
          <div class="lp-category-name-wrapper">
            <span class="lp-category-name">${cat.category_name}</span>
          </div>
          <span class="lp-category-count">${getCategoryCount(
            cat.category_id
          )}</span>
        </li>
      `
      )
      .join("");
  };

  const renderChannels = () => {
    const grid = document.getElementById("lp-channels-grid");
    if (!grid) return;

    filteredStreams = getFilteredChannels();
    console.log(
      `Rendering channels. Category: ${selectedCategoryId}, Count: ${filteredStreams.length}`
    );

    if (filteredStreams.length === 0) {
      grid.innerHTML =
        '<div style="padding:20px; color:#aaa; zoom:1.4; text-align:center;">No channels found</div>';
      return;
    }

    // Calculate which channels to show
    const endIdx = Math.min(
      channelChunk * channelPageSize,
      filteredStreams.length
    );
    const channelsToRender = filteredStreams.slice(0, endIdx);

    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();

    channelsToRender.forEach((stream, idx) => {
      const currentPlaylistObj = getCurrentPlaylist();
      const playlistUsername = currentPlaylistObj
        ? currentPlaylistObj.playlistName
        : null;
      const isFav = window.isItemFavoriteForPlaylist
        ? window.isItemFavoriteForPlaylist(
            stream,
            "favoritesLiveTV",
            playlistUsername
          )
        : false;
      const isHistory = selectedCategoryId === "channelHistory";

      // Detect adult channels
      const category = (window.liveCategories || []).find(
        (c) => c.category_id === stream.category_id
      );
      const isAdultChannel = category
        ? isLiveAdultCategory(category.category_name)
        : false;
      const currentPlaylistForParental = getCurrentPlaylist();
      const parentalEnabled =
        currentPlaylistForParental &&
        !!currentPlaylistForParental.parentalPassword;

      // Determine if channel is unlocked
      let isChannelUnlocked = true;
      if (isAdultChannel && parentalEnabled) {
        if (selectedCategoryId === "All") {
          isChannelUnlocked = unlockedLiveAdultChannelsInAll.has(
            String(stream.stream_id)
          );
        } else if (selectedCategoryId === "favorites") {
          isChannelUnlocked = unlockedLiveAdultChannelsInFavorites.has(
            String(stream.stream_id)
          );
        } else if (selectedCategoryId === "channelHistory") {
          isChannelUnlocked = unlockedLiveAdultChannelsInHistory.has(
            String(stream.stream_id)
          );
        } else {
          isChannelUnlocked = unlockedLiveAdultCatIds.has(
            String(selectedCategoryId)
          );
        }
      }

      const card = document.createElement("div");
      card.className = "lp-channel-card";
      card.dataset.streamId = stream.stream_id;
      card.dataset.index = idx;
      card.dataset.isAdult = isAdultChannel;

      card.innerHTML = `
        <div class="lp-channel-logo-container ${
          isAdultChannel && parentalEnabled && !isChannelUnlocked
            ? "lp-channel-card-locked"
            : ""
        }">
          <img src="${
            stream.stream_icon || "assets/main-logo.png"
          }" class="lp-channel-logo" onerror="this.src='assets/main-logo.png'">
          ${
            isAdultChannel && parentalEnabled && !isChannelUnlocked
              ? '<i class="fas fa-lock lp-channel-lock-icon"></i>'
              : ""
          }
        </div>
        <div class="lp-channel-info">
        <div class="lp-name-and-buttons">


          <div class="lp-channel-name-wrapper">
            <div class="lp-channel-name">${stream.name}</div>
          </div>
         <div class="lp-channel-buttons">
          <button class="lp-channel-fav-btn" data-stream-id="${
            stream.stream_id
          }" data-button-index="0">
            <i class="${isFav ? "fa-solid" : "fa-regular"} fa-heart"></i>
          </button>
          ${
            isHistory
              ? `<button class="lp-channel-remove-btn" data-stream-id="${stream.stream_id}" data-button-index="1">
              <i class="fa-solid fa-xmark"></i>
            </button>`
              : ""
          }
        </div>
          </div>
          <div class="lp-progress-bar">
            <div class="lp-progress-fill" style="width: ${
              Math.random() * 100
            }%">
              <div class="lp-progress-dot"></div>
            </div>
          </div>
        </div>
       
      `;

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  };

  const toggleFavorite = (stream, showToast = true) => {
    if (!window.toggleFavoriteItem) {
      console.error("toggleFavoriteItem function not available");
      return;
    }

    const now = Date.now();
    if (now - lastToggleTime < 500) {
      console.warn("Toggle favorite called too quickly, ignoring");
      return;
    }
    lastToggleTime = now;

    // CRITICAL FIX: Get fresh playlist data and check CURRENT favorite state BEFORE toggling
    const freshPlaylist = getCurrentPlaylist();
    const playlistUsername = freshPlaylist ? freshPlaylist.playlistName : null;

    if (!playlistUsername) {
      console.error("No playlist username found");
      if (showToast && window.Toaster && window.Toaster.showToast) {
        window.Toaster.showToast("error", "Failed to update favorites");
      }
      return;
    }

    // Check if the item is CURRENTLY a favorite (before toggling)
    const isCurrentlyFavorite = window.isItemFavoriteForPlaylist
      ? window.isItemFavoriteForPlaylist(
          stream,
          "favoritesLiveTV",
          playlistUsername
        )
      : false;

    // Now perform the toggle operation
    const result = window.toggleFavoriteItem(stream, "favoritesLiveTV");

    // Check if the operation was successful
    if (!result || !result.success) {
      console.error(
        "Failed to toggle favorite:",
        result ? result.message : "unknown error"
      );
      if (showToast && window.Toaster && window.Toaster.showToast) {
        window.Toaster.showToast("error", "Failed to update favorites");
      }
      return;
    }

    // Show toast based on what we INTENDED to do (opposite of current state)
    // If it was a favorite, we removed it. If it wasn't, we added it.
    if (showToast && window.Toaster && window.Toaster.showToast) {
      const actionMessage = isCurrentlyFavorite
        ? "Removed from favorites"
        : "Added to favorites";
      const toastType = isCurrentlyFavorite ? "error" : "success";

      window.Toaster.showToast(toastType, actionMessage);
    }

    // Force refresh of the current playlist data from localStorage after toggle
    const updatedPlaylist = getCurrentPlaylist();

    if (selectedCategoryId === "favorites" && isCurrentlyFavorite) {
      // If we're in favorites view and removed an item, re-render everything
      channelChunk = 1;
      renderChannels();
      renderCategories();
      if (channelIndex >= filteredStreams.length) {
        channelIndex = Math.max(0, filteredStreams.length - 1);
      }
      buttonFocusIndex = -1;
      updateFocus();
    } else {
      // Update the specific card's heart icon based on fresh data
      const card = document.querySelector(
        `.lp-channel-card[data-stream-id="${stream.stream_id}"]`
      );
      if (card) {
        const favBtn = card.querySelector(".lp-channel-fav-btn i");
        if (favBtn) {
          // Check the actual favorite status from fresh playlist data after toggle
          const updatedPlaylistUsername = updatedPlaylist
            ? updatedPlaylist.playlistName
            : null;
          const actualIsFav = window.isItemFavoriteForPlaylist
            ? window.isItemFavoriteForPlaylist(
                stream,
                "favoritesLiveTV",
                updatedPlaylistUsername
              )
            : result.isFav;

          favBtn.className = actualIsFav
            ? "fa-solid fa-heart"
            : "fa-regular fa-heart";
        }
      }

      // If this is the currently playing stream, update EPG heart icon too
      if (
        currentPlayingStream &&
        String(currentPlayingStream.stream_id) === String(stream.stream_id)
      ) {
        updateEPG(stream);
      }

      renderCategories();
    }
  };

  const removeFromHistory = (stream) => {
    const currentPlaylistName = JSON.parse(
      localStorage.getItem("selectedPlaylist")
    ).playlistName;
    const playlistsData = JSON.parse(localStorage.getItem("playlistsData"));
    const currentPlaylistIndex = playlistsData.findIndex(
      (pl) => pl.playlistName === currentPlaylistName
    );

    if (currentPlaylistIndex !== -1) {
      playlistsData[currentPlaylistIndex].ChannelListLive = (
        playlistsData[currentPlaylistIndex].ChannelListLive || []
      ).filter((ch) => String(ch.stream_id) !== String(stream.stream_id));

      localStorage.setItem("playlistsData", JSON.stringify(playlistsData));
    }

    channelChunk = 1;
    renderChannels();
    renderCategories();

    if (channelIndex >= filteredStreams.length) {
      channelIndex = Math.max(0, filteredStreams.length - 1);
    }
    buttonFocusIndex = -1;
    updateFocus();
  };

  const updateFocus = () => {
    if (localStorage.getItem("navigationFocus") === "navbar") {
      document
        .querySelectorAll(".lp-focused")
        .forEach((el) => el.classList.remove("lp-focused"));
      document
        .querySelectorAll(".lp-control-focused")
        .forEach((el) => el.classList.remove("lp-control-focused"));
      return;
    }

    document
      .querySelectorAll(".lp-focused")
      .forEach((el) => el.classList.remove("lp-focused"));

    // Globally remove control focus
    document
      .querySelectorAll(".lp-control-focused")
      .forEach((el) => el.classList.remove("lp-control-focused"));

    // Globally hide play/pause icon if not in player section
    const playPauseIcon =
      document.querySelector(".play-pause-icon") ||
      document.getElementById("live-play-pause-btn");

    if (playPauseIcon && focusedSection !== "player") {
      playPauseIcon.style.display = "none";
    }

    // Blur all inputs when not in search sections
    if (
      focusedSection !== "sidebarSearch" &&
      focusedSection !== "channelSearch"
    ) {
      const catInput = document.getElementById("lp-cat-search-input");
      const chanInput = document.getElementById("lp-chan-search-input");
      if (catInput) catInput.blur();
      if (chanInput) chanInput.blur();
    }

    if (focusedSection === "epg") {
      const epgList = document.getElementById("lp-epg-list");
      const headerFavBtn = document.getElementById("lp-epg-fav-btn");

      if (epgIndex === -1) {
        if (headerFavBtn) headerFavBtn.classList.add("lp-focused");
      } else {
        const items = document.querySelectorAll(".lp-epg-item");
        if (items[epgIndex]) {
          items[epgIndex].classList.add("lp-focused");
          items[epgIndex].scrollIntoView({
            block: "nearest",
          });
        }
      }
    } else if (focusedSection === "sidebar") {
      const items = document.querySelectorAll(".lp-category-item");
      if (items[sidebarIndex]) {
        items[sidebarIndex].classList.add("lp-focused");
        items[sidebarIndex].scrollIntoView({
          block: "nearest",
        });

        // Conditional Marquee for Category
        const name = items[sidebarIndex].querySelector(".lp-category-name");
        if (name) {
          name.classList.remove("marquee-active");
          if (name.scrollWidth > name.clientWidth) {
            name.classList.add("marquee-active");
          }
        }
      }
    } else if (focusedSection === "sidebarSearch") {
      const box = document.getElementById("lp-cat-search-box");
      if (box) {
        box.classList.add("lp-focused");
        // Don't auto-focus the input, only add the border class
      }
    } else if (focusedSection === "player") {
      const player = document.getElementById("lp-player-container");
      if (player) {
        player.classList.add("lp-player-active"); // Keep controls visible
        player.classList.add("lp-focused"); // Always show border when player section is active

        if (playPauseIcon) {
          // Only show if we are in the player section
          // Logic: If playerSubFocus is 0 (wrapper) or 1 (button), show it.
          if (playerSubFocus === 0 || playerSubFocus === 1) {
            // In fullscreen, don't force it to flex here, let the toggle logic handle it
            if (!document.fullscreenElement) {
              playPauseIcon.style.display = "flex";
            }
          } else {
            playPauseIcon.style.display = "none";
          }
        }

        if (playerSubFocus === 1) {
          if (playPauseIcon) playPauseIcon.classList.add("lp-control-focused");
        } else if (playerSubFocus === 2) {
          const btn =
            document.querySelector(".videojs-aspect-ratio-div") ||
            document.querySelector(".flow-aspect-ratio-div");
          if (btn) btn.classList.add("lp-control-focused");
        }
      }
      document.activeElement.blur();
    } else if (focusedSection === "channelSearch") {
      const box = document.getElementById("lp-chan-search-box");
      if (box) {
        box.classList.add("lp-focused");
        // Don't auto-focus the input, only add the border class
      }
    } else if (focusedSection === "channels") {
      const items = document.querySelectorAll(".lp-channel-card");
      if (items[channelIndex]) {
        items[channelIndex].classList.add("lp-focused");
        items[channelIndex].scrollIntoView({
          block: "nearest",
        });

        // Conditional Marquee for Channel
        const name = items[channelIndex].querySelector(".lp-channel-name");
        if (name) {
          name.classList.remove("marquee-active");
          if (name.scrollWidth > name.clientWidth) {
            name.classList.add("marquee-active");
          }
        }

        // Handle button focus
        if (buttonFocusIndex >= 0) {
          const buttons = items[channelIndex].querySelectorAll(
            ".lp-channel-fav-btn, .lp-channel-remove-btn"
          );
          if (buttons[buttonFocusIndex]) {
            buttons[buttonFocusIndex].classList.add("lp-focused");
          }
        }
      }
    }
  };

  const playChannel = (stream) => {
    if (!stream) {
      // Stop Player Logic
      const videoWrapper = document.querySelector(".lp-video-wrapper");
      if (videoWrapper) {
        if (
          typeof LiveVideoJsComponent !== "undefined" &&
          typeof LiveVideoJsComponent.cleanup === "function"
        ) {
          try {
            LiveVideoJsComponent.cleanup();
          } catch (err) {}
        }

        if (window.livePlayer) {
          try {
            window.livePlayer.dispose();
          } catch (e) {}
          window.livePlayer = null;
        }

        videoWrapper.innerHTML = `
          <div style="width:100%; height:100%; background:black; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#666;">
            <i class="fas fa-play-circle" style="font-size: 50px; margin-bottom:10px;"></i>
            <p>Select a channel to play</p>
          </div>
        `;
      }

      // Reset EPG
      const epgList = document.getElementById("lp-epg-list");
      if (epgList) {
        epgList.innerHTML = `
          <div style="padding:20px; text-align:center; color:#aaa; zoom:1.3;">
            Select a channel to view program information
          </div>
        `;
      }
      const epgHeader = document.querySelector(".lp-epg-header");
      if (epgHeader) {
        epgHeader.innerHTML = `<span>Program Guide</span>`;
      }

      currentPlayingStream = null;

      document.querySelectorAll(".lp-channel-card").forEach((c) => {
        c.classList.remove("lp-channel-card-playing");
      });
      return;
    }

    // Show loading indicator
    const videoWrapper = document.querySelector(".lp-video-wrapper");
    if (videoWrapper) {
      videoWrapper.innerHTML = `
        <div style="width:100%; height:100%; background:black; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#fff;">
          <i class="fas fa-spinner fa-spin" style="font-size: 50px; margin-bottom:10px;"></i>
          <p>Loading channel...</p>
        </div>
      `;
    }

    try {
      const currentPlaylistData = JSON.parse(
        localStorage.getItem("currentPlaylistData")
      );
      const playlistLiveExtension = JSON.parse(
        localStorage.getItem("selectedPlaylist")
      );

      if (!currentPlaylistData || !playlistLiveExtension) {
        console.error("Missing playlist data");
        return;
      }

      const liveVideoUrl = `${
        currentPlaylistData.server_info.server_protocol
      }://${currentPlaylistData.server_info.url}:${
        currentPlaylistData.server_info.port
      }/live/${currentPlaylistData.user_info.username}/${
        currentPlaylistData.user_info.password
      }/${stream.stream_id}.${playlistLiveExtension.streamFormat || "m3u8"}`;

      const videoWrapper = document.querySelector(".lp-video-wrapper");
      if (!videoWrapper) return;

      const videoEl = videoWrapper.querySelector("video");
      const currentStreamId = videoEl ? videoEl.dataset.streamId : null;

      if (currentStreamId !== String(stream.stream_id)) {
        if (typeof LiveVideoJsComponent.cleanup === "function") {
          try {
            LiveVideoJsComponent.cleanup();
          } catch (err) {}
        }

        if (window.livePlayer) {
          try {
            window.livePlayer.dispose();
          } catch (e) {}
          window.livePlayer = null;
        }

        const currentPlaylist = getCurrentPlaylist();
        const isTs =
          (currentPlaylist.streamFormat
            ? currentPlaylist.streamFormat
            : ""
          ).toLowerCase() === "ts";

        if (isTs && typeof FlowLivePlayerComponent === "function") {
          videoWrapper.innerHTML = FlowLivePlayerComponent(
            stream.stream_id,
            liveVideoUrl,
            stream.stream_icon,
            "100%",
            stream.name || ""
          );
        } else if (typeof LiveVideoJsComponent === "function") {
          videoWrapper.innerHTML = LiveVideoJsComponent(
            stream.stream_id,
            liveVideoUrl,
            stream.stream_icon,
            "100%",
            stream.name || ""
          );
        } else {
          videoWrapper.innerHTML = `<video src="${liveVideoUrl}" controls autoplay style="width:100%; height:100%;" data-stream-id="${stream.stream_id}"></video>`;
        }
      } else {
        if (window.livePlayer && typeof window.livePlayer.play === "function") {
          window.livePlayer.play();
        }
      }

      document.querySelectorAll(".lp-channel-card").forEach((c) => {
        c.classList.remove("lp-channel-card-playing");
      });

      const playingCard = document.querySelector(
        `.lp-channel-card[data-stream-id="${stream.stream_id}"]`
      );
      if (playingCard) {
        playingCard.classList.add("lp-channel-card-playing");
      }

      if (selectedCategoryId !== "channelHistory" && window.addItemToHistory) {
        window.addItemToHistory(stream, "ChannelListLive");
        setTimeout(() => {
          renderCategories();
        }, 100);
      }

      updateEPG(stream);
    } catch (error) {
      console.error("Error playing channel:", error);
    }
  };

  const updateEPG = (stream) => {
    currentPlayingStream = stream;
    const epgList = document.getElementById("lp-epg-list");
    const epgHeader = document.querySelector(".lp-epg-header");

    if (!epgList || !epgHeader) return;

    // Render Header immediately
    const currentPlaylistObj = getCurrentPlaylist();
    const playlistUsername = currentPlaylistObj
      ? currentPlaylistObj.playlistName
      : null;
    const isFav = window.isItemFavoriteForPlaylist
      ? window.isItemFavoriteForPlaylist(
          stream,
          "favoritesLiveTV",
          playlistUsername
        )
      : false;

    // Only show heart if favorite, and NOT as a button/focusable
    const heartIcon = isFav
      ? `<i class="fa-solid fa-heart" style="color:#ff4444; margin-left: 10px;"></i>`
      : "";

    epgHeader.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                <img src="${stream.stream_icon || "assets/main-logo.png"}" 
                     style="border-radius: 4px; object-fit: cover;" 
                     onerror="this.src='assets/main-logo.png'">
            </div>
            <div>


            
            ${heartIcon}
        </div>
            </div>
    `;

    epgList.innerHTML = `
      <div style="padding:20px; text-align:center; color:#aaa;">
        <i class="fas fa-spinner fa-spin"></i> Loading EPG...
      </div>
    `;

    if (window.getLiveStreamEpg) {
      window
        .getLiveStreamEpg(stream.stream_id)
        .then((data) => {
          currentEpgData = data && data.epg_listings ? data.epg_listings : [];
          renderEPGList();
        })
        .catch((err) => {
          console.error("EPG Fetch Error", err);
          currentEpgData = [];
          renderEPGList();
        });
    } else {
      currentEpgData = [];
      renderEPGList();
    }
  };

  const decodeBase64 = (str) => {
    try {
      return decodeURIComponent(escape(window.atob(str)));
    } catch (e) {
      return str;
    }
  };

  const togglePlayPauseGlobal = () => {
    if (!window.livePlayer) return;

    // Toggle Play/Pause
    if (typeof window.livePlayer.togglePlayPause === "function") {
      window.livePlayer.togglePlayPause();
    } else {
      // Video.js instance
      if (window.livePlayer.paused()) {
        window.livePlayer.play();
      } else {
        window.livePlayer.pause();
      }
    }

    // Handle Icon Visibility
    const icon =
      document.querySelector(".play-pause-icon") ||
      document.getElementById("live-play-pause-btn");

    if (icon) {
      icon.style.display = "flex";

      // Clear existing timeout if any
      if (icon._hideTimeout) clearTimeout(icon._hideTimeout);

      // Set new timeout to hide after 3 seconds
      icon._hideTimeout = setTimeout(() => {
        if (document.fullscreenElement) {
          icon.style.display = "none";
        }
      }, 3000);
    }
  };

  const formatTime = (dateStr, format) => {
    let date;
    if (!isNaN(dateStr)) {
      const ts = dateStr.toString().length === 10 ? dateStr * 1000 : dateStr;
      date = new Date(parseInt(ts));
    } else {
      date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return "";

    const options =
      format === "12hrs"
        ? {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        : {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          };
    return new Intl.DateTimeFormat(undefined, options).format(date);
  };

  const renderEPGList = () => {
    const epgList = document.getElementById("lp-epg-list");
    if (!epgList) return;

    if (!currentEpgData || currentEpgData.length === 0) {
      epgList.innerHTML = `
            <div style="padding:20px; text-align:center; color:#666;">
                No Program Information Available
            </div>
          `;
      return;
    }

    // Get Time Format
    const currentPlaylist = getCurrentPlaylist();
    const timeFormatSetting =
      currentPlaylist && currentPlaylist.timeFormat
        ? currentPlaylist.timeFormat
        : "12hrs";

    epgList.innerHTML = currentEpgData
      .map((prog, idx) => {
        let timeDisplay = "";
        if (prog.start && prog.end) {
          const startStr = formatTime(
            prog.start_timestamp || prog.start,
            timeFormatSetting
          );
          const endStr = formatTime(
            prog.stop_timestamp || prog.end,
            timeFormatSetting
          );
          if (startStr && endStr) {
            timeDisplay = `${startStr} - ${endStr}`;
          } else {
            timeDisplay = "Upcoming";
          }
        }

        const title = prog.title ? decodeBase64(prog.title) : "No Title";
        const description = prog.description
          ? decodeBase64(prog.description)
          : prog.descr || "";

        return `
            <div class="lp-epg-item" data-index="${idx}">
                <div class="lp-epg-time" style="font-size:14px; color:white; margin-bottom:4px;">${timeDisplay}</div>
                <div class="lp-epg-title" style="font-size:16px; font-weight:bold; margin-bottom:2px;">${title}</div>
            </div>
          `;
      })
      .join("");
  };

  const isVideoPlaceholderVisible = () => {
    const videoWrapper = document.querySelector(".lp-video-wrapper");
    if (!videoWrapper) return false;
    // Check if the placeholder text exists
    return videoWrapper.innerText.includes("Select a channel to play");
  };

  const handleFullscreenChange = () => {
    const playerContainer = document.getElementById("lp-player-container");
    if (!playerContainer) return;

    const playPauseIcon =
      document.querySelector(".play-pause-icon") ||
      document.getElementById("live-play-pause-btn");

    // Clear auto-hide timer when fullscreen state changes
    if (playPauseIcon && playPauseIcon._hideTimeout) {
      clearTimeout(playPauseIcon._hideTimeout);
      playPauseIcon._hideTimeout = null;
    }

    if (document.fullscreenElement) {
      // Entering fullscreen - hide border and play/pause icon initially
      playerContainer.classList.remove("lp-focused");
      playerContainer.classList.remove("lp-player-active");
      if (playPauseIcon) {
        playPauseIcon.style.display = "none";
      }
    } else {
      // Exiting fullscreen - show play/pause icon with focus
      playerContainer.classList.add("lp-focused");
      playerContainer.classList.add("lp-player-active");

      // Always show play/pause icon when exiting fullscreen
      if (playPauseIcon) {
        playPauseIcon.style.display = "flex";
        playPauseIcon.classList.add("lp-control-focused");
      }

      // Set focus to play/pause button
      focusedSection = "player";
      playerSubFocus = 1;
      updateFocus();
    }
  };

  const handleSortChange = (e) => {
    if (e.detail.page === "liveTvPage") {
      currentSortOption = e.detail.sortType;
      channelChunk = 1;
      renderChannels();
    }
  };

  const handleKeydown = (e) => {
    // Check if sidebar is open
    const sidebar = document.getElementById("sidebar");
    if (sidebar && !sidebar.classList.contains("option-remove")) {
      return; // Let Navbar handle the event
    }

    // Only process keydown events if navigationFocus is on this page
    const navigationFocus = localStorage.getItem("navigationFocus");
    const currentPage = localStorage.getItem("currentPage");

    if (currentPage !== "liveTvPage" || !document.body.contains(container)) {
      return;
    }

    if (
      navigationFocus !== "liveTvPage" &&
      navigationFocus !== "sidebarSearch" &&
      navigationFocus !== "channelSearch"
    ) {
      return; // Don't process keydown events until user navigates into the page
    }

    // Handle Fullscreen Exit
    if (
      ["Escape", "Back", "BrowserBack", "XF86Back", "SoftLeft"].includes(e.key)
    ) {
      if (document.fullscreenElement) {
        e.preventDefault();
        e.stopImmediatePropagation();
        document.exitFullscreen().catch((err) => {
          console.error("Error attempting to exit fullscreen:", err);
        });
        return;
      }
    }

    // If in fullscreen, allow Enter to toggle play/pause and show icon
    if (document.fullscreenElement && e.key === "Enter") {
      e.preventDefault();
      const playPauseIcon =
        document.querySelector(".play-pause-icon") ||
        document.getElementById("live-play-pause-btn");

      // Show the icon first
      if (playPauseIcon) {
        playPauseIcon.style.display = "flex";
      }

      // Then toggle play/pause (which will handle auto-hide)
      togglePlayPauseGlobal();
      return;
    }

    // Handle Enter key to focus search inputs
    if (focusedSection === "sidebarSearch" && e.key === "Enter") {
      const catInput = document.getElementById("lp-cat-search-input");
      if (catInput) {
        catInput.focus();
        e.preventDefault();
        return;
      }
    }

    if (focusedSection === "channelSearch" && e.key === "Enter") {
      const chanInput = document.getElementById("lp-chan-search-input");
      if (chanInput) {
        chanInput.focus();
        e.preventDefault();
        return;
      }
    }

    // Prevent default for navigation keys
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
        e.key
      )
    ) {
      e.preventDefault();
      // CRITICAL: Stop propagation for Enter to prevent it from triggering click events
      if (e.key === "Enter") {
        e.stopImmediatePropagation();
      }
    }

    switch (e.key) {
      case "ArrowUp":
        navigateUp();
        break;
      case "ArrowDown":
        if (focusedSection === "player" && playerSubFocus === 1) {
          // From Play/Pause directly to Channel Search (skip aspect ratio)
          focusedSection = "channelSearch";
          playerSubFocus = 0;
        } else {
          navigateDown();
        }
        break;
      case "ArrowLeft":
        if (focusedSection === "player" && playerSubFocus === 1) {
          // From Play/Pause back to Video Border
          focusedSection = "player";
          playerSubFocus = 0; // Back to video border
        } else {
          navigateLeft();
        }
        break;
      case "ArrowRight":
        if (focusedSection === "player") {
          // Only go to EPG if there is data
          if (currentEpgData && currentEpgData.length > 0) {
            focusedSection = "epg";
            epgIndex = 0; // Focus first item directly
          }
        } else {
          navigateRight();
        }
        break;
      case "Enter":
        handleEnter();
        break;
    }
    updateFocus();
  };

  const navigateUp = () => {
    if (focusedSection === "sidebar") {
      if (sidebarIndex > 0) {
        sidebarIndex--;
      } else {
        focusedSection = "sidebarSearch";
        updateFocus();
      }
    } else if (focusedSection === "sidebarSearch") {
      // Navigate up to Navbar
      localStorage.setItem("navigationFocus", "navbar");
      const navItem = document.querySelector(
        '.nav-item[data-page="liveTvPage"]'
      );
      if (navItem) navItem.focus();
      const catInput = document.getElementById("lp-cat-search-input");
      if (catInput) catInput.blur();
    } else if (focusedSection === "player") {
      if (playerSubFocus === 1) {
        // From Play/Pause to Video Border
        playerSubFocus = 0;
      } else if (playerSubFocus === 0) {
        // From Video Border to Navbar
        localStorage.setItem("navigationFocus", "navbar");
        const navItem = document.querySelector(
          '.nav-item[data-page="liveTvPage"]'
        );
        if (navItem) navItem.focus();
      }
    } else if (focusedSection === "channelSearch") {
      // From Channel Search to Video Player Border
      focusedSection = "player";
      playerSubFocus = 0;
    } else if (focusedSection === "channels") {
      if (buttonFocusIndex >= 0) {
        buttonFocusIndex = -1;
        return;
      }

      if (channelIndex >= 4) {
        channelIndex -= 4;
      } else {
        focusedSection = "channelSearch";
      }
    } else if (focusedSection === "epg") {
      if (epgIndex > 0) {
        epgIndex--;
      } else if (epgIndex === 0) {
        // From first EPG item to Navbar
        localStorage.setItem("navigationFocus", "navbar");
        const navItem = document.querySelector(
          '.nav-item[data-page="liveTvPage"]'
        );
        if (navItem) navItem.focus();
      }
    }
  };

  const navigateDown = () => {
    if (focusedSection === "sidebarSearch") {
      focusedSection = "sidebar";
      sidebarIndex = 0;
    } else if (focusedSection === "sidebar") {
      const allCats = getAllFilteredCategories();
      const loadedCats = getFilteredCategories();

      if (sidebarIndex < loadedCats.length - 1) {
        sidebarIndex++;
      } else if (loadedCats.length < allCats.length) {
        // Load more categories
        categoryChunk++;
        renderCategories();
        sidebarIndex++;
      }
    } else if (focusedSection === "player") {
      if (playerSubFocus === 0) {
        // Check if video is playing
        const videoWrapper = document.querySelector(".lp-video-wrapper");
        const hasVideo =
          videoWrapper &&
          !videoWrapper.innerText.includes("Select a channel to play");

        if (hasVideo) {
          // Video is playing - go to Play/Pause button
          playerSubFocus = 1;
        } else {
          // No video - go to Channel Search
          focusedSection = "channelSearch";
          playerSubFocus = 0;
        }
      } else if (playerSubFocus === 1) {
        // From Play/Pause to Channel Search
        focusedSection = "channelSearch";
        playerSubFocus = 0;
      }
    } else if (focusedSection === "epg") {
      if (currentEpgData && epgIndex < currentEpgData.length - 1) {
        epgIndex++;
      } else if (epgIndex === currentEpgData.length - 1) {
        // From last EPG item to Channel Search
        focusedSection = "channelSearch";
        epgIndex = -1;
      }
    } else if (focusedSection === "channelSearch") {
      focusedSection = "channels";
      channelIndex = 0;
      buttonFocusIndex = -1;
    } else if (focusedSection === "channels") {
      const currentCard =
        document.querySelectorAll(".lp-channel-card")[channelIndex];
      if (currentCard) {
        const buttons = currentCard.querySelectorAll(
          ".lp-channel-fav-btn, .lp-channel-remove-btn"
        );

        if (buttonFocusIndex === -1 && buttons.length > 0) {
          buttonFocusIndex = 0;
        } else if (buttonFocusIndex >= 0) {
          buttonFocusIndex = -1;
          if (channelIndex + 4 < filteredStreams.length) {
            const loadedCount = channelChunk * channelPageSize;
            if (
              channelIndex + 4 >= loadedCount &&
              loadedCount < filteredStreams.length
            ) {
              // Load more channels
              channelChunk++;
              renderChannels();
            }
            channelIndex += 4;
          }
        }
      }
    }
  };

  const navigateLeft = () => {
    if (focusedSection === "epg") {
      // From EPG to Video Player
      focusedSection = "player";
      playerSubFocus = 0;
      epgIndex = -1;
    } else if (focusedSection === "player") {
      // From Video Player to Category List
      focusedSection = "sidebar";
      if (sidebarIndex === -1) sidebarIndex = 0;
    } else if (focusedSection === "channelSearch") {
      focusedSection = "sidebar";
    } else if (focusedSection === "channels") {
      if (buttonFocusIndex > 0) {
        buttonFocusIndex--;
      } else if (buttonFocusIndex === 0) {
        buttonFocusIndex = -1;
      } else if (channelIndex % 4 === 0) {
        focusedSection = "sidebar";
        if (sidebarIndex === -1) sidebarIndex = 0;
      } else {
        channelIndex--;
      }
    }
  };

  const navigateRight = () => {
    if (focusedSection === "sidebar" || focusedSection === "sidebarSearch") {
      // From Category to Video Player or Channel List
      const videoWrapper = document.querySelector(".lp-video-wrapper");
      const hasVideo =
        videoWrapper &&
        !videoWrapper.innerText.includes("Select a channel to play");

      if (hasVideo) {
        focusedSection = "player";
        playerSubFocus = 0;
      } else {
        // No video - check if channels are available
        if (filteredStreams && filteredStreams.length > 0) {
          // Go to first channel
          focusedSection = "channels";
          channelIndex = 0;
          buttonFocusIndex = -1;
        }
        // If no channels available, stay on sidebar
      }
    } else if (focusedSection === "player") {
      // From Video Player to EPG
      if (currentEpgData && currentEpgData.length > 0) {
        focusedSection = "epg";
        epgIndex = 0; // Focus first item directly
      }
    } else if (focusedSection === "channels") {
      const currentCard =
        document.querySelectorAll(".lp-channel-card")[channelIndex];
      if (currentCard) {
        const buttons = currentCard.querySelectorAll(
          ".lp-channel-fav-btn, .lp-channel-remove-btn"
        );

        if (buttonFocusIndex === -1 && buttons.length > 0) {
          buttonFocusIndex = 0;
        } else if (
          buttonFocusIndex >= 0 &&
          buttonFocusIndex < buttons.length - 1
        ) {
          buttonFocusIndex++;
        } else if (buttonFocusIndex >= buttons.length - 1) {
          // Only move to next channel if available
          if (channelIndex < filteredStreams.length - 1) {
            buttonFocusIndex = -1;
            channelIndex++;
          }
          // If no next channel, stay on the last button (do nothing)
        }
      }
    }
  };

  const handleEnter = () => {
    if (focusedSection === "sidebar") {
      const cats = getFilteredCategories();

      // CRITICAL FIX: Ensure sidebarIndex is in valid range
      if (sidebarIndex < 0 || sidebarIndex >= cats.length) {
        console.warn(`Invalid sidebarIndex: ${sidebarIndex}, resetting to 0`);
        sidebarIndex = 0;
      }

      if (cats[sidebarIndex]) {
        const newCategoryId = cats[sidebarIndex].category_id;
        console.log(`Category selected: ${newCategoryId}`);

        // Only update if we're actually changing categories
        if (String(selectedCategoryId) !== String(newCategoryId)) {
          selectedCategoryId = newCategoryId;
          channelChunk = 1; // Reset pagination
          channelIndex = 0; // Reset channel focus
          channelChunk = 1; // Reset pagination
          channelIndex = 0; // Reset channel focus
          buttonFocusIndex = -1;

          // Render categories and channels with the new selection
          renderCategories(); // Update visual selection
          renderChannels(); // Update channel list

          // Stop any playing channel
          playChannel("");
        }

        // Always ensure focus stays on sidebar and the selected category
        // renderCategories() will update sidebarIndex to match selectedCategoryId
        updateFocus();
      }
    } else if (focusedSection === "player") {
      // Toggle fullscreen on Enter ONLY if border is focused
      const playerContainer = document.getElementById("lp-player-container");
      if (playerContainer) {
        if (playerSubFocus === 0) {
          // Video Border focused - Toggle Fullscreen
          if (!document.fullscreenElement) {
            playerContainer.requestFullscreen().catch((err) => {
              console.error("Error attempting to enable fullscreen:", err);
            });
          } else {
            document.exitFullscreen();
          }
        } else if (playerSubFocus === 1) {
          // Play/Pause focused - Click it
          const btn =
            document.querySelector(".play-pause-icon") ||
            document.getElementById("live-play-pause-btn");
          if (btn) btn.click();
        } else if (playerSubFocus === 2) {
          // Aspect Ratio focused - Click it
          const btn =
            document.querySelector(".videojs-aspect-ratio-div") ||
            document.querySelector(".flow-aspect-ratio-div");
          if (btn) btn.click();
        }
      }
    } else if (focusedSection === "channels") {
      const stream = filteredStreams[channelIndex];
      if (!stream) return;

      if (buttonFocusIndex === 0) {
        // Heart button - show toaster
        toggleFavorite(stream, true);
      } else if (buttonFocusIndex === 1) {
        // Remove button
        removeFromHistory(stream);
      } else {
        // Check for adult content lock before playing
        const category = (window.liveCategories || []).find(
          (c) => c.category_id === stream.category_id
        );
        const isAdultChannel = category
          ? isLiveAdultCategory(category.category_name)
          : false;
        const currentPlaylistForParental = getCurrentPlaylist();
        const parentalEnabled =
          currentPlaylistForParental &&
          !!currentPlaylistForParental.parentalPassword;

        // Determine if channel is unlocked
        let isChannelUnlocked = true;
        let unlockSet = null;

        if (isAdultChannel && parentalEnabled) {
          if (selectedCategoryId === "All") {
            isChannelUnlocked = unlockedLiveAdultChannelsInAll.has(
              String(stream.stream_id)
            );
            unlockSet = unlockedLiveAdultChannelsInAll;
          } else if (selectedCategoryId === "favorites") {
            isChannelUnlocked = unlockedLiveAdultChannelsInFavorites.has(
              String(stream.stream_id)
            );
            unlockSet = unlockedLiveAdultChannelsInFavorites;
          } else if (selectedCategoryId === "channelHistory") {
            isChannelUnlocked = unlockedLiveAdultChannelsInHistory.has(
              String(stream.stream_id)
            );
            unlockSet = unlockedLiveAdultChannelsInHistory;
          } else {
            isChannelUnlocked = unlockedLiveAdultCatIds.has(
              String(selectedCategoryId)
            );
            unlockSet = null;
          }
        }

        if (
          isAdultChannel &&
          parentalEnabled &&
          !isChannelUnlocked &&
          unlockSet
        ) {
          // Show parental PIN dialog
          ParentalPinDialog(
            () => {
              // PIN correct - unlock and play
              unlockSet.add(String(stream.stream_id));
              const card = document.querySelector(
                `.lp-channel-card[data-stream-id="${stream.stream_id}"]`
              );
              if (card) {
                const logoContainer = card.querySelector(
                  ".lp-channel-logo-container"
                );
                if (logoContainer) {
                  logoContainer.classList.remove("lp-channel-card-locked");
                }
                const lockIcon = card.querySelector(".lp-channel-lock-icon");
                if (lockIcon) lockIcon.remove();
              }
              playChannel(stream);
            },
            () => {
              // PIN incorrect - do nothing
              console.log("Parental PIN incorrect");
            },
            currentPlaylistForParental,
            "liveTvPage"
          );
          return;
        }

        // Play channel if not locked or already unlocked
        playChannel(stream);
      }
    }
  };

  const setupClickListeners = () => {
    const categoryList = document.getElementById("lp-category-list");
    if (categoryList) {
      categoryList.addEventListener("click", (e) => {
        const item = e.target.closest(".lp-category-item");
        if (item) {
          const index = parseInt(item.dataset.index, 10);
          if (!isNaN(index)) {
            localStorage.setItem("navigationFocus", "liveTvPage");
            focusedSection = "sidebar";

            const cats = getFilteredCategories();
            if (cats[index]) {
              selectedCategoryId = cats[index].category_id;
              channelChunk = 1;
              channelIndex = 0;
              buttonFocusIndex = -1;

              // Render categories and channels with the new selection
              renderCategories();
              renderChannels();

              // Stop any playing channel
              playChannel("");

              // Update focus - renderCategories() will have set sidebarIndex correctly
              updateFocus();
            }
          }
        }
      });
    }

    const channelGrid = document.getElementById("lp-channels-grid");
    if (channelGrid) {
      channelGrid.addEventListener("click", (e) => {
        const card = e.target.closest(".lp-channel-card");
        if (card) {
          localStorage.setItem("navigationFocus", "liveTvPage");
          const index = parseInt(card.dataset.index, 10);
          if (!isNaN(index)) {
            focusedSection = "channels";
            channelIndex = index;
            updateFocus();

            const favBtn = e.target.closest(".lp-channel-fav-btn");
            const removeBtn = e.target.closest(".lp-channel-remove-btn");

            const stream = filteredStreams[channelIndex];
            if (stream) {
              if (favBtn) {
                e.stopPropagation();
                toggleFavorite(stream, true);
              } else if (removeBtn) {
                e.stopPropagation();
                removeFromHistory(stream);
              } else {
                // Check for adult content lock before playing
                const category = (window.liveCategories || []).find(
                  (c) => c.category_id === stream.category_id
                );
                const isAdultChannel = category
                  ? isLiveAdultCategory(category.category_name)
                  : false;
                const currentPlaylistForParental = getCurrentPlaylist();
                const parentalEnabled =
                  currentPlaylistForParental &&
                  !!currentPlaylistForParental.parentalPassword;

                // Determine if channel is unlocked
                let isChannelUnlocked = true;
                let unlockSet = null;

                if (isAdultChannel && parentalEnabled) {
                  if (selectedCategoryId === "All") {
                    isChannelUnlocked = unlockedLiveAdultChannelsInAll.has(
                      String(stream.stream_id)
                    );
                    unlockSet = unlockedLiveAdultChannelsInAll;
                  } else if (selectedCategoryId === "favorites") {
                    isChannelUnlocked =
                      unlockedLiveAdultChannelsInFavorites.has(
                        String(stream.stream_id)
                      );
                    unlockSet = unlockedLiveAdultChannelsInFavorites;
                  } else if (selectedCategoryId === "channelHistory") {
                    isChannelUnlocked = unlockedLiveAdultChannelsInHistory.has(
                      String(stream.stream_id)
                    );
                    unlockSet = unlockedLiveAdultChannelsInHistory;
                  } else {
                    isChannelUnlocked = unlockedLiveAdultCatIds.has(
                      String(selectedCategoryId)
                    );
                    unlockSet = null;
                  }
                }

                if (
                  isAdultChannel &&
                  parentalEnabled &&
                  !isChannelUnlocked &&
                  unlockSet
                ) {
                  // Show parental PIN dialog
                  ParentalPinDialog(
                    () => {
                      // PIN correct - unlock and play
                      unlockSet.add(String(stream.stream_id));
                      const card = document.querySelector(
                        `.lp-channel-card[data-stream-id="${stream.stream_id}"]`
                      );
                      if (card) {
                        const logoContainer = card.querySelector(
                          ".lp-channel-logo-container"
                        );
                        if (logoContainer) {
                          logoContainer.classList.remove(
                            "lp-channel-card-locked"
                          );
                        }
                        const lockIcon = card.querySelector(
                          ".lp-channel-lock-icon"
                        );
                        if (lockIcon) lockIcon.remove();
                      }
                      playChannel(stream);
                    },
                    () => {
                      // PIN incorrect - do nothing
                      console.log("Parental PIN incorrect");
                    },
                    currentPlaylistForParental,
                    "liveTvPage"
                  );
                  return;
                }

                // Play channel if not locked or already unlocked
                playChannel(stream);
              }
            }
          }
        }
      });
    }
  };

  const setupInputListeners = () => {
    const catInput = document.getElementById("lp-cat-search-input");
    if (catInput) {
      catInput.addEventListener("input", (e) => {
        categorySearchQuery = e.target.value;
        categoryChunk = 1;
        sidebarIndex = 0; // Reset focus to top when searching
        renderCategories();
      });
      catInput.addEventListener("focus", () => {
        localStorage.setItem("navigationFocus", "liveTvPage");
        focusedSection = "sidebarSearch";
        updateFocus();
      });
    }

    const chanInput = document.getElementById("lp-chan-search-input");
    if (chanInput) {
      chanInput.addEventListener("input", (e) => {
        channelSearchQuery = e.target.value;
        channelChunk = 1;
        renderChannels();
      });
      chanInput.addEventListener("focus", () => {
        localStorage.setItem("navigationFocus", "liveTvPage");
        focusedSection = "channelSearch";
        updateFocus();
      });
    }
  };

  const setupScrollListener = () => {
    const grid = document.getElementById("lp-channels-grid");
    if (!grid) return;

    grid.removeEventListener("scroll", handleScroll);
    grid.addEventListener("scroll", handleScroll);
  };

  const handleScroll = () => {
    const grid = document.getElementById("lp-channels-grid");
    if (!grid) return;

    const scrollPosition = grid.scrollTop + grid.clientHeight;
    const scrollHeight = grid.scrollHeight;

    if (scrollPosition >= scrollHeight - 100) {
      const loadedChannels = channelChunk * channelPageSize;
      if (loadedChannels < filteredStreams.length) {
        channelChunk++;
        renderChannels();
      }
    }
  };

  return `<div class="lp-main-container"></div>`;
}
