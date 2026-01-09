function LivePage() {
    // Create and show custom live page loader immediately
    const liveLoader = document.createElement("div");
    liveLoader.id = "live-page-loader";
    liveLoader.innerHTML = `
    <div class="live-loader-content">
      <div class="live-loader-spinner"></div>
    </div>
  `;
    document.body.appendChild(liveLoader);

    let filteredStreams = [];
    let selectedCategoryId = "All";

    // Navigation State
    let focusedSection = "player"; // Start with player focused
    let sidebarIndex = 0;
    let channelIndex = 0;
    let buttonFocusIndex = -1; // -1 = no button focused, 0 = heart, 1 = remove
    let playerSubFocus = 0; // 0 = Video Border, 1 = Play/Pause, 2 = Aspect Ratio

    let playerVisualFocus = true; // Separate variable to track player visual focus (red border)

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

    // Optimized State Tracking
    let lastCategoryId = null;
    let lastCategoryQuery = "";
    let lastChannelQuery = "";
    let lastSort = "default";
    let cachedCats = null;
    let cachedStreams = null;
    let currentFocusElement = null; // Track focused element for efficiency
    let lastFocusedSection = null;
    let lastEnterTime = 0;
    let lastEnteredChannelId = null;

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
    const unlockedLiveAdultChannelsInCategories = new Set();

    // Adult category detection
    const isLiveAdultCategory = (name) => {
        if (!name) return false;
        const normalized = name.trim().toLowerCase();
        const configured = Array.isArray(window.adultsCategories) ?
            window.adultsCategories.map((k) => String(k).toLowerCase()) :
            [];

        // Exact match against configured keywords
        if (configured.includes(normalized)) return true;

        // Partial match (includes) against configured keywords
        if (configured.some((keyword) => normalized.includes(keyword))) return true;

        // Regexp fallback for common patterns
        return /(adult|xxx|18\+|18\s*plus|sex|porn|nsfw|erotic|nude|xnxx|xvideo|hot|porn)/i.test(
            normalized
        );
    };

    // Initialize
    setTimeout(() => {
        if (window.cleanupLivePage) {
            window.cleanupLivePage();
        }
        init();
    }, 0);

    // Cross-browser fullscreen detection helper
    const checkIsFullscreen = () => {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    };

    const isCategoryAdult = (catId, catName) => {
        if (!catId) return false;

        // Check by name first
        if (isLiveAdultCategory(catName)) return true;

        const currentPlaylist = getCurrentPlaylist();
        const playlistUsername = currentPlaylist ?
            currentPlaylist.playlistName :
            null;

        if (catId === "favorites") {
            const allFavs = window.favoritesLiveTV || [];
            const playlistFavs = allFavs.filter(
                (f) => f.playlistName === playlistUsername
            );
            return playlistFavs.some((fav) => {
                if (isLiveAdultCategory(fav.name)) return true;
                const stream = (window.allLiveStreams || []).find(
                    (s) => String(s.stream_id) === String(fav.stream_id)
                );
                if (!stream) return false;
                if (isLiveAdultCategory(stream.name)) return true;
                const itemCat = (window.liveCategories || []).find(
                    (c) => String(c.category_id) === String(stream.category_id)
                );
                return itemCat ? isLiveAdultCategory(itemCat.category_name) : false;
            });
        }

        if (catId === "All") {
            const hasAdultCat = (window.liveCategories || []).some(
                (c) =>
                isLiveAdultCategory(c.category_name) &&
                getCategoryCount(c.category_id) > 0
            );
            const hasAdultChannelName = (window.allLiveStreams || []).some((s) =>
                isLiveAdultCategory(s.name)
            );
            return hasAdultCat || hasAdultChannelName;
        }

        return false;
    };

    // Add this function after state variables, before cleanup function
    const toggleFullscreen = () => {
        const playerContainer = document.getElementById("lp-player-container");
        if (!playerContainer) return;

        if (!checkIsFullscreen()) {
            // Enter fullscreen
            if (playerContainer.requestFullscreen) {
                playerContainer.requestFullscreen();
            } else if (playerContainer.mozRequestFullScreen) {
                playerContainer.mozRequestFullScreen();
            } else if (playerContainer.webkitRequestFullscreen) {
                playerContainer.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            } else if (playerContainer.msRequestFullscreen) {
                playerContainer.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    const cleanup = () => {
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
        focusedSection = "player"; // Start with player focused
        sidebarIndex = 0;
        channelIndex = 0;
        buttonFocusIndex = -1;
        playerSubFocus = 0;
        playerVisualFocus = true; // Player should have visual focus initially
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

        // Add styles for parental control features
        if (!document.getElementById("lp-parental-styles")) {
            const styles = document.createElement("style");
            styles.id = "lp-parental-styles";
            styles.textContent = `
        .lp-category-locked { position: relative; }
        .lp-category-name-wrapper { position: relative; display: flex; align-items: center; width: 100%; }
        .lp-blur-text { filter: blur(5px); opacity: 0.5; pointer-events: none; transition: filter 0.3s ease; display: inline-block; width: 100%; }
        .lp-cat-lock-icon { 
          position: absolute; 
          left: 50%; top: 50%; 
          transform: translate(-50%, -50%); 
          color: #ffca28; 
          font-size: 1.4em; 
          z-index: 10; 
          text-shadow: 0 0 15px rgba(0,0,0,1), 0 0 5px rgba(0,0,0,1);
          pointer-events: none;
        }
        .lp-adult-warning-banner { 
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(8px);
          border-radius: 8px;
        }
        .lp-warning-content { 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          gap: 20px; 
          color: #ff5252; 
          font-size: 1.4em; 
          font-weight: 600; 
          text-align: center;
          padding: 40px;
          border: 2px solid rgba(255, 82, 82, 0.3);
          border-radius: 12px;
          background: rgba(40, 0, 0, 0.4);
        }
        .lp-warning-content i { font-size: 3em; color: #ffca28; }
        .lp-warning-text { text-transform: uppercase; letter-spacing: 1px; }
      `;
            document.head.appendChild(styles);
        }
    };

    const handleNavigationFocusChange = () => {
        const navFocus = localStorage.getItem("navigationFocus");
        if (navFocus === "sidebarSearch") {
            focusedSection = "sidebarSearch";
            updateFocus();
        }
    };

    const getFilteredCategories = () => {
        // Return cache if parameters haven't changed
        if (cachedCats && categorySearchQuery === lastCategoryQuery) {
            const start = 0;
            const end = categoryChunk * categoryPageSize;
            return cachedCats.slice(start, end);
        }

        let cats = [{
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

        // Update Cache
        cachedCats = cats;
        lastCategoryQuery = categorySearchQuery;

        // Return only the current chunk
        const start = 0;
        const end = categoryChunk * categoryPageSize;
        return cats.slice(start, end);
    };

    const getAllFilteredCategories = () => {
        let cats = [{
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
        // Return cache if parameters haven't changed
        if (
            cachedStreams &&
            selectedCategoryId === lastCategoryId &&
            channelSearchQuery === lastChannelQuery &&
            currentSortOption === lastSort
        ) {
            return cachedStreams;
        }

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

        // Update Cache
        cachedStreams = streams;
        lastCategoryId = selectedCategoryId;
        lastChannelQuery = channelSearchQuery;
        lastSort = currentSortOption;

        return streams;
    };

    const getCategoryCount = (catId) => {
        if (catId === "All") return (window.allLiveStreams || []).length;
        if (catId === "favorites") {
            const currentPlaylist = getCurrentPlaylist();
            return currentPlaylist && currentPlaylist.favoritesLiveTV ?
                currentPlaylist.favoritesLiveTV.length :
                0;
        }
        if (catId === "channelHistory") {
            const currentPlaylist = getCurrentPlaylist();
            return currentPlaylist && currentPlaylist.ChannelListLive ?
                currentPlaylist.ChannelListLive.length :
                0;
        }
        return (window.allLiveStreams || []).filter(
            (s) => String(s.category_id) === String(catId)
        ).length;
    };

    const render = () => {
        // Aggressive DOM Caching: Preserve the structure if it exists
        if (!container.innerHTML.trim()) {
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
                <div style="padding:20px; color:#aaa; text-align:center; zoom:1.4;">
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
            setupInputListeners();
            setupScrollListener();
            setupClickListeners();
        }

        renderCategories();
        renderChannels();

        // Hide the loader quickly
        const loaderElement = document.querySelector("#live-page-loader");
        if (loaderElement) {
            loaderElement.style.animation = "fadeOut 0.2s ease-out";
            setTimeout(() => {
                if (loaderElement && loaderElement.parentNode) {
                    loaderElement.parentNode.removeChild(loaderElement);
                }
            }, 200);
        }
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

        const currentPlaylistForParental = getCurrentPlaylist();
        const parentalEnabled =
            currentPlaylistForParental &&
            !!currentPlaylistForParental.parentalPassword;

        list.innerHTML = cats
            .map((cat, idx) => {
                const isSelected =
                    String(selectedCategoryId) === String(cat.category_id);
                let isAdult = isCategoryAdult(cat.category_id, cat.category_name);

                const isLocked =
                    isAdult &&
                    parentalEnabled &&
                    !unlockedLiveAdultCatIds.has(String(cat.category_id));

                return `
        <li class="lp-category-item ${isSelected ? "lp-selected" : ""} ${
          isLocked ? "lp-category-locked" : ""
        }" data-id="${cat.category_id}" data-index="${idx}">
          <div class="lp-category-name-wrapper">
            <span class="lp-category-name ${isLocked ? "lp-blur-text" : ""}">${
          cat.category_name
        }</span>
            ${isLocked ? '<i class="fas fa-lock lp-cat-lock-icon"></i>' : ""}
          </div>
          <span class="lp-category-count">${getCategoryCount(
            cat.category_id
          )}</span>
        </li>
      `;
            })
            .join("");
    };

    const renderChannels = () => {
        const grid = document.getElementById("lp-channels-grid");
        if (!grid) return;

        filteredStreams = getFilteredChannels();
        console.log(
            `Rendering channels. Category: ${selectedCategoryId}, Count: ${filteredStreams.length}`
        );

        grid.innerHTML = "";

        // Clear existing warning if any
        const existingWarning = document.querySelector(".lp-adult-warning-banner");
        if (existingWarning) existingWarning.remove();

        // Add adult content warning for "All" or "favorites" category if applicable
        if (selectedCategoryId === "All" || selectedCategoryId === "favorites") {
            const currentPlaylistForParental = getCurrentPlaylist();
            const parentalEnabled =
                currentPlaylistForParental &&
                !!currentPlaylistForParental.parentalPassword;

            const cats = getAllFilteredCategories();
            const currentCat = cats.find(
                (c) => String(c.category_id) === String(selectedCategoryId)
            );
            const catName = currentCat ? currentCat.category_name : "";

            if (
                parentalEnabled &&
                isCategoryAdult(selectedCategoryId, catName) &&
                !unlockedLiveAdultCatIds.has(String(selectedCategoryId))
            ) {
                grid.innerHTML = ""; // Don't show channels in background
                const warning = document.createElement("div");
                warning.className = "lp-adult-warning-banner";
                warning.style.cursor = "pointer";
                warning.innerHTML = `
          <div class="lp-warning-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span class="lp-warning-text">Contains Adult Content</span>
            <p style="font-size: 0.6em; margin-top: 10px; color: #aaa; font-weight: normal;">Click to unlock</p>
          </div>
        `;
                warning.onclick = (e) => {
                    e.stopPropagation();
                    ParentalPinDialog(
                        () => {
                            unlockedLiveAdultCatIds.add(String(selectedCategoryId));
                            renderCategories();
                            renderChannels();
                            updateFocus();
                        },
                        () => {
                            console.log("PIN incorrect");
                        },
                        currentPlaylistForParental,
                        "liveTvPage"
                    );
                };
                grid.style.position = "relative";
                grid.appendChild(warning);
                return; // Stop further rendering
            }
        }

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

        const fragment = document.createDocumentFragment();

        channelsToRender.forEach((stream, idx) => {
            const currentPlaylistObj = getCurrentPlaylist();
            const playlistUsername = currentPlaylistObj ?
                currentPlaylistObj.playlistName :
                null;
            const isFav = window.isItemFavoriteForPlaylist ?
                window.isItemFavoriteForPlaylist(
                    stream,
                    "favoritesLiveTV",
                    playlistUsername
                ) :
                false;
            const isHistory = selectedCategoryId === "channelHistory";

            const card = document.createElement("div");
            card.className = "lp-channel-card";
            card.dataset.streamId = stream.stream_id;
            card.dataset.index = idx;

            card.innerHTML = `
        <div class="lp-channel-logo-container">
          <img src="${
            stream.stream_icon || "assets/main-logo.png"
          }" class="lp-channel-logo" onerror="this.src='assets/main-logo.png'">
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
        const isCurrentlyFavorite = window.isItemFavoriteForPlaylist ?
            window.isItemFavoriteForPlaylist(
                stream,
                "favoritesLiveTV",
                playlistUsername
            ) :
            false;

        // Now perform the toggle operation
        const result = window.toggleFavoriteItem(stream, "favoritesLiveTV");

        // Clear data cache on update
        cachedStreams = null;
        cachedCats = null;

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
            const actionMessage = isCurrentlyFavorite ?
                "Removed from favorites" :
                "Added to favorites";
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
                    const updatedPlaylistUsername = updatedPlaylist ?
                        updatedPlaylist.playlistName :
                        null;
                    const actualIsFav = window.isItemFavoriteForPlaylist ?
                        window.isItemFavoriteForPlaylist(
                            stream,
                            "favoritesLiveTV",
                            updatedPlaylistUsername
                        ) :
                        result.isFav;

                    favBtn.className = actualIsFav ?
                        "fa-solid fa-heart" :
                        "fa-regular fa-heart";
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
        window.Toaster.showToast("error", "Removed from Channel History");

        // Clear data cache on update
        cachedStreams = null;
        cachedCats = null;
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
        // Fast class removal helper using live HTMLCollection
        const clearFast = (className) => {
            const elements = document.getElementsByClassName(className);
            while (elements.length > 0) {
                elements[0].classList.remove(className);
            }
        };

        if (localStorage.getItem("navigationFocus") === "navbar") {
            clearFast("lp-focused");
            clearFast("lp-control-focused");

            currentFocusElement = null;

            if (playerVisualFocus) {
                const player = document.getElementById("lp-player-container");
                if (player) player.classList.add("lp-player-permanent-focus");
            }
            return;
        }

        clearFast("lp-focused");
        clearFast("lp-control-focused");
        clearFast("lp-player-permanent-focus");

        const playPauseIcon =
            document.querySelector(".play-pause-icon") ||
            document.getElementById("live-play-pause-btn");

        if (playPauseIcon && focusedSection !== "player") {
            playPauseIcon.style.display = "none";
        }

        const videoWrapper = document.querySelector(".lp-video-wrapper");
        if (videoWrapper) {
            const video = videoWrapper.querySelector("video");
            if (video && video.src && video.src !== "") {
                // Video is loaded, keep it visible
                video.style.display = "block";
                video.style.visibility = "visible";
                video.style.opacity = "1";
            }
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
                if (headerFavBtn && currentFocusElement !== headerFavBtn) {
                    headerFavBtn.classList.add("lp-focused");
                    currentFocusElement = headerFavBtn;
                }
            } else {
                const items = document.getElementsByClassName("lp-epg-item");
                const target = items[epgIndex];
                if (target && currentFocusElement !== target) {
                    target.classList.add("lp-focused");
                    currentFocusElement = target;
                    target.scrollIntoView({
                        block: "nearest",
                    });
                }
            }
        } else if (focusedSection === "sidebar") {
            const items = document.getElementsByClassName("lp-category-item");
            const target = items[sidebarIndex];
            if (target && currentFocusElement !== target) {
                target.classList.add("lp-focused");
                currentFocusElement = target;
                target.scrollIntoView({
                    block: "nearest",
                });

                // Conditional Marquee for Category
                const name = target.querySelector(".lp-category-name");
                if (name) {
                    name.classList.remove("marquee-active");
                    const scrollWidth = name.scrollWidth;
                    const clientWidth = name.clientWidth;
                    if (scrollWidth > clientWidth) {
                        const scrollDist = scrollWidth - clientWidth;
                        name.setAttribute("data-marquee", name.textContent);
                        name.style.setProperty("--scroll-dist", `-${scrollDist}px`);
                        name.style.setProperty("--duration", `${scrollWidth / 150}s`);
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

                const isFullscreen = checkIsFullscreen();

                if (
                    !isFullscreen &&
                    playerSubFocus !== 0 &&
                    playerSubFocus !== 1 &&
                    playerSubFocus !== 2
                ) {
                    player.classList.add("lp-focused");
                } else {
                    player.classList.remove("lp-focused");
                }

                // Check for loader
                const loader = document.querySelector(".live-video-loader");
                const isLoaderVisible = loader && !loader.classList.contains("hidden");

                const playPauseIcon =
                    document.querySelector(".play-pause-icon") ||
                    document.getElementById("live-play-pause-btn");
                const aspectRatioBtn =
                    document.getElementById("videojs-aspect-ratio") ||
                    document.getElementById("flow-aspect-ratio");
                const fullscreenBtn = document.getElementById("lp-fullscreen-btn");

                // Check if video is actually playing
                const videoWrapper = document.querySelector(".lp-video-wrapper");
                const hasVideo =
                    videoWrapper &&
                    !videoWrapper.innerText.includes("Select a channel to play");

                if (isLoaderVisible || !hasVideo) {
                    // Force hide controls if loader is visible or NO video
                    if (playPauseIcon) playPauseIcon.style.display = "none";
                    if (aspectRatioBtn) aspectRatioBtn.style.display = "none";
                    if (fullscreenBtn) fullscreenBtn.style.display = "none";
                } else {
                    // In fullscreen, always show both controls when player is focused
                    if (isFullscreen) {
                        if (playPauseIcon) playPauseIcon.style.display = "flex";
                        if (aspectRatioBtn) aspectRatioBtn.style.display = "block";
                        // Fullscreen button is handled via CSS (hidden in fullscreen)
                    } else {
                        // Non-fullscreen logic
                        if (fullscreenBtn) fullscreenBtn.style.display = "flex"; // Show only if video playing & no loader

                        if (playPauseIcon) {
                            if (playerSubFocus === 1) {
                                playPauseIcon.style.display = "flex";
                            } else {
                                playPauseIcon.style.display = "flex";
                            }
                        }
                    }

                    // Apply focus styling
                    if (playerSubFocus === 1) {
                        if (playPauseIcon)
                            playPauseIcon.classList.add("lp-control-focused");
                        const icon = fullscreenBtn.querySelector(".lp-fullscreen-icon");
                        if (icon) {
                            icon.style.color = "white";
                            icon.style.zoom = "2";
                        }
                    } else if (playerSubFocus === 2) {
                        if (aspectRatioBtn) {
                            aspectRatioBtn.classList.add("lp-control-focused");
                            const icon = fullscreenBtn.querySelector(".lp-fullscreen-icon");
                            if (icon) {
                                icon.style.color = "white";
                                icon.style.zoom = "2";
                            }
                        }
                    } else if (playerSubFocus === 0) {
                        if (fullscreenBtn) {
                            const icon = fullscreenBtn.querySelector(".lp-fullscreen-icon");
                            if (icon) {
                                icon.style.color = "#fdbd0f";
                                icon.style.zoom = "3";
                            }
                        }
                    }

                    // Ensure Aspect Ratio button is visible when player is focused (non-fullscreen)
                    if (!isFullscreen && (playerSubFocus === 1 || playerSubFocus === 2)) {
                        if (aspectRatioBtn) aspectRatioBtn.style.display = "block";
                    }
                }
            }
            document.activeElement.blur();
        } else {
            // STRICT HIDING: If not in player section, hide controls
            const playPauseIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            const aspectRatioBtn =
                document.getElementById("videojs-aspect-ratio") ||
                document.getElementById("flow-aspect-ratio");
            const fullscreenBtn = document.getElementById("lp-fullscreen-btn");

            if (playPauseIcon) playPauseIcon.style.display = "none";
            if (aspectRatioBtn) aspectRatioBtn.style.display = "none";
            if (fullscreenBtn) fullscreenBtn.style.display = "none";
        }

        // INDEPENDENT PLAYER VISUAL FOCUS: Always show RED border if playerVisualFocus is true
        // This ensures the player maintains its RED border even when focusedSection changes
        if (playerVisualFocus) {
            const player = document.getElementById("lp-player-container");
            // CRITICAL: Do NOT show border in fullscreen mode
            const isFullscreen = checkIsFullscreen();

            if (player && !isFullscreen) {
                player.classList.add("lp-player-permanent-focus"); // Red border always visible
            }
        }

        if (focusedSection === "channelSearch") {
            const box = document.getElementById("lp-chan-search-box");
            if (box) {
                box.classList.add("lp-focused");
            }
        } else if (focusedSection === "channels") {
            const items = document.getElementsByClassName("lp-channel-card");
            const target = items[channelIndex];
            if (target) {
                if (currentFocusElement !== target || buttonFocusIndex >= 0) {
                    target.classList.add("lp-focused");
                    currentFocusElement = target;
                    target.scrollIntoView({
                        block: "nearest",
                    });

                    // Conditional Marquee for Channel
                    const name = target.querySelector(".lp-channel-name");
                    if (name) {
                        name.classList.remove("marquee-active");
                        const scrollWidth = name.scrollWidth;
                        const clientWidth = name.clientWidth;
                        if (scrollWidth > clientWidth) {
                            const scrollDist = scrollWidth - clientWidth;
                            name.setAttribute("data-marquee", name.textContent);
                            name.style.setProperty("--scroll-dist", `-${scrollDist}px`);
                            name.style.setProperty("--duration", `${scrollWidth / 150}s`);
                            name.classList.add("marquee-active");
                        }
                    }
                }

                // Handle button focus (always update if focus is on buttons within card)
                if (buttonFocusIndex >= 0) {
                    const buttons = target.querySelectorAll(
                        ".lp-channel-fav-btn, .lp-channel-remove-btn"
                    );
                    const btnTarget = buttons[buttonFocusIndex];
                    if (btnTarget) {
                        btnTarget.classList.add("lp-focused");
                        currentFocusElement = btnTarget; // Buttons are also focus points
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
        if (
            currentPlayingStream &&
            String(currentPlayingStream.stream_id) === String(stream.stream_id)
        ) {
            console.log("Channel already playing, skipping reload");
            return;
        }

        currentPlayingStream = stream; // Set early to prevent multiple reloads

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
                    (currentPlaylist.streamFormat ?
                        currentPlaylist.streamFormat :
                        ""
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
                // Prevent adult channels from being added to history
                const category = (window.liveCategories || []).find(
                    (c) => c.category_id === stream.category_id
                );
                const isAdultChannel =
                    (category && isLiveAdultCategory(category.category_name)) ||
                    isLiveAdultCategory(stream.name);

                if (!isAdultChannel) {
                    window.addItemToHistory(stream, "ChannelListLive");
                    setTimeout(() => {
                        renderCategories();
                    }, 100);
                }
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
        const playlistUsername = currentPlaylistObj ?
            currentPlaylistObj.playlistName :
            null;
        const isFav = window.isItemFavoriteForPlaylist ?
            window.isItemFavoriteForPlaylist(
                stream,
                "favoritesLiveTV",
                playlistUsername
            ) :
            false;

        // Only show heart if favorite, and NOT as a button/focusable
        const heartIcon = isFav ?
            `<i class="fa-solid fa-heart" style="color:#ff4444; margin-left: 10px;"></i>` :
            "";

        epgHeader.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                <img src="${stream.stream_icon || "assets/main-logo.png"}" 
                     style="border-radius: 4px; object-fit: contain;" 
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

    const resetControlsTimer = () => {
        // Show controls
        const playPauseIcon =
            document.querySelector(".play-pause-icon") ||
            document.getElementById("live-play-pause-btn");
        const aspectRatioBtn =
            document.getElementById("videojs-aspect-ratio") ||
            document.getElementById("flow-aspect-ratio");

        if (playPauseIcon) playPauseIcon.style.display = "flex";
        if (aspectRatioBtn) aspectRatioBtn.style.display = "block";

        // Clear existing timeout
        if (window._controlsTimer) clearTimeout(window._controlsTimer);

        // Set new timeout to hide after 3 seconds
        window._controlsTimer = setTimeout(() => {
            if (playPauseIcon) playPauseIcon.style.display = "none";
            if (aspectRatioBtn) aspectRatioBtn.style.display = "none";
        }, 3000);
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

        resetControlsTimer();
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
            format === "12hrs" ?
            {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            } :
            {
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
            currentPlaylist && currentPlaylist.timeFormat ?
            currentPlaylist.timeFormat :
            "12hrs";

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
                const description = prog.description ?
                    decodeBase64(prog.description) :
                    prog.descr || "";

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

        // Cross-browser fullscreen detection
        const isFullscreen = checkIsFullscreen();

        const playPauseIcon =
            document.querySelector(".play-pause-icon") ||
            document.getElementById("live-play-pause-btn");

        // Clear auto-hide timer when fullscreen state changes
        if (playPauseIcon && playPauseIcon._hideTimeout) {
            clearTimeout(playPauseIcon._hideTimeout);
            playPauseIcon._hideTimeout = null;
        }

        if (isFullscreen) {
            // Entering fullscreen - hide border and play/pause icon initially
            playerContainer.classList.add("fullscreen-mode"); // Add fullscreen class
            playerContainer.classList.remove("lp-focused");
            playerContainer.classList.remove("lp-player-active");

            // Only hide if we are not actively focusing a control
            if (playPauseIcon) {
                if (playerSubFocus === 1 || playerSubFocus === 2) {
                    playPauseIcon.style.display = "flex";
                    resetControlsTimer();
                } else {
                    playPauseIcon.style.display = "none";
                }
            }

            // Handle aspect ratio button similarly
            const aspectRatioBtn =
                document.getElementById("videojs-aspect-ratio") ||
                document.getElementById("flow-aspect-ratio");
            if (aspectRatioBtn) {
                if (playerSubFocus === 1 || playerSubFocus === 2) {
                    aspectRatioBtn.style.display = "block";
                } else {
                    aspectRatioBtn.style.display = "none";
                }
            }
        } else {
            // Exiting fullscreen - show border and ensure controls are hidden
            playerContainer.classList.remove("fullscreen-mode"); // Remove fullscreen class
            playerContainer.classList.remove("lp-focused"); // Remove yellow border
            playerContainer.classList.remove("lp-player-active");

            // Ensure aspect ratio buttons are hidden immediately
            const arBtns = document.querySelectorAll(
                ".videojs-aspect-ratio-div, .flow-aspect-ratio-div"
            );
            arBtns.forEach((btn) => (btn.style.display = "none"));

            // Ensure video is visible after exiting fullscreen
            const videoWrapper = document.querySelector(".lp-video-wrapper");
            if (videoWrapper) {
                const video = videoWrapper.querySelector("video");
                if (video) {
                    video.style.display = "block";
                    video.style.visibility = "visible";
                    video.style.opacity = "1";
                    video.style.width = "100%";
                    video.style.height = "100%";
                }
            }

            // Always show play/pause icon when exiting fullscreen
            if (playPauseIcon) {
                playPauseIcon.style.display = "flex";
                // playPauseIcon.classList.add("lp-control-focused"); // Don't force focus here, let logic handle it
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

        // Cross-browser fullscreen detection
        const isFullscreen = checkIsFullscreen();

        // Handle Fullscreen Exit
        if (
            [
                "Escape",
                "Back",
                "BrowserBack",
                "XF86Back",
                "SoftLeft",
                "Backspace",
            ].includes(e.key) ||
            e.keyCode === 10009
        ) {
            if (isFullscreen) {
                e.preventDefault();
                e.stopImmediatePropagation();

                // Cross-browser exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                return;
            }
        }

        // If in fullscreen, allow Enter to toggle play/pause and show icon
        if (isFullscreen && e.key === "Enter") {
            e.preventDefault();
            e.stopImmediatePropagation(); // Ensure it doesn't propagate

            // If focused on Aspect Ratio, click it
            if (playerSubFocus === 2) {
                const btn =
                    document.getElementById("videojs-aspect-ratio") ||
                    document.getElementById("flow-aspect-ratio");
                if (btn) btn.click();
                resetControlsTimer();
                return;
            }

            // Otherwise (Play/Pause focus or general player focus)
            // Toggle play/pause AND Show Controls AND Focus Play/Pause
            const playPauseIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            const aspectRatioBtn =
                document.getElementById("videojs-aspect-ratio") ||
                document.getElementById("flow-aspect-ratio");

            // Show both icons in fullscreen
            if (playPauseIcon) playPauseIcon.style.display = "flex";
            if (aspectRatioBtn) aspectRatioBtn.style.display = "block";

            // Toggle Play/Pause
            togglePlayPauseGlobal();

            // Ensure Play/Pause is focused
            if (playerSubFocus !== 1) {
                playerSubFocus = 1;
                updateFocus();
            }

            resetControlsTimer();
            return;
        }

        // In fullscreen, we let navigate functions handle arrows.
        // IMPORTANT: We do NOT call resetControlsTimer() here for arrows,
        // to prevent waking up the UI on random arrow presses.

        // Handle Enter key to focus search inputs
        if (focusedSection === "sidebarSearch" && e.key === "Enter") {
            const catInput = document.getElementById("lp-cat-search-input");
            if (catInput) {
                catInput.focus({
                    preventScroll: true,
                });
                e.preventDefault();
                return;
            }
        }

        if (focusedSection === "channelSearch" && e.key === "Enter") {
            const chanInput = document.getElementById("lp-chan-search-input");
            if (chanInput) {
                chanInput.focus({
                    preventScroll: true,
                });
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
                navigateDown();
                break;
            case "ArrowLeft":
                if (focusedSection === "player") {
                    // In fullscreen, ArrowLeft ALWAYS switches to previous channel
                    if (checkIsFullscreen()) {
                        if (channelIndex > 0) {
                            channelIndex--;
                            const stream = filteredStreams[channelIndex];
                            if (stream) {
                                playChannel(stream);
                                renderChannels(); // Keep background in sync
                            }
                        } else {
                            if (window.Toaster) {
                                window.Toaster.showToast(
                                    "info",
                                    "No previous channel available"
                                );
                            }
                        }
                    } else {
                        // Not in fullscreen - original behavior
                        navigateLeft();
                    }
                } else {
                    navigateLeft();
                }
                break;
            case "ArrowRight":
                if (focusedSection === "player") {
                    // In fullscreen, ArrowRight ALWAYS switches to next channel
                    if (checkIsFullscreen()) {
                        if (channelIndex < filteredStreams.length - 1) {
                            channelIndex++;
                            const stream = filteredStreams[channelIndex];
                            if (stream) {
                                playChannel(stream);
                                renderChannels(); // Keep background in sync
                            }
                        } else {
                            if (window.Toaster) {
                                window.Toaster.showToast("info", "No next channel available");
                            }
                        }
                    } else {
                        // Not in fullscreen - original behavior
                        if (currentEpgData && currentEpgData.length > 0) {
                            focusedSection = "epg";
                            epgIndex = 0;
                        }
                    }
                } else {
                    navigateRight();
                }
                break;
            case "Enter":
                handleEnter();
                break;
        }

        if (focusedSection === "player" && !checkIsFullscreen()) {
            resetControlsTimer();
        }

        updateFocus();
    };

    const navigateUp = () => {
        // In strict fullscreen mode, if controls are hidden, DO NOT Navigate
        if (focusedSection === "player" && checkIsFullscreen()) {
            const playIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            if (playIcon && playIcon.style.display === "none") return;
            resetControlsTimer(); // If visible and moving, keep them visible
        }
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
            if (playerSubFocus === 2) {
                // From Aspect Ratio to Play/Pause
                playerSubFocus = 1;
            } else if (playerSubFocus === 0) {
                // From Fullscreen (0) to Play/Pause (1)
                playerSubFocus = 1;
            } else if (playerSubFocus === 1) {
                // From Play/Pause (1) to Video Border/Navbar?
                // If we treat 1 as top-most control effectively before navbar:
                if (!checkIsFullscreen()) {
                    localStorage.setItem("navigationFocus", "navbar");
                    const navItem = document.querySelector(
                        '.nav-item[data-page="liveTvPage"]'
                    );
                    if (navItem) navItem.focus();
                }
            }
        } else if (focusedSection === "channelSearch") {
            // From Channel Search
            const videoWrapper = document.querySelector(".lp-video-wrapper");
            const hasVideo =
                videoWrapper &&
                !videoWrapper.innerText.includes("Select a channel to play");

            if (hasVideo && !checkIsFullscreen()) {
                // Go to Fullscreen Button (0)
                focusedSection = "player";
                playerSubFocus = 0;
                return;
            }

            if (!hasVideo) {
                // No video playing - go directly to Navbar
                localStorage.setItem("navigationFocus", "navbar");
                const navItem = document.querySelector(
                    '.nav-item[data-page="liveTvPage"]'
                );
                if (navItem) navItem.focus();
                const chanInput = document.getElementById("lp-chan-search-input");
                if (chanInput) chanInput.blur();
            } else {
                // Video is playing
                focusedSection = "player";
                // If Fullscreen, go to Aspect Ratio, else go to Play/Pause
                // (Skipping Aspect Ratio in non-fullscreen)
                if (checkIsFullscreen()) {
                    playerSubFocus = 2;
                } else {
                    playerSubFocus = 1;
                }
            }
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
        // In strict fullscreen mode, if controls are hidden, DO NOT Navigate
        if (focusedSection === "player" && checkIsFullscreen()) {
            const playIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            if (playIcon && playIcon.style.display === "none") return;
            resetControlsTimer(); // If visible and moving, keep them visible
        }
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
            if (playerSubFocus === 1) {
                // From Play/Pause (1)
                if (checkIsFullscreen()) {
                    // To Aspect Ratio (2)
                    playerSubFocus = 2;
                    resetControlsTimer();
                } else {
                    // To Fullscreen Button (0)
                    playerSubFocus = 0;
                }
            } else if (playerSubFocus === 0) {
                // From Fullscreen Button (0) to Channel Search
                if (!checkIsFullscreen()) {
                    focusedSection = "channelSearch";
                    playerSubFocus = 0; // Reset subfocus for next time we enter player
                }
            } else if (playerSubFocus === 2) {
                // From Aspect Ratio to Channel Search - Only happens in Fullscreen logic effectively
                // But keep safety check
                if (!checkIsFullscreen()) {
                    // Should not happen theoretically if we skip it, but good fallback
                    focusedSection = "channelSearch";
                    playerSubFocus = 0;
                } else {
                    // In fullscreen, stay on aspect ratio and keep controls visible
                    playerSubFocus = 2;
                    resetControlsTimer();
                }
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
        // In strict fullscreen mode, if controls are hidden, DO NOT Navigate
        if (focusedSection === "player" && checkIsFullscreen()) {
            const playIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            if (playIcon && playIcon.style.display === "none") return;
            resetControlsTimer(); // If visible and moving, keep them visible
        }
        if (focusedSection === "epg") {
            // From EPG to Video Player
            focusedSection = "player";
            playerSubFocus = 0;
            epgIndex = -1;
        } else if (focusedSection === "player") {
            // From Video Player to Category List - ONLY IF NOT FULLSCREEN
            if (!checkIsFullscreen()) {
                focusedSection = "sidebar";
                if (sidebarIndex === -1) sidebarIndex = 0;
            } else {
                // In fullscreen, maybe just go back to border focus
                playerSubFocus = 0;
            }
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
        // In strict fullscreen mode, if controls are hidden, DO NOT Navigate
        if (focusedSection === "player" && checkIsFullscreen()) {
            const playIcon =
                document.querySelector(".play-pause-icon") ||
                document.getElementById("live-play-pause-btn");
            if (playIcon && playIcon.style.display === "none") return;
            resetControlsTimer(); // If visible and moving, keep them visible
        }
        if (focusedSection === "sidebar" || focusedSection === "sidebarSearch") {
            // BLOCK navigation to channels if the category is locked
            const cats = getFilteredCategories();
            const currentCat = cats[sidebarIndex];
            if (currentCat) {
                const currentPlaylistForParental = getCurrentPlaylist();
                const parentalEnabled =
                    currentPlaylistForParental &&
                    !!currentPlaylistForParental.parentalPassword;

                let isAdult = isLiveAdultCategory(currentCat.category_name);
                if (
                    currentCat.category_id === "All" ||
                    currentCat.category_id === "favorites"
                ) {
                    // Reuse the logic or check if locked via state
                    const isLocked = !unlockedLiveAdultCatIds.has(
                        String(currentCat.category_id)
                    );
                    // If we don't have isAdult here, we can just check if it's in the locked set or recalculate
                    // For simplicity, let's assume if it matches locking criteria, we block.
                }

                const isLocked =
                    (isLiveAdultCategory(currentCat.category_name) ||
                        (currentCat.category_id === "favorites" &&
                            /* existing check logic */
                            true) ||
                        (currentCat.category_id === "All" && true)) && // This is getting complex, let's check the DOM/State
                    parentalEnabled &&
                    !unlockedLiveAdultCatIds.has(String(currentCat.category_id));

                // More reliable check: does the DOM element have the locked class?
                const sidebarItems = document.querySelectorAll(".lp-category-item");
                const currentEl = sidebarItems[sidebarIndex];
                if (currentEl && currentEl.classList.contains("lp-category-locked")) {
                    window.Toaster.showToast(
                        "error",
                        "Please unlock this category first!"
                    );
                    return;
                }
            }

            // From Category to Video Player or Channel List
            const videoWrapper = document.querySelector(".lp-video-wrapper");
            const hasVideo =
                videoWrapper &&
                !videoWrapper.innerText.includes("Select a channel to play");

            if (hasVideo) {
                focusedSection = "player";
                playerSubFocus = 0; // Go to Fullscreen button first? Or play/pause?
                // User requested 0 = Fullscreen. Let's default to Fullscreen (0) as it's bottom right, close to list?
                // Actually usually Play/Pause (1) is central. Let's go to Play/Pause (1) from side.
                playerSubFocus = 1;
            } else {
                // No video - Always go to Channel Search Input as per user request
                focusedSection = "channelSearch";
                updateFocus();
            }
        } else if (focusedSection === "player") {
            // From Video Player to EPG - ONLY IF NOT FULLSCREEN
            if (!checkIsFullscreen()) {
                if (currentEpgData && currentEpgData.length > 0) {
                    focusedSection = "epg";
                    epgIndex = 0; // Focus first item directly
                }
            } else {
                // In fullscreen, maybe just go back to border focus
                playerSubFocus = 0;
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

            if (sidebarIndex >= 0 && sidebarIndex < cats.length) {
                const cat = cats[sidebarIndex];
                const newCategoryId = cat.category_id;

                // Check if category is adult
                let isAdult = isCategoryAdult(newCategoryId, cat.category_name);
                const currentPlaylistForParental = getCurrentPlaylist();
                const parentalEnabled =
                    currentPlaylistForParental &&
                    !!currentPlaylistForParental.parentalPassword;

                const isLocked =
                    isAdult &&
                    parentalEnabled &&
                    !unlockedLiveAdultCatIds.has(String(newCategoryId));

                if (isLocked) {
                    ParentalPinDialog(
                        () => {
                            unlockedLiveAdultCatIds.add(String(newCategoryId));
                            // Switch category after unlock
                            if (String(selectedCategoryId) !== String(newCategoryId)) {
                                selectedCategoryId = newCategoryId;
                                channelSearchQuery = "";
                                const chanInput = document.getElementById(
                                    "lp-chan-search-input"
                                );
                                if (chanInput) chanInput.value = "";
                                channelChunk = 1;
                                channelIndex = 0;
                                buttonFocusIndex = -1;
                                renderCategories();
                                renderChannels();
                                playChannel("");
                            }
                            updateFocus();
                        },
                        () => {
                            console.log("Parental PIN incorrect for category");
                        },
                        currentPlaylistForParental,
                        "liveTvPage"
                    );
                    return;
                }

                if (String(selectedCategoryId) !== String(newCategoryId)) {
                    selectedCategoryId = newCategoryId;
                    channelSearchQuery = "";
                    const chanInput = document.getElementById("lp-chan-search-input");
                    if (chanInput) chanInput.value = "";
                    channelChunk = 1;
                    channelIndex = 0;
                    buttonFocusIndex = -1;
                    renderCategories();
                    renderChannels();
                    playChannel("");
                }
                updateFocus();
            }
        } else if (focusedSection === "player") {
            const playerContainer = document.getElementById("lp-player-container");
            if (playerContainer) {
                if (playerSubFocus === 0) {
                    toggleFullscreen();
                } else if (playerSubFocus === 1) {
                    const btn =
                        document.querySelector(".play-pause-icon") ||
                        document.getElementById("live-play-pause-btn");
                    if (btn) btn.click();
                } else if (playerSubFocus === 2) {
                    const btn =
                        document.getElementById("videojs-aspect-ratio") ||
                        document.getElementById("flow-aspect-ratio");
                    if (btn) btn.click();
                }
            }
        } else if (focusedSection === "channels") {
            const stream = filteredStreams[channelIndex];
            if (!stream) return;

            if (buttonFocusIndex === 0) {
                toggleFavorite(stream, true);
            } else if (buttonFocusIndex === 1) {
                removeFromHistory(stream);
            } else {
                // Individual channel lock removed as per user request
                handleChannelAction(stream);
            }
        }
    };

    const handleChannelAction = (stream) => {
        const now = Date.now();
        if (
            lastEnteredChannelId === String(stream.stream_id) &&
            now - lastEnterTime < 500
        ) {
            // First ensure it's playing (might already be if user clicked once then again)
            playChannel(stream);

            // Now toggle fullscreen
            toggleFullscreen();

            // Set focus to controls and show them
            focusedSection = "player";
            playerSubFocus = 1; // Play/Pause
            updateFocus();
            resetControlsTimer();

            lastEnterTime = 0;
        } else {
            lastEnterTime = now;
            lastEnteredChannelId = String(stream.stream_id);
            playChannel(stream);
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
                        const cat = cats[index];
                        if (cat) {
                            const newCategoryId = cat.category_id;

                            // Parental Control Check
                            let isAdult = isCategoryAdult(newCategoryId, cat.category_name);
                            const currentPlaylistForParental = getCurrentPlaylist();
                            const parentalEnabled =
                                currentPlaylistForParental &&
                                !!currentPlaylistForParental.parentalPassword;

                            const isLocked =
                                isAdult &&
                                parentalEnabled &&
                                !unlockedLiveAdultCatIds.has(String(newCategoryId));

                            if (isLocked) {
                                ParentalPinDialog(
                                    () => {
                                        unlockedLiveAdultCatIds.add(String(newCategoryId));
                                        if (String(selectedCategoryId) !== String(newCategoryId)) {
                                            selectedCategoryId = newCategoryId;
                                            channelChunk = 1;
                                            channelIndex = 0;
                                            buttonFocusIndex = -1;
                                            renderCategories();
                                            renderChannels();
                                            playChannel("");
                                            updateFocus();
                                        }
                                    },
                                    () => {
                                        console.log("Parental PIN incorrect for category");
                                    },
                                    currentPlaylistForParental,
                                    "liveTvPage"
                                );
                                return;
                            }

                            if (String(selectedCategoryId) !== String(newCategoryId)) {
                                selectedCategoryId = newCategoryId;
                                channelChunk = 1;
                                channelIndex = 0;
                                buttonFocusIndex = -1;
                                renderCategories();
                                renderChannels();
                                playChannel("");
                                updateFocus();
                            }
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
                                const isAdultChannel = category ?
                                    isLiveAdultCategory(category.category_name) :
                                    false;
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
                                        isChannelUnlocked =
                                            unlockedLiveAdultChannelsInCategories.has(
                                                String(stream.stream_id)
                                            );
                                        unlockSet = unlockedLiveAdultChannelsInCategories;
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

                                            // Single channel unlock (All/Favorites/History/Category)
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
                                handleChannelAction(stream);
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