const FED_DATA_BASE = "https://api.stlouisfed.org/fred/series/observations";
const LOCAL_STORAGE_KEY = "macro_terminal_fed_key";
const SERVER_CONFIG_URL = "/api/config";
const SERVER_SERIES_URL = "/api/series";

const SERIES = [
  {
    id: "PCEPI",
    name: "PCE Price Index",
    category: "inflation",
    unit: "index",
    notes: "Fed's preferred inflation gauge.",
  },
  {
    id: "PCEPILFE",
    name: "Core PCE Price Index",
    category: "inflation",
    unit: "index",
    notes: "Underlying inflation excluding food and energy.",
  },
  {
    id: "CPIAUCSL",
    name: "Consumer Price Index",
    category: "inflation",
    unit: "index",
    notes: "Broad inflation pressure felt by households.",
  },
  {
    id: "UNRATE",
    name: "Unemployment Rate",
    category: "labor",
    unit: "%",
    notes: "Labor slack and hiring conditions.",
  },
  {
    id: "PAYEMS",
    name: "Nonfarm Payrolls",
    category: "labor",
    unit: "thousands",
    notes: "Monthly employment momentum.",
  },
  {
    id: "GDPC1",
    name: "Real GDP",
    category: "growth",
    unit: "billions",
    notes: "Output growth and recession risk.",
  },
  {
    id: "INDPRO",
    name: "Industrial Production",
    category: "activity",
    unit: "index",
    notes: "Factory and utility output trend.",
  },
  {
    id: "RSAFS",
    name: "Retail Sales",
    category: "activity",
    unit: "millions",
    notes: "Consumer demand impulse.",
  },
  {
    id: "HOUST",
    name: "Housing Starts",
    category: "activity",
    unit: "thousands",
    notes: "Rate-sensitive housing activity.",
  },
  {
    id: "FEDFUNDS",
    name: "Fed Funds Effective Rate",
    category: "rates",
    unit: "%",
    notes: "Current policy stance anchor.",
  },
  {
    id: "DGS10",
    name: "10Y Treasury Yield",
    category: "rates",
    unit: "%",
    notes: "Long-end rate expectations.",
  },
  {
    id: "T10Y2Y",
    name: "10Y - 2Y Yield Spread",
    category: "rates",
    unit: "bps",
    notes: "Curve shape and recession signal.",
  },
];

let currentCategory = "overview";
let chartMap = new Map();
let latestDataset = [];
let hasServerKey = false;

const el = {
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveKeyBtn: document.getElementById("saveKeyBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  tabs: document.querySelectorAll(".tab"),
  cardsContainer: document.getElementById("cardsContainer"),
  insightList: document.getElementById("insightList"),
  systemStatus: document.getElementById("systemStatus"),
  lastUpdate: document.getElementById("lastUpdate"),
  inflationPulse: document.getElementById("inflationPulse"),
  laborPulse: document.getElementById("laborPulse"),
  ratesPulse: document.getElementById("ratesPulse"),
};

init();

async function init() {
  await detectServerConfig();

  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored && !hasServerKey) {
    el.apiKeyInput.value = stored;
  }

  if (hasServerKey) {
    el.apiKeyInput.value = "";
    el.apiKeyInput.placeholder = "Using FED_API_KEY/FRED_API_KEY from .env";
  }

  el.saveKeyBtn.addEventListener("click", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, el.apiKeyInput.value.trim());
    setStatus("API key saved", "cool");
  });

  el.refreshBtn.addEventListener("click", refreshAll);

  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentCategory = tab.dataset.category;
      el.tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      renderCards(latestDataset);
    });
  });

  refreshAll();
}

async function detectServerConfig() {
  try {
    const response = await fetch(SERVER_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    hasServerKey = Boolean(payload?.hasServerKey);
  } catch (_error) {
    hasServerKey = false;
  }
}

async function refreshAll() {
  const apiKey = el.apiKeyInput.value.trim();
  const useServerKey = hasServerKey;

  if (!useServerKey && !apiKey) {
    setStatus("Missing FED data API key", "hot");
    renderMissingKeyMessage();
    return;
  }

  setStatus("Loading data...", "warn");

  try {
    const payload = await Promise.all(SERIES.map((s) => fetchSeriesData(s, apiKey, useServerKey)));
    latestDataset = payload.filter(Boolean);
    renderInsights(latestDataset);
    renderCards(latestDataset);
    updatePulseChips(latestDataset);
    el.lastUpdate.textContent = new Date().toLocaleString();
    setStatus(useServerKey ? "Live (.env key)" : "Live", "ok");
  } catch (error) {
    setStatus("Fetch error", "hot");
    el.cardsContainer.innerHTML = `<article class="card"><p class="explain">${escapeHtml(error.message)}</p></article>`;
  }
}

async function fetchSeriesData(series, apiKey, useServerKey) {
  const url = useServerKey ? new URL(SERVER_SERIES_URL, window.location.origin) : new URL(FED_DATA_BASE);

  url.searchParams.set("series_id", series.id);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "asc");
  url.searchParams.set("limit", "600");

  if (!useServerKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url);
  if (!response.ok) {
    let errorText = "";
    try {
      const errorJson = await response.json();
      errorText = errorJson?.error_message || "";
    } catch (_error) {
      errorText = "";
    }

    throw new Error(errorText || `FED data request failed for ${series.id}`);
  }

  const data = await response.json();
  if (!data.observations) {
    throw new Error(`No observations found for ${series.id}`);
  }

  const points = data.observations
    .map((item) => ({ date: item.date, value: Number(item.value) }))
    .filter((item) => Number.isFinite(item.value));

  if (points.length < 3) {
    return null;
  }

  const stats = computeStats(points);
  return {
    ...series,
    points,
    stats,
    narrative: buildNarrative(series, stats),
  };
}

