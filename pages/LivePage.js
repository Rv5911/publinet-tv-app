function LivePage() {
    let categories = window.liveCategories || [];
    let allStreams = window.allLiveStreams || [];
    let filteredStreams = [];
    let selectedCategoryId = "All";

    // Navigation State
    let focusedSection = "sidebar";
    let sidebarIndex = 0;
    let channelIndex = 0;
    let epgIndex = 0;

    // Search State
    let categorySearchQuery = "";
    let channelSearchQuery = "";

    // Chunking State for Memory Optimization
    let channelChunk = 1;
    const channelPageSize = 20;

    // DOM Elements References
    let container;

    // Get current playlist data
    const getCurrentPlaylist = () => {
        try {
            const currentPlaylistName = JSON.parse(localStorage.getItem("selectedPlaylist") || "{}").playlistName;
            const playlistsData = JSON.parse(localStorage.getItem("playlistsData") || "[]");
            return playlistsData.find(pl => pl.playlistName === currentPlaylistName);
        } catch (e) {
            return null;
        }
    };

    // Initialize
    setTimeout(() => {
        init();
    }, 0);

    const init = () => {
        container = document.querySelector(".lp-main-container");
        if (!container) return;

        // Initial Render
        render();

        // Setup Event Listeners
        document.addEventListener("keydown", handleKeydown);

        // Initial Focus
        updateFocus();
    };

    const cleanup = () => {
        document.removeEventListener("keydown", handleKeydown);

        // Remove fullscreen event listeners
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);

        // Remove scroll listener
        const grid = document.getElementById("lp-channels-grid");
        if (grid) {
            grid.removeEventListener('scroll', handleScroll);
        }

        // Dispose player if exists
        if (window.livePlayer) {
            try {
                window.livePlayer.dispose();
            } catch (e) {}
            window.livePlayer = null;
        }
    };

    // Attach cleanup to the function object so Router can call it
    LivePage.cleanup = cleanup;

    const getFilteredCategories = () => {
        let cats = [];

        // Static/Special Categories
        cats.push({
            category_id: "All",
            category_name: "All Channels"
        });
        cats.push({
            category_id: "favorites",
            category_name: "Favorite Channels"
        });
        cats.push({
            category_id: "channelHistory",
            category_name: "Channels History"
        });

        // Dynamic Categories
        if (categories) {
            cats = [...cats, ...categories];
        }

        if (categorySearchQuery) {
            cats = cats.filter(c => c.category_name.toLowerCase().includes(categorySearchQuery.toLowerCase()));
        }
        return cats;
    };

    const getFilteredChannels = () => {
        let streams = [];

        if (selectedCategoryId === "All") {
            streams = allStreams;
        } else if (selectedCategoryId === "favorites") {
            try {
                const currentPlaylist = getCurrentPlaylist();
                streams = currentPlaylist ? (currentPlaylist.favoritesLiveTV || []) : [];
            } catch (e) {
                streams = [];
            }
        } else if (selectedCategoryId === "channelHistory") {
            try {
                const currentPlaylist = getCurrentPlaylist();
                streams = currentPlaylist ? (currentPlaylist.ChannelListLive || []) : [];
            } catch (e) {
                streams = [];
            }
        } else {
            streams = allStreams.filter(s => s.category_id === selectedCategoryId);
        }

        if (channelSearchQuery) {
            streams = streams.filter(s => (s.name || "").toLowerCase().includes(channelSearchQuery.toLowerCase()));
        }

        return streams;
    };

    const getCategoryCount = (catId) => {
        if (catId === "All") return allStreams.length;
        if (catId === "favorites") {
            try {
                const currentPlaylist = getCurrentPlaylist();
                return currentPlaylist && currentPlaylist.favoritesLiveTV ? currentPlaylist.favoritesLiveTV.length : 0;
            } catch (e) {
                return 0;
            }
        }
        if (catId === "channelHistory") {
            try {
                const currentPlaylist = getCurrentPlaylist();
                return currentPlaylist && currentPlaylist.ChannelListLive ? currentPlaylist.ChannelListLive.length : 0;
            } catch (e) {
                return 0;
            }
        }
        return allStreams.filter(s => s.category_id === catId).length;
    };

    const render = () => {
        container.innerHTML = `
            <div class="lp-sidebar">
                <div class="lp-search-box" id="lp-cat-search-box">
                    <i class="fas fa-search" style="color: #aaa; margin-right: 10px;"></i>
                    <input type="text" class="lp-search-input" id="lp-cat-search-input" placeholder="Search Categories" value="${categorySearchQuery}">
                </div>
                <ul class="lp-category-list" id="lp-category-list">
                    <!-- Categories injected here -->
                </ul>
            </div>
            <div class="lp-content">
                <div class="lp-top-section">
                    <div class="lp-player-container" id="lp-player-container">
                        <div class="lp-video-wrapper">
                            <!-- Player injected here -->
                            <div style="width:100%; height:100%; background:black; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#666;">
                                <i class="fas fa-play-circle" style="font-size: 50px; margin-bottom:10px;"></i>
                                <p>Select a channel to play</p>
                            </div>
                        </div>
                    </div>
                    <div class="lp-epg-container" id="lp-epg-container">
                        <div class="lp-epg-header">
                            <span>Program Guide</span>
                        </div>
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
                    <div class="lp-channels-grid" id="lp-channels-grid">
                        <!-- Channels injected here -->
                    </div>
                </div>
            </div>
        `;

        renderCategories();
        renderChannels();

        // Setup input event listeners
        setTimeout(() => {
            setupInputListeners();
        }, 100);
    };

    const renderCategories = () => {
        const list = document.getElementById("lp-category-list");
        if (!list) return;

        const cats = getFilteredCategories();
        list.innerHTML = cats.map((cat, idx) => `
            <li class="lp-category-item ${selectedCategoryId === cat.category_id ? 'lp-selected' : ''}" data-id="${cat.category_id}" data-index="${idx}">
                <span class="lp-category-name">${cat.category_name}</span>
                <span class="lp-category-count">${getCategoryCount(cat.category_id)}</span>
            </li>
        `).join("");
    };

    const renderChannels = (isAppend = false) => {
        const grid = document.getElementById("lp-channels-grid");
        if (!grid) return;

        filteredStreams = getFilteredChannels();

        if (filteredStreams.length === 0) {
            grid.innerHTML = '<div style="padding:20px; color:#aaa;">No channels found</div>';
            return;
        }

        // Clear grid if not appending
        if (!isAppend) {
            grid.innerHTML = '';
            channelChunk = 1;
        }

        // Calculate which channels to show (chunking for memory optimization)
        const startIdx = (channelChunk - 1) * channelPageSize;
        const endIdx = Math.min(startIdx + channelPageSize, filteredStreams.length);
        const channelsToRender = filteredStreams.slice(startIdx, endIdx);

        // Render channels
        const fragment = document.createDocumentFragment();
        channelsToRender.forEach((stream, relativeIdx) => {
            const idx = startIdx + relativeIdx;
            const isFav = window.isItemFavoriteForPlaylist ? window.isItemFavoriteForPlaylist(stream, "favoritesLiveTV") : false;
            const isHistory = selectedCategoryId === "channelHistory";

            const card = document.createElement('div');
            card.className = 'lp-channel-card';
            card.dataset.streamId = stream.stream_id;
            card.dataset.index = idx;

            card.innerHTML = `
                <div class="lp-channel-logo-container">
                    <img src="${stream.stream_icon || 'img/logo.png'}" class="lp-channel-logo" onerror="this.src='img/logo.png'">
                </div>
                <div class="lp-channel-info">
                    <div class="lp-channel-name">${stream.name}</div>
                    <div class="lp-program-info">Entertainment</div>
                    <div class="lp-progress-bar">
                        <div class="lp-progress-fill" style="width: ${Math.random() * 100}%"></div>
                    </div>
                </div>
                <div class="lp-channel-buttons">
                    <button class="lp-channel-fav-btn" data-stream-id="${stream.stream_id}">
                        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                    ${isHistory ? `
                    <button class="lp-channel-remove-btn" data-stream-id="${stream.stream_id}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    ` : ''}
                </div>
            `;

            fragment.appendChild(card);
        });

        grid.appendChild(fragment);

        // Attach button event listeners
        attachChannelButtonListeners();

        // Setup scroll listener for lazy loading
        setupScrollListener();
    };

    const attachChannelButtonListeners = () => {
        // Favorite buttons
        document.querySelectorAll(".lp-channel-fav-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const streamId = btn.dataset.streamId;
                const stream = filteredStreams.find(s => s.stream_id == streamId);
                if (stream) toggleFavorite(stream);
            });
        });

        // Remove buttons
        document.querySelectorAll(".lp-channel-remove-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const streamId = btn.dataset.streamId;
                const stream = filteredStreams.find(s => s.stream_id == streamId);
                if (stream) removeFromHistory(stream);
            });
        });
    };

    const toggleFavorite = (stream) => {
        if (!window.toggleFavoriteItem) return;

        const result = window.toggleFavoriteItem(stream, "favoritesLiveTV");

        // Show toast notification
        if (window.Toaster && window.Toaster.showToast) {
            window.Toaster.showToast(
                result.isFav ? "success" : "error",
                result.isFav ? "Added to favorites" : "Removed from favorites"
            );
        }

        // If we're in favorites category and unfavoriting, remove the card
        if (selectedCategoryId === "favorites" && !result.isFav) {
            // Re-render channels to remove the unfavorited one
            renderChannels();
            renderCategories(); // Update counts

            // Adjust focus if needed
            if (channelIndex >= filteredStreams.length) {
                channelIndex = Math.max(0, filteredStreams.length - 1);
            }
            updateFocus();
        } else {
            // Just update the heart icon
            const card = document.querySelector(`.lp-channel-card[data-stream-id="${stream.stream_id}"]`);
            if (card) {
                const favBtn = card.querySelector(".lp-channel-fav-btn i");
                if (favBtn) {
                    favBtn.className = result.isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
                }
            }
            renderCategories(); // Update counts
        }
    };

    const removeFromHistory = (stream) => {
        if (!window.removeFromChannelHistory) return;

        window.removeFromChannelHistory(stream.stream_id);

        // Re-render channels
        renderChannels();
        renderCategories(); // Update counts

        // Adjust focus
        if (channelIndex >= filteredStreams.length) {
            channelIndex = Math.max(0, filteredStreams.length - 1);
        }
        updateFocus();
    };

    const updateFocus = () => {
        // Remove all focus classes
        document.querySelectorAll(".lp-focused").forEach(el => el.classList.remove("lp-focused"));

        if (focusedSection === "sidebar") {
            const items = document.querySelectorAll(".lp-category-item");
            if (items[sidebarIndex]) {
                items[sidebarIndex].classList.add("lp-focused");
                items[sidebarIndex].scrollIntoView({
                    block: "nearest"
                });
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
        } else if (focusedSection === "epg") {
            const items = document.querySelectorAll(".lp-epg-item");
            if (items[epgIndex]) {
                items[epgIndex].classList.add("lp-focused");
                items[epgIndex].scrollIntoView({
                    block: "nearest"
                });
            }
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
                items[channelIndex].scrollIntoView({
                    block: "nearest"
                });
            }
        }
    };

    const playChannel = (stream) => {
        if (!stream) return;

        try {
            const currentPlaylistData = JSON.parse(localStorage.getItem("currentPlaylistData"));
            const playlistLiveExtension = JSON.parse(localStorage.getItem("selectedPlaylist"));

            if (!currentPlaylistData || !playlistLiveExtension) {
                console.error("Missing playlist data");
                return;
            }

            const liveVideoUrl = `${currentPlaylistData.server_info.server_protocol}://${currentPlaylistData.server_info.url}:${currentPlaylistData.server_info.port}/live/${currentPlaylistData.user_info.username}/${currentPlaylistData.user_info.password}/${stream.stream_id}.${playlistLiveExtension.streamFormat || "m3u8"}`;

            const videoWrapper = document.querySelector(".lp-video-wrapper");
            if (!videoWrapper) return;

            // Check if we're switching to a different stream
            const videoEl = videoWrapper.querySelector("video");
            const currentStreamId = videoEl ? videoEl.dataset.streamId : null;

            if (currentStreamId !== String(stream.stream_id)) {
                // Clean up existing player
                if (typeof LiveVideoJsComponent.cleanup === "function") {
                    try {
                        LiveVideoJsComponent.cleanup();
                    } catch (err) {
                        console.warn("LiveVideoJsComponent cleanup error:", err);
                    }
                }

                if (window.livePlayer) {
                    try {
                        window.livePlayer.dispose();
                    } catch (e) {}
                    window.livePlayer = null;
                }

                // Determine player type based on stream format
                const currentPlaylist = getCurrentPlaylist();
                const isTs = (currentPlaylist.streamFormat ? currentPlaylist.streamFormat : "").toLowerCase() === "ts";


                // Render appropriate player
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
                    // Fallback
                    videoWrapper.innerHTML = `<video src="${liveVideoUrl}" controls autoplay style="width:100%; height:100%;" data-stream-id="${stream.stream_id}"></video>`;
                }
            } else {
                // Same stream, just ensure it's playing
                if (window.livePlayer && typeof window.livePlayer.play === "function") {
                    window.livePlayer.play();
                }
            }

            // Update visual states
            document.querySelectorAll(".lp-channel-card").forEach(c => {
                c.classList.remove("lp-channel-card-playing", "lp-channel-card-selected");
            });

            const playingCard = document.querySelector(`.lp-channel-card[data-stream-id="${stream.stream_id}"]`);
            if (playingCard) {
                playingCard.classList.add("lp-channel-card-playing", "lp-channel-card-selected");
            }

            // Add to history (except when already in history category)
            if (selectedCategoryId !== "channelHistory" && window.addItemToHistory) {
                window.addItemToHistory(stream, "ChannelListLive");
                // Update category counts after adding to history
                setTimeout(() => {
                    renderCategories();
                }, 100);
            }

            // Update EPG area with channel info
            updateEPG(stream);

        } catch (error) {
            console.error("Error playing channel:", error);
        }
    };

    const updateEPG = (stream) => {
        const epgList = document.getElementById("lp-epg-list");
        if (!epgList) return;

        // For now, show channel info since we don't have real EPG API
        epgList.innerHTML = `
            <div style="padding:20px;">
                <div style="margin-bottom:15px;">
                    <strong style="color:var(--lp-accent-color);">Now Playing</strong>
                    <p style="margin:5px 0; font-size:14px;">${stream.name}</p>
                </div>
                <div style="margin-bottom:15px;">
                    <strong style="color:var(--lp-text-color);">Program</strong>
                    <p style="margin:5px 0; font-size:13px; color:var(--lp-text-secondary);">Live Entertainment</p>
                </div>
                <div>
                    <p style="font-size:12px; color:#666;">EPG data not available</p>
                </div>
            </div>
        `;
    };

    const handleKeydown = (e) => {
        // Prevent default scrolling for arrows
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
            case "Backspace":
            case "Escape":
                // if (focusedSection === "sidebarSearch" && categorySearchQuery) {
                //     categorySearchQuery = "";
                //     document.getElementById("lp-cat-search-input").value = "";
                //     renderCategories();
                //     return;
                // }
                // if (focusedSection === "channelSearch" && channelSearchQuery) {
                //     channelSearchQuery = "";
                //     document.getElementById("lp-chan-search-input").value = "";
                //     renderChannels();
                //     return;
                // }
                // LivePage.cleanup();
                // Router.showPage("homePage");
                break;
        }
        updateFocus();
    };

    const navigateUp = () => {
        if (focusedSection === "sidebar") {
            if (sidebarIndex > 0) {
                sidebarIndex--;
            } else {
                // Only focus search if not already there
                const searchBox = document.getElementById("lp-cat-search-box");
                if (searchBox && !searchBox.classList.contains("lp-focused")) {
                    focusedSection = "sidebarSearch";
                }
            }
        } else if (focusedSection === "sidebarSearch") {
            // Stay in search when pressing up
            return;
        } else if (focusedSection === "channels") {
            const cols = getGridCols();
            if (channelIndex >= cols) {
                channelIndex -= cols;
            } else {
                // Only focus channel search if not already there
                const searchBox = document.getElementById("lp-chan-search-box");
                if (searchBox && !searchBox.classList.contains("lp-focused")) {
                    focusedSection = "channelSearch";
                }
            }
        } else if (focusedSection === "channelSearch") {
            // Stay in search when pressing up, or move to player
            focusedSection = "player";
        } else if (focusedSection === "player") {
            // Stay on player
            return;
        } else if (focusedSection === "epg") {
            if (epgIndex > 0) {
                epgIndex--;
            } else {
                focusedSection = "player";
            }
        }
    };

    const navigateDown = () => {
        if (focusedSection === "sidebarSearch") {
            focusedSection = "sidebar";
            sidebarIndex = 0;
        } else if (focusedSection === "sidebar") {
            const cats = getFilteredCategories();
            if (sidebarIndex < cats.length - 1) {
                sidebarIndex++;
            }
        } else if (focusedSection === "player") {
            focusedSection = "channelSearch";
        } else if (focusedSection === "epg") {
            focusedSection = "channelSearch";
        } else if (focusedSection === "channelSearch") {
            focusedSection = "channels";
            channelIndex = 0;
        } else if (focusedSection === "channels") {
            const cols = getGridCols();
            const total = filteredStreams.length;

            if (channelIndex + cols < total) {
                channelIndex += cols;
            }
        }
    };

    const navigateLeft = () => {
        if (focusedSection === "player") {
            focusedSection = "sidebar";
        } else if (focusedSection === "epg") {
            focusedSection = "player";
        } else if (focusedSection === "channelSearch") {
            focusedSection = "sidebar";
        } else if (focusedSection === "channels") {
            if (channelIndex % getGridCols() === 0) {
                focusedSection = "sidebar";
            } else {
                channelIndex--;
            }
        }
    };

    const navigateRight = () => {
        if (focusedSection === "sidebar") {
            focusedSection = "player";
        } else if (focusedSection === "sidebarSearch") {
            focusedSection = "player";
        } else if (focusedSection === "player") {
            focusedSection = "epg";
        } else if (focusedSection === "channels") {
            if (channelIndex < filteredStreams.length - 1) {
                channelIndex++;
            }
        }
    };

    const getGridCols = () => {
        const grid = document.getElementById("lp-channels-grid");
        if (!grid) return 1;
        const cardWidth = 215; // 200 + 15 gap
        return Math.floor(grid.clientWidth / cardWidth) || 1;
    };

    const handleEnter = () => {
        if (focusedSection === "sidebar") {
            const cats = getFilteredCategories();
            if (cats[sidebarIndex]) {
                selectedCategoryId = cats[sidebarIndex].category_id;
                channelChunk = 1; // Reset chunk when changing category
                renderCategories();
                renderChannels();
                channelIndex = 0;
            }
        } else if (focusedSection === "sidebarSearch") {
            // Only trigger focus if search box has border (is focused)
            const searchBox = document.getElementById("lp-cat-search-box");
            if (searchBox && searchBox.classList.contains("lp-focused")) {
                // Move to first category
                focusedSection = "sidebar";
                sidebarIndex = 0;
            }
        } else if (focusedSection === "channelSearch") {
            // Only trigger focus if search box has border (is focused)
            const searchBox = document.getElementById("lp-chan-search-box");
            if (searchBox && searchBox.classList.contains("lp-focused")) {
                // Move to first channel
                focusedSection = "channels";
                channelIndex = 0;
            }
        } else if (focusedSection === "channels") {
            const stream = filteredStreams[channelIndex];
            if (stream) {
                playChannel(stream);
                focusedSection = "player";
            }
        } else if (focusedSection === "player") {
            // Toggle fullscreen
            toggleFullscreen();
        }
    };

    const setupInputListeners = () => {
        const catInput = document.getElementById("lp-cat-search-input");
        if (catInput) {
            catInput.addEventListener("input", (e) => {
                categorySearchQuery = e.target.value;
                renderCategories();
            });
        }

        const chanInput = document.getElementById("lp-chan-search-input");
        if (chanInput) {
            chanInput.addEventListener("input", (e) => {
                channelSearchQuery = e.target.value;
                renderChannels();
            });
        }
    };

    const setupScrollListener = () => {
        const grid = document.getElementById("lp-channels-grid");
        if (!grid) return;

        // Remove existing listener if any
        grid.removeEventListener('scroll', handleScroll);
        grid.addEventListener('scroll', handleScroll);
    };

    const handleScroll = () => {
        const grid = document.getElementById("lp-channels-grid");
        if (!grid) return;

        // Check if scrolled near bottom
        const scrollPosition = grid.scrollTop + grid.clientHeight;
        const scrollHeight = grid.scrollHeight;

        if (scrollPosition >= scrollHeight - 100) {
            // Load more channels if available
            const totalChannels = filteredStreams.length;
            const loadedChannels = channelChunk * channelPageSize;

            if (loadedChannels < totalChannels) {
                channelChunk++;
                renderChannels(true); // Append mode
            }
        }
    };

    const toggleFullscreen = () => {
        const playerContainer = document.querySelector('.lp-video-wrapper');
        if (!playerContainer) return;

        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (playerContainer.requestFullscreen) {
                playerContainer.requestFullscreen();
            } else if (playerContainer.webkitRequestFullscreen) {
                playerContainer.webkitRequestFullscreen();
            } else if (playerContainer.msRequestFullscreen) {
                playerContainer.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
        const playerDiv = document.querySelector('.lp-player-container');
        if (!playerDiv) return;

        if (document.fullscreenElement) {
            // In fullscreen - remove border
            playerDiv.style.border = 'none';
        } else {
            // Not in fullscreen - restore border if focused
            if (focusedSection === 'player') {
                playerDiv.style.border = '3px solid var(--lp-focus-border)';
            }
        }
    };

    // Add fullscreen event listener
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return `
        <div class="lp-main-container">
            <!-- Content rendered via JS -->
        </div>
    `;
}