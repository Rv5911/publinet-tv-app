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
  let playerButtonFocusIndex = -1; // -1 = none, 0 = play/pause, 1 = aspect ratio

  // Search State
  let categorySearchQuery = "";
  let channelSearchQuery = "";

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
    updateFocus();
  };

  const cleanup = () => {
    document.removeEventListener("keydown", handleKeydown);

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
          <div class="lp-channel-name">${stream.name}</div>
          <div class="lp-program-info">Entertainment</div>
          <div class="lp-progress-bar">
            <div class="lp-progress-fill" style="width: ${
              Math.random() * 100
            }%"></div>
          </div>
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
      `;

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  };

  const toggleFavorite = (stream) => {
    if (!window.toggleFavoriteItem) return;

    const result = window.toggleFavoriteItem(stream, "favoritesLiveTV");

    if (window.Toaster && window.Toaster.showToast) {
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
    document
      .querySelectorAll(".lp-focused")
      .forEach((el) => el.classList.remove("lp-focused"));

    if (focusedSection === "sidebar") {
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
      if (player) player.classList.add("lp-focused");
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
    const epgList = document.getElementById("lp-epg-list");
    if (!epgList) return;

    epgList.innerHTML = `
      <div style="padding:20px;">
        <div style="margin-bottom:15px;">
          <strong style="color:var(--lp-accent);">Now Playing</strong>
          <p style="margin:5px 0; font-size:14px;">${stream.name}</p>
        </div>
        <div style="margin-bottom:15px;">
          <strong style="color:var(--lp-text-primary);">Program</strong>
          <p style="margin:5px 0; font-size:13px; color:var(--lp-text-secondary);">Live Entertainment</p>
        </div>
        <div>
          <p style="font-size:12px; color:#666;">EPG data not available</p>
        </div>
      </div>
    `;
  };

  const handleKeydown = (e) => {
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
        navigateLeft();
        break;
      case "ArrowRight":
        navigateRight();
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
      }
    } else if (focusedSection === "channelSearch") {
      focusedSection = "player";
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
      focusedSection = "channelSearch";
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
    if (focusedSection === "player") {
      focusedSection = "sidebar";
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
      focusedSection = "player";
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
        channelIndex = 0;
        buttonFocusIndex = -1;
      }
    } else if (focusedSection === "channels") {
      const stream = filteredStreams[channelIndex];
      if (!stream) return;

      if (buttonFocusIndex === 0) {
        // Heart button
        toggleFavorite(stream);
      } else if (buttonFocusIndex === 1) {
        // Remove button
        removeFromHistory(stream);
      } else {
        // Play channel
        playChannel(stream);
        // focusedSection = "player";
        // buttonFocusIndex = -1;
      }
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
    }

    const chanInput = document.getElementById("lp-chan-search-input");
    if (chanInput) {
      chanInput.addEventListener("input", (e) => {
        channelSearchQuery = e.target.value;
        channelChunk = 1;
        renderChannels();
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