function computeStats(points) {
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  const delta = latest.value - previous.value;
  const deltaPct = previous.value !== 0 ? (delta / previous.value) * 100 : 0;

  const lookback = getYoYLookback(points);
  const yoyIndex = Math.max(0, points.length - (lookback + 1));
  const yoyBase = points[yoyIndex];
  const yoy = yoyBase?.value ? ((latest.value - yoyBase.value) / yoyBase.value) * 100 : null;

  const recent = points.slice(-6);
  const slope = linearSlope(recent.map((p) => p.value));

  return {
    latest,
    previous,
    delta,
    deltaPct,
    yoy,
    slope,
  };
}

function getYoYLookback(points) {
  if (points.length < 3) {
    return 12;
  }

  const last = points[points.length - 1];
  const prior = points[points.length - 2];
  const days = Math.max(1, Math.round((new Date(last.date) - new Date(prior.date)) / 86400000));

  if (days >= 70) return 4;
  if (days >= 20) return 12;
  if (days >= 5) return 52;
  return 252;
}

function linearSlope(values) {
  const n = values.length;
  if (n < 2) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;
  return denominator === 0 ? 0 : numerator / denominator;
}

function buildNarrative(series, stats) {
  const direction = stats.delta > 0 ? "up" : stats.delta < 0 ? "down" : "flat";
  const changeText = `${direction} ${Math.abs(stats.delta).toFixed(2)} (${stats.deltaPct.toFixed(2)}%)`;
  const yoyText = Number.isFinite(stats.yoy) ? `${stats.yoy.toFixed(2)}% YoY` : "YoY n/a";

  const assessment = assessSeries(series.id, stats);

  return {
    changed: `Changed ${changeText} from prior release; latest print ${yoyText}.`,
    state: assessment.state,
    badge: assessment.badge,
    tone: assessment.tone,
  };
}

function assessSeries(id, stats) {
  const latest = stats.latest.value;
  const yoy = Number.isFinite(stats.yoy) ? stats.yoy : 0;

  switch (id) {
    case "PCEPI":
    case "PCEPILFE":
    case "CPIAUCSL":
      if (yoy <= 2.5) return { state: "Inflation near target-consistent zone.", badge: "Cooling", tone: "ok" };
      if (yoy <= 3.5) return { state: "Inflation elevated but moderating.", badge: "Sticky", tone: "warn" };
      return { state: "Inflation too high for comfort.", badge: "Hot", tone: "hot" };
    case "UNRATE":
      if (latest < 4.2) return { state: "Labor market still tight.", badge: "Tight", tone: "ok" };
      if (latest < 5) return { state: "Labor market cooling gradually.", badge: "Cooling", tone: "warn" };
      return { state: "Labor softening materially.", badge: "Weak", tone: "hot" };
    case "PAYEMS":
      if (stats.delta > 200) return { state: "Payroll momentum remains strong.", badge: "Strong", tone: "ok" };
      if (stats.delta > 75) return { state: "Payroll growth is slowing but positive.", badge: "Moderate", tone: "warn" };
      return { state: "Payroll trend is weak.", badge: "Weak", tone: "hot" };
    case "GDPC1":
      if (yoy > 2) return { state: "Growth trend remains above potential.", badge: "Firm", tone: "ok" };
      if (yoy > 0) return { state: "Growth is positive but soft.", badge: "Soft", tone: "warn" };
      return { state: "Output is contracting year over year.", badge: "Contraction", tone: "hot" };
    case "FEDFUNDS":
      if (latest >= 5) return { state: "Policy stance is restrictive.", badge: "Restrictive", tone: "warn" };
      if (latest >= 3) return { state: "Policy stance is moderately tight.", badge: "Moderate", tone: "cool" };
      return { state: "Policy stance is accommodative.", badge: "Easy", tone: "ok" };
    case "T10Y2Y":
      if (latest < 0) return { state: "Curve inversion still flags downside risk.", badge: "Inverted", tone: "warn" };
      return { state: "Curve normalization points to easing recession risk.", badge: "Normalizing", tone: "ok" };
    default:
      if (stats.slope > 0.1) return { state: "Trend is rising over recent prints.", badge: "Rising", tone: "cool" };
      if (stats.slope < -0.1) return { state: "Trend is easing over recent prints.", badge: "Falling", tone: "ok" };
      return { state: "Trend is broadly stable.", badge: "Stable", tone: "warn" };
  }
}

