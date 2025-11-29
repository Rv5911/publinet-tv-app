function LivePage() {
  let categories = window.liveCategories || [];
  let allStreams = window.allLiveStreams || [];
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
  const currentPlaylist = getCurrentPlaylist();
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
    init();
  }, 0);

  const init = () => {
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
  };

  const cleanup = () => {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("sortChanged", handleSortChange);

    // Remove fullscreen event listeners
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
  };

  LivePage.cleanup = cleanup;

  const getFilteredCategories = () => {
    let cats = [
      { category_id: "All", category_name: "All Channels" },
      { category_id: "favorites", category_name: "Favorite Channels" },
      { category_id: "channelHistory", category_name: "Channels History" },
    ];

    if (categories) {
      cats = [...cats, ...categories];
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
      { category_id: "All", category_name: "All Channels" },
      { category_id: "favorites", category_name: "Favorite Channels" },
      { category_id: "channelHistory", category_name: "Channels History" },
    ];

    if (categories) {
      cats = [...cats, ...categories];
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
      streams = allStreams;
    } else if (selectedCategoryId === "favorites") {
      const currentPlaylist = getCurrentPlaylist();
      streams = currentPlaylist ? currentPlaylist.favoritesLiveTV || [] : [];
    } else if (selectedCategoryId === "channelHistory") {
      const currentPlaylist = getCurrentPlaylist();
      streams = currentPlaylist ? currentPlaylist.ChannelListLive || [] : [];
    } else {
      streams = allStreams.filter((s) => s.category_id === selectedCategoryId);
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
    if (catId === "All") return allStreams.length;
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
    return allStreams.filter((s) => s.category_id === catId).length;
  };

  const render = () => {
    container.innerHTML = `
      <div class="lp-sidebar">
        <div class="lp-search-box" id="lp-cat-search-box">
          <i class="fas fa-search" style="color: #aaa; margin-right: 10px;"></i>
          <input type="text" class="lp-search-input" id="lp-cat-search-input" placeholder="Search Categories" value="${categorySearchQuery}">
        </div>
        <ul class="lp-category-list" id="lp-category-list"></ul>
      </div>
      <div class="lp-content">
        <div class="lp-top-section">
          <div class="lp-player-container" id="lp-player-container">
            <div class="lp-video-wrapper">
              <div style="width:100%; height:100%; background:black; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#666;">
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
              <i class="fas fa-search" style="color: #aaa; margin-right: 10px;"></i>
              <input type="text" class="lp-channel-search-input" id="lp-chan-search-input" placeholder="Search Channels" value="${channelSearchQuery}">
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
    }, 100);
  };

  const renderCategories = () => {
    const list = document.getElementById("lp-category-list");
    if (!list) return;

    const cats = getFilteredCategories();
    list.innerHTML = cats
      .map(
        (cat, idx) => `
        <li class="lp-category-item ${
          selectedCategoryId === cat.category_id ? "lp-selected" : ""
        }" data-id="${cat.category_id}" data-index="${idx}">
          <span class="lp-category-name">${cat.category_name}</span>
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

    if (filteredStreams.length === 0) {
      grid.innerHTML =
        '<div style="padding:20px; color:#aaa;">No channels found</div>';
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
      const isFav = window.isItemFavoriteForPlaylist
        ? window.isItemFavoriteForPlaylist(stream, "favoritesLiveTV")
        : false;
      const isHistory = selectedCategoryId === "channelHistory";

      // Detect adult channels
      const category = categories.find(
        (c) => c.category_id === stream.category_id
      );
      const isAdultChannel = category
        ? isLiveAdultCategory(category.category_name)
        : false;
      const parentalEnabled =
        currentPlaylist && !!currentPlaylist.parentalPassword;

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


          <div class="lp-channel-name">${stream.name}</div>
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
          <div class="lp-program-info">Entertainment</div>
          <div class="lp-progress-bar">
            <div class="lp-progress-fill" style="width: ${
              Math.random() * 100
            }%"></div>
          </div>
        </div>
       
      `;

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  };

  const toggleFavorite = (stream, showToast = true) => {
    if (!window.toggleFavoriteItem) return;

    const result = window.toggleFavoriteItem(stream, "favoritesLiveTV");

    // Only show toaster if explicitly requested
    if (showToast && window.Toaster && window.Toaster.showToast) {
      window.Toaster.showToast(
        result.isFav ? "success" : "error",
        result.isFav ? "Added to favorites" : "Removed from favorites"
      );
    }

    if (selectedCategoryId === "favorites" && !result.isFav) {
      channelChunk = 1;
      renderChannels();
      renderCategories();
      if (channelIndex >= filteredStreams.length) {
        channelIndex = Math.max(0, filteredStreams.length - 1);
      }
      buttonFocusIndex = -1;
      updateFocus();
    } else {
      const card = document.querySelector(
        `.lp-channel-card[data-stream-id="${stream.stream_id}"]`
      );
      if (card) {
        const favBtn = card.querySelector(".lp-channel-fav-btn i");
        if (favBtn) {
          favBtn.className = result.isFav
            ? "fa-solid fa-heart"
            : "fa-regular fa-heart";
        }
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
      return;
    }

    document
      .querySelectorAll(".lp-focused")
      .forEach((el) => el.classList.remove("lp-focused"));

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
          items[epgIndex].scrollIntoView({ block: "nearest" });
        }
      }
    } else if (focusedSection === "sidebar") {
      const items = document.querySelectorAll(".lp-category-item");
      if (items[sidebarIndex]) {
        items[sidebarIndex].classList.add("lp-focused");
        items[sidebarIndex].scrollIntoView({ block: "nearest" });
      }
    } else if (focusedSection === "sidebarSearch") {
      const box = document.getElementById("lp-cat-search-box");
      if (box) {
        box.classList.add("lp-focused");
        const input = document.getElementById("lp-cat-search-input");
        if (input) input.focus();
      }
    } else if (focusedSection === "player") {
      const player = document.getElementById("lp-player-container");
      if (player) {
        player.classList.add("lp-player-active"); // Keep controls visible

        // Remove specific focus classes first
        player.classList.remove("lp-focused");
        document
          .querySelectorAll(".lp-control-focused")
          .forEach((el) => el.classList.remove("lp-control-focused"));

        if (playerSubFocus === 0) {
          player.classList.add("lp-focused"); // Show border
        } else if (playerSubFocus === 1) {
          const btn =
            document.querySelector(".play-pause-icon") ||
            document.getElementById("live-play-pause-btn");
          if (btn) btn.classList.add("lp-control-focused");
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
        const input = document.getElementById("lp-chan-search-input");
        if (input) input.focus();
      }
    } else if (focusedSection === "channels") {
      const items = document.querySelectorAll(".lp-channel-card");
      if (items[channelIndex]) {
        items[channelIndex].classList.add("lp-focused");
        items[channelIndex].scrollIntoView({ block: "nearest" });

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
    if (!stream) return;

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
    const isFav = window.isItemFavoriteForPlaylist
      ? window.isItemFavoriteForPlaylist(stream, "favoritesLiveTV")
      : false;

    epgHeader.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-size: 16px;">${stream.name}</span>
            <button id="lp-epg-fav-btn" class="lp-epg-fav-btn">
                <i class="${
                  isFav ? "fa-solid" : "fa-regular"
                } fa-heart" style="color:${isFav ? "#ff4444" : "inherit"}"></i>
            </button>
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
        ? { hour: "numeric", minute: "2-digit", hour12: true }
        : { hour: "2-digit", minute: "2-digit", hour12: false };
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
                <div class="lp-epg-time" style="font-size:12px; color:#fdbd0f; margin-bottom:4px;">${timeDisplay}</div>
                <div class="lp-epg-title" style="font-size:14px; font-weight:bold; margin-bottom:2px;">${title}</div>
                <div class="lp-epg-desc" style="font-size:12px; color:#aaa;">${description}</div>
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

    if (document.fullscreenElement) {
      // Entering fullscreen - remove border
      playerContainer.style.border = "none";
    } else {
      // Exiting fullscreen - restore border
      playerContainer.style.border = "3px solid transparent";
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
    if (
      navigationFocus !== "liveTvPage" &&
      navigationFocus !== "sidebarSearch" &&
      navigationFocus !== "channelSearch"
    ) {
      return; // Don't process keydown events until user navigates into the page
    }

    if (localStorage.getItem("currentPage") === "liveTvPage") {
      // Fullscreen isolation logic
      if (document.fullscreenElement) {
        // Allow Enter for play/pause/controls
        if (e.key === "Enter") {
          // Let it pass through to handleEnter or default behavior
        } else {
          // Block all other keys (Arrow keys, etc.)
          e.stopPropagation();
          return;
        }
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "ArrowUp":
          navigateUp();
          break;
        case "ArrowDown":
          navigateDown();
          break;
        case "ArrowLeft":
          if (focusedSection === "epg") {
            focusedSection = "player";
            playerSubFocus = 0; // Back to video border
          } else {
            navigateLeft();
          }
          break;
        case "ArrowRight":
          if (focusedSection === "player") {
            focusedSection = "epg";
            epgIndex = -1; // Focus header first
          } else {
            navigateRight();
          }
          break;
        case "Enter":
          if (focusedSection === "epg" && epgIndex === -1) {
            // Toggle Favorite
            if (currentPlayingStream) {
              toggleFavorite(currentPlayingStream);
              // Re-render header to update icon
              const isFav = window.isItemFavoriteForPlaylist
                ? window.isItemFavoriteForPlaylist(
                    currentPlayingStream,
                    "favoritesLiveTV"
                  )
                : false;
              const icon = document.querySelector("#lp-epg-fav-btn i");
              if (icon) {
                icon.className = isFav
                  ? "fa-solid fa-heart"
                  : "fa-regular fa-heart";
                icon.style.color = isFav ? "#ff4444" : "inherit";
              }
            }
          } else {
            handleEnter();
          }
          break;
      }
      updateFocus();
    }
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
      } else if (epgIndex === -1) {
        // From EPG header to Navbar
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
      if (epgIndex === -1) {
        // From EPG header to first item
        if (currentEpgData && currentEpgData.length > 0) {
          epgIndex = 0;
        }
      } else if (currentEpgData && epgIndex < currentEpgData.length - 1) {
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
      if (buttonFocusIndex >= 0) {
        buttonFocusIndex = -1;
        return;
      }

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
        // No video - go to first channel
        focusedSection = "channels";
        channelIndex = 0;
        buttonFocusIndex = -1;
      }
    } else if (focusedSection === "player") {
      // From Video Player to EPG
      focusedSection = "epg";
      epgIndex = -1; // Focus header first
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
          buttonFocusIndex = -1;
          if (channelIndex < filteredStreams.length - 1) {
            channelIndex++;
          }
        }
      }
    }
  };

  const handleEnter = () => {
    if (focusedSection === "sidebar") {
      const cats = getFilteredCategories();
      if (cats[sidebarIndex]) {
        selectedCategoryId = cats[sidebarIndex].category_id;
        channelChunk = 1;
        renderCategories();
        renderChannels();
        playChannel("");
        channelIndex = 0;
        buttonFocusIndex = -1;
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
        // Play channel
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
            sidebarIndex = index;
            updateFocus();

            const cats = getFilteredCategories();
            if (cats[sidebarIndex]) {
              selectedCategoryId = cats[sidebarIndex].category_id;
              channelChunk = 1;
              renderCategories();
              renderChannels();
              playChannel("");
              channelIndex = 0;
              buttonFocusIndex = -1;
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
                toggleFavorite(stream, true);
              } else if (removeBtn) {
                removeFromHistory(stream);
              } else {
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
