# Stock Tracker

Market dashboard for 5 indices (S&P 500, Nasdaq 100, Dow Jones, FTSE 100, DAX), 20 large-cap
US stocks and 6 commodities (gold, silver, WTI, Brent, natural gas, copper).

- Interactive price chart (TradingView Lightweight Charts): line or candles, 1D–Max, pinch /
  trackpad zoom and pan, draw-in animation.
- Events on the date axis: earnings, ex-dividend dates and macro releases (FOMC, CPI, GDP,
  BoE, ECB, EIA, OPEC). Tap one for its date and price lines plus details.
- The three most important news stories of the last month as dots on the chart.
- Earnings: next report, estimate vs reported EPS, quarterly history with SEC filing links,
  analyst forecasts with low–high ranges.
- Financials: revenue, net income, margins, debt/equity, leverage, ratios, statements.
- Trading 212 tab: a labelled sample portfolio until a Trading 212 account is connected.

## Data sources

All free and keyless. CNBC and Nasdaq are public but unofficial services that may change.

| Data | Source |
|---|---|
| Prices and quote stats | CNBC chart and quote services |
| Earnings dates, estimates, forecasts, financials, dividends, targets, macro calendar | Nasdaq data API |
| Quarterly history and past earnings release dates | SEC EDGAR (`data.sec.gov`) |
| News (FT, Reuters, Bloomberg, WSJ, CNBC, Business Insider, MarketWatch, Barron's) | Google News RSS |

`fetch.py` runs on the app schedule (daily by default) and from the in-app refresh button.
It writes `index.json`, `sym/<ID>.json` and, when Trading 212 is connected, `portfolio.json`
to app storage. Set `STOCK_TRACKER_SEC_CONTACT` to identify your instance to SEC EDGAR.
Development run: `python3 fetch.py --out DIR [IDS...]`.

## Trading 212 (optional)

Uses Trading 212's official API with a read-only key (Account data + Portfolio). Ask the
Möbius agent to connect it from the Trading 212 tab; the key and secret go through a sealed
card to `store_t212.py`, which stores them with owner-only permissions outside the app source.
Trading 212 may refuse API calls from servers outside its supported regions.
