async function SeriesDetailPage() {
  if (SeriesDetailPage.cleanup) SeriesDetailPage.cleanup();
  const castImageUrl = "https://image.tmdb.org/t/p/w500";
  const selectedSeriesItem = JSON.parse(
    localStorage.getItem("selectedSeriesItem")
  );

  let seriesIsContinueWatching = false;
  let castList = [];
  let getAllSeriesCastResults = [];
  let getSerieByName = [];
  let selectedSeason = 1;

  const seriesDetailId = localStorage.getItem("selectedSeriesId");

  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
  let navigationInterrupted = false;

  function handleBackNavigationDuringLoading(e) {
    if (
      (e.keyCode === 10009 ||
        e.key === "Escape" ||
        e.key === "Back" ||
        e.key === "BrowserBack" ||
        e.key === "XF86Back") &&
      localStorage.getItem("currentPage") === "seriesDetailPage"
    ) {
      e.preventDefault();
      e.stopPropagation();

      navigationInterrupted = true;

      if (loadingOverlay) loadingOverlay.classList.add("hidden");

      document.removeEventListener(
        "keydown",
        handleBackNavigationDuringLoading
      );

      localStorage.removeItem("selectedSeriesId");
      localStorage.setItem("currentPage", "seriesPage");
      Router.showPage("seriesPage");
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "black";

      return true;
    }
  }

  // Add listener BEFORE any async operations
  document.addEventListener("keydown", handleBackNavigationDuringLoading);
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  const seriesDetailData = await getSeriesDetail(seriesDetailId);
  if (navigationInterrupted) {
    document.removeEventListener("keydown", handleBackNavigationDuringLoading);
    return;
  }
  const lastPlayedEpisodeId = localStorage.getItem("lastPlayedEpisodeId");

  if (seriesDetailData) {
    localStorage.setItem(
      "seriesEpisodesData",
      JSON.stringify(seriesDetailData.episodes || {})
    );
  }

  localStorage.setItem("selectedSeason", selectedSeason.toString());
  if (!seriesDetailData || !seriesDetailData.info) {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    document.removeEventListener("keydown", handleBackNavigationDuringLoading);

    Toaster.showToast("error", "No Data Found of Selected Series");
    localStorage.removeItem("selectedSeriesId");
    localStorage.setItem("currentPage", "seriesPage");
    Router.showPage("seriesPage");
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "black";
    return;
  }

  // if (seriesDetailData && seriesDetailData.info && seriesDetailData.info.name) {
  //   getAllSeriesCastResults = await getSeriesTmbdId(
  //     seriesDetailData.info.name.trim()
  //   );
  //   if (navigationInterrupted) {
  //     document.removeEventListener(
  //       "keydown",
  //       handleBackNavigationDuringLoading
  //     );
  //     return;
  //   }
  // }

  // if (getAllSeriesCastResults && getAllSeriesCastResults.results) {
  //   getSerieByName = getAllSeriesCastResults.results.find(
  //     (s) => s.original_name === seriesDetailData.info.name.trim()
  //   );
  // } else {
  //   getSerieByName = null;
  //   console.warn("No series cast results found");
  // }

  const currentPlaylistName = JSON.parse(
    localStorage.getItem("selectedPlaylist")
  ).playlistName;
  const currentPlaylist = JSON.parse(
    localStorage.getItem("playlistsData")
  ).filter((pl) => pl.playlistName === currentPlaylistName)[0];

  const continueWatchingEpisodes = currentPlaylist.continueWatchingSeries || [];
  if (continueWatchingEpisodes.length > 0) {
    seriesIsContinueWatching = continueWatchingEpisodes.some(
      (item) => item.itemId === seriesDetailId
    );
  }

  const continueWatchingMap = {};
  (continueWatchingEpisodes || []).forEach((item) => {
    if (!item || !item.episodeId) return;

    const seasonKey = 1; // Use 1 if season info is not present
    const episodeKey = Number(item.episodeId); // Must match episode.id

    if (!continueWatchingMap[seasonKey]) continueWatchingMap[seasonKey] = {};

    const progress = item.duration
      ? Math.min(Math.max((item.resumeTime / item.duration) * 100, 0), 100)
      : 0;

    continueWatchingMap[seasonKey][episodeKey] = progress;
  });

  let getSeriesCastData = [];
  if (getSerieByName && getSerieByName.id) {
    // const seriesCast = await getSeriesCast(getSerieByName.id);
    const seriesCast = [];

    getSeriesCastData = seriesCast || [];
    if (navigationInterrupted) {
      document.removeEventListener(
        "keydown",
        handleBackNavigationDuringLoading
      );
      return;
    }
  } else {
    getSeriesCastData = [];
  }

  document.removeEventListener("keydown", handleBackNavigationDuringLoading);

  if (loadingOverlay) loadingOverlay.classList.add("hidden");

  if (!seriesDetailData) {
    localStorage.removeItem("selectedSeriesId");
    localStorage.setItem("currentPage", "seriesPage");
    Router.showPage("seriesPage");
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "black";
    return;
  }

  const scrollToElement = (el) => {
    if (!el) return;
    const container =
      el.closest(".series-cards-list-container") ||
      el.closest(".series-channels-list") ||
      el.closest(".series-detail-cast") ||
      el.closest(".series-detail-page-content-container");
    if (!container) return;

    if (container.classList.contains("series-detail-cast")) {
      container.scrollLeft =
        el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
    } else {
      container.scrollTop =
        el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    }
  };

  let currentFocusIndex = 0;
  let focusableEls = [];
  let lastFocused = null;
  let isDropdownOpen = false;
  let dropdownFocusIndex = 0;
  let currentEpisodeIndex = 0;

  const episodes = seriesDetailData.episodes || {};

  if (lastPlayedEpisodeId) {
    Object.keys(episodes).forEach((seasonKey) => {
      const seasonEpisodes = episodes[seasonKey];
      const playedEpisode = seasonEpisodes.find(
        (ep) => ep.id.toString() === lastPlayedEpisodeId
      );
      if (playedEpisode) {
        selectedSeason = parseInt(seasonKey);
      }
    });
  }

  const seasons = Object.keys(episodes)
    .map((seasonKey) => ({
      season_number: parseInt(seasonKey),
      episode_count: episodes[seasonKey].length,
    }))
    .sort((a, b) => a.season_number - b.season_number);
  const seriesInfo = seriesDetailData.info || {};

  const setFocus = (el, skipScroll = false) => {
    if (lastFocused)
      lastFocused.classList.remove("series-detail-button-focused");
    if (!el) return;

    el.classList.add("series-detail-button-focused");

    // Don't scroll for seasons button specifically
    if (!skipScroll && el.id !== "seasons-button") {
      if (el.classList.contains("seasons-episodes-item")) {
        const container = document.querySelector(
          ".series-detail-page-content-container"
        );
        if (container) container.scrollTop = container.scrollHeight;

        if (el.classList.contains("seasons-episodes-item")) {
          const episodesContainer = document.querySelector(
            ".series-detail-cast"
          );
          if (episodesContainer) {
            const elementLeft = el.offsetLeft;
            const elementWidth = el.offsetWidth;
            const containerWidth = episodesContainer.clientWidth;
            const currentScrollLeft = episodesContainer.scrollLeft;

            if (elementLeft < currentScrollLeft) {
              episodesContainer.scrollLeft = elementLeft - 30;
            } else if (
              elementLeft + elementWidth >
              currentScrollLeft + containerWidth
            ) {
              episodesContainer.scrollLeft =
                elementLeft + elementWidth - containerWidth + 30;
            }
          }
        }
      } else {
        scrollToElement(el);
      }
    }

    lastFocused = el;
  };

  const rebuildFocusable = () => {
    const playBtn = document.querySelector(".series-detail-play-button");
    const startOverBtn = document.querySelector(
      ".series-detail-start-over-button"
    );
    const trailerBtn = document.querySelector(
      ".series-detail-more-info-button"
    );
    const menuBtn = document.querySelector(".series-detail-page-header-menu");
    const favBtn = document.querySelector(".series-detail-fav-button");
    const seasonsBtn = document.querySelector("#seasons-button");
    const castBtn = document.querySelector("#cast-button");
    const episodeItems = [
      ...document.querySelectorAll(".seasons-episodes-item"),
    ];
    const castItems = [...document.querySelectorAll(".series-cast-item")];

    focusableEls = [
      playBtn,
      startOverBtn,
      trailerBtn,
      favBtn,
      menuBtn,
      seasonsBtn,
      castBtn,
      ...episodeItems,
      ...castItems,
    ].filter(Boolean);
  };

  const initFocus = () => {
    rebuildFocusable();
    if (lastPlayedEpisodeId) {
      const playedEpisodeItem = document.querySelector(
        `[data-episode-id="${lastPlayedEpisodeId}"]`
      );
      if (playedEpisodeItem) {
        currentFocusIndex = focusableEls.indexOf(playedEpisodeItem);
        setFocus(playedEpisodeItem);
        return;
      }
    }
    const menuBtn = document.querySelector(".series-detail-page-header-menu");
    const firstBtn = document.querySelector(".series-detail-play-button");
    if (firstBtn) {
      currentFocusIndex = focusableEls.indexOf(firstBtn);
      setFocus(firstBtn);
    } else if (focusableEls.length > 0) {
      currentFocusIndex = 0;
      setFocus(focusableEls[currentFocusIndex]);
    }
  };

  const scrollDropdownToFocused = () => {
    const dropdown = document.querySelector(".seasons-dropdown");
    const focusedItem = document.querySelector(".dropdown-item-focused");
    if (!dropdown || !focusedItem) return;

    const itemTop = focusedItem.offsetTop;
    const itemHeight = focusedItem.offsetHeight;
    const dropdownHeight = dropdown.clientHeight;
    const currentScrollTop = dropdown.scrollTop;

    if (itemTop < currentScrollTop) {
      dropdown.scrollTop = itemTop;
    } else if (itemTop + itemHeight > currentScrollTop + dropdownHeight) {
      dropdown.scrollTop = itemTop + itemHeight - dropdownHeight;
    }
  };

  const showDropdown = () => {
    // If only one season, show episodes directly instead of dropdown
    if (Object.keys(episodes).length <= 1) {
      showSeasons(); // Show episodes for the single season
      return;
    }

    const dropdown = document.querySelector(".seasons-dropdown");
    const mainContainer = document.querySelector(
      ".series-detail-page-content-container"
    );
    if (dropdown) {
      dropdown.style.display = "block";
      isDropdownOpen = true;
      if (mainContainer) mainContainer.classList.add("dropdown-open");

      dropdownFocusIndex = selectedSeason - 1;
      updateDropdownFocus();

      setTimeout(scrollDropdownToFocused, 50);
    }
  };

  const hideDropdown = () => {
    const dropdown = document.querySelector(".seasons-dropdown");
    const mainContainer = document.querySelector(
      ".series-detail-page-content-container"
    );
    if (dropdown) {
      dropdown.style.display = "none";
      isDropdownOpen = false;
      if (mainContainer) mainContainer.classList.remove("dropdown-open");

      const seasonsBtn = document.querySelector("#seasons-button");
      currentFocusIndex = focusableEls.indexOf(seasonsBtn);
      setFocus(focusableEls[currentFocusIndex], true);
    }
  };

  const updateDropdownFocus = () => {
    const dropdownItems = [...document.querySelectorAll(".dropdown-item")];
    dropdownItems.forEach((item, i) => {
      item.classList.toggle("dropdown-item-focused", i === dropdownFocusIndex);
    });
    setTimeout(scrollDropdownToFocused, 10);
  };

  const updateSeasonButton = () => {
    const seasonsBtn = document.querySelector("#seasons-button");
    if (seasonsBtn) {
      let seasonNumber = selectedSeason.toString().padStart(2, "0");
      // Show dropdown arrow only if there are multiple seasons
      const dropdownArrow =
        Object.keys(episodes).length > 1
          ? ' <i class="fas fa-chevron-down"></i>'
          : "";
      seasonsBtn.innerHTML = `Season ${seasonNumber}${dropdownArrow}`;
    }
  };

  const updatePlayButton = () => {
    const playBtn = document.querySelector(".series-detail-play-button");
    const startOverBtn = document.querySelector(
      ".series-detail-start-over-button"
    );

    if (!playBtn) return;

    // Check if we have continue watching data
    const continueWatchingEpisodes =
      currentPlaylist.continueWatchingSeries || [];
    const lastWatchedEpisode = continueWatchingEpisodes.find(
      (item) => item.itemId === seriesDetailId
    );

    console.log(
      continueWatchingEpisodes,
      "continueWatchingEpisodescontinueWatchingEpisodes"
    );
    if (lastWatchedEpisode && lastWatchedEpisode.episodeId) {
      // Find which season and episode this belongs to
      let foundSeason = null;
      let foundEpisode = null;
      let foundSeasonKey = null;

      Object.keys(episodes).forEach((seasonKey) => {
        const seasonEpisodes = episodes[seasonKey];
        const episode = seasonEpisodes.find(
          (ep) => ep.id.toString() === lastWatchedEpisode.episodeId.toString()
        );

        if (episode) {
          foundSeason = parseInt(seasonKey);
          foundEpisode = episode;
          foundSeasonKey = seasonKey;
        }
      });

      if (foundEpisode && foundSeason && foundSeasonKey) {
        const seasonNum = foundSeason.toString().padStart(2, "0");
        const episodeNum = foundEpisode.episode_num.toString().padStart(2, "0");

        // Update button text AND data attributes
        playBtn.textContent = `Resume - S${seasonNum}.E${episodeNum}`;
        playBtn.setAttribute("data-last-season", foundSeasonKey);
        playBtn.setAttribute(
          "data-last-episode-index",
          episodes[foundSeasonKey].findIndex((ep) => ep.id === foundEpisode.id)
        );
        playBtn.setAttribute("data-last-episode-id", foundEpisode.id);

        // Update start over button if it exists
        if (startOverBtn) {
          startOverBtn.textContent = `Start From Beginning - S${seasonNum}.E${episodeNum}`;
          startOverBtn.setAttribute("data-last-season", foundSeasonKey);
          startOverBtn.setAttribute(
            "data-last-episode-index",
            episodes[foundSeasonKey].findIndex(
              (ep) => ep.id === foundEpisode.id
            )
          );
          startOverBtn.setAttribute("data-last-episode-id", foundEpisode.id);
        }
        return;
      }
    }

    // Default to first episode if no continue watching data
    const firstSeasonKey = Object.keys(episodes).sort(
      (a, b) => parseInt(a) - parseInt(b)
    )[0];
    const firstSeasonEpisodes = episodes[firstSeasonKey] || [];
    const firstEpisode = firstSeasonEpisodes[0];

    if (firstEpisode) {
      const seasonNum = firstSeasonKey.toString().padStart(2, "0");
      const episodeNum = firstEpisode.episode_num.toString().padStart(2, "0");

      playBtn.textContent = `Play - S${seasonNum}.E${episodeNum}`;
      playBtn.setAttribute("data-last-season", firstSeasonKey);
      playBtn.setAttribute("data-last-episode-index", "0");
      playBtn.setAttribute("data-last-episode-id", firstEpisode.id);
    }
  };
  const showSeasons = () => {
    const container = document.querySelector(".series-detail-cast");
    if (!container) return;
    const seasonEpisodes = episodes[selectedSeason.toString()] || [];

    const episodeHtml = seasonEpisodes
      .map((episode, j) => {
        const seasonKey = 1; // must match above
        const episodeKey = Number(episode.id); // match continueWatchingMap

        let progress = 0;
        if (
          continueWatchingMap[seasonKey] &&
          continueWatchingMap[seasonKey][episodeKey] != null
        ) {
          progress = continueWatchingMap[seasonKey][episodeKey];
        }

        return `
      <div class="seasons-episodes-item" tabindex="0" 
           data-episode-index="${j}" data-episode-id="${episode.id}">
        
        <!-- Image Container -->
        <div class="episode-image-container">
          <img src="${
            episode.info.movie_image ||
            seriesInfo.cover ||
            "./assets/noImageFound.png"
          }" class="episode-thumbnail" 
          onerror="this.src='./assets/noImageFound.png'" />
          
          <div class="play-icon-overlay">
            <img src="./assets/playicon.png" />
          </div>
          
          ${
            episode.info.duration
              ? `<div class="episode-duration">${episode.info.duration}m</div>`
              : ""
          }

          <!-- Progress Bar -->
          <div class="episode-progress-container" style="${
            progress == 0 ? "display: none;" : ""
          }">
            <div class="episode-progress-bar" style="width: ${progress}%;"></div>
          </div>
        </div>

        <!-- Info Container -->
        <div class="episode-info-container">
          <div class="episode-info-row-1">
            <span class="episode-number">Ep.${(episode.episode_num || j + 1)
              .toString()
              .padStart(2, "0")}</span>
            <span class="episode-title">${
              episode.title || `Episode ${episode.episode_num}`
            }</span>
            <span class="episode-rating">
              <img src="./assets/rating-star.png" style="width: 14px; height: 14px; margin-right: 4px;">
              ${episode.info.rating_5based || seriesInfo.rating_5based || "N/A"}
            </span>
          </div>
          <p class="episode-description">${
            episode.info.plot ||
            episode.plot ||
            seriesInfo.plot ||
            "No description available."
          }</p>
        </div>
      </div>
    `;
      })
      .join("");

    container.innerHTML = `<div class="seasons-episodes-list">${episodeHtml}</div>`;
    rebuildFocusable();
  };

  const showCast = () => {
    const container = document.querySelector(".series-detail-cast");

    castList = Array.isArray(getSeriesCastData)
      ? getSeriesCastData
      : (getSeriesCastData && getSeriesCastData.cast) || [];

    if (!castList.length) {
      container.innerHTML =
        '<p class="series-no-cast-message">No cast information available</p>';
      rebuildFocusable();

      // Ensure cast button remains focusable
      const castBtn = document.querySelector("#cast-button");
      if (castBtn && !focusableEls.includes(castBtn)) {
        rebuildFocusable();
      }
      return;
    }
    const castHtml = castList
      .map(
        (castMember) => `<div class="series-cast-item" tabindex="0">
        <img src="${
          castMember.profile_path
            ? castImageUrl + castMember.profile_path
            : "/assets/placeholder-img.png"
        }" alt="${
          castMember.original_name || "Unknown"
        }" class="series-cast-item-image"
        onerror="this.src='/assets/placeholder-img.png'"/>
        <p class="series-cast-item-name">${
          castMember.original_name || "Unknown"
        }</p>
      </div>`
      )
      .join("");

    container.innerHTML = castHtml;
    rebuildFocusable();

    const castBtn = document.querySelector("#cast-button");
    currentFocusIndex = focusableEls.indexOf(castBtn);
    setFocus(focusableEls[currentFocusIndex]);
  };

  const playEpisode = (episodeId, episodeIndex, startFromBeginning = false) => {
    const seasonEpisodes = episodes[selectedSeason.toString()] || [];
    const episode = seasonEpisodes[episodeIndex];

    if (episode) {
      currentEpisodeIndex = episodeIndex;
      updatePlayButton();

      localStorage.setItem("selectedEpisodeId", episodeId);

      localStorage.setItem("selectedSeason", selectedSeason.toString());

      const currentPlaylist = JSON.parse(
        localStorage.getItem("currentPlaylistData")
      );

      const seriesEpisodeVideoUrl = `${currentPlaylist.server_info.server_protocol}://${currentPlaylist.server_info.url}:${currentPlaylist.server_info.port}/series/${currentPlaylist.user_info.username}/${currentPlaylist.user_info.password}/${episodeId}.${episode.container_extension}`;

      // Create a clean copy of the episode data
      const playingItemData = { ...episode };

      // FIX: If starting from beginning, explicitly set resumeTime to 0
      // AND remove any existing continue watching data
      if (startFromBeginning) {
        playingItemData.resumeTime = 0;

        // Remove from continue watching to ensure fresh start
        const username = currentPlaylist.user_info.username;
        removeItemFromHistoryById(
          episodeId,
          "continueWatchingSeries",
          username
        );

        // Also update the current playlist data in localStorage
        const playlistsData = JSON.parse(
          localStorage.getItem("playlistsData") || "[]"
        );
        const updatedPlaylists = playlistsData.map((playlist) => {
          if (playlist.playlistName === currentPlaylistName) {
            const updatedContinueWatching = (
              playlist.continueWatchingSeries || []
            ).filter((item) => item.episodeId !== episodeId);
            return {
              ...playlist,
              continueWatchingSeries: updatedContinueWatching,
            };
          }
          return playlist;
        });
        localStorage.setItem("playlistsData", JSON.stringify(updatedPlaylists));
      }

      localStorage.setItem("playingItemData", JSON.stringify(playingItemData));
      localStorage.setItem("selectedVideoItemUrl", seriesEpisodeVideoUrl);
      localStorage.setItem("from", "series");

      localStorage.setItem("currentPage", "videojsPlayer");
      const navbarEl = document.querySelector("#navbar-root");
      if (navbarEl) {
        navbarEl.style.display = "none";
      }
      Router.showPage("videoJsPlayer");
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = "black";
    }
  };

  const seriesDetailPageKeydownHandler = (e) => {
    if (
      localStorage.getItem("currentPage") == "seriesDetailPage" &&
      localStorage.getItem("navigationFocus") == "seriesDetailPage"
    ) {
      rebuildFocusable();

      // Sync internal state with actual focused element
      const activeEl = document.activeElement;
      if (activeEl && focusableEls.includes(activeEl)) {
        if (lastFocused && lastFocused !== activeEl) {
          lastFocused.classList.remove("series-detail-button-focused");
        }
        lastFocused = activeEl;
        activeEl.classList.add("series-detail-button-focused");
        currentFocusIndex = focusableEls.indexOf(activeEl);
      }

      const playBtn = document.querySelector(".series-detail-play-button");
      const startOverBtn = document.querySelector(
        ".series-detail-start-over-button"
      );
      const trailerBtn = document.querySelector(
        ".series-detail-more-info-button"
      );
      const menuBtn = document.querySelector(".series-detail-page-header-menu");
      const seasonsBtn = document.querySelector("#seasons-button");
      const castBtn = document.querySelector("#cast-button");
      const favBtn = document.querySelector(".series-detail-fav-button");

      const topButtons = [
        playBtn,
        startOverBtn,
        trailerBtn,
        favBtn,
        seasonsBtn,
        castBtn,
      ].filter(Boolean);
      const episodeItems = [
        ...document.querySelectorAll(".seasons-episodes-item"),
      ];
      const castItems = [...document.querySelectorAll(".series-cast-item")];

      const focused = focusableEls[currentFocusIndex];

      // ✅ Handle dropdown navigation
      if (isDropdownOpen) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "ArrowDown") {
          dropdownFocusIndex = Math.min(
            dropdownFocusIndex + 1,
            seasons.length - 1
          );
          updateDropdownFocus();
          return;
        } else if (e.key === "ArrowUp") {
          dropdownFocusIndex = Math.max(dropdownFocusIndex - 1, 0);
          updateDropdownFocus();
          return;
        } else if (e.key === "Enter") {
          const seasonObj = seasons[dropdownFocusIndex];
          if (!seasonObj) {
            console.warn(
              "No season found for dropdownFocusIndex:",
              dropdownFocusIndex,
              seasons
            );
            hideDropdown();
            return;
          }

          selectedSeason = seasonObj.season_number || seasonObj.season || 1;
          updateSeasonButton();
          hideDropdown();
          showSeasons();
          updatePlayButton();
          return;
        } else if (e.key === "Escape") {
          hideDropdown();
          return;
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();

        // If in Top Buttons -> Go to Navbar
        if (topButtons.includes(focused) || focused === menuBtn) {
          localStorage.setItem("navigationFocus", "navbar");

          // Remove focus styling from current
          if (focused) focused.classList.remove("series-detail-button-focused");

          // Focus appropriate navbar item
          const navItem = document.querySelector(
            ".nav-item[data-page='seriesPage']"
          );
          if (navItem) {
            navItem.focus();
            navItem.classList.add("active");
          } else {
            const firstNav = document.querySelector(".nav-item");
            if (firstNav) firstNav.focus();
          }
          return;
        }

        // If in Episodes/Cast -> Go to Top Buttons (Play Button)
        if (episodeItems.includes(focused) || castItems.includes(focused)) {
          if (playBtn) {
            setFocus(playBtn);
            playBtn.focus();
          }
          return;
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();

        // If in Top Buttons -> Go to first Episode/Cast
        if (topButtons.includes(focused) || focused === menuBtn) {
          if (episodeItems.length > 0) {
            setFocus(episodeItems[0]);
            episodeItems[0].focus();
          } else if (castItems.length > 0) {
            setFocus(castItems[0]);
            castItems[0].focus();
          }
          return;
        }

        // If in Episodes -> Navigate down (if grid) or just next?
        // Assuming simple list flow for now, or let ArrowRight handle flow.
        // If user wants grid navigation, we'd need column calculation.
        // For now, let's map ArrowDown to "Next Row" if possible, or just Next Item.
        // Given the layout is likely a flex wrap, ArrowDown usually means index + columns.
        // Let's try a simple heuristic: index + 1 for now, or just let ArrowRight handle it.
        // But user specifically asked for "arrow down from detail button ficus move to epsiodes".
        // That is handled above.
        // For within episodes, standard behavior.
        const nextIndex = currentFocusIndex + 1;
        if (nextIndex < focusableEls.length) {
          setFocus(focusableEls[nextIndex]);
          focusableEls[nextIndex].focus();
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();

        // If in Top Buttons
        if (topButtons.includes(focused)) {
          const currentIndexInTop = topButtons.indexOf(focused);
          if (currentIndexInTop < topButtons.length - 1) {
            const nextBtn = topButtons[currentIndexInTop + 1];
            setFocus(nextBtn);
            nextBtn.focus();
          }
          return;
        }

        // If in Episodes/Cast
        const nextIndex = currentFocusIndex + 1;
        if (nextIndex < focusableEls.length) {
          setFocus(focusableEls[nextIndex]);
          focusableEls[nextIndex].focus();
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();

        // If in Top Buttons
        if (topButtons.includes(focused)) {
          const currentIndexInTop = topButtons.indexOf(focused);
          if (currentIndexInTop > 0) {
            const prevBtn = topButtons[currentIndexInTop - 1];
            setFocus(prevBtn);
            prevBtn.focus();
          } else if (currentIndexInTop === 0) {
            // Optional: Go to Menu Button if it exists?
            if (menuBtn) {
              setFocus(menuBtn);
              menuBtn.focus();
            }
          }
          return;
        }

        // If in Episodes/Cast
        const prevIndex = currentFocusIndex - 1;
        if (prevIndex >= 0) {
          setFocus(focusableEls[prevIndex]);
          focusableEls[prevIndex].focus();
        }
        return;
      }

      // ✅ FIXED: Start from beginning functionality in Enter key handler
      if (e.key === "Enter") {
        e.preventDefault();

        if (focused === playBtn) {
          if (playBtn.textContent.includes("Resume")) {
            // Use the stored season and episode data from data attributes
            const lastSeason = playBtn.getAttribute("data-last-season");
            const lastEpisodeIndex = parseInt(
              playBtn.getAttribute("data-last-episode-index")
            );
            const lastEpisodeId = playBtn.getAttribute("data-last-episode-id");

            if (lastSeason && lastEpisodeIndex !== null && lastEpisodeId) {
              // Set the selected season to the correct one
              selectedSeason = parseInt(lastSeason);
              updateSeasonButton();
              showSeasons(); // Update the episodes display

              playEpisode(lastEpisodeId, lastEpisodeIndex, false); // FALSE = resume from last position
            }
          } else {
            // Regular play from beginning - Use the stored data from attributes
            const firstSeason = playBtn.getAttribute("data-last-season");
            const firstEpisodeIndex = parseInt(
              playBtn.getAttribute("data-last-episode-index")
            );
            const firstEpisodeId = playBtn.getAttribute("data-last-episode-id");

            if (firstSeason && firstEpisodeIndex !== null && firstEpisodeId) {
              // Set the selected season to the correct one
              selectedSeason = parseInt(firstSeason);
              updateSeasonButton();
              showSeasons(); // Update the episodes display

              playEpisode(firstEpisodeId, firstEpisodeIndex, true); // TRUE = start from beginning
            }
          }
        } else if (focused === startOverBtn) {
          // Use the stored season and episode data from data attributes
          const lastSeason = startOverBtn.getAttribute("data-last-season");
          const lastEpisodeIndex = parseInt(
            startOverBtn.getAttribute("data-last-episode-index")
          );
          const lastEpisodeId = startOverBtn.getAttribute(
            "data-last-episode-id"
          );

          if (lastSeason && lastEpisodeIndex !== null && lastEpisodeId) {
            // Set the selected season to the correct one
            selectedSeason = parseInt(lastSeason);
            updateSeasonButton();
            showSeasons(); // Update the episodes display

            playEpisode(lastEpisodeId, lastEpisodeIndex, true); // TRUE = start from beginning
          }
        } else if (focused === trailerBtn) {
          if (seriesInfo.youtube_trailer) {
            const trailerUrl = `https://www.youtube.com/watch?v=${seriesInfo.youtube_trailer}`;
            localStorage.setItem("selectedVideoItemUrl", trailerUrl);

            // Navigate to videoJsPlayer page
            localStorage.setItem("currentPage", "videojsPlayer");

            const navbarEl = document.querySelector("#navbar-root");
            if (navbarEl) {
              navbarEl.style.display = "none";
            }
            Router.showPage("videoJsPlayer");

            document.body.style.backgroundImage = "none";
            document.body.style.backgroundColor = "black";
          } else {
            alert("No trailer available");
          }
        } else if (focused === favBtn) {
          const result = toggleFavoriteItem(
            selectedSeriesItem.series_id,
            "favouriteSeries"
          );

          const heart = favBtn.querySelector(".heart-icon");
          const text = favBtn.querySelector(".fav-text");

          if (heart) {
            heart.innerHTML = result.isFav
              ? `<i class="fa-solid fa-heart"></i>`
              : `<i class="fa-regular fa-heart"></i>`;
          }
          if (text) {
            text.textContent = result.isFav
              ? "Remove from Favorites"
              : "Add to Favorites";
          }

          favBtn.setAttribute(
            "aria-label",
            result.isFav ? "Remove from Favorites" : "Add to Favorites"
          );

          Toaster.showToast(
            result.isFav ? "success" : "error",
            result.isFav ? "Added to Favorites" : "Removed from Favorites"
          );
        } else if (focused === seasonsBtn) {
          showDropdown();
        } else if (focused === castBtn) {
          showCast();
        } else if (episodeItems.includes(focused)) {
          const episodeIndex = parseInt(
            focused.getAttribute("data-episode-index")
          );
          const episodeId = focused.getAttribute("data-episode-id");

          // Check if this episode has progress data
          const seasonKey = 1; // Use 1 if season info is not present
          const episodeKey = Number(episodeId);
          let hasProgress = false;

          if (
            continueWatchingMap[seasonKey] &&
            continueWatchingMap[seasonKey][episodeKey] != null
          ) {
            hasProgress = continueWatchingMap[seasonKey][episodeKey] > 0;
          }

          // Only start from beginning if there's NO progress
          playEpisode(episodeId, episodeIndex, !hasProgress);
        } else if (focused === menuBtn) {
          e.preventDefault();
          localStorage.setItem("sidebarPage", "seriesDetailPage");

          const sidebar = document.querySelector(
            ".sidebar-container-series-detail"
          );
          if (sidebar.style.display === "none") {
            openSidebar("seriesDetailPage");
          } else {
            closeSidebar("seriesDetailPage");
          }
        }
        return;
      }
      // Back/Escape
      if (
        ["Escape", "Back", "BrowserBack", "XF86Back"].includes(e.key) ||
        e.keyCode === 10009
      ) {
        e.preventDefault();

        if (isDropdownOpen) {
          hideDropdown();
          return;
        }
        localStorage.removeItem("selectedSeriesId");
        localStorage.removeItem("lastPlayedEpisodeId");
        localStorage.setItem("currentPage", "seriesPage");
        Router.showPage("seriesPage");
        document.body.style.backgroundImage = "none";
        document.body.style.backgroundColor = "black";
        return;
      }
    } else {
      return;
    }
  };

  document.addEventListener("keydown", seriesDetailPageKeydownHandler);
  SeriesDetailPage.cleanup = () =>
    document.removeEventListener("keydown", seriesDetailPageKeydownHandler);
  // document.removeEventListener("keydown", globalBackHandler);
  // localStorage.removeItem("lastPlayedEpisodeId");

  renderSeriesDetailPage(seriesDetailData);

  setTimeout(() => {
    showSeasons();
    initFocus();
    updateSeasonButton();
    updatePlayButton();

    const favBtn = document.querySelector(".series-detail-fav-button");
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        const result = toggleFavoriteItem(
          selectedSeriesItem.series_id,
          "favouriteSeries"
        );
        favBtn.textContent = result.isFav
          ? "Remove from Favorites"
          : "Add to Favorites";
        Toaster.showToast(
          result.isFav ? "success" : "error",
          result.isFav ? "Added to Favorites" : "Removed from Favorites"
        );
      });
    }
  }, 50);

  function removeItemfromContiueWatchingSerie() {
    removeItemFromHistoryById(
      selectedSeriesItem.series_id,
      "continueWatchingSeries"
    );
    if (selectedSeriesItem) {
      localStorage.setItem(
        "selectedSeriesId",
        selectedSeriesItem.series_id.toString()
      );
      localStorage.setItem("currentPage", "seriesDetailPage");
      localStorage.setItem(
        "selectedSeriesItem",
        JSON.stringify(selectedSeriesItem)
      );
      document.querySelector("#loading-progress").style.display = "none";
      Router.showPage("seriesDetail");
    }
  }
  function renderSeriesDetailPage(data) {
    const seasons = data.seasons || [];

    const episodes = data.episodes || {};
    const dynamicSeasons = Object.keys(episodes)
      .map((seasonKey) => ({
        season_number: parseInt(seasonKey),
        episode_count: episodes[seasonKey].length,
      }))
      .sort((a, b) => a.season_number - b.season_number);

    const seriesInfo = data.info || {};

    const seasonsDropdownHtml = dynamicSeasons
      .map((season) => {
        const seasonNum = season.season_number.toString().padStart(2, "0");
        const episodeCount = season.episode_count.toString().padStart(2, "0");
        return `<div class="dropdown-item" data-season="${season.season_number}">Season ${seasonNum} (${episodeCount} Episodes)</div>`;
      })
      .join("");

    document.querySelector("#series-detail-page").innerHTML = `
<div class="series-detail-page-container" 
<--style="background-image: linear-gradient(
  113.67deg,
  rgba(21, 42, 34, 0.9) 3.4%,
  rgba(11, 30, 33, 0.8) 68.19%,
  rgba(231, 161, 1, 0.7) 132.98%
), url('${
      (seriesInfo.backdrop_path && seriesInfo.backdrop_path[0]) ||
      seriesInfo.cover ||
      "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"
    }'); background-size: cover; background-position: center;"
    
    -->
    >
    
    <div class="series-detail-page-content-container">
    
    <div class="series-detail-content-container">
      <div class="series-detail-content-main">

        <!-- Image on LEFT (matching MovieDetailPage) -->
        <div class="series-detail-image">
          <img src="${seriesInfo.cover || "./assets/noImageFound.png"}" 
               onerror="this.onerror=null; this.src='./assets/noImageFound.png';"
               class="series-detail-card-poster" />
 
        </div>

        <!-- Content on RIGHT (matching MovieDetailPage) -->
        <div class="series-detail-info-div">
          
          <!-- Series Name -->
          <div class="seriesdetail-series-name">
            <p>${seriesInfo.name || "Unknown Series"}</p>
          </div>

          <!-- Rating, Duration, Release Date -->
          <div class="seriesdetail-series-rating-time">
            <p class="seriesdetail-rating">
              <img src="./assets/rating-star.png">${
                seriesInfo.rating_5based || "N/A"
              }
            </p>
            <p class="seriesdetail-date">${seriesInfo.releaseDate || "N/A"}</p>
          </div>

          <!-- Director and Genre -->
          <div class="seriesdetail-series-directed-and-genre">
            <div>
              <p class="seriesdetail-directed"><span>Directed by:</span> ${
                seriesInfo.director || "N/A"
              }</p>
              <p class="seriesdetail-genre"><span>Genre:</span> ${
                seriesInfo.genre || "N/A"
              }</p>
            </div>
          </div>

          <!-- Description -->
          <div>
            <p class="seriesdetail-series-description">${
              seriesInfo.plot || "No description available."
            }</p>
          </div>

          <!-- Buttons (Play, Start Over, Trailer, Favorites, Seasons) -->
          <div class="series-detail-buttons">
            ${(() => {
              // Find the last watched episode for this series
              const continueWatchingEpisodes =
                currentPlaylist.continueWatchingSeries || [];
              const lastWatchedEpisode = continueWatchingEpisodes.find(
                (item) => item.itemId === seriesDetailId
              );

              if (lastWatchedEpisode && lastWatchedEpisode.episodeId) {
                // Find which season and episode this belongs to - STORE ALL FOUND DATA
                let foundSeason = null;
                let foundEpisodeIndex = null;
                let foundEpisode = null;
                let foundSeasonKey = null;

                // Search through all seasons to find the episode
                Object.keys(episodes).forEach((seasonKey) => {
                  const seasonEpisodes = episodes[seasonKey];
                  const episodeIndex = seasonEpisodes.findIndex(
                    (ep) =>
                      ep.id.toString() ===
                      lastWatchedEpisode.episodeId.toString()
                  );

                  if (episodeIndex !== -1) {
                    foundSeason = parseInt(seasonKey);
                    foundEpisodeIndex = episodeIndex;
                    foundEpisode = seasonEpisodes[episodeIndex];
                    foundSeasonKey = seasonKey; // Store the actual season key
                  }
                });

                if (foundEpisode && foundSeason && foundSeasonKey) {
                  const seasonNum = foundSeason.toString().padStart(2, "0");
                  const episodeNum = foundEpisode.episode_num
                    .toString()
                    .padStart(2, "0");

                  // Store the season and episode info in data attributes for later use
                  return `
                    <button class="series-detail-play-button" tabindex="0" 
                            data-last-season="${foundSeasonKey}" 
                            data-last-episode-index="${foundEpisodeIndex}"
                            data-last-episode-id="${foundEpisode.id}">
                      Resume - S${seasonNum}.E${episodeNum}
                    </button>
                    <button class="series-detail-start-over-button" tabindex="0"
                            data-last-season="${foundSeasonKey}" 
                            data-last-episode-index="${foundEpisodeIndex}"
                            data-last-episode-id="${foundEpisode.id}">
                      Start From Beginning - S${seasonNum}.E${episodeNum}
                    </button>
                  `;
                }
              }

              // Default play button if no continue watching data found
              const firstSeasonKey = Object.keys(episodes).sort(
                (a, b) => parseInt(a) - parseInt(b)
              )[0];
              const firstSeasonEpisodes = episodes[firstSeasonKey] || [];
              if (firstSeasonEpisodes.length > 0) {
                const firstEpisode = firstSeasonEpisodes[0];
                return `
                  <button class="series-detail-play-button" tabindex="0"
                          data-last-season="${firstSeasonKey}" 
                          data-last-episode-index="0"
                          data-last-episode-id="${firstEpisode.id}">
                    Play - S${firstSeasonKey
                      .toString()
                      .padStart(2, "0")}.E${firstEpisode.episode_num
                  .toString()
                  .padStart(2, "0")}
                  </button>
                `;
              }

              return `<button class="series-detail-play-button" tabindex="0">Play</button>`;
            })()}
            
            ${
              data.info && data.info.youtube_trailer
                ? `<button class="series-detail-more-info-button" tabindex="0">Watch Trailer</button>`
                : ""
            }
            
            <button class="series-detail-fav-button" tabindex="0">
              <span class="heart-icon">
                ${
                  isItemFavoriteForPlaylist(
                    selectedSeriesItem.series_id,
                    "favouriteSeries"
                  )
                    ? `<i class="fa-solid fa-heart"></i>`
                    : `<i class="fa-regular fa-heart"></i>`
                }
              </span>
              <span class="fav-text">
                ${
                  isItemFavoriteForPlaylist(
                    selectedSeriesItem.series_id,
                    "favouriteSeries"
                  )
                    ? "Remove from Favorites"
                    : "Add to Favorites"
                }
              </span>
            </button>

            <!-- Seasons button -->
            <div class="seasons-button-container">
              <button class="seasons-button" id="seasons-button" tabindex="0">Season 01</button>
              <div class="seasons-dropdown" style="display: none;">${seasonsDropdownHtml}</div>
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- Cast/Episodes section below -->
    <div class="seasons-and-cast-container">
      <div class="seasons-and-cast-buttons">
      <p class="episodes-title-upper">Episodes</p>
        <button class="cast-button" id="cast-button" style="display: none;" tabindex="0">Cast</button>
      </div>
      <div class="series-detail-cast"></div>
    </div>
  </div>

</div>`;
  }
}
