// Connect the search controls and related UI elements.
const form = document.querySelector(".search-form");
const input = document.querySelector("#search-input");
const searchType = document.querySelector("#search-type");
const clearButton = document.querySelector(".clear-button");
const themeToggle = document.querySelector(".theme-toggle");
const voiceButton = document.querySelector(".voice-button");
const suggestionsPanel = document.querySelector("#search-suggestions");
const historySection = document.querySelector(".history-section");
const historyList = document.querySelector(".history-list");
const searchStatus = document.querySelector(".search-status");
// Local suggestions and saved searches stay in this browser.
const historyKey = "gofind-search-history";
const popularSearches = [
  "beautiful places to visit",
  "easy weeknight recipes",
  "how does solar energy work",
  "latest technology",
  "weather today",
];
let searchHistory = readSearchHistory();
let recognition = null;

// Search providers used for each category.
const searchPaths = {
  web: "https://www.google.com/search",
  images: "https://www.google.com/search?tbm=isch",
  news: "https://news.google.com/search",
  maps: "https://www.google.com/maps/search/",
};

// Build a provider URL and navigate to the selected results.
function getSearchUrl(query, lucky = false) {
  const type = searchType.value;
  if (type === "maps") {
    return `${searchPaths.maps}${encodeURIComponent(query)}`;
  }

  const url = new URL(searchPaths[type]);
  url.searchParams.set("q", query);
  if (lucky) url.searchParams.set("btnI", "1");
  return url.toString();
}

function search(lucky = false) {
  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }
  rememberSearch(query);
  window.location.assign(getSearchUrl(query, lucky));
}

// Submit searches and keep the input's helper controls in sync.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  search();
});

document.querySelector(".lucky-button").addEventListener("click", () => search(true));

input.addEventListener("input", () => {
  clearButton.hidden = input.value.length === 0;
  searchStatus.textContent = "";
  renderSuggestions(input.value);
});

input.addEventListener("focus", () => renderSuggestions(input.value));

clearButton.addEventListener("click", () => {
  input.value = "";
  clearButton.hidden = true;
  renderSuggestions("");
  input.focus();
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.query;
    clearButton.hidden = false;
    renderSuggestions("");
    search();
  });
});

suggestionsPanel.addEventListener("click", (event) => {
  const option = event.target.closest(".suggestion-option");
  if (!option) return;
  input.value = option.dataset.query;
  clearButton.hidden = false;
  renderSuggestions("");
  search();
});

// Load, update, and render recent searches from local storage.
function readSearchHistory() {
  try {
    const saved = localStorage.getItem(historyKey);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every((query) => typeof query === "string")) {
      console.warn("Saved search history has an unexpected format.");
      return [];
    }
    return parsed.slice(0, 8);
  } catch (error) {
    console.warn("Could not load search history.", error);
    return [];
  }
}

function saveSearchHistory() {
  try {
    localStorage.setItem(historyKey, JSON.stringify(searchHistory));
  } catch (error) {
    console.warn("Could not save search history.", error);
    searchStatus.textContent = "Your browser could not save search history.";
  }
}

function rememberSearch(query) {
  searchHistory = [query, ...searchHistory.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
  saveSearchHistory();
  renderHistory();
}

function renderHistory() {
  historyList.replaceChildren();
  historySection.hidden = searchHistory.length === 0;

  searchHistory.forEach((query) => {
    const item = document.createElement("span");
    item.className = "history-item";

    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "history-query";
    searchButton.textContent = query;
    searchButton.setAttribute("aria-label", `Search again for ${query}`);
    searchButton.addEventListener("click", () => {
      input.value = query;
      search();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-history";
    removeButton.setAttribute("aria-label", `Remove ${query} from search history`);
    removeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    removeButton.addEventListener("click", () => {
      searchHistory = searchHistory.filter((itemQuery) => itemQuery !== query);
      saveSearchHistory();
      renderHistory();
      renderSuggestions(input.value);
    });

    item.append(searchButton, removeButton);
    historyList.append(item);
  });
}

// Match typed text against local history and built-in suggestions.
function renderSuggestions(value) {
  const query = value.trim().toLowerCase();
  suggestionsPanel.replaceChildren();
  if (!query) {
    suggestionsPanel.hidden = true;
    return;
  }

  const matches = [...new Set([...searchHistory, ...popularSearches])]
    .filter((suggestion) => suggestion.toLowerCase().includes(query) && suggestion.toLowerCase() !== query)
    .slice(0, 5);

  matches.forEach((suggestion) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "suggestion-option";
    option.setAttribute("role", "option");
    option.dataset.query = suggestion;

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20.2 20.2 16 16m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z");
    icon.append(path);

    const label = document.createElement("span");
    label.textContent = suggestion;
    option.append(icon, label);
    suggestionsPanel.append(option);
  });
  suggestionsPanel.hidden = matches.length === 0;
}

document.querySelector(".clear-history").addEventListener("click", () => {
  searchHistory = [];
  saveSearchHistory();
  renderHistory();
  renderSuggestions(input.value);
});

// Use the browser's speech recognition when available.
function setupVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    searchStatus.textContent = "Voice search is not supported by this browser.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voiceButton.classList.add("listening");
  voiceButton.setAttribute("aria-label", "Listening for your search");
  searchStatus.textContent = "Listening... Speak your search.";

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    input.value = transcript;
    clearButton.hidden = transcript.length === 0;
    searchStatus.textContent = transcript ? `Searching for: ${transcript}` : "No speech was recognized.";
    if (transcript) search();
  };

  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Microphone access was denied. Allow microphone access to use voice search.",
      "service-not-allowed": "Voice search is unavailable because microphone access is blocked.",
      "no-speech": "No speech was detected. Try again.",
    };
    searchStatus.textContent = messages[event.error] || `Voice search failed: ${event.error}.`;
  };

  recognition.onend = () => {
    voiceButton.classList.remove("listening");
    voiceButton.setAttribute("aria-label", "Search by voice");
  };

  try {
    recognition.start();
  } catch (error) {
    voiceButton.classList.remove("listening");
    voiceButton.setAttribute("aria-label", "Search by voice");
    searchStatus.textContent = "Voice search could not start. Try again.";
    console.warn("Could not start voice search.", error);
  }
}

voiceButton.addEventListener("click", setupVoiceSearch);
renderHistory();

// Remember the user's preferred color theme.
function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  try {
    localStorage.setItem("gofind-theme", isDark ? "dark" : "light");
  } catch (error) {
    console.warn("Could not save theme preference.", error);
  }
}

try {
  setTheme(localStorage.getItem("gofind-theme") === "dark");
} catch (error) {
  console.warn("Could not load theme preference.", error);
}

themeToggle.addEventListener("click", () => {
  setTheme(!document.body.classList.contains("dark"));
});

// Keyboard shortcuts for focusing and clearing the search field.
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === "Escape" && document.activeElement === input) {
    input.value = "";
    clearButton.hidden = true;
    renderSuggestions("");
  }
});