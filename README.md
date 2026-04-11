# Macro Terminal

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

## Run

1. Open `index.html` in a browser.
2. Enter your FED data API key.
3. Click **Save** and then **Refresh**.
4. Flip between tabs for category views.

## Notes

- API key is stored in browser local storage (`macro_terminal_fed_key`).
- `.env.example` is sample format only. Put real key in local `.env` and never commit it.
- Expected env format: `FED_API_KEY=replace_with_your_api_key`.
- If you do not have a key, request one at [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html).
