function VideoJsPlayer(poster = "") {
    const srcUrl =
        window.selectedVideoItemUrl ||
        localStorage.getItem("selectedVideoItemUrl") ||
        "";

    let isYouTube = srcUrl.includes("youtube.com") || srcUrl.includes("youtu.be");

    const previousCleanup = VideoJsPlayer.cleanup;
    if (previousCleanup) {
        // Use setTimeout to ensure cleanup happens after current execution
        setTimeout(() => {
            try {
                previousCleanup();
            } catch (err) {
                console.warn("Previous cleanup error:", err);
            }
        }, 0);
    }

    const fromValue = localStorage.getItem("from");
    const playingItemData =
        JSON.parse(localStorage.getItem("playingItemData")) || {};
    const titleText = playingItemData.title || playingItemData.name;

    const currentPlaylistName = JSON.parse(
        localStorage.getItem("selectedPlaylist")
    ).playlistName;

    const getPlaylistsData = () => JSON.parse(localStorage.getItem("playlistsData")) || [];
    const getCurrentPlaylist = () => getPlaylistsData().find((pl) => pl.playlistName === currentPlaylistName) || {};

    const currentPlaylist = getCurrentPlaylist();

    const continueWatchingMoviesData = currentPlaylist.continueWatchingMovies ?
        currentPlaylist.continueWatchingMovies :
        [];
    const continueWatchingSeriesData = currentPlaylist.continueWatchingSeries ?
        currentPlaylist.continueWatchingSeries :
        [];

    const isLive = localStorage.getItem("isLive") === "true";

    let player = null;
    let overlayTimeout;
    let controlsTimer = null; // 🔴 NEW: For 5s auto-hide
    let errorActive = false;
    let currentTimeEl = null;
    let durationEl = null;

    // 🔴 Track focus states
    let isSeekBarFocused = false;
    let isPlayPauseFocused = true;
    let isAspectRatioFocused = false;

    // 🔴 Track if user is actively dragging seek bar
    let isSeekBarDragging = false;

    // 🔴 Track play state before seeking
    let wasPlayingBeforeSeek = false;

    // 🔴 Track if user manually paused
    let userManuallyPaused = false;

    // 🔴 Debouncing variables for seek operations
    let pendingSeekTimeout = null;
    let accumulatedSeekOffset = 0;
    let lastSeekTime = 0;
    let pendingResumeTimeout = null;

    // 🔴 Track if video has started playing for the first time
    let hasStartedPlayingOnce = false;

    // Format time function
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00:00";

        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${mins < 10 ? "0" : ""}${mins}:${
        secs < 10 ? "0" : ""
      }${secs}`;
        } else {
            return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        }
    }

    // 🔴 Debounced seek function to prevent buffer overload on low-RAM devices
    function debouncedSeek(offset) {
        // Clear any pending seek operation
        if (pendingSeekTimeout) {
            clearTimeout(pendingSeekTimeout);
            pendingSeekTimeout = null;
        }

        // Clear any pending resume timeout
        if (pendingResumeTimeout) {
            clearTimeout(pendingResumeTimeout);
            pendingResumeTimeout = null;
        }

        // Accumulate the seek offset
        accumulatedSeekOffset += offset;

        // Store play state before seeking (only once per seek session)
        const isFirstSeek = pendingSeekTimeout === null;
        if (isFirstSeek && player) {
            wasPlayingBeforeSeek = !player.paused;
            if (wasPlayingBeforeSeek && !userManuallyPaused) {
                player.pause();
            }
        }

        // 🔴 IMMEDIATELY update seek bar for smooth visual feedback
        const seekBar = document.getElementById("customSeek");

        // Show loading indicator immediately when seeking starts
        const loadingEl = document.querySelector(".video-buffer-loader");
        if (loadingEl && !errorActive) {
            loadingEl.classList.remove("hidden");
        }

        if (seekBar && player && !isNaN(player.currentTime)) {
            try {
                const currentTime = player.currentTime;
                const duration = player.duration || 0;
                const newTime = Math.max(
                    0,
                    Math.min(duration, currentTime + accumulatedSeekOffset)
                );
                seekBar.value = newTime;

                // Update time display immediately too
                if (currentTimeEl) {
                    currentTimeEl.textContent = formatTime(newTime);
                }

                // Update seek bar background gradient
                const percent = duration > 0 ? (newTime / duration) * 100 : 0;
                let bufferedPercent = 0;
                if (player.buffered && player.buffered.length > 0) {
                    bufferedPercent =
                        (player.buffered.end(player.buffered.length - 1) / duration) *
                        100;
                }
                seekBar.style.background = `linear-gradient(to right,
          var(--gold) 0%, var(--gold) ${percent}%,
          #aaa ${percent}%, #aaa ${bufferedPercent}%,
          #888 ${bufferedPercent}%, #888 100%)`;
            } catch (err) {
                // Ignore errors during immediate update
            }
        }

        // Set a new timeout to execute the seek after 300ms of no input
        pendingSeekTimeout = setTimeout(() => {
            if (!player || isNaN(player.currentTime) || errorActive) {
                accumulatedSeekOffset = 0;
                return;
            }

            try {
                const currentTime = player.currentTime;
                const duration = player.duration || 0;
                const newTime = Math.max(
                    0,
                    Math.min(duration, currentTime + accumulatedSeekOffset)
                );

                // Execute the accumulated seek
                player.currentTime = newTime;

                // Update seek bar
                const seekBar = document.getElementById("customSeek");
                if (seekBar) {
                    seekBar.value = newTime;
                }

                // Show appropriate overlay
                if (accumulatedSeekOffset > 0) {
                    showOverlay("forward");
                } else if (accumulatedSeekOffset < 0) {
                    showOverlay("backward");
                }

                // Reset accumulated offset
                accumulatedSeekOffset = 0;

                // Resume playback if it was playing before
                if (wasPlayingBeforeSeek && !userManuallyPaused) {
                    pendingResumeTimeout = setTimeout(() => {
                        if(player) {
                            player.play().catch((err) => {
                                console.log("Resume after debounced seek failed:", err);
                            });
                        }
                    }, 200);
                }
            } catch (err) {
                console.warn("Debounced seek error:", err);
                accumulatedSeekOffset = 0;
            }

            pendingSeekTimeout = null;
        }, 300); // Wait 300ms after last input before executing seek
    }

    function updateVolume(direction) {
        if (typeof window.tizen !== "undefined" && window.tizen.tvaudiocontrol) {
            let currentVolume = window.tizen.tvaudiocontrol.getVolume();
            if (direction === "up") {
                currentVolume = Math.min(currentVolume + 1, 100);
            } else if (direction === "down") {
                currentVolume = Math.max(currentVolume - 1, 0);
            }
            window.tizen.tvaudiocontrol.setVolume(currentVolume);
            showVolumeDisplay(currentVolume);
        } else if (player) {
            let currentVolume = player.volume * 100;
            if (direction === "up") {
                currentVolume = Math.min(currentVolume + 10, 100);
            } else if (direction === "down") {
                currentVolume = Math.max(currentVolume - 10, 0);
            }
            player.volume = currentVolume / 100;
            showVolumeDisplay(currentVolume);
        }
    }

    function toggleMute() {
        if (typeof window.tizen !== "undefined" && window.tizen.tvaudiocontrol) {
            const isMuted =
                window.tizen.tvaudiocontrol.isMute &&
                window.tizen.tvaudiocontrol.isMute();
            window.tizen.tvaudiocontrol.setMute(!isMuted);
        } else if (player) {
            player.muted = !player.muted;
        }
    }

    function showVolumeDisplay(volume) {
        let volDisplay = document.getElementById("volumeDisplay");
        if (!volDisplay) {
            volDisplay = document.createElement("div");
            volDisplay.id = "volumeDisplay";
            volDisplay.className = "volume-display";
            document.body.appendChild(volDisplay);
        }
        volDisplay.innerText = "Volume: " + volume;
        volDisplay.style.display = "block";

        clearTimeout(window._volDisplayTimeout);
        window._volDisplayTimeout = setTimeout(() => {
            volDisplay.style.display = "none";
        }, 1200);
    }

    function showMuteIcon() {
        let muteIcon = document.getElementById("muteIcon");
        if (!muteIcon) {
            muteIcon = document.createElement("div");
            muteIcon.id = "muteIcon";
            muteIcon.className = "mute-icon";
            muteIcon.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
            document.body.appendChild(muteIcon);
        }
        muteIcon.style.display = "block";
    }

    function hideMuteIcon() {
        const muteIcon = document.getElementById("muteIcon");
        if (muteIcon) muteIcon.style.display = "none";
    }

    function showOverlay(type) {
        if (errorActive) return;

        const playOverlay = document.querySelector(".video-action-overlay.center");
        const forwardOverlay = document.querySelector(
            ".video-action-overlay.right"
        );
        const backwardOverlay = document.querySelector(
            ".video-action-overlay.left"
        );

        [playOverlay, forwardOverlay, backwardOverlay].forEach((el) => {
            if (el) el.classList.add("hidden");
        });

        let targetOverlay = null;

        switch (type) {
            case "play":
                if (playOverlay) {
                    playOverlay.querySelector(
                        ".video-action-icon"
                    ).innerHTML = `<i class="fa-solid fa-play"></i>`;
                    targetOverlay = playOverlay;
                }
                break;
            case "pause":
                if (playOverlay) {
                    playOverlay.querySelector(
                        ".video-action-icon"
                    ).innerHTML = `<i class="fa-solid fa-pause"></i>`;
                    targetOverlay = playOverlay;
                }
                break;
            case "forward":
                if (forwardOverlay) {
                    forwardOverlay.querySelector(
                        ".video-action-icon"
                    ).innerHTML = `<i class="fa-solid fa-rotate-right"></i>`;
                    targetOverlay = forwardOverlay;
                }
                break;
            case "backward":
                if (backwardOverlay) {
                    backwardOverlay.querySelector(
                        ".video-action-icon"
                    ).innerHTML = `<i class="fa-solid fa-rotate-left"></i>`;
                    targetOverlay = backwardOverlay;
                }
                break;
        }

        if (targetOverlay) {
            targetOverlay.classList.remove("hidden");

            clearTimeout(overlayTimeout);
            // Don't auto-hide pause overlay OR focused play overlay
            if (type !== "pause" && !isPlayPauseFocused) {
                overlayTimeout = setTimeout(() => {
                    targetOverlay.classList.add("hidden");
                }, 1000);
            }
        }
    }

    // 🔴 Function to focus on play/pause overlay with white border
    function focusPlayPause() {
        const playOverlay = document.querySelector(".video-action-overlay.center");
        const seekBar = document.getElementById("customSeek");
        const aspectRatioButton = document.getElementById("aspectRatioButton");

        if (playOverlay) {
            isPlayPauseFocused = true;
            isSeekBarFocused = false;
            isAspectRatioFocused = false;

            // Ensure play/pause overlay is visible when focused
            playOverlay.classList.remove("hidden");
            playOverlay.classList.add("focused");

            // Restore all controls and title bar when focusing center icon
            const controlsBar = document.querySelector(".custom-video-controls");
            const titleBar = document.querySelector(".video-title-bar");
            if (controlsBar) controlsBar.classList.remove("hidden");
            if (titleBar) titleBar.style.display = "flex";

            // Remove focused class from seek bar and aspect ratio button
            if (seekBar) seekBar.classList.remove("focused");
            if (aspectRatioButton) aspectRatioButton.classList.remove("focused");
        }
    }

    // 🔴 Function to focus on seek bar with red border
    function focusSeekBar() {
        const seekBar = document.getElementById("customSeek");
        const playOverlay = document.querySelector(".video-action-overlay.center");
        const aspectRatioButton = document.getElementById("aspectRatioButton");

        if (seekBar) {
            isSeekBarFocused = true;
            isPlayPauseFocused = false;
            isAspectRatioFocused = false;

            // Ensure seek bar is visible and focused
            seekBar.classList.add("focused");

            // Ensure controls bar is visible
            const controlsBar = document.querySelector(".custom-video-controls");
            if (controlsBar) controlsBar.classList.remove("hidden");

            // Remove focused class from others
            if (playOverlay) playOverlay.classList.remove("focused");
            if (aspectRatioButton) aspectRatioButton.classList.remove("focused");
        }
    }

    // 🔴 Function to focus on aspect ratio button
    function focusAspectRatio() {
        const aspectRatioButton = document.getElementById("aspectRatioButton");
        const playOverlay = document.querySelector(".video-action-overlay.center");
        const seekBar = document.getElementById("customSeek");

        if (aspectRatioButton) {
            isAspectRatioFocused = true;
            isPlayPauseFocused = false;
            isSeekBarFocused = false;

            // Add focused class to aspect ratio button
            aspectRatioButton.classList.add("focused");

            // Remove focused class from play overlay and seek bar
            if (playOverlay) playOverlay.classList.remove("focused");
            if (seekBar) seekBar.classList.remove("focused");
        }
    }

    // 🔴 Function to remove all focus
    function unfocusAll() {
        isSeekBarFocused = false;
        isPlayPauseFocused = false;
        isAspectRatioFocused = false;

        const seekBar = document.getElementById("customSeek");
        const playOverlay = document.querySelector(".video-action-overlay.center");
        const aspectRatioButton = document.getElementById("aspectRatioButton");

        if (seekBar) seekBar.classList.remove("focused");
        if (playOverlay) playOverlay.classList.remove("focused");
        if (aspectRatioButton) aspectRatioButton.classList.remove("focused");
    }

    // 🔴 NEW: Functions for auto-hiding controls
    function hideAllControls() {
        const controlsBar = document.querySelector(".custom-video-controls");
        const titleBar = document.querySelector(".video-title-bar");
        const playOverlay = document.querySelector(".video-action-overlay.center");

        if (controlsBar) controlsBar.classList.add("hidden");
        if (titleBar) titleBar.style.display = "none";
        if (playOverlay) playOverlay.classList.add("hidden");

        // Remove visual focus classes BUT KEEP state variables (isSeekBarFocused, etc.)
        const seekBar = document.getElementById("customSeek");
        const aspectRatioButton = document.getElementById("aspectRatioButton");
        if (seekBar) seekBar.classList.remove("focused");
        if (playOverlay) playOverlay.classList.remove("focused");
        if (aspectRatioButton) aspectRatioButton.classList.remove("focused");
    }

    function showAllControls() {
        const controlsBar = document.querySelector(".custom-video-controls");
        const titleBar = document.querySelector(".video-title-bar");
        const playOverlay = document.querySelector(".video-action-overlay.center");

        if (controlsBar) controlsBar.classList.remove("hidden");
        if (titleBar) titleBar.style.display = "flex";
        if (playOverlay) playOverlay.classList.remove("hidden");
    }

    function resetControlsTimer() {
        if (controlsTimer) {
            clearTimeout(controlsTimer);
            controlsTimer = null;
        }

        // Don't auto-hide if player isn't playing or in error
        if (!player || player.paused || errorActive) return;

        controlsTimer = setTimeout(() => {
            if (player && !player.paused && !errorActive) {
                hideAllControls();
            }
        }, 5000);
    }

    function initPlayer(attempt = 0) {
        const videoElement = document.getElementById("videojs-player-tag");
        if (!videoElement) {
            if (attempt < 10) {
                setTimeout(() => initPlayer(attempt + 1), 100);
            }
            return;
        }

        let resumeTime = 0;

        if (!isLive) {
            if (fromValue === "movie") {
                const movieId = localStorage.getItem("selectedMovieId");
                const matched = continueWatchingMoviesData.find(
                    (item) => item.itemId === movieId
                );
                if (matched && matched.resumeTime) {
                    resumeTime = matched.resumeTime;
                }
            } else {
                const seriesId = localStorage.getItem("selectedSeriesId");
                const episodeId = localStorage.getItem("selectedEpisodeId");

                const matched = continueWatchingSeriesData.find(
                    (item) => item.itemId === seriesId && item.episodeId === episodeId
                );
                if (matched && matched.resumeTime) {
                    resumeTime = matched.resumeTime;
                }
            }
        }

        player = videoElement;
        
        player.autoplay = true;
        player.preload = "auto";
        
        if (isYouTube && (fromValue === "trailer_movie" || fromValue === "trailer_series")) {
            // No poster
        } else if (poster) {
            player.poster = poster;
        }

        player.src = srcUrl || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

        player.addEventListener("seeking", () => {
            console.log("Seeking started...");
        });

        player.addEventListener("seeked", () => {
            console.log("Seek completed");

            // Only auto-play if video wasn't manually paused AND not dragging
            if (
                player.paused &&
                !errorActive &&
                !isSeekBarDragging &&
                !userManuallyPaused
            ) {
                setTimeout(() => {
                    player.play().catch((err) => {
                        console.log("Auto-play after seek failed:", err);
                    });
                }, 100);
            }
        });

        // Apply resume time after metadata is loaded
        if (resumeTime > 0) {
            player.addEventListener("loadedmetadata", () => {
                if (resumeTime < player.duration) {
                    player.currentTime = resumeTime;
                }
            });
        }

        const loadingEl = document.querySelector(".video-buffer-loader");
        const seekBar = document.getElementById("customSeek");
        const liveBadge = document.querySelector(".video-live-badge");
        const errorDialog = document.querySelector(".video-error-dialog");
        const errorBackBtn = document.getElementById("errorBackBtn");
        const controlsBar = document.querySelector(".custom-video-controls");
        const overlays = document.querySelectorAll(".video-action-overlay");
        const titleBar = document.querySelector(".video-title-bar");

        currentTimeEl = document.getElementById("currentTime");
        durationEl = document.getElementById("duration");

        if (isLive && liveBadge) {
            liveBadge.classList.remove("hidden");
        }
        if (isLive && seekBar) {
            seekBar.style.display = "none";
        }

        // Show title at start for 3 seconds, then hide if video is playing
        if (titleBar) {
            titleBar.classList.remove("hidden");
            const titleTextEl = titleBar.querySelector(".video-title-text");
            if (titleTextEl) {
                titleTextEl.classList.remove("marquee-active");
                const sw = titleTextEl.scrollWidth;
                const cw = titleTextEl.clientWidth;
                if (sw > cw) {
                    titleTextEl.setAttribute("data-marquee", titleTextEl.textContent);
                    titleTextEl.style.setProperty("--scroll-dist", `-${sw - cw}px`);
                    titleTextEl.style.setProperty("--duration", `${sw / 150}s`);
                    titleTextEl.classList.add("marquee-active");
                }
            }
            setTimeout(() => {
                if (player && !player.paused) {
                    titleBar.classList.add("hidden");
                }
            }, 3000);
        }

        // Seek bar event listeners
        if (!isLive && seekBar) {
            seekBar.addEventListener("input", () => {
                if (
                    !errorActive &&
                    player &&
                    !isNaN(player.currentTime)
                ) {
                    // Throttle seek bar updates to prevent buffer overload
                    const now = Date.now();
                    if (now - lastSeekTime < 100) {
                        // Ignore updates faster than 100ms
                        return;
                    }
                    lastSeekTime = now;

                    isSeekBarDragging = true;

                    // Show loading indicator when seeking
                    if (loadingEl) {
                        loadingEl.classList.remove("hidden");
                    }

                    // Store play state before seeking
                    wasPlayingBeforeSeek = !player.paused;

                    try {
                        player.currentTime = parseFloat(seekBar.value);
                    } catch (err) {
                        console.warn("Seek bar error:", err);
                    }
                }
            });

            seekBar.addEventListener("change", () => {
                isSeekBarDragging = false;

                // Only auto-resume if it was playing AND not manually paused
                if (wasPlayingBeforeSeek && !userManuallyPaused && !errorActive) {
                    setTimeout(() => {
                        player.play().catch((err) => {
                            console.log("Auto-play after seek bar release failed:", err);
                        });
                    }, 200);
                }
            });

            player.addEventListener("timeupdate", () => {
                if (errorActive) return;

                if (!seekBar.getAttribute("max") && player.duration) {
                    seekBar.setAttribute("max", player.duration || 0);
                }

                // Only update seek bar value if user is not actively dragging it
                if (!isSeekBarDragging && !isNaN(player.currentTime)) {
                    seekBar.value = player.currentTime;
                }

                // Update current time display
                if (currentTimeEl) {
                    currentTimeEl.textContent = formatTime(player.currentTime);
                }

                // Update duration display (only once when available)
                if (
                    durationEl &&
                    player.duration &&
                    durationEl.textContent === "0:00"
                ) {
                    durationEl.textContent = formatTime(player.duration);
                }

                const duration = player.duration || 0;
                const percent = duration > 0 ? (player.currentTime / duration) * 100 : 0;
                let bufferedPercent = 0;
                if (player.buffered && player.buffered.length > 0 && duration > 0) {
                    bufferedPercent =
                        (player.buffered.end(player.buffered.length - 1) / duration) *
                        100;
                }

                seekBar.style.background = `linear-gradient(to right,
          var(--gold) 0%, var(--gold) ${percent}%,
          #aaa ${percent}%, #aaa ${bufferedPercent}%,
          #888 ${bufferedPercent}%, #888 100%)`;
            });
        }

        player.addEventListener("waiting", () => {
            if (!errorActive) {
                loadingEl.classList.remove("hidden");
                // Hide pause overlay when loading starts
                const playOverlay = document.querySelector(
                    ".video-action-overlay.center"
                );
                if (playOverlay) {
                    playOverlay.classList.add("hidden");
                }
            }
        });

        player.addEventListener("canplay", () => {
            if (!errorActive) {
                loadingEl.classList.add("hidden");
                // 🔴 UPDATED: Auto-play if not manually paused and not dragging seek bar
                if (
                    player.paused &&
                    !isSeekBarDragging &&
                    !userManuallyPaused &&
                    !errorActive
                ) {
                    player.play().catch((err) => {
                        console.log("Auto-play on canplay failed:", err);
                    });
                } else if (player.paused && !isSeekBarDragging) {
                    // Show pause overlay if user manually paused or is seeking
                    showOverlay("pause");
                }
            }
        });

        player.addEventListener("stalled", () => {
            if (!errorActive) {
                loadingEl.classList.remove("hidden");
            }
        });

        player.addEventListener("loadstart", () => {
            if (!errorActive) {
                loadingEl.classList.remove("hidden");
            }
        });

        player.addEventListener("ended", () => {
            goBack();
        });

        player.addEventListener("playing", () => {
            if (!errorActive) {
                hasStartedPlayingOnce = true;
                loadingEl.classList.add("hidden");
                // Reset timer when playing starts
                resetControlsTimer();
                
                // Only show play overlay if we're not seeking
                if (!isSeekBarDragging && !player.seeking) {
                    showOverlay("play");
                }

                // Reset manual pause flag when video starts playing
                userManuallyPaused = false;
            }
        });

        player.addEventListener("pause", () => {
            // Don't show pause UI if video is still loading/buffering
            if (!errorActive && !loadingEl.classList.contains("hidden")) {
                return;
            }

            // Always show pause overlay when paused, even during seeking
            if (!errorActive) {
                controlsBar.classList.remove("hidden");
                titleBar.style.display = "flex";
                showOverlay("pause");
                setTimeout(() => focusPlayPause(), 100);

                // Mark that user manually paused (unless it's from seeking)
                if (!player.seeking) {
                    userManuallyPaused = true;
                }
            }
        });

        player.addEventListener("error", (e) => {
            console.log("❌ Player error:", player.error);
            errorActive = true;

            loadingEl.classList.add("hidden");
            controlsBar.classList.add("hidden");
            liveBadge.classList.add("hidden");
            titleBar.style.display = "none";

            overlays.forEach((o) => o.classList.add("hidden"));

            const errorMsgEl = document.getElementById("errorDialogMessage");
            if (errorMsgEl) {
                const playerError = player.error;
                let errorMessage = "Something went wrong";
                if (playerError) {
                    errorMessage = playerError.message || `Error Code: ${playerError.code}`;
                }
                errorMsgEl.innerText = `⚠️ ${errorMessage}`;
            }

            if (errorDialog) errorDialog.classList.remove("hidden");
        });

        function goBack() {
            const currentPlaylist = getCurrentPlaylist();
            const allRecentlyWatchedMovies = currentPlaylist.continueWatchingMovies ?
                currentPlaylist.continueWatchingMovies :
                [];
            const allRecentlyWatchedSeries = currentPlaylist.continueWatchingSeries ?
                currentPlaylist.continueWatchingSeries :
                [];
            
            const navbarEl = document.querySelector("#navbar-root");
            if (navbarEl) {
                navbarEl.style.display = "block";
            }

            // Check if coming from HomePage
            const fromHome = localStorage.getItem("fromHome");
            if (fromHome === "true") {
                document.body.style.backgroundImage = "none";
                document.body.style.backgroundColor = "black";

                // Save to continue watching if played for more than 5 seconds
                if (!isYouTube && !isLive && !errorActive && player) {
                    let resumeTime = 0;
                    let duration = 0;

                    try {
                        if (!isNaN(player.currentTime)) {
                            resumeTime = player.currentTime;
                        }
                        if (!isNaN(player.duration)) {
                            duration = player.duration;
                        }
                    } catch (e) {
                        resumeTime = 0;
                        duration = 0;
                    }

                    // Only save if played for more than 5 seconds and not completed
                    const isVideoCompleted =
                        duration > 0 && Math.abs(resumeTime - duration) < 5;

                    if (resumeTime > 5 && !isVideoCompleted) {
                        const continueWatchingItem = {
                            itemId: playingItemData.season ?
                                localStorage.getItem("selectedSeriesId") :
                                localStorage.getItem("selectedMovieId"),
                            episodeId: playingItemData.season ?
                                localStorage.getItem("selectedEpisodeId") :
                                null,
                            resumeTime,
                            duration,
                            type: playingItemData.season ? "series" : "movie",
                        };

                        // Load playlists
                        let playlists = getPlaylistsData();

                        playlists = playlists.map((pl) => {
                            if (pl.playlistName !== currentPlaylistName) return pl;

                            if (continueWatchingItem.type === "series") {
                                // Remove old entry for same series+episode
                                let updatedSeries = (pl.continueWatchingSeries || []).filter(
                                    (item) =>
                                    !(
                                        item.itemId === continueWatchingItem.itemId &&
                                        item.episodeId === continueWatchingItem.episodeId
                                    )
                                );
                                pl = {
                                    ...pl,
                                    continueWatchingSeries: updatedSeries,
                                };
                            } else {
                                // Remove old entry for same movie
                                let updatedMovies = (pl.continueWatchingMovies || []).filter(
                                    (item) => item.itemId !== continueWatchingItem.itemId
                                );
                                pl = {
                                    ...pl,
                                    continueWatchingMovies: updatedMovies,
                                };
                            }

                            return pl;
                        });

                        // Save cleaned playlists back to localStorage
                        localStorage.setItem("playlistsData", JSON.stringify(playlists));

                        // Finally, add updated item via your function
                        if (continueWatchingItem.type === "series") {
                            addItemToHistory(continueWatchingItem, "continueWatchingSeries");
                        } else {
                            addItemToHistory(continueWatchingItem, "continueWatchingMovies");
                        }
                    }
                }

                // Dispose player before navigating
                disposePlayer();

                // Set fromHome to false
                localStorage.setItem("fromHome", "false");

                // Navigate to HomePage and focus on home button in navbar
                localStorage.setItem("currentPage", "homePage");
                Router.showPage("homePage");

                // Focus on home button in navbar after navigation
                setTimeout(() => {
                    const homeButton = document.querySelector('[data-page="homePage"]');
                    if (homeButton) {
                        homeButton.focus();
                    }
                }, 100);

                return;
            }

            // Simple return for trailers
            if (fromValue === "trailer_series") {
                document.body.style.backgroundImage = "none";
                document.body.style.backgroundColor = "black";
                disposePlayer();
                localStorage.setItem("currentPage", "seriesDetailPage");
                Router.showPage("seriesDetailPage");
                return;
            }
            if (fromValue === "trailer_movie") {
                document.body.style.backgroundImage = "none";
                document.body.style.backgroundColor = "black";
                disposePlayer();
                localStorage.setItem("currentPage", "movieDetailPage");
                Router.showPage("movieDetailPage");
                return;
            }

            if (fromValue === "series") {
                const episodeId = localStorage.getItem("selectedEpisodeId");
                localStorage.setItem("lastPlayedEpisodeId", episodeId);
            }

            const currentPlayer = player;

            function disposePlayer() {
                if (player) {
                    try {
                        player.pause();
                        player.removeAttribute("src");
                        player.load();
                        player = null;
                    } catch (e) {
                        console.warn("Error disposing player", e);
                    }
                }
            }

            if (!isYouTube) {
                if (currentPlayer) {
                    let resumeTime = 0;
                    let duration = 0;

                    try {
                        if (!isLive && !isNaN(currentPlayer.currentTime)) {
                            resumeTime = currentPlayer.currentTime;
                        }
                        if (!isNaN(currentPlayer.duration)) {
                            duration = currentPlayer.duration;
                        }
                    } catch (e) {
                        resumeTime = 0;
                        duration = 0;
                    }

                    const isVideoCompleted =
                        duration > 0 && Math.abs(resumeTime - duration) < 5; // 5 second buffer

                    // If video is completed, focus on next episode (for series)
                    if (isVideoCompleted) {
                        if (fromValue === "series") {
                            const currentEpisodeId =
                                localStorage.getItem("selectedEpisodeId");
                            const seriesEpisodes =
                                JSON.parse(localStorage.getItem("seriesEpisodesData")) || {};
                            const currentSeason =
                                localStorage.getItem("selectedSeason") || "1";

                            // Find current episode and get next one
                            const seasonEpisodes = seriesEpisodes[currentSeason] || [];
                            const currentEpisodeIndex = seasonEpisodes.findIndex(
                                (ep) => ep.id.toString() === currentEpisodeId
                            );

                            if (
                                currentEpisodeIndex !== -1 &&
                                currentEpisodeIndex < seasonEpisodes.length - 1
                            ) {
                                // Focus on next episode
                                const nextEpisodeId =
                                    seasonEpisodes[currentEpisodeIndex + 1].id;
                                localStorage.setItem(
                                    "lastPlayedEpisodeId",
                                    nextEpisodeId.toString()
                                );
                            } else {
                                // No next episode, remove the focus marker
                                localStorage.removeItem("lastPlayedEpisodeId");
                            }

                            // Remove the completed episode from continue watching
                            removeEpisodeFromContinueWatching(currentEpisodeId);

                            // Only remove from continue watching if ALL episodes in the series are completed
                            const allEpisodesCompleted = checkIfAllEpisodesCompleted(
                                currentEpisodeId,
                                seriesEpisodes
                            );
                            if (allEpisodesCompleted) {
                                removeItemFromHistoryById(
                                    localStorage.getItem("selectedSeriesId"),
                                    "continueWatchingSeries"
                                );
                            }
                        } else if (fromValue === "movie") {
                            // MOVIES: Remove from continue watching when completed
                            removeItemFromHistoryById(
                                localStorage.getItem("selectedMovieId"),
                                "continueWatchingMovies"
                            );
                        }
                    } else if (resumeTime > 5 && !isVideoCompleted && !errorActive) {
                        const continueWatchingItem = {
                            itemId: playingItemData.season ?
                                localStorage.getItem("selectedSeriesId") :
                                localStorage.getItem("selectedMovieId"),
                            episodeId: playingItemData.season ?
                                localStorage.getItem("selectedEpisodeId") :
                                null,
                            resumeTime,
                            duration,
                            type: playingItemData.season ? "series" : "movie",
                        };

                        // Load playlists
                        let playlists = getPlaylistsData();

                        playlists = playlists.map((pl) => {
                            if (pl.playlistName !== currentPlaylistName) return pl;

                            if (continueWatchingItem.type === "series") {
                                // Remove old entry for same series+episode
                                let updatedSeries = (pl.continueWatchingSeries || []).filter(
                                    (item) =>
                                    !(
                                        item.itemId === continueWatchingItem.itemId &&
                                        item.episodeId === continueWatchingItem.episodeId
                                    )
                                );
                                pl = {
                                    ...pl,
                                    continueWatchingSeries: updatedSeries,
                                };
                            } else {
                                // Remove old entry for same movie
                                let updatedMovies = (pl.continueWatchingMovies || []).filter(
                                    (item) => item.itemId !== continueWatchingItem.itemId
                                );
                                pl = {
                                    ...pl,
                                    continueWatchingMovies: updatedMovies,
                                };
                            }

                            return pl;
                        });

                        // Save cleaned playlists back to localStorage
                        localStorage.setItem("playlistsData", JSON.stringify(playlists));

                        // Finally, add updated item via your function
                        if (continueWatchingItem.type === "series") {
                            addItemToHistory(continueWatchingItem, "continueWatchingSeries");
                        } else {
                            addItemToHistory(continueWatchingItem, "continueWatchingMovies");
                        }
                    }

                    // Set player to null first to prevent further access
                    player = null;

                    // Then safely dispose
                    try {
                        currentPlayer.pause();
                        currentPlayer.removeAttribute("src");
                        currentPlayer.load();
                    } catch (err) {
                        console.warn("Player dispose error:", err);
                    }
                }

                if (fromValue == "movie") {
                    const isContinueWatchingMovie = allRecentlyWatchedMovies.some(
                        (movie) =>
                        movie && movie.itemId === localStorage.getItem("selectedMovieId")
                    );

                    localStorage.setItem(
                        "isContinueWatchingMovie",
                        isContinueWatchingMovie == false ? "true" : "false"
                    );

                    buildDynamicSidebarOptions();
                    localStorage.setItem("currentPage", "movieDetailPage");
                    Router.showPage("movieDetailPage");
                } else {
                    const isContinueWatchingSeries = allRecentlyWatchedSeries.some(
                        (series) =>
                        series &&
                        series.itemId === localStorage.getItem("selectedSeriesId")
                    );

                    localStorage.setItem(
                        "isContinueWatchingSeries",
                        isContinueWatchingSeries === false ? "true" : "false"
                    );
                    buildDynamicSidebarOptions();
                    localStorage.setItem("currentPage", "seriesDetailPage");
                    Router.showPage("seriesDetailPage");
                }
            } else {
                disposePlayer();
                if (fromValue == "movie") {
                    localStorage.setItem("currentPage", "movieDetailPage");
                    Router.showPage("movieDetailPage");
                } else {
                    localStorage.setItem("currentPage", "seriesDetailPage");
                    Router.showPage("seriesDetailPage");
                }
            }
        }

        // Helper function to remove completed episode from continue watching
        function removeEpisodeFromContinueWatching(completedEpisodeId) {
            try {
                const seriesId = localStorage.getItem("selectedSeriesId");
                const currentPlaylistName = JSON.parse(
                    localStorage.getItem("selectedPlaylist")
                ).playlistName;
                const playlistsData = getPlaylistsData();
                const currentPlaylist = playlistsData.find(
                    (pl) => pl.playlistName === currentPlaylistName
                );

                if (!currentPlaylist || !currentPlaylist.continueWatchingSeries) return;

                // Remove the specific episode from continue watching
                const updatedContinueWatching =
                    currentPlaylist.continueWatchingSeries.filter(
                        (item) =>
                        !(
                            item.itemId === seriesId &&
                            item.episodeId === completedEpisodeId.toString()
                        )
                    );

                // Update the playlist
                const updatedPlaylists = playlistsData.map((pl) => {
                    if (pl.playlistName === currentPlaylistName) {
                        return {
                            ...pl,
                            continueWatchingSeries: updatedContinueWatching,
                        };
                    }
                    return pl;
                });

                // Save back to localStorage
                localStorage.setItem("playlistsData", JSON.stringify(updatedPlaylists));
            } catch (error) {
                console.warn("Error removing episode from continue watching:", error);
            }
        }

        // Helper function to check if ALL episodes in the series are completed
        function checkIfAllEpisodesCompleted(currentEpisodeId, seriesEpisodes) {
            try {
                const seriesId = localStorage.getItem("selectedSeriesId");
                const currentPlaylistName = JSON.parse(
                    localStorage.getItem("selectedPlaylist")
                ).playlistName;
                const playlistsData = getPlaylistsData();
                const currentPlaylist = playlistsData.find(
                    (pl) => pl.playlistName === currentPlaylistName
                );
                const continueWatchingEpisodes = currentPlaylist ?
                    currentPlaylist.continueWatchingSeries || [] :
                    [];

                // Get all episodes from the series
                const allEpisodes = [];
                Object.keys(seriesEpisodes).forEach((seasonKey) => {
                    const seasonEpisodes = seriesEpisodes[seasonKey] || [];
                    seasonEpisodes.forEach((episode) => {
                        allEpisodes.push({
                            id: episode.id.toString(),
                            season: seasonKey,
                            episode_num: episode.episode_num,
                        });
                    });
                });

                // Check if there are any episodes that are still in continue watching
                const hasIncompleteEpisodes = allEpisodes.some((episode) => {
                    if (episode.id === currentEpisodeId.toString()) {
                        return false;
                    }
                    const isInContinueWatching = continueWatchingEpisodes.some(
                        (cw) => cw.itemId === seriesId && cw.episodeId === episode.id
                    );
                    return isInContinueWatching;
                });

                return !hasIncompleteEpisodes;
            } catch (error) {
                console.warn("Error checking if all episodes completed:", error);
                return false;
            }
        }

        if (errorBackBtn) {
            errorBackBtn.addEventListener("click", goBack);
        }

        // Keyboard events
        function videojsPlayerdownHandler(e) {
            if (localStorage.getItem("currentPage") !== "videoJsPlayer") return;

            const key = e.keyCode || e.which;
            const keyChar = e.key;

            // Reset auto-hide timer on any key press
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
                resetControlsTimer();
            }

            // Tizen Volume Controls
            if (typeof window.tizen !== "undefined" && window.tizen.tvaudiocontrol) {
                if (keyChar === "w" || key === 447) {
                    updateVolume("up");
                    e.stopPropagation();
                    return;
                }
                if (keyChar === "s" || key === 448) {
                    updateVolume("down");
                    e.stopPropagation();
                    return;
                }
                if (keyChar === "m" || key === 449) {
                    toggleMute();
                    e.stopPropagation();
                    return;
                }
            }

            if (errorActive) {
                if (e.key === "Enter" || isBackKey(e)) {
                    goBack();
                }
                return;
            }

            // Show UI on arrow keys/enter if hidden
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
                const controlsBarWrapper = document.querySelector(".custom-video-controls");
                if (controlsBarWrapper && controlsBarWrapper.classList.contains("hidden")) {
                    showAllControls();
                    if (isSeekBarFocused) focusSeekBar();
                    else if (isAspectRatioFocused) focusAspectRatio();
                    else focusPlayPause();
                }
                resetControlsTimer();
            }

            if (isAspectRatioFocused) {
                switch (e.key) {
                    case "ArrowUp":
                        focusSeekBar();
                        e.preventDefault();
                        break;
                    case "Enter":
                        const videoEl = document.querySelector("#videojs-player-tag");
                        if (videoEl && window.VideoAspectRatio) {
                            const newLabel = window.VideoAspectRatio.cycle(videoEl);
                            window.VideoAspectRatio.showOverlay(newLabel);
                        }
                        e.preventDefault();
                        break;
                    default:
                        if (isBackKey(e)) {
                            goBack();
                            e.preventDefault();
                        }
                        break;
                }
                return;
            }

            if (isSeekBarFocused) {
                switch (e.key) {
                    case "ArrowLeft":
                        if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                            showAllControls();
                            focusPlayPause();
                            debouncedSeek(-10);
                            showOverlay("backward");
                        }
                        e.preventDefault();
                        break;
                    case "ArrowRight":
                        if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                            showAllControls();
                            focusPlayPause();
                            debouncedSeek(10);
                            showOverlay("forward");
                        }
                        e.preventDefault();
                        break;
                    case "ArrowUp":
                        focusPlayPause();
                        e.preventDefault();
                        break;
                    case "ArrowDown":
                        focusAspectRatio();
                        e.preventDefault();
                        break;
                    case "Enter":
                        focusPlayPause();
                        e.preventDefault();
                        break;
                    default:
                        if (isBackKey(e)) {
                            goBack();
                            e.preventDefault();
                        }
                        break;
                }
                return;
            }

            if (isPlayPauseFocused) {
                switch (e.key) {
                    case "ArrowDown":
                        if (!isLive) focusSeekBar();
                        else focusAspectRatio();
                        e.preventDefault();
                        break;
                    case "ArrowUp":
                        focusPlayPause();
                        e.preventDefault();
                        break;
                    case "Enter":
                        if (player) {
                            if (player.paused) player.play();
                            else player.pause();
                        }
                        e.preventDefault();
                        break;
                    case "ArrowRight":
                        if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                            showAllControls();
                            debouncedSeek(10);
                            showOverlay("forward");
                        }
                        e.preventDefault();
                        break;
                    case "ArrowLeft":
                        if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                            showAllControls();
                            debouncedSeek(-10);
                            showOverlay("backward");
                        }
                        e.preventDefault();
                        break;
                }
                if (["ArrowUp", "ArrowDown", "Enter", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                    return;
                }
            }

            // Fallback
            switch (e.key) {
                case "Enter":
                    if (player) {
                        if (player.paused) player.play();
                        else player.pause();
                    }
                    break;
                case "ArrowRight":
                    if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                        showAllControls();
                        focusPlayPause();
                        debouncedSeek(10);
                        showOverlay("forward");
                    }
                    e.preventDefault();
                    break;
                case "ArrowLeft":
                    if (!isLive && player && hasStartedPlayingOnce && !isNaN(player.currentTime)) {
                        showAllControls();
                        focusPlayPause();
                        debouncedSeek(-10);
                        showOverlay("backward");
                    }
                    e.preventDefault();
                    break;
                default:
                    if (isBackKey(e)) {
                        goBack();
                    }
                    break;
            }
        }

        document.addEventListener("keydown", videojsPlayerdownHandler);

        VideoJsPlayer.cleanup = function() {
            if (pendingSeekTimeout) clearTimeout(pendingSeekTimeout);
            if (pendingResumeTimeout) clearTimeout(pendingResumeTimeout);
            try {
                document.removeEventListener("keydown", videojsPlayerdownHandler);
            } catch (err) {}
            
            isSeekBarDragging = false;
            wasPlayingBeforeSeek = false;
            isSeekBarFocused = false;
            isPlayPauseFocused = true;
            isAspectRatioFocused = false;
            userManuallyPaused = false;
            accumulatedSeekOffset = 0;
            lastSeekTime = 0;
            hasStartedPlayingOnce = false;

            if (player) {
                const currentPlayer = player;
                player = null;
                try { currentPlayer.pause(); } catch (err) {}
                try {
                    currentPlayer.removeAttribute("src");
                    currentPlayer.load();
                } catch (err) {}
            }
        };
    }

    setTimeout(() => initPlayer(), 0);

    setTimeout(() => {
        const videoEl = document.querySelector("#videojs-player-tag");
        if (videoEl && window.VideoAspectRatio) {
            window.VideoAspectRatio.initialize(videoEl);
        }
    }, 0);

    setTimeout(() => {
        const aspectRatioButton = document.getElementById("aspectRatioButton");
        if (aspectRatioButton) {
            aspectRatioButton.addEventListener("click", () => {
                const videoEl = document.querySelector("#videojs-player-tag");
                if (videoEl && window.VideoAspectRatio) {
                    const newLabel = window.VideoAspectRatio.cycle(videoEl);
                    window.VideoAspectRatio.showOverlay(newLabel);
                }
            });
        }
    }, 0);

    return `
  <div class="video-js-player-container">
    <div class="video-title-bar" style="display: none;">
      <span class="video-title-text">${titleText}</span>
    </div>

    <div class="video-buffer-loader hidden">
      <div class="spinner"></div>
    </div>

    <div class="video-live-badge hidden">LIVE</div>

    <div class="video-error-dialog hidden">
      <div class="error-box">
        <p id="errorDialogMessage">⚠️ Something went wrong</p>
        <button id="errorBackBtn">Go Back</button>
      </div>
    </div>

    <div class="video-action-overlay center hidden">
        <div class="video-action-icon"><i class="fa-solid fa-play"></i></div>
    </div>
    <div class="video-action-overlay left hidden">
        <div class="video-action-icon"><i class="fa-solid fa-backward"></i></div>
    </div>
    <div class="video-action-overlay right hidden">
        <div class="video-action-icon"><i class="fa-solid fa-forward"></i></div>
    </div>

    <video
      id="videojs-player-tag"
      class="video-js videojs-player-class"
      playsinline
      style="width: 100%; height: 100%;"
    ></video>

    <div class="custom-video-controls hidden">
      <div class="seek-bar-container">
        <span id="currentTime" class="time-display">0:00</span>
        <input id="customSeek" type="range" value="0" min="0" step="0.1" />
        <span id="duration" class="time-display">0:00</span>
      </div>
      ${isYouTube ? "" : `
      <div class="aspect-ratio-container">
        <button class="aspect-ratio-button" id="aspectRatioButton">
          <i class="fa-solid fa-compress" style="color: ${isAspectRatioFocused ? "var(--gold)" : "white"}"></i>
          Aspect Ratio
        </button>
      </div>`}
    </div>
    <div id="aspectRatioOverlay" class="aspect-ratio-overlay hidden"></div>
  </div>
`;
}