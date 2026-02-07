import { getCookie, setCookie, deleteCookie } from './utils/cookies.js';
import { renderMoonPhase } from './moon.js';

const monthsContainer = document.getElementById("months");
const flipClock = document.getElementById("flip-clock");
const clockWrap = document.getElementById("clock-wrap");
const analogClock = document.getElementById("analog-clock");
const hourHand = analogClock?.querySelector(".hand.hour");
const minuteHand = analogClock?.querySelector(".hand.minute");
const fxPriceEl = document.getElementById("fx-price");
const fxChangeEl = document.getElementById("fx-change");
const fxUpdatedEl = document.getElementById("fx-updated");
const fxChartEl = document.getElementById("fx-chart");
const fxMiniChartEl = document.getElementById("fx-mini-chart");
const fxStatusEl = document.getElementById("fx-status");
const fxCardEl = document.querySelector(".fx-card");
const settingsToggleBtn = document.getElementById("settings-toggle");
const settingsPanelEl = document.getElementById("settings-panel");
const calculatorPanelEl = document.getElementById("calculator-panel");
const fxKeyForm = document.getElementById("fx-key-form");
const fxKeyInput = document.getElementById("freecurrency-key");
const fxKeyStatus = document.getElementById("fx-key-status");
const fxKeyClearBtn = document.getElementById("clear-freecurrency-key");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const calendarContextMenu = document.createElement("div");

let fxHistory = null;
let fxChartSize = { width: 0, height: 0 };
let fxMiniSize = { width: 0, height: 0 };
let fxChartEntries = [];
let fxHoverIndex = null;
let freeCurrencyKey = null;
const fxSessionKey = "fxLatestSession";
const freeCurrencyCookieKey = "freeCurrencyApiKey";

const weekdayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const monthNames = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const weekdayNames = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

let startOffset = -1;
const visibleMonths = 6;
let isScrolling = false;
let calendarMenuDate = null;

// --- CALENDAR CONTEXT MENU ---
calendarContextMenu.className = "calendar-context-menu";
calendarContextMenu.innerHTML = `
  <div class="calendar-context-header" data-calendar-header></div>
  <div class="calendar-context-divider"></div>
  <button type="button" data-calendar-action="check">Controlla</button>
  <button type="button" data-calendar-action="add">Aggiungi</button>
  <button type="button" data-calendar-action="delete">Cancella</button>
  <button type="button" data-calendar-action="settings">Impostazioni</button>
`;
document.body.appendChild(calendarContextMenu);

// --- CALENDARIO ---
function getMonthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function addDays(date, offset) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + offset);
  return newDate;
}

