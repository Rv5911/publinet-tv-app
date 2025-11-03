const TMBD_API_KEY = localStorage.getItem("tmbdId") 
// const TMBD_API_KEY = localStorage.getItem("tmbdId") ? localStorage.getItem("tmbdId") : "a21eeaca44af5d2a4349214ecba1b338";

const castImageUrl = "https://image.tmdb.org/t/p/w500";

let currentAnimationId = null;

function updateLoadingPercentage(targetPercentage, message = "") {
  const progressElement = document.getElementById("loading-progress");
  if (!progressElement) return;

  if (currentAnimationId) {
    cancelAnimationFrame(currentAnimationId);
  }

  const currentText = progressElement.textContent;
  const currentMatch = currentText.match(/(\d+)%/);
  const currentPercentage = currentMatch ? parseInt(currentMatch[1]) : 0;

  if (targetPercentage === currentPercentage) {
    progressElement.textContent = `${targetPercentage}%`;
    return;
  }

  const duration = 300; // Reduced duration for faster transitions
  const startTime = Date.now();
  const startPercentage = currentPercentage;

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = Math.round(startPercentage + (targetPercentage - startPercentage) * easeOutQuart);
    
    progressElement.textContent = `${currentValue}%`;
    
    if (progress < 1) {
      currentAnimationId = requestAnimationFrame(animate);
    } else {
      // Ensure we end exactly at target
      progressElement.textContent = `${targetPercentage}%`;
      currentAnimationId = null;
    }
  }

  currentAnimationId = requestAnimationFrame(animate);
}

function buildLoginUrl(dns, username, password) {
  dns = dns.trim();
  if (!dns.endsWith("/")) {
    dns += "/";
  }
  return `${dns}player_api.php?username=${username}&password=${password}`;
}

