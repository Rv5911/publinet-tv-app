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

  const duration = 300; 
  const startTime = Date.now();
  const startPercentage = currentPercentage;

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = Math.round(startPercentage + (targetPercentage - startPercentage) * easeOutQuart);
    
    progressElement.textContent = `${currentValue}%`;
    
    if (progress < 1) {
      currentAnimationId = requestAnimationFrame(animate);
    } else {
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
  const defaultDns = "https://test.koolip.live";
  let alldns = JSON.parse(localStorage.getItem("all_dns")) || [];
  if (alldns.length === 0) alldns = [defaultDns];

  const existingPlaylists = JSON.parse(localStorage.getItem("playlistsData")) || [];

  if (!fromPlaylist) {
    var duplicate = existingPlaylists.find(function (p) {
      return p.playlistName.toLowerCase().trim() === playlistName.toLowerCase().trim();
    });
    if (duplicate) {
      Toaster.showToast("error", "Playlist name already exists!");
      return null;
    }
  }

  const loadingOverlay = document.getElementById("loading-overlay");
  loadingOverlay.classList.remove("hidden");
  updateLoadingPercentage(0, "Starting login process...");

  var lastStatusCode = null;

  enableKeyBlock(function () {
    loadingOverlay.classList.add("hidden");
    Toaster.showToast("error", "Login Aborted!");
  });

  // Helper function to load all data APIs
  async function loadAllData() {
    var steps = [
      { fn: getAllVodMovies, msg: "Loading movies data..." },
      { fn: getMoviesCategories, msg: "Loading movie categories..." },
      { fn: getAllVodSeries, msg: "Loading series data..." },
      { fn: getSeriesCategories, msg: "Loading series categories..." },
      { fn: getAllLiveStreams, msg: "Loading live streams..." },
      { fn: getLiveCategories, msg: "Loading live categories..." },
    ];

    var results = [];

    for (var i = 0; i < steps.length; i++) {
      if (isLoginCancelled()) return null;
      updateLoadingPercentage(30 + i * 10, steps[i].msg);
      var res = await steps[i].fn();
      if (!res) return null;
      results.push(res);
      await new Promise(function (r) {
        setTimeout(r, 100);
      });
    }

    window.allMoviesStreams = results[0];
    window.moviesCategories = results[1];
    window.allSeriesStreams = results[2];
    window.allseriesCategories = results[3];
    window.allLiveStreams = results[4];
    window.liveCategories = results[5];

    return true;
  }

  // Function to finalize playlist save after successful data load
  function savePlaylist(data, apiUrl) {
    if (isLoginCancelled()) return null;

    var newPlaylist = {
      playlistName: playlistName,
      playlistUrl: apiUrl,
      playlistUsername: username,
    };

    if (!fromPlaylist) {
      existingPlaylists.push(newPlaylist);
      localStorage.setItem("playlistsData", JSON.stringify(existingPlaylists));
    }

    localStorage.setItem("selectedPlaylist", JSON.stringify(newPlaylist));
    localStorage.setItem("currentPlaylistData", JSON.stringify(data));
  }

  // Case 1: From playlist URL
  if (fromPlaylist && playlistUrl) {
    try {
      updateLoadingPercentage(10, "Validating playlist URL...");
      var response = await fetch(playlistUrl);
      if (isLoginCancelled()) return null;

      if (!response.ok) {
        lastStatusCode = response.status;
        throw new Error("Invalid response " + response.status);
      }

      updateLoadingPercentage(20, "Processing playlist data...");
      var data = await response.json();
      if (isLoginCancelled()) return null;

      if (!data || !data.user_info || data.user_info.auth !== 1 || data.user_info.status !== "Active") {
        Toaster.showToast("error", "Account not activated or invalid playlist data");
        return null;
      }

      var success = await loadAllData();
      if (!success) return null;

      savePlaylist(data, playlistUrl);

      updateLoadingPercentage(100, "Login successful!");
      setTimeout(function () {
        localStorage.setItem("currentPage", "homePage");
        Router.showPage("homePage");
        loadingOverlay.classList.add("hidden");
        disableKeyBlock();
      }, 500);

      return true;
    } catch (err) {
      console.log("❌ Failed to load playlist:", playlistUrl, err);
      Toaster.showToast(
        "error",
        "Invalid Playlist URL" + (lastStatusCode ? " (Status: " + lastStatusCode + ")" : "")
      );
    }
  }

  // Case 2: Try DNS list
  var dnsToCheck = alldns.slice(0, 5);

  for (var i = 0; i < dnsToCheck.length; i++) {
    if (isLoginCancelled()) return null;

    var apiUrl = buildLoginUrl(dnsToCheck[i], username, password);
    updateLoadingPercentage(10 + i * 5, "Testing DNS " + (i + 1) + "/" + dnsToCheck.length + "...");

    try {
      var response = await fetch(apiUrl);
      if (isLoginCancelled()) return null;

      if (!response.ok) {
        lastStatusCode = response.status;
        console.log("❌ Failed DNS: " + dnsToCheck[i] + " (Status: " + response.status + ")");
        continue;
      }

      var data = await response.json();
      if (isLoginCancelled()) return null;
      if (!data || !data.user_info || data.user_info.auth !== 1 || data.user_info.status !== "Active") continue;

      var success = await loadAllData();
      if (!success) return null;

      savePlaylist(data, apiUrl);

      updateLoadingPercentage(100, "Login successful!");
      setTimeout(function () {
        localStorage.setItem("currentPage", "homePage");
        Router.showPage("homePage");
        loadingOverlay.classList.add("hidden");
        disableKeyBlock();
      }, 500);

      return true;
    } catch (err) {
      console.log("❌ Failed DNS:", dnsToCheck[i], err);
      continue;
    }
  }

  updateLoadingPercentage(100, "Login failed");
  setTimeout(function () {
    loadingOverlay.classList.add("hidden");
    disableKeyBlock();
    Toaster.showToast(
      "error",
      "Invalid Credentials" + (lastStatusCode ? " (Status: " + lastStatusCode + ")" : "")
    );
  }, 500);

  return null;
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
