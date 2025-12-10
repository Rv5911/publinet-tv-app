/* AppWorker.js */

// Internal data storage
let moviesData = { categories: [], streams: [] };
let seriesData = { categories: [], streams: [] };
let liveData = { categories: [], streams: [] };
let config = { adultsCategories: [] };

function normalizeText(s) {
  return (s || "").trim().toLowerCase();
}

function isAdult(name) {
  const normalized = normalizeText(name);
  if (config.adultsCategories.includes(normalized)) return true;
  return /(adult|xxx|18\+|18\s*plus|sex|porn|nsfw)/i.test(normalized);
}

function filterStreamsByQuery(streams, query) {
  if (!query) return streams;
  const q = normalizeText(query);
  return streams.filter((s) => normalizeText(s.name).includes(q));
}

function sortCategories(categories, sortType) {
  if (!categories || categories.length === 0) return categories;

  let alphabetic = [];
  let nonAlphabetic = [];

  for (let i = 0; i < categories.length; i++) {
    let cat = categories[i];
    let firstChar = (cat.title || "").charAt(0);
    if (/^[A-Za-z]$/.test(firstChar)) {
      alphabetic.push(cat);
    } else {
      nonAlphabetic.push(cat);
    }
  }

  const sortAlpha = (a, b) =>
    (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase());
  const sortAlphaDesc = (a, b) =>
    (b.title || "").toLowerCase().localeCompare((a.title || "").toLowerCase());

  switch (sortType) {
    case "a-z":
      alphabetic.sort(sortAlpha);
      nonAlphabetic.sort(sortAlpha);
      return alphabetic.concat(nonAlphabetic);
    case "z-a":
      alphabetic.sort(sortAlphaDesc);
      nonAlphabetic.sort(sortAlphaDesc);
      return alphabetic.concat(nonAlphabetic);
    case "recently-added":
      return categories.sort(
        (a, b) => (b.category_id || 0) - (a.category_id || 0)
      );
    case "top-rated":
      return categories.sort((a, b) => {
        const getAvg = (list) => {
          if (!list || !list.length) return 0;
          return (
            list.reduce(
              (sum, item) => sum + (parseFloat(item.rating_5based) || 0),
              0
            ) / list.length
          );
        };
        return getAvg(b.movies || b.series) - getAvg(a.movies || a.series);
      });
    default:
      return categories;
  }
}

// --- Movies Logic ---
function processMovies({ query, sort }) {
  const { categories, streams } = moviesData;
  if (!categories.length || !streams.length) return [];

  let results = [];
  for (let i = 0; i < categories.length; i++) {
    let category = categories[i];
    if (!category) continue;

    let categoryMovies = [];
    for (let j = 0; j < streams.length; j++) {
      let stream = streams[j];
      if (stream.category_id == category.category_id) {
        categoryMovies.push(stream);
      }
    }

    if (query) {
      categoryMovies = filterStreamsByQuery(categoryMovies, query);
    }
    categoryMovies = categoryMovies.slice(0, 50);

    results.push({
      title: category.category_name
        ? category.category_name.replace(/[*]/g, "")
        : "Category",
      movies: categoryMovies,
      id: category.category_id,
      containerClass: "movies-category-container",
      category_id: category.category_id,
    });
  }

  return sortCategories(results, sort);
}

// --- Series Logic ---
function processSeries({ query, sort }) {
  const { categories, streams } = seriesData;
  if (!categories.length || !streams.length) return [];

  let results = [];
  for (let i = 0; i < categories.length; i++) {
    let category = categories[i];
    let categorySeries = [];
    for (let j = 0; j < streams.length; j++) {
      let stream = streams[j];
      if (stream.category_id == category.category_id) {
        categorySeries.push(stream);
      }
    }

    if (query) {
      categorySeries = filterStreamsByQuery(categorySeries, query);
    }
    categorySeries = categorySeries.slice(0, 50);

    results.push({
      title: category.category_name || "Category",
      series: categorySeries,
      id: category.category_id,
      containerClass: "series-category-container",
      category_id: category.category_id,
    });
  }

  return sortCategories(results, sort);
}

// --- Live Logic ---
function processLive({ categoryQuery, channelQuery, categoryId, sort }) {
  // 1. Filter Categories
  let filteredCategories = liveData.categories;
  if (categoryQuery) {
    const q = normalizeText(categoryQuery);
    filteredCategories = filteredCategories.filter((c) =>
      normalizeText(c.category_name).includes(q)
    );
  }

  // 2. Filter Channels
  let filteredStreams = liveData.streams;

  // Filter by Category ID if provided
  if (
    categoryId &&
    categoryId !== "All" &&
    categoryId !== "favorites" &&
    categoryId !== "channelHistory"
  ) {
    filteredStreams = filteredStreams.filter(
      (s) => String(s.category_id) === String(categoryId)
    );
  }

  // Filter by Channel Name Query
  if (channelQuery) {
    filteredStreams = filterStreamsByQuery(filteredStreams, channelQuery);
  }

  // Apply Sorting
  if (sort === "a-z") {
    filteredStreams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sort === "z-a") {
    filteredStreams.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
  } else if (sort === "recently-added") {
    filteredStreams.sort((a, b) => {
      const timeA = a.added ? parseInt(a.added) : 0;
      const timeB = b.added ? parseInt(b.added) : 0;
      return timeB - timeA;
    });
  }

  return {
    categories: filteredCategories,
    streams: filteredStreams,
  };
}

self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  try {
    let result = null;

    switch (type) {
      case "SET_MOVIES_DATA":
        moviesData.categories = payload.categories || [];
        moviesData.streams = payload.streams || [];
        result = { success: true };
        break;
      case "SET_SERIES_DATA":
        seriesData.categories = payload.categories || [];
        seriesData.streams = payload.streams || [];
        result = { success: true };
        break;
      case "SET_LIVE_DATA":
        liveData.categories = payload.categories || [];
        liveData.streams = payload.streams || [];
        result = { success: true };
        break;
      case "SET_CONFIG":
        if (payload.adultsCategories)
          config.adultsCategories = payload.adultsCategories;
        result = { success: true };
        break;
      case "PROCESS_MOVIES":
        result = processMovies(payload);
        break;
      case "PROCESS_SERIES":
        result = processSeries(payload);
        break;
      case "PROCESS_LIVE":
        result = processLive(payload);
        break;
      default:
        console.error("Unknown worker message type:", type);
    }

    self.postMessage({ type, id, payload: result });
  } catch (err) {
    self.postMessage({ type, id, error: err.message });
  }
};