function startOfISOWeek(date) {
  const newDate = new Date(date);
  const day = (newDate.getDay() + 6) % 7;
  newDate.setDate(newDate.getDate() - day);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

function endOfISOWeek(date) {
  const start = startOfISOWeek(date);
  return addDays(start, 6);
}

function getISOWeekNumber(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (temp.getUTCDay() + 6) % 7;
  temp.setUTCDate(temp.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(temp.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const diff = temp - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function buildMonthCard(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = new Date();
  const todayKey = getMonthKey(today);

  const card = document.createElement("div");
  card.className = "month-card";

  const title = document.createElement("div");
  title.className = "month-title";
  const name = document.createElement("span");
  name.textContent = `${monthNames[month]} ${year}`;
  const indicator = document.createElement("span");
  indicator.textContent = getMonthKey(date) === todayKey ? "•" : "";
  title.append(name, indicator);

  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";
  const weekSpacer = document.createElement("span");
  weekSpacer.className = "week-label";
  weekSpacer.textContent = "s.";
  weekdays.appendChild(weekSpacer);
  weekdayLabels.forEach((label, index) => {
    const span = document.createElement("span");
    span.textContent = label;
    if (index === 5 || index === 6) {
      span.classList.add("weekend-header");
    }
    weekdays.appendChild(span);
  });

  const daysGrid = document.createElement("div");
  daysGrid.className = "days";

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = startOfISOWeek(firstDay);
  const end = endOfISOWeek(lastDay);

  let current = new Date(start);
  let weekCount = 0;

  while (current <= end) {
    weekCount++;
    const weekCell = document.createElement("div");
    weekCell.className = "week-number";
    // Check if this is the current week
    const currentWeekNumber = getISOWeekNumber(current);
    const todayWeekNumber = getISOWeekNumber(today);
    const isCurrentWeek =
      currentWeekNumber === todayWeekNumber &&
      current.getFullYear() === today.getFullYear();
    // Create dot indicator for current week
    if (isCurrentWeek) {
      const dot = document.createElement("span");
      dot.textContent = "• ";
      dot.className = "week-dot";
      weekCell.appendChild(dot);
    }
    const weekNumberText = document.createElement("span");
    weekNumberText.textContent = getISOWeekNumber(current);
    weekCell.appendChild(weekNumberText);
    daysGrid.appendChild(weekCell);

    for (let i = 0; i < 7; i += 1) {
      const dayDate = addDays(current, i);
      const cell = document.createElement("div");
      cell.className = "day";

      if (dayDate.getDay() === 0 || dayDate.getDay() === 6) {
        cell.classList.add("weekend-day");
      }

      if (dayDate.getMonth() !== month) {
        cell.classList.add("out-of-month");
        cell.textContent = "";
      } else {
        cell.textContent = dayDate.getDate();
        cell.dataset.date = formatDateLocal(dayDate);
        cell.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          calendarMenuDate = new Date(dayDate.getTime());
          showCalendarContextMenu(event.clientX, event.clientY, calendarMenuDate);
        });
      }

      if (
        dayDate.getMonth() === month &&
        dayDate.getDate() === today.getDate() &&
        dayDate.getMonth() === today.getMonth() &&
        dayDate.getFullYear() === today.getFullYear()
      ) {
        cell.classList.add("today");
      }

      daysGrid.appendChild(cell);
    }

    current = addDays(current, 7);
  }

  card.classList.add(`weeks-${weekCount}`);

  card.append(title, weekdays, daysGrid);
  return card;
}

function renderMonths() {
  monthsContainer.innerHTML = "";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let i = 0; i < visibleMonths; i += 1) {
    // Logic fix: We explicitly calculate the target year/month and pick the 1st day.
    // This avoids "Feb skip" bug when today is 29th, 30th, 31st.
    const targetMonthIndex = currentMonth + startOffset + i;

    // new Date(y, m, 1) handles month overflow/underflow correctly
    const date = new Date(currentYear, targetMonthIndex, 1);

    monthsContainer.appendChild(buildMonthCard(date));
  }
}


function handleWheel(event) {
  event.preventDefault();
  if (isScrolling) return;

  isScrolling = true;
  startOffset += event.deltaY > 0 ? 1 : -1;
  renderMonths();

  setTimeout(() => {
    isScrolling = false;
  }, 120);
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    5
  );
  const timeout = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    renderMonths();
    renderMoonPhase();
    scheduleMidnightRefresh();
  }, timeout);
}

function scheduleFxHistoryRefresh() {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    17,
    5,
    0
  );
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }
  const timeout = target.getTime() - now.getTime();

  setTimeout(() => {
    fetchFxHistory();
    scheduleFxHistoryRefresh();
  }, timeout);
}

function updateClock() {
  if (!flipClock) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const hourEl = flipClock.querySelector('[data-unit="hours"] .flip-value');
  const minuteEl = flipClock.querySelector('[data-unit="minutes"] .flip-value');

  if (hourEl && hourEl.textContent !== hours) {
    const unit = hourEl.closest(".flip-unit");
    hourEl.textContent = hours;
    if (unit) {
      unit.classList.remove("flip-animate");
      void unit.offsetWidth;
      unit.classList.add("flip-animate");
    }
  }

  if (minuteEl && minuteEl.textContent !== minutes) {
    const unit = minuteEl.closest(".flip-unit");
    minuteEl.textContent = minutes;
    if (unit) {
      unit.classList.remove("flip-animate");
      void unit.offsetWidth;
      unit.classList.add("flip-animate");
    }
  }

  if (hourHand && minuteHand) {
    const hourValue = now.getHours() % 12;
    const minuteValue = now.getMinutes();
    const hourDeg = (hourValue + minuteValue / 60) * 30;
    const minuteDeg = minuteValue * 6;
    hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
  }
}