async function loginApi(
  username,
  password,
  playlistName,
  fromPlaylist = false,
  playlistUrl = ""
) {
  const defaultDns = "http://nubiatv.live/";
  let alldns = JSON.parse(localStorage.getItem("all_dns")) || [];

  if (alldns.length === 0) {
    alldns = [defaultDns];
  }

  const existingPlaylists =
    JSON.parse(localStorage.getItem("playlistsData")) || [];

  if (!fromPlaylist) {
    const duplicate = existingPlaylists.find(
      (p) =>
        p.playlistName.toLowerCase().trim() ===
        playlistName.toLowerCase().trim()
    );

    if (duplicate) {
      Toaster.showToast("error", "Playlist name already exists!");
      return null;
    }
  }

  // ALWAYS show loading overlay at the start
  const loadingOverlay = document.getElementById("loading-overlay");
  loadingOverlay.classList.remove("hidden");
  updateLoadingPercentage(0, "Starting login process...");

  let lastStatusCode = null;

  enableKeyBlock(() => {
    loadingOverlay.classList.add("hidden");
    Toaster.showToast("error", "Login Aborted!");
  });

  try {
    // Case 1: Existing playlist
    if (fromPlaylist && playlistUrl) {
      try {
        updateLoadingPercentage(10, "Validating playlist URL...");
        const response = await fetch(playlistUrl);
        if (isLoginCancelled()) {
          loadingOverlay.classList.add("hidden");
          disableKeyBlock();
          return null;
        }

        if (!response.ok) {
          lastStatusCode = response.status;
          throw new Error(`Invalid response ${response.status}`);
        }

        updateLoadingPercentage(20, "Processing playlist data...");
        const data = await response.json();
        if (isLoginCancelled()) {
          loadingOverlay.classList.add("hidden");
          disableKeyBlock();
          return null;
        }

        if (data && data.user_info) {
          if (data.user_info.auth === 1 && data.user_info.status === "Active") {
            const newPlaylist = {
              playlistName,
              playlistUrl,
              playlistUsername: username,
            };

            localStorage.setItem("selectedPlaylist", JSON.stringify(newPlaylist));
            const newCurrentPlaylistData = { 
              ...data,
              playlistName: playlistName
            };
            localStorage.setItem("currentPlaylistData", JSON.stringify(newCurrentPlaylistData));

            // Load all data sequentially with proper error handling
            updateLoadingPercentage(30, "Loading movies data...");
            const vodMovies = await getAllVodMovies();
            if (isLoginCancelled() || !vodMovies) {
              throw new Error("Failed to load movies data");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(40, "Loading movie categories...");
            const moviesCategories = await getMoviesCategories();
            if (isLoginCancelled() || !moviesCategories) {
              throw new Error("Failed to load movie categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(50, "Loading series data...");
            const vodSeries = await getAllVodSeries();
            if (isLoginCancelled() || !vodSeries) {
              throw new Error("Failed to load series data");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(60, "Loading series categories...");
            const seriesCategories = await getSeriesCategories();
            if (isLoginCancelled() || !seriesCategories) {
              throw new Error("Failed to load series categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(70, "Loading live streams...");
            const vodAllLiveStreams = await getAllLiveStreams();
            if (isLoginCancelled() || !vodAllLiveStreams) {
              throw new Error("Failed to load live streams");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(80, "Loading live categories...");
            const liveCategories = await getLiveCategories();
            if (isLoginCancelled() || !liveCategories) {
              throw new Error("Failed to load live categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            // Store all loaded data
            window.allMoviesStreams = vodMovies;
            window.moviesCategories = moviesCategories;
            window.allSeriesStreams = vodSeries;
            window.allseriesCategories = seriesCategories;
            window.allLiveStreams = vodAllLiveStreams;
            window.liveCategories = liveCategories;

            updateLoadingPercentage(100, "Login successful!");
            
            // Store playlist data only when ALL loading is complete
            if (!fromPlaylist) {
              existingPlaylists.push(newPlaylist);
              localStorage.setItem("playlistsData", JSON.stringify(existingPlaylists));
            }
            
            setTimeout(() => {
                            localStorage.setItem("isLogin", true);

              localStorage.setItem("navigationFocus","navbar")
              localStorage.setItem("currentPage", "homePage");
              Router.showPage("homePage");
              loadingOverlay.classList.add("hidden");
              disableKeyBlock();
            }, 500);
            return true;
          } else {
            throw new Error("Account not activated");
          }
        } else {
          throw new Error("Invalid Playlist Data");
        }
      } catch (error) {
        console.log("❌ Failed to load playlist:", playlistUrl, error);
        throw new Error(`Invalid Playlist URL ${lastStatusCode ? `(Status: ${lastStatusCode})` : ""}`);
      }
    }

    // Case 2: Try DNS list
    const dnsToCheck = alldns.slice(0, 5);
    let success = false;

    for (let i = 0; i < dnsToCheck.length; i++) {
      if (isLoginCancelled()) {
        loadingOverlay.classList.add("hidden");
        disableKeyBlock();
        return null;
      }
      
      const apiUrl = buildLoginUrl(dnsToCheck[i], username, password);
      updateLoadingPercentage(10 + i * 5, `Testing DNS ${i + 1}/${dnsToCheck.length}...`);

      try {
        const response = await fetch(apiUrl);
        if (isLoginCancelled()) {
          loadingOverlay.classList.add("hidden");
          disableKeyBlock();
          return null;
        }

        if (!response.ok) {
          lastStatusCode = response.status;
          console.log(`❌ Failed DNS: ${dnsToCheck[i]} (Status: ${response.status})`);
          continue;
        }

        const data = await response.json();
        if (isLoginCancelled()) {
          loadingOverlay.classList.add("hidden");
          disableKeyBlock();
          return null;
        }

        if (data && data.user_info) {
          if (data.user_info.auth === 1 && data.user_info.status === "Active") {
            const newPlaylist = {
              playlistName,
              playlistUrl: apiUrl,
              playlistUsername: username,
            };

            localStorage.setItem("selectedPlaylist", JSON.stringify(newPlaylist));
            const newCurrentPlaylistData = { 
              ...data,
              playlistName: playlistName
            };
            localStorage.setItem("currentPlaylistData", JSON.stringify(newCurrentPlaylistData));

            // Load all data sequentially with proper error handling
            updateLoadingPercentage(35, "Loading movies data...");
            const vodMovies = await getAllVodMovies();
            if (isLoginCancelled() || !vodMovies) {
              throw new Error("Failed to load movies data");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(45, "Loading movie categories...");
            const moviesCategories = await getMoviesCategories();
            if (isLoginCancelled() || !moviesCategories) {
              throw new Error("Failed to load movie categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(55, "Loading series data...");
            const vodSeries = await getAllVodSeries();
            if (isLoginCancelled() || !vodSeries) {
              throw new Error("Failed to load series data");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(65, "Loading series categories...");
            const seriesCategories = await getSeriesCategories();
            if (isLoginCancelled() || !seriesCategories) {
              throw new Error("Failed to load series categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(75, "Loading live streams...");
            const vodAllLiveStreams = await getAllLiveStreams();
            if (isLoginCancelled() || !vodAllLiveStreams) {
              throw new Error("Failed to load live streams");
            }
            await new Promise((r) => setTimeout(r, 100));

            updateLoadingPercentage(85, "Loading live categories...");
            const liveCategories = await getLiveCategories();
            if (isLoginCancelled() || !liveCategories) {
              throw new Error("Failed to load live categories");
            }
            await new Promise((r) => setTimeout(r, 100));

            // Store all loaded data
            window.allMoviesStreams = vodMovies;
            window.moviesCategories = moviesCategories;
            window.allSeriesStreams = vodSeries;
            window.allseriesCategories = seriesCategories;
            window.allLiveStreams = vodAllLiveStreams;
            window.liveCategories = liveCategories;

            // Store playlist data only when ALL loading is complete
            if (!fromPlaylist) {
              existingPlaylists.push(newPlaylist);
              localStorage.setItem("playlistsData", JSON.stringify(existingPlaylists));
            }

            updateLoadingPercentage(100, "Login successful!");
            success = true;
            
            setTimeout(() => {
                            localStorage.setItem("isLogin", true);

                 localStorage.setItem("navigationFocus","navbar")
              localStorage.setItem("currentPage", "homePage");
              Router.showPage("homePage");
              loadingOverlay.classList.add("hidden");
              disableKeyBlock();
            }, 500);
            return true;
          } else {
            throw new Error("Account not activated");
          }
        }
      } catch (error) {
        console.log("❌ Failed DNS:", dnsToCheck[i], error);
        continue;
      }
    }

    if (!success) {
      throw new Error(`Invalid Credentials${lastStatusCode ? ` (Status: ${lastStatusCode})` : ""}`);
    }

  } catch (error) {
    console.log("❌ Login failed:", error);
    updateLoadingPercentage(100, "Login failed");
    
    setTimeout(() => {
      loadingOverlay.classList.add("hidden");
      disableKeyBlock();
      Toaster.showToast("error", error.message);
    }, 500);
    return null;
  }
}



async function getMoviesCategories() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_vod_categories`
      );
      if (!response.ok) throw new Error("Failed to fetch categories");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get movies categories:", error);
  }
  return null;
}

// ✅ Get all VOD movies
async function getAllVodMovies() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_vod_streams`
      );
      if (!response.ok) throw new Error("Failed to fetch movies");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get movies:", error);
  }
  return null;
}

async function getMovieDetail(movieId) {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_vod_info&vod_id=${movieId}`
      );
      if (!response.ok) throw new Error("Failed to fetch movies");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get movies:", error);
  }
  return null;
}

//series API's
async function getAllVodSeries() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_series`
      );
      if (!response.ok) throw new Error("Failed to fetch get_series");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get get_series:", error);
  }
  return null;
}

async function getSeriesCategories() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_series_categories`
      );
      if (!response.ok)
        throw new Error("Failed to get_series_categories categories");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get get_series_categories categories:", error);
  }
  return null;
}

async function getSeriesDetail(seriesId) {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_series_info&series_id=${seriesId}`
      );
      if (!response.ok) throw new Error("Failed to get_series_detail item");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get_series_detail item:", error);
  }
  return null;
}
//Live API's

async function getAllLiveStreams() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_live_streams`
      );
      if (!response.ok) throw new Error("Failed to fetch get_live_streams");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get get_live_streams:", error);
  }
  return null;
}

async function getLiveCategories() {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_live_categories`
      );
      if (!response.ok)
        throw new Error("Failed to get_live_categories categories");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get get_live_categories categories:", error);
  }
  return null;
}

async function getSeriesTmbdId(seriesName) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/tv?api_key=${localStorage.getItem("tmbdId")}&query=${seriesName}`
    );

    if (!response.ok) throw new Error("Failed to fetch getSeriesTmbdId");
    return await response.json();
  } catch (error) {
    console.log("❌ Failed to get getSeriesTmbdId:", error);
  }
}

async function getSeriesCast(seriesId) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${seriesId}/credits?api_key=${localStorage.getItem("tmbdId")}`
    );
    if (!response.ok) throw new Error("Failed to fetch getSeriesCasts");
    return await response.json();
  } catch (error) {
    console.log("❌ Failed to get getSeriesCasts:", error);
  }
}

async function getMovieCast(movies_tmbd_id) {
  try {
    const repsonse = await fetch(
      `https://api.themoviedb.org/3/movie/${movies_tmbd_id}/credits?api_key=${localStorage.getItem("tmbdId")}`
    );

    if (!repsonse.ok) throw new Error("Failed to fetch getMovieCast");
    return await repsonse.json();
  } catch (error) {
    console.log("❌ Failed to get getMovieCast:", error);
  }
}

async function getLiveStreamEpg(liveStreamId) {
  const selectedPlaylist = JSON.parse(localStorage.getItem("selectedPlaylist"));
  try {
    if (selectedPlaylist) {
      const response = await fetch(
        `${selectedPlaylist.playlistUrl}&action=get_short_epg&stream_id=${liveStreamId}`
      );
      if (!response.ok) throw new Error("Failed to fetch getLiveStreamEpg");
      return await response.json();
    }
  } catch (error) {
    console.log("❌ Failed to get getLiveStreamEpg:", error);
  }
  return null;
}
