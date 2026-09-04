function LiveVideoJsComponent(
  streamId = "",
  srcUrl = "",
  poster = "./assets/placeholder.png",
  height = "100%",
  channelName = ""
) {
  const id = "live-videojs-player";
  let epgData = [];
  let handleAspectRatioChange = null;
  let focusedControl = "play-pause";

  // Store reference to previous cleanup to avoid race conditions
  const previousCleanup = LiveVideoJsComponent.cleanup;
  if (previousCleanup) {
    // Use setTimeout to ensure cleanup happens after current execution
    setTimeout(() => {
      try {
        previousCleanup();
      } catch (err) {
        console.warn("Previous LiveVideoJsComponent cleanup error:", err);
      }
    }, 0);
  }

  console.log(srcUrl, "srcUrlsrcUrlsrcUrl");

  const currentPlaylistName = JSON.parse(
    localStorage.getItem("selectedPlaylist")
  ).playlistName;
  const currentPlaylist = JSON.parse(
    localStorage.getItem("playlistsData")
  ).filter((pl) => pl.playlistName === currentPlaylistName)[0];

  const streamFormat = currentPlaylist.streamFormat;
  const timeFormat = currentPlaylist.timeFormat
    ? currentPlaylist.timeFormat
    : "12hrs";
  const isTsStream = (streamFormat || "").toLowerCase() === "ts";

  //API call to fetch EPG data
  if (streamId) {
    getLiveStreamEpg(streamId).then((data) => {
      epgData = data.epg_listings ? data.epg_listings : [];
      renderEpg(epgData);
    });
  }

  function formatTime(dateStr, format) {
    let date;

    // Handle UNIX timestamp (seconds or ms) or string
    if (!isNaN(dateStr)) {
      const ts = dateStr.toString().length === 10 ? dateStr * 1000 : dateStr;
      date = new Date(parseInt(ts));
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date)) return dateStr; // fallback if invalid

    // Use Intl.DateTimeFormat for proper local timezone formatting
    const options =
      format === "12hrs"
        ? { hour: "numeric", minute: "2-digit", hour12: true }
        : { hour: "2-digit", minute: "2-digit", hour12: false };

    return new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function renderEpg(epgList) {
    const epgContainer = document.querySelector(".livetv-player-epg");
    if (!epgContainer) return;

    if (!epgList || epgList.length === 0) {
      epgContainer.innerHTML = `
      <div class="livetv-player-epg-item">
        <p class="livetv-player-epg-title">No EPG Found</p>
        <p class="livetv-player-epg-description">No EPG data available</p>
      </div>
    `;
      return;
    }

    epgContainer.innerHTML = epgList
      .map((epg) => {
        const startTime = formatTime(epg.start, timeFormat);
        const endTime = formatTime(epg.end, timeFormat);

        return `
        <div class="livetv-player-epg-item">
          <p class="livetv-player-epg-title">
            ${startTime} - ${endTime} ${decodeBase64(epg.title) || "Untitled"}
          </p>
          <p class="livetv-player-epg-description">
            ${decodeBase64(epg.description) || "No description available"}
          </p>
        </div>
      `;
      })
      .join("");
  }

  function updateVolume(direction) {
    try {
      if (typeof tizen !== "undefined" && tizen.tvaudiocontrol) {
        let vol = tizen.tvaudiocontrol.getVolume();
        // Always increment/decrement by 1
        vol = Math.max(0, Math.min(100, vol + (direction === "up" ? 1 : -1)));
        tizen.tvaudiocontrol.setVolume(vol);
        showVolumeDisplay(vol);
      }
    } catch (err) {
      console.warn("Volume control failed:", err);
    }
  }

  function showVolumeDisplay(volume) {
    let volEl = document.querySelector(".live-volume-display");
    if (!volEl) {
      volEl = document.createElement("div");
      volEl.className = "live-volume-display";

      // Insert the volume display in the player container
      const playerContainer = document.querySelector(".live-video-player");
      if (playerContainer) {
        playerContainer.appendChild(volEl);
      } else {
        document.body.appendChild(volEl);
      }
    }

    volEl.textContent = `Volume: ${volume}`;
    volEl.style.display = "block";
    clearTimeout(volEl._timeout);
    volEl._timeout = setTimeout(() => (volEl.style.display = "none"), 1500);
  }

  function toggleMute() {
    try {
      if (typeof tizen !== "undefined" && tizen.tvaudiocontrol) {
        if (tizen.tvaudiocontrol.isMute()) {
          tizen.tvaudiocontrol.setMute(false);
          hideMuteIcon();
        } else {
          tizen.tvaudiocontrol.setMute(true);
          showMuteIcon();
        }
      }
    } catch (err) {
      console.warn("Mute toggle failed:", err);
    }
  }

  function showMuteIcon() {
    let muteEl = document.querySelector(".live-mute-icon");
    if (!muteEl) {
      muteEl = document.createElement("div");
      muteEl.className = "live-mute-icon";
      muteEl.textContent = "🔇";
      document.body.appendChild(muteEl);
    }
    muteEl.style.display = "block";
  }

  function hideMuteIcon() {
    const muteEl = document.querySelector(".live-mute-icon");
    if (muteEl) muteEl.style.display = "none";
  }

  function togglePlayPause() {
    if (!window.livePlayer) return false;

    try {
      return isLivePaused() ? playLive() : pauseLive();
    } catch (err) {
      console.warn("Play/Pause toggle failed:", err);
      return false;
    }
  }

  function keyMatches(e, values) {
    const keyCode = e.keyCode || e.which;
    return (
      values.includes(keyCode) ||
      values.includes(e.key) ||
      values.includes(e.code)
    );
  }

  function getRemotePlaybackAction(e) {
    if (keyMatches(e, [10252, 179, "MediaPlayPause", "PlayPause"])) {
      return "toggle";
    }
    if (keyMatches(e, [415, "MediaPlay", "Play", "XF86AudioPlay"])) {
      return "play";
    }
    if (keyMatches(e, [19, "MediaPause", "Pause", "XF86AudioPause"])) {
      return "pause";
    }
    if (keyMatches(e, [413, "MediaStop", "Stop", "XF86AudioStop"])) {
      return "stop";
    }
    return null;
  }

  function registerTizenPlaybackKeys() {
    if (
      typeof window.tizen === "undefined" ||
      !window.tizen.tvinputdevice ||
      typeof window.tizen.tvinputdevice.registerKey !== "function"
    ) {
      return;
    }

    [
      "MediaPlayPause",
      "MediaPlay",
      "MediaPause",
      "MediaStop",
    ].forEach((keyName) => {
      try {
        window.tizen.tvinputdevice.registerKey(keyName);
      } catch (err) {
        console.warn("Tizen key registration failed:", keyName, err);
      }
    });
  }

  function getLiveHtml5Video() {
    return (
      document.querySelector("#live-videojs-player_html5_api") ||
      document.querySelector("#flowplayer-live video")
    );
  }

  function isLivePaused() {
    if (!window.livePlayer) return true;
    try {
      if (window.livePlayer._fp) {
        const videoEl = getLiveHtml5Video();
        if (videoEl) return videoEl.paused;
        return !window.livePlayer._fp.playing;
      }
      if (typeof window.livePlayer.paused === "function") {
        return window.livePlayer.paused();
      }
    } catch (err) {
      console.warn("Unable to read live pause state:", err);
    }
    return false;
  }

  function playLive() {
    if (!window.livePlayer) return false;

    try {
      if (window.livePlayer._fp) {
        if (typeof window.livePlayer._fp.resume === "function") {
          window.livePlayer._fp.resume();
        } else {
          const videoEl = getLiveHtml5Video();
          if (videoEl) videoEl.play();
        }
      } else if (typeof window.livePlayer.play === "function") {
        window.livePlayer.play();
      }
      updatePlayPauseIcon(true);
      return true;
    } catch (err) {
      console.warn("Live play failed:", err);
      return false;
    }
  }

  function pauseLive() {
    if (!window.livePlayer) return false;

    try {
      if (window.livePlayer._fp) {
        if (typeof window.livePlayer._fp.pause === "function") {
          window.livePlayer._fp.pause();
        } else {
          const videoEl = getLiveHtml5Video();
          if (videoEl) videoEl.pause();
        }
      } else if (typeof window.livePlayer.pause === "function") {
        window.livePlayer.pause();
      }
      updatePlayPauseIcon(false);
      return true;
    } catch (err) {
      console.warn("Live pause failed:", err);
      return false;
    }
  }

  function handleRemotePlaybackAction(action) {
    switch (action) {
      case "toggle":
        return togglePlayPause();
      case "play":
        return playLive();
      case "pause":
      case "stop":
        return pauseLive();
      default:
        return false;
    }
  }

  function getLivePlayerContainer() {
    return (
      document.getElementById("lp-player-container") ||
      document.querySelector(".live-video-player-div")
    );
  }

  function isLivePlayerFocused() {
    const container = getLivePlayerContainer();
    return !!(
      container &&
      (container.classList.contains("lp-focused") ||
        container.classList.contains("focused") ||
        document.fullscreenElement === container ||
        document.webkitFullscreenElement === container)
    );
  }

  function showLiveControls() {
    const playPauseIcon = document.querySelector(".play-pause-icon");
    const fullscreenBtn = document.getElementById("lp-fullscreen-btn");
    const aspectRatioBtn = document.getElementById("videojs-aspect-ratio");

    if (playPauseIcon) playPauseIcon.style.display = "flex";
    if (fullscreenBtn) fullscreenBtn.style.display = "flex";
    if (aspectRatioBtn) aspectRatioBtn.style.display = "block";
  }

  function updateLiveControlFocus() {
    const focusMap = [
      {
        id: "play-pause",
        el: document.querySelector(".play-pause-icon"),
        cls: "pp-focused",
      },
      {
        id: "fullscreen-toggle",
        el: document.getElementById("lp-fullscreen-btn"),
        cls: "fs-focused",
      },
      {
        id: "ar",
        el: document.getElementById("videojs-aspect-ratio"),
        cls: "ar-focused",
      },
    ];

    focusMap.forEach(({ id, el, cls }) => {
      if (!el) return;
      el.classList.remove(
        "focused",
        "lp-control-focused",
        "pp-focused",
        "fs-focused",
        "ar-focused"
      );
      if (id === focusedControl) {
        el.classList.add("focused", "lp-control-focused", cls);
      }
    });
  }

  function moveLiveControlFocus(direction) {
    if (direction === "left") {
      focusedControl = "play-pause";
    } else if (direction === "right") {
      focusedControl =
        focusedControl === "play-pause" ? "fullscreen-toggle" : "ar";
    } else if (direction === "up") {
      focusedControl = "play-pause";
    } else if (direction === "down") {
      focusedControl = "ar";
    }

    showLiveControls();
    updateLiveControlFocus();
  }

  function toggleLiveFullscreen() {
    const playerContainer = document.querySelector(".live-video-player-div");
    if (!playerContainer) return false;

    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (playerContainer.requestFullscreen) playerContainer.requestFullscreen();
        else if (playerContainer.webkitRequestFullscreen)
          playerContainer.webkitRequestFullscreen();
        else if (playerContainer.msRequestFullscreen)
          playerContainer.msRequestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      return true;
    } catch (err) {
      console.warn("Live fullscreen toggle failed:", err);
      return false;
    }
  }

  function handleLiveControlEnter() {
    showLiveControls();
    updateLiveControlFocus();

    if (focusedControl === "play-pause") return togglePlayPause();
    if (focusedControl === "fullscreen-toggle") return toggleLiveFullscreen();
    if (focusedControl === "ar" && handleAspectRatioChange) {
      handleAspectRatioChange();
      return true;
    }
    return false;
  }

  function handleLiveArrowKey(e) {
    if (!isLivePlayerFocused()) return false;

    switch (e.keyCode) {
      case 37:
        moveLiveControlFocus("left");
        break;
      case 39:
        moveLiveControlFocus("right");
        break;
      case 38:
        moveLiveControlFocus("up");
        break;
      case 40:
        moveLiveControlFocus("down");
        break;
      case 13:
        handleLiveControlEnter();
        break;
      default:
        return false;
    }

    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  function updatePlayPauseIcon(isPlaying) {
    const playPauseIcon = document.querySelector(".play-pause-icon i");
    if (playPauseIcon) {
      if (isPlaying) {
        playPauseIcon.className = "fa-solid fa-pause";
      } else {
        playPauseIcon.className = "fa-solid fa-play";
      }
    }
  }

  // Function to update aspect ratio button visibility
  function updateAspectRatioButtonVisibility() {
    const aspectRatioBtn = document.querySelector(".videojs-aspect-ratio-div");
    const loadingEl = document.querySelector(".live-video-loader");
    const errorEl = document.querySelector(".live-video-error");

    if (aspectRatioBtn) {
      // Hide aspect ratio button when loader is visible or error is visible
      if (
        (loadingEl && !loadingEl.classList.contains("hidden")) ||
        (errorEl && !errorEl.classList.contains("hidden"))
      ) {
        aspectRatioBtn.style.display = "none";
      }
    }
  }

  console.log(srcUrl, "srcUrl");

  // If no URL is provided
  if (!srcUrl || srcUrl.trim() === "") {
    return `
      <div class="live-video-player live-video-player-div" style="width:100%; height:100%;">
        <div class="live-no-url-message">
          <div class="no-url-icon">📺</div>
          <p class="no-url-text">Please select any channel to play</p>
        </div>
        <video id="${id}" class="video-js vjs-big-play-centered" playsinline webkit-playsinline style="height:100%; width:100%; display:none;"></video>
      </div>
      <div class="livetv-player-epg"  style="display: none;">
        <div class="livetv-player-epg-item">
          <p class="livetv-player-epg-title">No EPG Found</p>
          <p class="livetv-player-epg-description">No EPG data available</p>
        </div>
      </div>
    `;
  }

  setTimeout(() => {
    if (window.livePlayer) {
      try {
        window.livePlayer.dispose();
      } catch {}
      window.livePlayer = null;
    }

    const loadingEl = document.querySelector(".live-video-loader");
    const errorEl = document.querySelector(".live-video-error");
    const aspectRatioBtn = document.querySelector(".videojs-aspect-ratio-div");

    if (loadingEl) loadingEl.classList.remove("hidden");
    if (errorEl) errorEl.classList.add("hidden");

    // Initial aspect ratio button visibility
    updateAspectRatioButtonVisibility();

    if (isTsStream && typeof flowplayer !== "undefined") {
      const hlsUrl = srcUrl.replace(
        /\.ts(\?.*)?$/i,
        (m, q) => `.m3u8${q || ""}`
      );
      const fpContainer = document.getElementById("flowplayer-live");
      if (fpContainer) {
        const wrapperEl = fpContainer.closest(".live-video-player-div");
        const fp = flowplayer(fpContainer, {
          autoplay: true,
          controls: false,
          ratio: 0,
          clip: {
            sources: [{ type: "application/x-mpegURL", src: hlsUrl }],
          },
        });

        // Shim to maintain API parity used elsewhere
        window.livePlayer = {
          _fp: fp,
          isFullscreen() {
            try {
              return document.fullscreenElement === wrapperEl;
            } catch {
              return false;
            }
          },
          requestFullscreen() {
            try {
              if (wrapperEl && wrapperEl.requestFullscreen)
                wrapperEl.requestFullscreen();
              else if (wrapperEl && wrapperEl.webkitRequestFullscreen)
                wrapperEl.webkitRequestFullscreen();
            } catch {}
          },
          exitFullscreen() {
            try {
              if (document.exitFullscreen) document.exitFullscreen();
              else if (document.webkitExitFullscreen)
                document.webkitExitFullscreen();
            } catch {}
          },
          on(ev, handler) {
            try {
              fp.on(ev, handler);
            } catch {}
          },
          src({ src }) {
            try {
              fp.load(src);
            } catch {}
          },
          load() {},
          dispose() {
            try {
              fp.unload();
            } catch {}
          },
        };

        // Loader / error wiring
        fp.on("ready", () => {
          if (loadingEl) loadingEl.classList.remove("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
        });
        fp.on("buffer", () => {
          // A paused video is never "buffering" — ignore stray buffer
          // events that fire while the user has already paused.
          if (isLivePaused()) return;
          if (loadingEl) loadingEl.classList.remove("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
        });
        fp.on("resume", () => {
          if (loadingEl) loadingEl.classList.add("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();

          // Remove/Hide any internal waiting overlays just in case
          const fpWaiting = fpContainer.querySelector(".fp-waiting");
          if (fpWaiting) fpWaiting.style.display = "none";
          const vLoader = document.querySelector(".live-video-loader");
          if (vLoader) vLoader.classList.add("hidden");
          updatePlayPauseIcon(true);

          // Auto-hide top overlays after 5 seconds
          setTimeout(() => {
            const topOverlays = document.querySelector(".live-top-overlays");
            if (topOverlays) {
              topOverlays.style.opacity = "0";
              topOverlays.style.transition = "opacity 0.5s ease";
            }
          }, 5000);
        });
        fp.on("pause", () => {
          if (loadingEl) loadingEl.classList.add("hidden");
          updatePlayPauseIcon(false);
          updateAspectRatioButtonVisibility();
        });
        fp.on("error", () => {
          if (loadingEl) loadingEl.classList.add("hidden");
          if (errorEl) errorEl.classList.remove("hidden");
          updateAspectRatioButtonVisibility();

          console.log("Flowplayer error event");
        });

        // Add play/pause event listeners for Flowplayer
        fp.on("play", () => {
          updatePlayPauseIcon(true);
        });
        fp.on("pause", () => {
          updatePlayPauseIcon(false);
        });

        const fullscreenBtn = document.getElementById("live-fullscreen-btn");
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener("click", () => {
            if (window.livePlayer.isFullscreen()) {
              window.livePlayer.exitFullscreen();
            } else {
              window.livePlayer.requestFullscreen();
            }
          });
        }

        const handleFullscreenChange = () => {
          const channelNameEl = document.querySelector(".live-channel-name");
          const liveBadgeEl = document.querySelector(".live-badge");
          const isFs = window.livePlayer.isFullscreen();
          if (channelNameEl)
            channelNameEl.style.display = isFs ? "none" : "flex";
          if (liveBadgeEl) liveBadgeEl.style.display = "flex";
        };
        fp.on("fullscreen", handleFullscreenChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        handleFullscreenChange();

        const retryBtn = document.querySelector(".retry-btn");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            if (loadingEl) loadingEl.classList.remove("hidden");
            if (errorEl) errorEl.classList.add("hidden");
            updateAspectRatioButtonVisibility();
            window.livePlayer.src({ src: hlsUrl });
          });
        }

        // Mirror Video.js loader behavior using underlying HTML5 video events
        const html5Video = fpContainer.querySelector("video");
        if (html5Video) {
          const showLoader = () => {
            if (isLivePaused()) return;
            if (loadingEl) loadingEl.classList.remove("hidden");
            if (errorEl) errorEl.classList.add("hidden");
            updateAspectRatioButtonVisibility();
          };
          const hideLoader = () => {
            if (loadingEl) loadingEl.classList.add("hidden");
            if (errorEl) errorEl.classList.add("hidden");
            updateAspectRatioButtonVisibility();
          };
          html5Video.addEventListener("waiting", showLoader);
          html5Video.addEventListener("stalled", showLoader);
          html5Video.addEventListener("seeking", showLoader);
          html5Video.addEventListener("playing", hideLoader);
          html5Video.addEventListener("canplay", hideLoader);
          html5Video.addEventListener("seeked", hideLoader);
        }
      }
    } else {
      const videoEl = document.getElementById(id);
      if (videoEl) {
        window.livePlayer = videojs(videoEl, {
          autoplay: true,
          controls: true,
          preload: "auto",
          liveui: true,
          fill: true,
          fluid: false,
          sources: [{ src: srcUrl, type: "application/x-mpegURL" }],
        });

        window.livePlayer.on("waiting", () => {
          // A paused video is never "buffering" — ignore stray waiting
          // events that fire while the user has already paused.
          if (isLivePaused()) return;
          if (loadingEl) loadingEl.classList.remove("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
        });

        window.livePlayer.on("stalled", () => {
          if (isLivePaused()) return;
          if (loadingEl) loadingEl.classList.remove("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
        });

        window.livePlayer.on("loadstart", () => {
          if (loadingEl) loadingEl.classList.remove("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
        });

        window.livePlayer.on("playing", () => {
          if (loadingEl) loadingEl.classList.add("hidden");
          if (errorEl) errorEl.classList.add("hidden");
          updateAspectRatioButtonVisibility();
          updatePlayPauseIcon(true);

          setTimeout(() => {
            const topOverlays = document.querySelector(".live-top-overlays");
            if (topOverlays) {
              topOverlays.style.opacity = "0";
              topOverlays.style.transition = "opacity 0.5s ease";
            }
          }, 5000);
        });

        window.livePlayer.on("pause", () => {
          // A paused video is never "buffering" — clear the loader so it
          // can't get stuck on screen once playback settles into paused.
          if (loadingEl) loadingEl.classList.add("hidden");
          updatePlayPauseIcon(false);
          updateAspectRatioButtonVisibility();
        });

        window.livePlayer.on("play", () => {
          updatePlayPauseIcon(true);
        });

        window.livePlayer.on("error", () => {
          if (loadingEl) loadingEl.classList.add("hidden");
          if (errorEl) errorEl.classList.remove("hidden");
          updateAspectRatioButtonVisibility();
        });

        const retryBtn = document.querySelector(".retry-btn");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            if (window.livePlayer) {
              if (loadingEl) loadingEl.classList.remove("hidden");
              if (errorEl) errorEl.classList.add("hidden");
              updateAspectRatioButtonVisibility();

              window.livePlayer.src({
                src: srcUrl,
                type: "application/x-mpegURL",
              });
              window.livePlayer.load();
            }
          });
        }

        const fullscreenBtn = document.getElementById("lp-fullscreen-btn");
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener("click", () => {
            const playerContainer = document.querySelector(
              ".live-video-player-div"
            );

            if (!document.fullscreenElement) {
              // Enter fullscreen - request on the container, not the player
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
          });
        }

        const handleFullscreenChange = () => {
          const techEl = document.querySelector(".vjs-tech");
          const channelNameEl = document.querySelector(".live-channel-name");
          const liveBadgeEl = document.querySelector(".live-badge");
          const isFs = window.livePlayer.isFullscreen();
          // Do not force tech element height; let Video.js/Tizen handle it
          if (channelNameEl)
            channelNameEl.style.display = isFs ? "none" : "flex";
          if (liveBadgeEl) liveBadgeEl.style.display = "flex";
        };

        window.livePlayer.on("fullscreenchange", handleFullscreenChange);
        handleFullscreenChange();

        const prevBtn = document.getElementById("live-prev-btn");
        const nextBtn = document.getElementById("live-next-btn");

        if (prevBtn) {
          prevBtn.addEventListener("click", () => {
            const event = new CustomEvent("liveChannelChange", {
              detail: { direction: "prev" },
            });
            document.dispatchEvent(event);
          });
        }

        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            const event = new CustomEvent("liveChannelChange", {
              detail: { direction: "next" },
            });
            document.dispatchEvent(event);
          });
        }

      }
    }

    registerTizenPlaybackKeys();
    if (window._liveTvVolumeHandler) {
      document.removeEventListener("keydown", window._liveTvVolumeHandler);
    }

    window._liveTvVolumeHandler = (e) => {
      if (localStorage.getItem("currentPage") !== "liveTvPage") return;

      switch (e.keyCode) {
        case 447:
          updateVolume("up");
          e.preventDefault();
          return;
        case 448:
          updateVolume("down");
          e.preventDefault();
          return;
        case 449:
          toggleMute();
          e.preventDefault();
          return;
      }

      const playbackAction = getRemotePlaybackAction(e);
      if (playbackAction && handleRemotePlaybackAction(playbackAction)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      handleLiveArrowKey(e);
    };

    document.addEventListener("keydown", window._liveTvVolumeHandler);

    // Add click event listener for play/pause icon
    const playPauseIcon = document.querySelector(".play-pause-icon");
    if (playPauseIcon) {
      playPauseIcon.addEventListener("click", togglePlayPause);
    }
    handleAspectRatioChange = () => {
      const videoEl =
        document.querySelector("#live-videojs-player_html5_api") ||
        document.querySelector("#flowplayer-live video");
      if (videoEl && window.VideoAspectRatio) {
        const newLabel = window.VideoAspectRatio.cycle(videoEl);
        window.VideoAspectRatio.showOverlay(newLabel);
      } else {
        console.warn(
          "Aspect ratio handler: No video element or VideoAspectRatio module found"
        );
      }
    };

    const aspectRatioButton = document.getElementById("videojs-aspect-ratio");
    if (aspectRatioButton) {
      aspectRatioButton.addEventListener("click", handleAspectRatioChange);
      console.log("Aspect ratio button event listener attached");
    }
  }, 50);

  // Add cleanup function to dispose player when component is not open
  LiveVideoJsComponent.cleanup = function () {
    // Clean up volume event listener
    if (window._liveTvVolumeHandler) {
      document.removeEventListener("keydown", window._liveTvVolumeHandler);
      window._liveTvVolumeHandler = null;
    }
    const aspectRatioButton = document.getElementById("videojs-aspect-ratio");
    if (aspectRatioButton) {
      aspectRatioButton.removeEventListener("click", handleAspectRatioChange);
    }
    // Store player reference to avoid race conditions
    const currentPlayer = window.livePlayer;
    if (currentPlayer) {
      // Set player to null first to prevent further access
      window.livePlayer = null;

      // Then safely dispose
      try {
        if (typeof currentPlayer.dispose === "function") {
          currentPlayer.dispose();
        }
      } catch (err) {
        console.warn("LiveVideoJsComponent player dispose error:", err);
      }
    }

    // Clean up event listeners
    try {
      // Remove fullscreen change listener
      document.removeEventListener("fullscreenchange", () => {});

      // Remove play/pause icon click listener
      const playPauseIcon = document.querySelector(".play-pause-icon");
      if (playPauseIcon) {
        playPauseIcon.removeEventListener("click", togglePlayPause);
      }
    } catch (err) {
      console.warn("Event listener cleanup error:", err);
    }

    // Reset volume handler flag
    window._liveTvVolumeHandlerAttached = false;
  };

  return `
  <div class="livetvPlayer-main-container">
    <div class="live-video-player live-video-player-div" style="width:100%; height:100%;">
      <div class="videojs-aspect-ratio-div">
        <button id="videojs-aspect-ratio" style="display:none;" class="videojs-aspect-ratio-btn"><i class="fa-solid fa-compress" style="color:white"></i>Aspect Ratio </button>
      </div>
      <div class="play-pause-icon" >
        <i class="fa-solid fa-play"></i>

      </div>
      <div class="live-top-overlays">
        <div class="live-channel-name">${channelName || ""}</div>
        <div class="live-badge">LIVE</div>
      </div>
      <div class="live-video-loader"><div class="live-spinner"></div></div>
      <div class="live-video-error hidden">
        <div class="error-icon">⚠️</div>
        <p>Failed to load video</p>
        <!-- <button class="retry-btn">Retry</button> -->
      </div>
      <div class="live-video-controls">
        <div id="lp-fullscreen-btn" class="lp-fullscreen-btn">
          <i class="fa-sharp fa-solid fa-expand lp-fullscreen-icon"></i>
        </div>
      </div>
      ${
        isTsStream
          ? `<div id="flowplayer-live" class="flowplayer " style="height:100%; width:100%;">
             <video>
               <source type="application/x-mpegURL" src="${srcUrl.replace(
                 /\.ts(\?.*)?$/i,
                 (m, q) => `.m3u8${q || ""}`
               )}">
             </video>
           </div>`
          : `<video id="${id}" class="video-js vjs-big-play-centered vjs-fullscreen " playsinline webkit-playsinline style="height:100%; width:100%;"></video>`
      }

          <div id="aspectRatioOverlay" class="aspect-ratio-overlay "></div>

    </div>
          <div class="livetv-player-epg" style="display: none;">
        <div class="livetv-player-epg-item">
          <p class="livetv-player-epg-title">Loading EPG...</p>
        </div>
      </div>
    </div>
  `;
}
