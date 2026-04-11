# FED MACRO TERMINAL

Interactive terminal-style dashboard for macroeconomic monitoring using live FED-focused data.

## What It Covers

The dashboard tracks indicators commonly central to Fed policy discussion:

- Inflation: `PCEPI`, `PCEPILFE`, `CPIAUCSL`
- Labor: `UNRATE`, `PAYEMS`
- Growth: `GDPC1`
- Activity: `INDPRO`, `RSAFS`, `HOUST`
- Rates/Curve: `FEDFUNDS`, `DGS10`, `T10Y2Y`

For each indicator, it provides:

- A sparkline chart
- What changed versus the prior release
- Current state interpretation
- A FED ANALYSIS tab with policy synthesis across inflation, labor, rates, and recession risk

## Run

1. Create `.env` from `.env.example` and set `FED_API_KEY` (or `FRED_API_KEY`).
2. Start server: `npm start`
3. Open `http://localhost:3000`
4. Dashboard auto-uses API key from `.env` via `/api/series`

## GitHub Pages Mode (No User API Key)

GitHub Pages cannot run `server.js`, so the site uses a static snapshot file:

- Data file: `data/fred_snapshot.json`
- Auto-refresh: `.github/workflows/update-snapshot.yml` (hourly)
- Generator: `scripts/build-snapshot.js`

Setup required once in GitHub repository settings:

1. Go to **Settings -> Secrets and variables -> Actions**
2. Add secret `FED_API_KEY` (or `FRED_API_KEY`)
3. Run workflow **Update FED Snapshot** once manually (or wait for next hourly schedule)

After that, users on GitHub Pages can view data without entering any API key.

Display behavior:

- Indicator cards are sorted by newest release date first.
- In GitHub Pages mode, app falls back to static snapshot when backend is unavailable.
- FED ANALYSIS renders larger terminal-style policy panels instead of standard indicator cards.

## Notes

- `.env.example` is sample format only. Put real key in local `.env` and never commit it.
- Expected env format: `FED_API_KEY=replace_with_your_api_key` or `FRED_API_KEY=replace_with_your_api_key`.
- If you do not have a key, request one at [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html).
