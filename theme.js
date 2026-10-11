export const CSS = `
* { box-sizing: border-box; }
.st-root {
  --st-up: #1f9d5c; --st-down: #e0464b; --st-div: #14b8a6; --st-macro: #d98a0b;
  min-height: 100%; background: var(--bg); color: var(--text); font-family: var(--font);
  font-variant-numeric: tabular-nums; -webkit-tap-highlight-color: transparent;
  padding-bottom: max(24px, var(--mobius-safe-bottom, 0px));
}
.st-root button { font: inherit; color: inherit; }
.st-root a { color: inherit; }
.st-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
.st-up { color: var(--st-up); }
.st-down { color: var(--st-down); }
.st-muted { color: var(--muted); }
.st-wrap { max-width: 980px; margin: 0 auto; padding: 0 16px; }

/* header */
.st-top { position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--border); }
.st-top-row { display: flex; align-items: center; gap: 8px; min-height: 56px; }
.st-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; flex: 1; min-width: 0; }
.st-sub { font-size: 12px; color: var(--muted); font-weight: 500; }
.st-icon-btn { width: 44px; height: 44px; border-radius: 12px; border: 0; background: transparent;
  display: grid; place-items: center; cursor: pointer; flex: none; }
.st-icon-btn:hover { background: var(--surface-2); }
.st-icon-btn[disabled] { opacity: .5; }
.st-spin { animation: st-spin 1s linear infinite; }
@keyframes st-spin { to { transform: rotate(360deg); } }

.st-tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding-bottom: 8px; }
.st-tabs::-webkit-scrollbar { display: none; }
.st-tab { min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); cursor: pointer; font-size: 14px; font-weight: 600; white-space: nowrap; color: var(--muted); }
.st-tab[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }

.st-chips { display: flex; gap: 2px; background: var(--surface-2); border-radius: 10px; padding: 3px; }
.st-chip { flex: 1; min-height: 32px; border: 0; background: transparent; border-radius: 8px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--muted); padding: 0 6px; }
.st-chip[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / .12); }

/* upcoming strip */
.st-strip { display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 4px; scrollbar-width: none; }
.st-strip::-webkit-scrollbar { display: none; }
.st-ev-card { flex: none; min-width: 132px; border: 1px solid var(--border); background: var(--surface);
  border-radius: 12px; padding: 10px 12px; text-align: left; cursor: pointer; }
.st-ev-card b { display: block; font-size: 14px; }
.st-ev-card span { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; }
.st-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
.st-dot.earnings { background: var(--accent); } .st-dot.dividend { background: var(--st-div); } .st-dot.macro { background: var(--st-macro); }

.st-section-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  margin: 20px 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }

/* list rows */
.st-list { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); overflow: hidden; }
.st-row { display: grid; grid-template-columns: minmax(0, 1fr) 72px 88px; align-items: center; gap: 10px;
  width: 100%; min-height: 64px; padding: 10px 14px; border: 0; border-top: 1px solid var(--border);
  background: transparent; text-align: left; cursor: pointer; }
.st-row:first-child { border-top: 0; }
.st-row:hover { background: var(--surface-2); }
.st-row-name { font-weight: 650; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-row-meta { font-size: 12px; color: var(--muted); margin-top: 4px; display: flex; align-items: center; gap: 8px; min-width: 0; }
.st-tick { font-weight: 700; flex: none; }
.st-next { display: inline-flex; align-items: center; gap: 0; min-width: 0; padding: 2px 7px 2px 6px; border-radius: 6px;
  background: var(--surface-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.st-next .st-dot { width: 6px; height: 6px; margin-right: 6px; flex: none; }
.st-row-abs { font-size: 11px; font-weight: 600; margin-top: 2px; }
.st-sort { display: inline-flex; gap: 2px; text-transform: none; letter-spacing: 0; }
.st-sort button { border: 0; background: transparent; font-size: 12px; font-weight: 650; color: var(--muted); padding: 4px 6px; border-radius: 6px; cursor: pointer; min-height: 28px; }
.st-sort button[aria-pressed="true"] { background: var(--surface-2); color: var(--text); }
.st-row-right { text-align: right; }
.st-row-price { font-weight: 650; font-size: 15px; }
.st-pill { display: inline-block; margin-top: 3px; font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
.st-pill.st-up { background: color-mix(in srgb, var(--st-up) 14%, transparent); }
.st-pill.st-down { background: color-mix(in srgb, var(--st-down) 14%, transparent); }
.st-held { font-size: 10px; font-weight: 800; color: var(--accent); border: 1px solid currentColor; border-radius: 4px; padding: 0 3px; margin-left: 6px; vertical-align: 2px; }

/* detail */
.st-hero { padding: 14px 0 6px; }
.st-hero-price { font-size: 34px; font-weight: 750; letter-spacing: -0.03em; line-height: 1.1; }
.st-hero-chg { font-size: 15px; font-weight: 650; margin-top: 4px; }
.st-chart-box { position: relative; margin: 8px -6px 0; touch-action: pan-y; }
.st-chart-box .recharts-surface { overflow: visible; }
.st-tip { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px;
  font-size: 12px; box-shadow: 0 6px 20px rgb(0 0 0 / .14); max-width: 220px; }
.st-tip b { font-size: 14px; }
.st-tip .st-tip-ev { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
.st-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); margin: 4px 0 0; }
.st-legend i { display: inline-block; width: 14px; border-top: 2px dashed; vertical-align: 3px; margin-right: 5px; }
.st-legend i.earnings { color: var(--accent); } .st-legend i.dividend { color: var(--st-div); } .st-legend i.macro { color: var(--st-macro); }
.st-legend .st-nm { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%;
  background: var(--text); color: var(--bg); font-size: 10px; font-weight: 800; margin-right: 5px; }

.st-perf { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border);
  border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 14px; }
.st-perf div { background: var(--surface); padding: 9px 8px; text-align: center; }
.st-perf div > span { display: block; font-size: 11px; color: var(--muted); font-weight: 600; }
.st-perf b { display: block; font-size: 14px; margin-top: 2px; }

.st-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1px; background: var(--border);
  border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.st-grid div { background: var(--surface); padding: 10px 12px; }
.st-grid div > span { display: block; font-size: 11px; color: var(--muted); font-weight: 600; }
.st-grid b { display: block; font-size: 15px; margin-top: 2px; }

.st-card { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 12px 14px; }
.st-event { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: start; padding: 12px 0; border-top: 1px solid var(--border); }
.st-event:first-child { border-top: 0; padding-top: 2px; }
.st-event-date { text-align: center; border-radius: 10px; background: var(--surface-2); padding: 6px 0; }
.st-event-date b { display: block; font-size: 18px; line-height: 1; }
.st-event-date span { display: block; font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; margin-top: 3px; }
.st-event-name { font-weight: 650; font-size: 15px; }
.st-event-kv { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--muted); margin-top: 4px; }
.st-event-kv b { color: var(--text); font-weight: 650; }
.st-countdown { font-size: 13px; font-weight: 700; color: var(--accent); white-space: nowrap; }
.st-links { margin-top: 8px; display: grid; gap: 6px; }

.st-news { display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding: 11px 0; border-top: 1px solid var(--border); text-decoration: none; }
.st-news:first-child { border-top: 0; padding-top: 2px; }
.st-news .st-nm { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  background: var(--text); color: var(--bg); font-size: 11px; font-weight: 800; }
.st-news .st-nm.off { background: var(--surface-2); color: var(--muted); }
.st-news-t { font-size: 14px; font-weight: 600; line-height: 1.35; }
.st-news-s { font-size: 12px; color: var(--muted); margin-top: 3px; }
.st-news:hover .st-news-t { text-decoration: underline; }
.st-link { display: flex; gap: 8px; align-items: baseline; font-size: 13px; text-decoration: none; padding: 4px 0; }
.st-link:hover span:last-child { text-decoration: underline; }
.st-link .st-src { flex: none; font-size: 11px; font-weight: 700; color: var(--muted); min-width: 58px; }

.st-seg { display: flex; gap: 2px; border-bottom: 1px solid var(--border); margin-top: 18px; overflow-x: auto; scrollbar-width: none; }
.st-seg button { min-height: 44px; padding: 0 12px; border: 0; background: transparent; cursor: pointer; font-weight: 650;
  font-size: 14px; color: var(--muted); border-bottom: 2px solid transparent; white-space: nowrap; }
.st-seg button[aria-pressed="true"] { color: var(--text); border-bottom-color: var(--text); }

.st-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.st-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.st-table th, .st-table td { padding: 9px 10px; text-align: right; white-space: nowrap; border-top: 1px solid var(--border); }
.st-table thead th { border-top: 0; font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; position: sticky; top: 0; background: var(--surface); }
.st-table th:first-child, .st-table td:first-child { text-align: left; position: sticky; left: 0; background: var(--surface); }
.st-table tr.st-nextrow td { background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.st-table a { text-decoration: none; color: var(--accent); font-weight: 650; }

.st-bars { height: 200px; }
.st-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.st-range { position: relative; height: 6px; border-radius: 3px; background: var(--surface-2); margin: 18px 0 6px; }
.st-range i { position: absolute; top: -5px; width: 3px; height: 16px; border-radius: 2px; background: var(--text); }
.st-range em { position: absolute; top: -4px; width: 2px; height: 14px; background: var(--accent); }
.st-range-l { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
.st-ratings { display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin: 10px 0 6px; }
.st-ratings i:nth-child(1) { background: var(--st-up); } .st-ratings i:nth-child(2) { background: var(--muted); opacity: .5; } .st-ratings i:nth-child(3) { background: var(--st-down); }

.st-empty { text-align: center; padding: 48px 16px; color: var(--muted); }
.st-empty b { display: block; color: var(--text); font-size: 17px; margin-bottom: 6px; }
.st-btn { min-height: 44px; padding: 0 18px; border-radius: 12px; border: 0; background: var(--accent); color: #fff !important;
  font-weight: 700; cursor: pointer; margin-top: 14px; }
.st-btn.ghost { background: var(--surface-2); color: var(--text) !important; }
.st-err { font-size: 12px; color: var(--st-down); margin-top: 8px; }

/* trade chart */
.st-chart-bar { display: flex; gap: 8px; flex-wrap: wrap; }
.st-chart-bar .st-chips:first-child { flex: 1 1 300px; }
.st-style { flex: 0 0 auto; margin-right: auto; }
.st-chart-bar { min-height: 38px; }
.st-style .st-chip { padding: 0 12px; }
.st-tc { position: relative; margin: 8px -4px 0; user-select: none; -webkit-user-select: none; }
.st-tc-canvas { position: absolute; inset: 22px 0 0 0; }
.st-tc-legend { position: absolute; z-index: 3; left: 4px; top: 2px; white-space: nowrap; overflow: hidden; display: flex; flex-wrap: wrap; gap: 2px 10px;
  font-size: 11px; pointer-events: none; max-width: calc(100% - 8px); }
.st-tc-legend b { font-weight: 650; }
.st-tc-overlay { position: absolute; left: 0; top: 22px; bottom: 26px; pointer-events: none; overflow: hidden; z-index: 2; }
.st-tc-line { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1.5px dashed; opacity: .9; }
.st-tc-line.past { border-left-style: dotted; border-left-width: 1px; opacity: .4; }
.st-tc-label { position: absolute; top: 2px; transform: translateX(-50%); pointer-events: auto; border: 0; cursor: pointer;
  min-width: 22px; height: 22px; padding: 0 6px; border-radius: 6px; font-size: 11px !important; font-weight: 800; line-height: 22px;
  white-space: nowrap; box-shadow: 0 1px 3px rgb(0 0 0 / .25); }
.st-tc-label::before { content: ''; position: absolute; inset: -11px -6px; }
.st-tc-label.multi { border-radius: 11px; }
.st-tc-label.past { opacity: .55; min-width: 18px; height: 18px; line-height: 18px; top: 4px; padding: 0 4px; }
.st-tc-label.sel { outline: 2px solid var(--text); outline-offset: 2px; }
.st-tc-dot { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; min-width: 18px; height: 18px; border-radius: 9px;
  border: 2px solid; background: var(--surface); color: var(--text) !important; font-size: 9px !important; font-weight: 800;
  padding: 0 3px; cursor: pointer; line-height: 14px; box-shadow: 0 0 0 2px var(--bg); }
.st-tc-pin { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--bg); padding: 0; cursor: pointer; font-size: 9px !important; font-weight: 800; line-height: 1; }
.st-tc-pin.many { width: 18px; height: 18px; }
.st-tc-pin.past { opacity: .55; }
.st-tc-pin.sel { outline: 2px solid var(--text); outline-offset: 1px; }
.st-tc-pin::before { content: ''; position: absolute; inset: -12px -6px; }
.st-tc-dot::before { content: ''; position: absolute; inset: -10px; }
.st-tc-zoom { position: absolute; z-index: 4; right: 0; top: -44px; display: flex; gap: 4px; }
.st-tc-zoom button { min-width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface);
  display: grid; place-items: center; cursor: pointer; font-size: 11px; font-weight: 700; padding: 0 6px; opacity: .92; }
.st-tc-loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 13px; }
.st-legend .st-nm.ring { background: var(--surface); color: var(--text); border: 2px solid var(--muted); width: 18px; height: 18px; }
.st-pin-k { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--muted); margin-right: 5px; vertical-align: 0; }
.st-more { display: block; width: 100%; min-height: 44px; margin-top: 8px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); cursor: pointer; font-weight: 650; font-size: 13px; color: var(--accent) !important; }
.st-legend .st-nm.multi { border-radius: 8px; width: 18px; }
.st-sel { margin-top: 10px; }
.st-sel-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.st-sel-head b { font-size: 15px; }
.st-sel-head .st-countdown { margin-left: auto; }
.st-sel-head .st-nm { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--text); color: var(--bg); font-size: 11px; font-weight: 800; }
.st-sel-x { width: 36px; height: 36px; border: 0; background: var(--surface-2); border-radius: 10px; cursor: pointer; font-size: 18px; line-height: 1; }
.st-sel-head .st-sel-x:only-of-type { margin-left: 0; }
.st-sel-title { display: block; margin-top: 8px; font-weight: 600; font-size: 15px; line-height: 1.35; text-decoration: none; }
.st-sel-title:hover { text-decoration: underline; }
.st-sel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.st-sel-actions .st-btn { margin-top: 10px; min-height: 38px; display: inline-flex; align-items: center; text-decoration: none; font-size: 13px; }

@media (min-width: 760px) {
  .st-chart-bar { padding-right: 124px; }
  .st-detail-cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  .st-perf { grid-template-columns: repeat(8, 1fr); }
  .st-row { grid-template-columns: minmax(0, 1fr) 120px 110px; }
}
@media (prefers-reduced-motion: reduce) { .st-spin { animation: none; } * { transition: none !important; } }
/* ---- Möbius / TuningKit look: branded header, pipeline rail, accent controls, tinted cards ---- */
.st-top { border-bottom: 1px solid var(--border); }
.st-brandbar { background: var(--surface); border-bottom: 1px solid var(--border); }
.st-brandrow { display: flex; align-items: center; justify-content: space-between; min-height: 56px; }
.st-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
.st-mark { width: 32px; height: 32px; border-radius: 9px; flex: none; box-shadow: 0 0 0 1px var(--border); }
.st-brand-text { min-width: 0; line-height: 1.15; }
.st-brand-text h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.015em; }
.st-brand-text span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-top-row { min-height: 56px; }
.st-title { font-size: 18px; }

.st-rail { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 12px 0 10px; padding: 8px;
  border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, var(--surface)), var(--surface)); }
.st-rail::before { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 3px; margin-top: -1.5px; border-radius: 99px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 30%, transparent) 25%, var(--accent) 50%, color-mix(in srgb, var(--accent) 30%, transparent) 75%, transparent); opacity: .55; }
.st-stage { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 8px;
  border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--muted); font-weight: 650; font-size: 13px;
  cursor: pointer; white-space: nowrap; transition: border-color .15s, background .15s, box-shadow .15s; }
.st-stage i { width: 8px; height: 8px; border-radius: 50%; border: 2px solid currentColor; flex: none; }
.st-stage:hover { border-color: var(--accent); color: var(--text); }
.st-stage[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--accent-fg, #fff);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent); }
.st-stage[aria-pressed="true"] i { background: currentColor; }

.st-chip[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg, #fff); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
.st-chip:hover:not([aria-pressed="true"]) { color: var(--text); }
.st-list, .st-card, .st-grid, .st-perf, .st-table-wrap { border-radius: 14px; }
.st-card, .st-list { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--surface)), var(--surface)); }
.st-row:hover { background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.st-btn { border-radius: 10px; }
.st-btn.ghost { border: 1px solid var(--border); background: var(--surface); }
.st-btn.ghost:hover { border-color: var(--accent); }
.st-seg button[aria-pressed="true"] { color: var(--accent); border-bottom-color: var(--accent); }
.st-more { border-radius: 10px; }
.st-more:hover { border-color: var(--accent); }

/* chart toolbar inside the chart */
.st-ranges { margin-top: 2px; }
.st-tc-top { position: absolute; z-index: 4; left: 4px; right: 4px; top: 0; height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.st-tc-top .st-tc-legend { position: static; pointer-events: none; }
.st-tc-type { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); flex: none; }
.st-tc-type button { width: 32px; height: 26px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.st-tc-type button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg, #fff); }
.st-tc-canvas { top: 34px !important; }
.st-tc-overlay { top: 34px !important; bottom: 26px; }
.st-tc-pin { width: 14px !important; height: 14px !important; border: 2px solid var(--bg) !important; box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 0%, transparent); }
.st-tc-pin.future { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.st-tc-pin.past { opacity: .7 !important; width: 11px !important; height: 11px !important; }
.st-tc-pin.many { width: 20px !important; height: 20px !important; font-size: 10px !important; }
.st-tc-pin.sel { outline: 2px solid var(--text); outline-offset: 2px; opacity: 1 !important; }
@media (min-width: 760px) { .st-chart-bar { padding-right: 0; } }
@media (max-width: 520px) { .st-stage { font-size: 12px; gap: 6px; } .st-stage i { display: none; } .st-tc-legend { font-size: 10px; } }
/* marker lanes above the date axis: news (rings) then events (filled) */
.st-tc-dot { min-width: 22px !important; height: 22px !important; border-radius: 11px !important; border: 2px solid var(--muted) !important;
  background: var(--surface) !important; color: var(--text) !important; font-size: 10px !important; line-height: 18px !important; box-shadow: 0 1px 4px rgb(0 0 0 / .25) !important; }
.st-tc-dot:hover { border-color: var(--accent) !important; }
.st-tc-lanes { position: absolute; left: 0; right: 0; height: 48px; pointer-events: none; }

.st-sample { display: inline-block; padding: 2px 8px; border-radius: 6px; background: color-mix(in srgb, var(--st-macro) 18%, transparent); color: var(--st-macro); letter-spacing: .06em; }
.st-sample-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; font-size: 13px; color: var(--muted); }
.st-sample-note .st-btn { margin-top: 0; min-height: 36px; }
.st-held { color: var(--st-macro) !important; }

/* overview: full-width rows, items side by side */
.st-hgrid { grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); }
.st-evrow { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
.st-evtile { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; min-width: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--surface)), var(--surface)); }
.st-evtile.earnings { border-top: 3px solid var(--accent); } .st-evtile.macro { border-top: 3px solid var(--st-macro); } .st-evtile.dividend { border-top: 3px solid var(--st-div); }
.st-evtile-top { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.st-evtile-top .st-countdown { margin-left: auto; font-size: 12px; }
.st-evtile-name { font-weight: 650; font-size: 14px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-newsrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
.st-newstile { display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; text-decoration: none;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--surface)), var(--surface)); }
.st-newstile:hover { border-color: var(--accent); }
.st-newstile .st-news-t { font-size: 14px; font-weight: 600; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.st-newstile .st-news-s { margin: 0; }

.st-hgrid { gap: 0 !important; background: var(--surface) !important; }
.st-hgrid > div { box-shadow: inset -1px -1px 0 var(--border); }

/* list sparklines draw in left→right */
.st-spark { animation: st-draw .65s cubic-bezier(.22,.61,.36,1) both; }
@keyframes st-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@media (prefers-reduced-motion: reduce) { .st-spark { animation: none; } }

/* news markers: plain dots */
.st-tc-dot { min-width: 0 !important; width: 12px !important; height: 12px !important; padding: 0 !important; border-radius: 50% !important;
  border: 2px solid var(--text) !important; background: var(--bg) !important; }
.st-tc-dot:hover, .st-tc-dot:focus-visible { background: var(--text) !important; }

.st-news-k { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--text); margin-right: 5px; vertical-align: -1px; }

`