function renderCards(data) {
  const filtered = currentCategory === "overview" ? data : data.filter((d) => d.category === currentCategory);

  clearCharts();

  if (!filtered.length) {
    el.cardsContainer.innerHTML = "<article class=\"card\"><p class=\"explain\">No series available for this tab.</p></article>";
    return;
  }

  const html = filtered
    .map(
      (series) => `
      <article class="card">
        <header class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(series.name)}</h3>
            <p class="mono-line">${series.id} | ${escapeHtml(series.notes)}</p>
          </div>
          <span class="badge ${series.narrative.tone}">${escapeHtml(series.narrative.badge)}</span>
        </header>
        <p class="mono-line">Latest: ${formatValue(series.stats.latest.value, series.unit)} (${series.stats.latest.date})</p>
        <p class="explain"><strong>What changed:</strong> ${escapeHtml(series.narrative.changed)}</p>
        <p class="explain"><strong>Current state:</strong> ${escapeHtml(series.narrative.state)}</p>
        <div class="chart-wrap"><canvas id="chart-${series.id}"></canvas></div>
      </article>
    `,
    )
    .join("");

  el.cardsContainer.innerHTML = html;

  filtered.forEach((series) => {
    const canvas = document.getElementById(`chart-${series.id}`);
    if (!canvas) return;

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: series.points.map((p) => p.date),
        datasets: [
          {
            data: series.points.map((p) => p.value),
            borderColor: "#67d6ff",
            pointRadius: 0,
            borderWidth: 1.8,
            tension: 0.15,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${formatValue(context.parsed.y, series.unit)} on ${context.label}`;
              },
            },
          },
        },
        scales: {
          x: {
            display: false,
            grid: { color: "rgba(103,214,255,0.09)" },
          },
          y: {
            ticks: { color: "#93bfce", maxTicksLimit: 4 },
            grid: { color: "rgba(103,214,255,0.09)" },
          },
        },
      },
    });

    chartMap.set(series.id, chart);
  });
}

function renderInsights(data) {
  const pce = data.find((d) => d.id === "PCEPI");
  const unrate = data.find((d) => d.id === "UNRATE");
  const funds = data.find((d) => d.id === "FEDFUNDS");
  const spread = data.find((d) => d.id === "T10Y2Y");

  const bullets = [
    pce ? `Inflation monitor: ${pce.narrative.state} PCE latest is ${formatValue(pce.stats.latest.value, pce.unit)}.` : "Inflation monitor unavailable.",
    unrate ? `Employment monitor: ${unrate.narrative.state} Unemployment rate at ${formatValue(unrate.stats.latest.value, unrate.unit)}.` : "Employment monitor unavailable.",
    funds && spread
      ? `Policy setup: ${funds.narrative.state} Yield curve signal is ${spread.stats.latest.value < 0 ? "inverted" : "normalizing"}.`
      : "Policy setup unavailable.",
  ];

  el.insightList.innerHTML = bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function updatePulseChips(data) {
  const pce = data.find((d) => d.id === "PCEPI");
  const unrate = data.find((d) => d.id === "UNRATE");
  const funds = data.find((d) => d.id === "FEDFUNDS");

  el.inflationPulse.textContent = pce ? pce.narrative.badge : "n/a";
  el.laborPulse.textContent = unrate ? unrate.narrative.badge : "n/a";
  el.ratesPulse.textContent = funds ? funds.narrative.badge : "n/a";
}

function setStatus(text, tone) {
  el.systemStatus.textContent = text;
  el.systemStatus.style.color = {
    ok: "#70e28f",
    warn: "#ffd166",
    hot: "#ff7a59",
    cool: "#67d6ff",
  }[tone] || "#d9f4ff";
}

function renderMissingKeyMessage() {
  clearCharts();
  el.cardsContainer.innerHTML = `
    <article class="card">
      <h3 class="card-title">FED data API key required</h3>
      <p class="explain">Enter key manually, or run via local Node server with .env using FED_API_KEY or FRED_API_KEY.</p>
      <p class="mono-line">When `.env` key is detected, the dashboard auto-uses it.</p>
    </article>
  `;
  el.insightList.innerHTML = "<li>Waiting for API key to generate Powell brief.</li>";
  el.inflationPulse.textContent = "-";
  el.laborPulse.textContent = "-";
  el.ratesPulse.textContent = "-";
}

function clearCharts() {
  chartMap.forEach((chart) => chart.destroy());
  chartMap.clear();
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return "n/a";

  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "bps") return `${(value * 100).toFixed(0)} bps`;
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