function scheduleMinuteRefresh() {
  const now = new Date();
  const nextMinute = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes() + 1,
    1
  );
  const timeout = nextMinute.getTime() - now.getTime();

  setTimeout(() => {
    updateClock();
    scheduleMinuteRefresh();
  }, timeout);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarLabel(date) {
  const weekday = weekdayNames[date.getDay()] || "";
  const month = monthNames[date.getMonth()] || "";
  return `${weekday} ${date.getDate()} ${month} ${date.getFullYear()}`;
}

function showCalendarContextMenu(x, y, date) {
  const header = calendarContextMenu.querySelector("[data-calendar-header]");
  if (header) {
    header.textContent = formatCalendarLabel(date);
  }
  calendarContextMenu.style.left = `${x}px`;
  calendarContextMenu.style.top = `${y}px`;
  calendarContextMenu.classList.add("is-visible");
}

function hideCalendarContextMenu() {
  calendarContextMenu.classList.remove("is-visible");
}

// --- CLOCK / TIME ---
function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

// --- FX HELPERS / API KEYS ---
// --- FX CACHE (SESSION) ---

function getFreeCurrencyCookieKey() {
  const key = getCookie(freeCurrencyCookieKey);
  return key ? key.trim() : null;
}

function setFreeCurrencyCookieKey(key) {
  if (!key) return;
  const oneYear = 60 * 60 * 24 * 365;
  setCookie(freeCurrencyCookieKey, key, oneYear);
}

function clearFreeCurrencyCookieKey() {
  deleteCookie(freeCurrencyCookieKey);
}

function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  const head = key.slice(0, 4);
  const tail = key.slice(-4);
  return `${head}••••${tail}`;
}

function updateFxKeyStatus() {
  if (!fxKeyStatus) return;
  const stored = getFreeCurrencyCookieKey();
  if (stored) {
    fxKeyStatus.textContent = `Chiave salvata: ${maskApiKey(stored)}`;
  } else {
    fxKeyStatus.textContent = "Nessuna chiave salvata.";
  }
}

function setActiveTab(tabId) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === tabId;
    panel.classList.toggle("active", isActive);
    if (panel.id === "settings-panel") {
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
  });
}

