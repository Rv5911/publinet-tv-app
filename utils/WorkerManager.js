class WorkerManager {
  constructor() {
    this.worker = null;
    this.callbacks = new Map();
    this.messageId = 0;
  }

  init() {
    if (this.worker) return;
    this.worker = new Worker("utils/AppWorker.js");
    this.worker.onmessage = (e) => {
      const { type, id, payload, error } = e.data;
      if (this.callbacks.has(id)) {
        const { resolve, reject } = this.callbacks.get(id);
        if (error) {
          console.error(`Worker Error [${type}]:`, error);
          reject(error);
        } else {
          resolve(payload);
        }
        this.callbacks.delete(id);
      }
    };
    this.worker.onerror = (err) => {
      console.error("Worker Global Error:", err);
    };
  }

  send(type, payload) {
    if (!this.worker) this.init();
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, payload });
    });
  }

  setMoviesData(categories, streams) {
    // Send lightweight data if possible, but structured clone handles objects efficiently usually.
    // If objects are massive, consider Transferable objects but that requires ArrayBuffers.
    // Basic objects are fine for this app scale usually.
    return this.send("SET_MOVIES_DATA", { categories, streams });
  }

  setSeriesData(categories, streams) {
    return this.send("SET_SERIES_DATA", { categories, streams });
  }

  setLiveData(categories, streams) {
    return this.send("SET_LIVE_DATA", { categories, streams });
  }

  setConfig(config) {
    return this.send("SET_CONFIG", config);
  }

  processMovies(query, sort) {
    return this.send("PROCESS_MOVIES", { query, sort });
  }

  processSeries(query, sort) {
    return this.send("PROCESS_SERIES", { query, sort });
  }

  processLive(categoryQuery, channelQuery, categoryId) {
    return this.send("PROCESS_LIVE", {
      categoryQuery,
      channelQuery,
      categoryId,
    });
  }
}

// Singleton instance exposed globally
window.appWorkerManager = new WorkerManager();