function getCachedSessionRate() {
  const raw = getCookie(fxSessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedSessionRate(rate) {
  const payload = {
    rate,
    ts: Date.now(),
  };
  setCookie(fxSessionKey, JSON.stringify(payload), 3600);
}

function isCacheFresh(payload) {
  if (!payload?.ts) return false;
  const ageMs = Date.now() - payload.ts;
  return ageMs < 60 * 60 * 1000;
}

// --- FX API KEYS ---
async function loadFreeCurrencyKey() {
  if (freeCurrencyKey) return freeCurrencyKey;
  try {
    const stored = localStorage.getItem("freeCurrencyKey");
    if (stored) {
      freeCurrencyKey = stored.trim();
      return freeCurrencyKey;
    }

    if (window?.FREECURRENCY_API_KEY) {
      freeCurrencyKey = String(window.FREECURRENCY_API_KEY).trim();
      return freeCurrencyKey;
    }

    if (location.protocol === "file:") {
      freeCurrencyKey = DEFAULT_FREECURRENCY_KEY;
      return freeCurrencyKey;
    }

    const response = await fetch("api-keys");
    if (!response.ok) return null;
    const text = await response.text();
    const lines = text.split("\n");
    const match = lines.find((line) => line.includes("freecurrencyapi.com"));
    if (!match) return null;
    const parts = match.split("=");
    if (parts.length < 2) return null;
    freeCurrencyKey = parts[1].trim();
    return freeCurrencyKey;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Generic loader for API keys stored in the `api-keys` file or provided via window/localStorage.
async function loadApiKey(domain) {
  try {
    // Cookie override (per-user)
    if (domain.toLowerCase().includes("freecurrency")) {
      const cookieKey = getFreeCurrencyCookieKey();
      if (cookieKey) return cookieKey;
    }

    // First try reading api-keys file (preferred on localhost/http(s))
    try {
      const resp = await fetch('api-keys');
      if (resp && resp.ok) {
        const text = await resp.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        // Look for a line referencing the domain (e.g. freecurrencyapi.com)
        const match = lines.find(line => line.toLowerCase().includes(domain.toLowerCase()));
        if (match) {
          const parts = match.split('=');
          if (parts.length >= 2) return parts[1].trim();
        }
      }
    } catch (err) {
      // ignore fetch errors (file:// or network); fallthrough to other fallbacks
    }

    // localStorage overrides (keyed by domain)
    const local = localStorage.getItem(`apiKey:${domain}`);
    if (local) return local.trim();

    // Window globals fallback (only FreeCurrencyAPI supported)
    if (domain.includes('freecurrency') && window?.FREECURRENCY_API_KEY) return String(window.FREECURRENCY_API_KEY).trim();

    // No hardcoded fallback; if nothing found, return null so caller can handle missing key
    return null;
  } catch (err) {
    // Could be file:// protocol or fetch blocked; fallback to null
    return null;
  }
}

// --- FX PAYLOAD PARSING ---
// Extract a numeric USD rate from multiple provider payload shapes
function extractRateFromPayload(payload) {
  if (!payload) return null;
  // FreeCurrencyAPI v1: { data: { USD: 1.123 } }
  if (payload.data && typeof payload.data.USD !== 'undefined') return parseFloat(payload.data.USD);
  // FreeCurrencyAPI newer shape: { data: { USD: { value: 1.123 } } }
  if (payload.data && payload.data.USD && typeof payload.data.USD === 'object') {
    const usdObj = payload.data.USD;
    if (typeof usdObj.value !== 'undefined') return parseFloat(usdObj.value);
    if (typeof usdObj.rate !== 'undefined') return parseFloat(usdObj.rate);
    if (typeof usdObj.amount !== 'undefined') return parseFloat(usdObj.amount);
  }
  // If FreeCurrencyAPI returned a full `data` map (base may be USD by default),
  // compute EUR->USD as USD / EUR when both present.
  if (payload.data && typeof payload.data.USD !== 'undefined' && typeof payload.data.EUR !== 'undefined') {
    const usd = parseFloat(payload.data.USD);
    const eur = parseFloat(payload.data.EUR);
    if (!isNaN(usd) && !isNaN(eur) && eur !== 0) return usd / eur;
  }
  // exchange-rate style: { rates: { USD: 1.123 } }
  if (payload.rates && typeof payload.rates.USD !== 'undefined') return parseFloat(payload.rates.USD);
  // alternate nesting: { data: { rates: { USD: 1.123 } } }
  if (payload.data && payload.data.rates && typeof payload.data.rates.USD !== 'undefined') return parseFloat(payload.data.rates.USD);
  if (payload['Realtime Currency Exchange Rate'] && payload['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
    return parseFloat(payload['Realtime Currency Exchange Rate']['5. Exchange Rate']);
  }
  // Some APIs return nested `result` or similar structures
  if (payload.result && payload.result.rates && typeof payload.result.rates.USD !== 'undefined') return parseFloat(payload.result.rates.USD);
  if (payload.result && typeof payload.result.USD !== 'undefined') return parseFloat(payload.result.USD);
  // Direct USD field
  if (typeof payload.USD !== 'undefined') return parseFloat(payload.USD);
  return null;
}

// --- FX INTRADAY CACHE ---
function getIntradayCache() {
  const raw = localStorage.getItem("fxIntraday");
  if (!raw) return { date: formatDate(new Date()), points: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { date: formatDate(new Date()), points: [] };
  }
}

function setIntradayCache(cache) {
  localStorage.setItem("fxIntraday", JSON.stringify(cache));
}

function addIntradayPoint(rate) {
  if (!rate) return;
  const now = new Date();
  const todayKey = formatDate(now);
  const cache = getIntradayCache();
  if (cache.date !== todayKey) {
    cache.date = todayKey;
    cache.points = [];
  }
  const hourKey = `${todayKey}T${String(now.getHours()).padStart(2, "0")}:00`;
  const existing = cache.points.findIndex((p) => p.t === hourKey);
  const point = { t: hourKey, r: rate };
  if (existing >= 0) {
    cache.points[existing] = point;
  } else {
    cache.points.push(point);
  }
  cache.points = cache.points.slice(-24);
  setIntradayCache(cache);
  drawFxMiniChart();
}

// --- FX HISTORY CACHE ---
function getHistoryRange() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);
  return { start: formatDate(start), end: formatDate(end) };
}

function readCachedHistory() {
  const raw = localStorage.getItem("fxHistory");
  const updated = localStorage.getItem("fxHistoryUpdated");
  if (!raw || !updated) return null;
  return { data: JSON.parse(raw), updated };
}

function cacheHistory(data) {
  localStorage.setItem("fxHistory", JSON.stringify(data));
  localStorage.setItem("fxHistoryUpdated", formatDate(new Date()));
}

// --- FX HISTORY FETCH/DERIVED ---
function updateFxTrend() {
  if (!fxChangeEl || !fxHistory) return;
  const sortedDates = Object.keys(fxHistory).sort();
  if (sortedDates.length < 2) return;
  const latestDate = sortedDates[sortedDates.length - 1];
  const prevDate = sortedDates[sortedDates.length - 2];
  const latestRate = fxHistory[latestDate]?.USD;
  const prevRate = fxHistory[prevDate]?.USD;
  if (!latestRate || !prevRate) return;
  const diff = latestRate - prevRate;
  const pct = (diff / prevRate) * 100;
  const sign = diff >= 0 ? "+" : "";
  fxChangeEl.textContent = `Frankfurter: ${latestRate.toFixed(4)} · Δ ${sign}${diff.toFixed(
    4
  )} (${sign}${pct.toFixed(2)}%)`;
  fxChangeEl.classList.toggle("negative", diff < 0);
}

async function fetchFxHistory() {
  try {
    const { start, end } = getHistoryRange();
    const url = `https://api.frankfurter.app/${start}..${end}?from=EUR&to=USD`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Errore richiesta FX history");
    const data = await response.json();
    fxHistory = data.rates;
    cacheHistory(fxHistory);
    drawFxChart();
    updateFxTrend();
  } catch (error) {
    console.error(error);
  }
}

function ensureFxHistory() {
  const cached = readCachedHistory();
  const todayKey = formatDate(new Date());
  if (cached) {
    fxHistory = cached.data;
    drawFxChart();
    updateFxTrend();
    if (cached.updated !== todayKey) {
      fetchFxHistory();
    }
  } else {
    fetchFxHistory();
  }
}

// --- FX LATEST FETCH ---
async function fetchFxLatest() {
  if (!fxPriceEl || !fxChangeEl || !fxUpdatedEl) return;
  try {
    if (fxStatusEl) fxStatusEl.classList.remove("cached");

    // Check local session cache (1 hour duration)
    const cached = getCachedSessionRate();
    if (cached && isCacheFresh(cached)) {
      fxPriceEl.textContent = cached.rate.toFixed(4);
      const cachedDate = new Date(cached.ts);
      fxUpdatedEl.textContent = `Aggiornamento: ${formatDate(cachedDate)} ${formatTime(
        cachedDate
      )}`;
      if (fxStatusEl) fxStatusEl.classList.add("cached");
      addIntradayPoint(cached.rate);
      return;
    }
    // Prefer FreeCurrencyAPI (key stored in `api-keys`) - called only if cookie expired
    let rate = null;
    try {
      // Try FreeCurrencyAPI first (key from api-keys)
      const freeKey = await loadApiKey('freecurrencyapi.com');
      if (freeKey) {
        const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${encodeURIComponent(
          freeKey
        )}&base_currency=EUR&currencies=USD`;
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const payload = await resp.json();
            rate = extractRateFromPayload(payload);
          } else {
            console.warn('FreeCurrencyAPI responded', resp.status);
          }
        } catch (err) {
          console.warn('FreeCurrencyAPI fetch failed', err);
        }
      }

      if (!rate || isNaN(rate)) {
        console.warn('No rate retrieved from FreeCurrencyAPI');
        return; // nothing to show
      }

      setCachedSessionRate(rate);
      fxPriceEl.textContent = rate.toFixed(4);
      fxUpdatedEl.textContent = `Aggiornamento: ${formatDate(new Date())} ${formatTime(new Date())}`;
      if (fxStatusEl) fxStatusEl.classList.remove('cached');
      addIntradayPoint(rate);
    } catch (err) {
      console.error(err);
    }
  } catch (error) {
    console.error(error);
  }
}

// --- FX CHART (ANNUAL) ---
function resizeFxChart() {
  if (!fxChartEl) return;
  const container = fxChartEl.parentElement;
  if (!container) return;
  const styles = window.getComputedStyle(container);
  const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const targetWidth = Math.max(0, container.clientWidth - paddingX);
  const targetHeight = Math.max(0, container.clientHeight - paddingY);
  if (targetWidth === fxChartSize.width && targetHeight === fxChartSize.height) return;

  const ratio = window.devicePixelRatio || 1;
  fxChartEl.width = targetWidth * ratio;
  fxChartEl.height = targetHeight * ratio;
  fxChartEl.style.height = `${targetHeight}px`;
  fxChartEl.style.width = `${targetWidth}px`;
  fxChartSize = { width: targetWidth, height: targetHeight };
  drawFxChart();
}

function drawFxChart() {
  if (!fxChartEl || !fxHistory) return;
  const ctx = fxChartEl.getContext("2d");
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  const width = fxChartEl.width;
  const height = fxChartEl.height;
  ctx.clearRect(0, 0, width, height);

  const entries = Object.entries(fxHistory)
    .map(([date, value]) => {
      const raw = value?.USD;
      const rate = typeof raw === "number" ? raw : parseFloat(raw);
      return { date, rate };
    })
    .filter((entry) => Number.isFinite(entry.rate))
    .sort((a, b) => a.date.localeCompare(b.date));

  fxChartEntries = entries;

  if (!entries.length) return;

  const rates = entries.map((entry) => entry.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const padding = 22 * ratio;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const scaleX = chartWidth / (entries.length - 1);
  const scaleY = chartHeight / (max - min || 1);

  const gridSteps = 6;
  ctx.strokeStyle = "rgba(122, 166, 194, 0.12)";
  ctx.lineWidth = 1 * ratio;
  for (let i = 0; i <= gridSteps; i += 1) {
    const y = padding + (chartHeight / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  for (let i = 0; i <= gridSteps; i += 1) {
    const x = padding + (chartWidth / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  ctx.strokeStyle = "#7aa6c2";
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  entries.forEach((entry, index) => {
    const x = padding + index * scaleX;
    const y = height - padding - (entry.rate - min) * scaleY;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  if (fxHoverIndex !== null && entries[fxHoverIndex]) {
    const entry = entries[fxHoverIndex];
    const x = padding + fxHoverIndex * scaleX;
    const y = height - padding - (entry.rate - min) * scaleY;

    ctx.strokeStyle = "rgba(155, 179, 168, 0.5)";
    ctx.lineWidth = 1 * ratio;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();

    ctx.fillStyle = "#7aa6c2";
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * ratio, 0, Math.PI * 2);
    ctx.fill();

    const tooltipText = `${entry.date}  ·  ${entry.rate.toFixed(4)}`;
    ctx.font = `${11 * ratio}px "Droid Sans Mono", monospace`;
    const textWidth = ctx.measureText(tooltipText).width;
    const padX = 8 * ratio;
    const padY = 6 * ratio;
    const boxWidth = textWidth + padX * 2;
    const boxHeight = 22 * ratio;

    let boxX = x - boxWidth / 2;
    boxX = Math.max(padding, Math.min(boxX, width - padding - boxWidth));
    const boxY = Math.max(padding, y - boxHeight - 10 * ratio);

    ctx.fillStyle = "rgba(16, 25, 32, 0.9)";
    ctx.strokeStyle = "rgba(122, 166, 194, 0.6)";
    ctx.lineWidth = 1 * ratio;
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxWidth, boxHeight);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e7f0f6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tooltipText, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5 * ratio);
  }

  const avg = rates.reduce((sum, value) => sum + value, 0) / rates.length;
  const avgY = height - padding - (avg - min) * scaleY;
  ctx.setLineDash([6 * ratio, 6 * ratio]);
  ctx.strokeStyle = "rgba(155, 179, 168, 0.75)";
  ctx.lineWidth = 1.5 * ratio;
  ctx.beginPath();
  ctx.moveTo(padding, avgY);
  ctx.lineTo(width - padding, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const monthStart = new Date(now);
  monthStart.setMonth(now.getMonth() - 1);
  const weekStartKey = formatDateLocal(weekStart);
  const monthStartKey = formatDateLocal(monthStart);
  const weekEntries = entries.filter((entry) => entry.date >= weekStartKey);
  const monthEntries = entries.filter((entry) => entry.date >= monthStartKey);
  const weekAvg =
    weekEntries.reduce((sum, entry) => sum + entry.rate, 0) / Math.max(weekEntries.length, 1);
  const monthAvg =
    monthEntries.reduce((sum, entry) => sum + entry.rate, 0) /
    Math.max(monthEntries.length, 1);

  ctx.fillStyle = "#9bb3a8";
  ctx.font = `${11 * ratio}px "Droid Sans Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(min.toFixed(4), padding, height - padding + 14 * ratio);
  ctx.textAlign = "right";
  ctx.fillText(max.toFixed(4), width - padding, padding - 6 * ratio);

  ctx.textAlign = "center";
  ctx.fillText(
    `Media 7g: ${weekAvg.toFixed(4)}  ·  Media 30g: ${monthAvg.toFixed(4)}`,
    width / 2,
    padding - 6 * ratio
  );

  ctx.fillText(`Media periodo: ${avg.toFixed(4)}`, width / 2, avgY - 6 * ratio);
}

function setupFxChartTooltip() {
  if (!fxChartEl) return;

  fxChartEl.addEventListener("mousemove", (event) => {
    if (!fxChartEntries.length) return;
    const rect = fxChartEl.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = fxChartEl.width;
    const height = fxChartEl.height;
    const padding = 22 * ratio;
    const chartWidth = width - padding * 2;

    const x = (event.clientX - rect.left) * ratio;
    if (x < padding || x > width - padding) {
      if (fxHoverIndex !== null) {
        fxHoverIndex = null;
        drawFxChart();
      }
      return;
    }

    const scaleX = chartWidth / Math.max(fxChartEntries.length - 1, 1);
    const index = Math.round((x - padding) / scaleX);
    const clamped = Math.max(0, Math.min(index, fxChartEntries.length - 1));

    if (fxHoverIndex !== clamped) {
      fxHoverIndex = clamped;
      drawFxChart();
    }
  });

  fxChartEl.addEventListener("mouseleave", () => {
    if (fxHoverIndex !== null) {
      fxHoverIndex = null;
      drawFxChart();
    }
  });
}

// --- FX CHART (INTRADAY) ---
function resizeFxMiniChart() {
  if (!fxMiniChartEl) return;
  const parent = fxMiniChartEl.parentElement;
  if (!parent) return;
  const targetWidth = Math.floor(parent.clientWidth);
  const targetHeight = 46;
  if (targetWidth === fxMiniSize.width && targetHeight === fxMiniSize.height) return;

  const ratio = window.devicePixelRatio || 1;
  fxMiniChartEl.width = targetWidth * ratio;
  fxMiniChartEl.height = targetHeight * ratio;
  fxMiniChartEl.style.width = `${targetWidth}px`;
  fxMiniChartEl.style.height = `${targetHeight}px`;
  fxMiniSize = { width: targetWidth, height: targetHeight };
  drawFxMiniChart();
}

function drawFxMiniChart() {
  if (!fxMiniChartEl) return;
  const ctx = fxMiniChartEl.getContext("2d");
  if (!ctx) return;

  const cache = getIntradayCache();
  const points = cache.points;
  const ratio = window.devicePixelRatio || 1;
  const width = fxMiniChartEl.width;
  const height = fxMiniChartEl.height;
  ctx.clearRect(0, 0, width, height);

  if (!points.length) return;

  const rates = points.map((p) => p.r);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const padding = 6 * ratio;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const scaleX = chartWidth / Math.max(points.length - 1, 1);
  const scaleY = chartHeight / (max - min || 1);

  ctx.strokeStyle = "rgba(155, 179, 168, 0.6)";
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = padding + index * scaleX;
    const y = height - padding - (point.r - min) * scaleY;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

// --- FX SCHEDULING ---
function scheduleIntradayRefresh() {
  const now = new Date();
  const startHour = 7;
  const endHour = 18;
  const currentHour = now.getHours();

  let next;
  if (currentHour < startHour) {
    next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 5, 0);
  } else if (currentHour >= endHour) {
    next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      startHour,
      5,
      0
    );
  } else {
    next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      currentHour + 1,
      5,
      0
    );
  }

  const timeout = next.getTime() - now.getTime();
  setTimeout(() => {
    fetchFxLatest();
    scheduleIntradayRefresh();
  }, timeout);
}

// --- INIT / LISTENERS ---
function initDashboard() {
  monthsContainer.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("mousedown", (event) => {
    if (!calendarContextMenu.contains(event.target)) {
      hideCalendarContextMenu();
    }
  });

  calendarContextMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-action]");
    if (!button) return;
    hideCalendarContextMenu();
  });
  monthsContainer.addEventListener("mousedown", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    startOffset = -1;
    renderMonths();
  });

  renderMonths();
  scheduleMidnightRefresh();
  updateClock();
  scheduleMinuteRefresh();
  ensureFxHistory();
  fetchFxLatest();
  scheduleIntradayRefresh();
  scheduleFxHistoryRefresh();
  resizeFxChart();
  resizeFxMiniChart();
  setupFxChartTooltip();

  window.addEventListener("resize", () => {
    resizeFxChart();
    resizeFxMiniChart();
  });

  if (fxCardEl) {
    fxCardEl.addEventListener("click", () => {
      document.body.classList.toggle("show-trading");
    });
  }

  if (clockWrap && flipClock && analogClock) {
    clockWrap.addEventListener("click", () => {
      clockWrap.classList.toggle("is-analog");
      const isAnalog = clockWrap.classList.contains("is-analog");
      flipClock.setAttribute("aria-hidden", isAnalog ? "true" : "false");
      analogClock.setAttribute("aria-hidden", isAnalog ? "false" : "true");
    });
  }

  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("show-settings");
      if (settingsPanelEl) {
        settingsPanelEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
      }
      if (calculatorPanelEl) {
        calculatorPanelEl.setAttribute("aria-hidden", isOpen ? "true" : "false");
      }
      settingsToggleBtn.setAttribute(
        "aria-label",
        isOpen ? "Chiudi impostazioni" : "Apri impostazioni"
      );
    });
  }

  if (tabButtons.length > 0) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.tab);
      });
    });
  }

  if (tabButtons.length > 0) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.tab);
      });
    });
  }

  if (fxKeyForm) {
    fxKeyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = fxKeyInput?.value?.trim();
      if (!value) {
        if (fxKeyStatus) fxKeyStatus.textContent = "Inserisci una chiave valida.";
        return;
      }
      setFreeCurrencyCookieKey(value);
      freeCurrencyKey = value;
      if (fxKeyInput) fxKeyInput.value = "";
      updateFxKeyStatus();
    });
  }

  if (fxKeyClearBtn) {
    fxKeyClearBtn.addEventListener("click", () => {
      clearFreeCurrencyCookieKey();
      freeCurrencyKey = null;
      updateFxKeyStatus();
    });
  }

  updateFxKeyStatus();
}

export { initDashboard };
