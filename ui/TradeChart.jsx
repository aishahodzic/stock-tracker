import React, { useEffect, useMemo, useRef, useState } from 'react'
import { isoToMs, dateShort, dateLong, timeHM, price, pct } from '../format.js'

// TradingView Lightweight Charts (Apache-2.0), loaded from esm.sh: the app is online-only and
// the library is not in Möbius's bundled imports. Detail falls back to Recharts if this fails.
const LC_URL = 'https://esm.sh/lightweight-charts@5.2.1?bundle'
let lcPromise = null
const loadLC = () => (lcPromise ||= import(/* @vite-ignore */ LC_URL).catch((e) => { lcPromise = null; throw e }))

export const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'Max']
const SPAN = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '5Y': 1826 }
const PAD = { '1D': 0, '1W': 14, '1M': 30, '3M': 60, '6M': 90, '1Y': 120, '5Y': 240, Max: 300 }

const bar = (b) => (b.length >= 5 ? { o: b[1], h: b[2], l: b[3], c: b[4] } : { o: b[1], h: b[1], l: b[1], c: b[1] })

// Only the selected period's bars are loaded, so each range is a fresh drawing of that period.
function dataset(d, range) {
  if (range === '1D' && d.intraday?.length > 10) return { kind: 'intraday', bars: d.intraday, step: 60 }
  const weekly = range === '5Y' || range === 'Max'
  let bars = (weekly ? d.weekly : d.daily) || []
  if (weekly) {
    bars = bars.slice()
    const ld = d.daily?.[d.daily.length - 1]
    if (ld && bars.length && ld[0] > bars[bars.length - 1][0] + 86400000) bars.push(ld)
  }
  if (range === '1D') bars = bars.slice(-5)
  else if (range !== 'Max' && bars.length) {
    const cut = bars[bars.length - 1][0] - SPAN[range] * 86400000
    const i = bars.findIndex((b) => b[0] >= cut)
    bars = bars.slice(Math.max(0, i - 1))
  }
  return { kind: weekly ? 'weekly' : 'daily', bars, step: weekly ? 7 * 86400 : 86400 }
}

const LineIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 14l4-5 4 3 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const CandleIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M5 2v16M10 4v13M15 3v14" stroke="currentColor" strokeWidth="1.4" />
    <rect x="3" y="6" width="4" height="7" rx="1" fill="currentColor" />
    <rect x="8" y="8" width="4" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <rect x="13" y="5" width="4" height="6" rx="1" fill="currentColor" />
  </svg>
)

export default function TradeChart({ data, range, style, setStyle, colors, onSelect, selected, onFail, height = 330 }) {
  const boxRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const lcRef = useRef(null)
  const priceLineRef = useRef(null)
  const animRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [overlay, setOverlay] = useState({ pins: [], dots: [], selX: null })
  const [legend, setLegend] = useState(null)
  const cur = data.kind === 'index' ? null : data.quote?.currency
  const ds = useMemo(() => dataset(data, range), [data, range])

  const model = useMemo(() => {
    if (!ds.bars.length) return null
    const rows = ds.bars.map((b) => ({ time: Math.round(b[0] / 1000), ...bar(b) })).sort((a, b) => a.time - b.time)
    const clean = rows.filter((r, i) => i === 0 || r.time > rows[i - 1].time)
    const lastT = clean[clean.length - 1].time
    const todayIso = new Date().toISOString().slice(0, 10)
    const nextEv = (data.events || []).find((e) => e.date >= todayIso)
    let pad = PAD[range]
    if (ds.kind !== 'intraday' && nextEv) pad = Math.max(pad, Math.min((isoToMs(nextEv.date) / 1000 - lastT) / 86400 + 5, 140))
    const future = []
    if (ds.kind !== 'intraday') for (let t = lastT + ds.step; t <= lastT + pad * 86400; t += ds.step) future.push({ time: t })
    return { rows: clean, future, times: clean.map((r) => r.time).concat(future.map((r) => r.time)), lastT, first: clean[0] }
  }, [ds, data, range])

  const events = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    return (data.events || [])
      .filter((e) => !(e.type === 'dividend' && ds.kind === 'weekly'))
      .map((e) => ({ ...e, t: Math.round(isoToMs(e.date) / 1000), future: e.date >= todayIso }))
  }, [data, ds])
  const news = useMemo(() => (data.news || []).map((a, i) => ({ ...a, n: i + 1, ts: Math.round(a.t / 1000) })), [data])

  useEffect(() => {
    let disposed = false
    let wheelOff = null
    loadLC().then((LC) => {
      if (disposed || !boxRef.current) return
      lcRef.current = LC
      const chart = LC.createChart(boxRef.current.querySelector('.st-tc-canvas'), {
        autoSize: true,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: colors.muted, fontSize: 11,
          fontFamily: getComputedStyle(boxRef.current).fontFamily },
        grid: { vertLines: { visible: false }, horzLines: { color: colors.border } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.24 } },  // bottom room for the marker lanes
        timeScale: { borderVisible: false, rightOffset: 0, minBarSpacing: 0.3 },
        crosshair: { mode: 0 },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
      })
      chartRef.current = chart
      // Trackpad: sideways = pan, pinch (ctrl+wheel) = zoom at cursor, up/down = page scroll.
      const el = boxRef.current
      const onWheel = (ev) => {
        const ts = chart.timeScale(), r = ts.getVisibleLogicalRange(), w = ts.width()
        if (!r || !w) return
        const bars = r.to - r.from
        const dx = ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX
        if (ev.ctrlKey || ev.metaKey) {
          ev.preventDefault()
          const frac = Math.min(1, Math.max(0, (ev.clientX - el.getBoundingClientRect().left) / w))
          const a = r.from + frac * bars
          const nb = Math.min(Math.max(5, bars * Math.exp(ev.deltaY * 0.01)), 5000)
          ts.setVisibleLogicalRange({ from: a - frac * nb, to: a + (1 - frac) * nb })
        } else if (Math.abs(dx) > Math.abs(ev.shiftKey ? 0 : ev.deltaY)) {
          ev.preventDefault()
          const sh = (dx / w) * bars
          ts.setVisibleLogicalRange({ from: r.from + sh, to: r.to + sh })
        }
      }
      el.addEventListener('wheel', onWheel, { passive: false, capture: true })
      wheelOff = () => el.removeEventListener('wheel', onWheel, { capture: true })
      chart.subscribeCrosshairMove((p) => {
        const s = seriesRef.current
        const v = s && p?.time ? p.seriesData.get(s) : null
        setLegend(v && (v.close ?? v.value) != null ? { time: p.time, o: v.open, h: v.high, l: v.low, c: v.close ?? v.value } : null)
      })
      setReady(true)
    }).catch((e) => {
      onFail?.(e)
      window.mobius?.signal?.('error', { message: String(e.message || e), source: 'chart-load' })
    })
    return () => { disposed = true; wheelOff?.(); chartRef.current?.remove(); chartRef.current = null; seriesRef.current = null }
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions({ layout: { textColor: colors.muted }, grid: { horzLines: { color: colors.border } } })
  }, [colors, ready])

  useEffect(() => {
    const chart = chartRef.current, LC = lcRef.current
    if (!ready || !chart || !model) return
    if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; priceLineRef.current = null }
    const fmt = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : v.toFixed(v < 10 ? 3 : 2))
    const up = model.rows[model.rows.length - 1].c >= model.first.c
    let s
    // Draw-in animation: every bar keeps its slot (undrawn bars are whitespace) and the price
    // scale is pinned to the period's full range, so the line grows left→right without the
    // axes moving. Reduced-motion users get the finished chart immediately.
    const lo = Math.min(...model.rows.map((r) => r.l)), hi = Math.max(...model.rows.map((r) => r.h))
    const pin = { on: true }
    const autoscaleInfoProvider = (orig) => (pin.on ? { priceRange: { minValue: lo, maxValue: hi } } : orig())
    const point = style === 'candles'
      ? (r) => ({ time: r.time, open: r.o, high: r.h, low: r.l, close: r.c })
      : (r) => ({ time: r.time, value: r.c })
    if (style === 'candles') {
      s = chart.addSeries(LC.CandlestickSeries, { upColor: colors.up, downColor: colors.down, borderVisible: false,
        wickUpColor: colors.up, wickDownColor: colors.down, priceFormat: { type: 'custom', formatter: fmt }, autoscaleInfoProvider })
    } else {
      const line = up ? colors.up : colors.down
      s = chart.addSeries(LC.AreaSeries, { lineColor: line, lineWidth: 2, topColor: hexA(line, 0.22), bottomColor: hexA(line, 0),
        priceFormat: { type: 'custom', formatter: fmt }, crosshairMarkerRadius: 4, autoscaleInfoProvider })
    }
    const full = model.rows.map(point).concat(model.future)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    cancelAnimationFrame(animRef.current)
    if (reduce) { s.setData(full); pin.on = false }
    else {
      const n = model.rows.length, dur = 700, t0 = performance.now()
      const frame = (now) => {
        if (seriesRef.current !== s) return
        const p = Math.min(1, (now - t0) / dur)
        const k = Math.max(1, Math.ceil(n * (1 - Math.pow(1 - p, 3))))   // ease-out
        s.setData(p >= 1 ? full : model.rows.map((r, i) => (i < k ? point(r) : { time: r.time })).concat(model.future))
        if (p < 1) animRef.current = requestAnimationFrame(frame)
        else { pin.on = false; s.applyOptions({}) }
      }
      s.setData(model.rows.map((r) => ({ time: r.time })).concat(model.future))
      animRef.current = requestAnimationFrame(frame)
    }
    seriesRef.current = s
    chart.applyOptions({ timeScale: { timeVisible: ds.kind === 'intraday', secondsVisible: false } })
    // show exactly this period plus its future days (fitContent ignores trailing whitespace bars)
    const ts = chart.timeScale()
    const show = () => ts.setVisibleLogicalRange({ from: -0.5, to: model.times.length - 0.5 })
    show()
    requestAnimationFrame(show)
  }, [ready, model, style, colors.up, colors.down])

  // selected event: horizontal price line at that day's price (latest price for future events)
  const selEvent = selected?.kind === 'event' ? selected.event : null
  useEffect(() => {
    const s = seriesRef.current
    if (!s) return
    if (priceLineRef.current) { s.removePriceLine(priceLineRef.current); priceLineRef.current = null }
    if (!selEvent || !model) return
    const t = isoToMs(selEvent.date) / 1000
    let row = model.rows[model.rows.length - 1]
    for (const r of model.rows) { if (r.time <= t + 43200) row = r; else break }
    priceLineRef.current = s.createPriceLine({ price: row.c, color: evColor(selEvent, colors), lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: selEvent.future ? 'Now' : dateShort(row.time * 1000) })
  }, [selEvent, model, style, ready])

  // overlay: event dots on the time axis, news circles on the price line
  useEffect(() => {
    const chart = chartRef.current
    if (!ready || !chart || !model) return
    let raf = 0
    const draw = () => {
      raf = 0
      const s = seriesRef.current
      const ts = chart.timeScale()
      const plotW = ts.width()
      if (!s || !plotW) { raf = requestAnimationFrame(draw); return }
      const placed = []
      for (const e of events) {
        const x = timeX(ts, model.times, e.t)
        if (x != null && x >= 0 && x <= plotW) placed.push({ e, x })
      }
      placed.sort((a, b) => a.x - b.x)
      const pins = []
      for (const p of placed) {
        const g = pins[pins.length - 1]
        if (g && p.x - g.x1 < 16) { g.items.push(p); g.x1 = p.x } else pins.push({ items: [p], x0: p.x, x1: p.x })
      }
      pins.forEach((g) => { g.x = (g.x0 + g.x1) / 2 })
      // news: only the 3 most important articles, one plain dot each, on the date axis
      const keyNews = news.filter((a) => a.key && a.ts >= model.rows[0].time).sort((a, b) => a.ts - b.ts)
      const fallback = keyNews.length ? keyNews : news.filter((a) => a.ts >= model.rows[0].time).slice(0, 3)
      const dots = []
      for (const a of fallback) {
        const x = timeX(ts, model.times, Math.min(a.ts, model.lastT))
        if (x != null && x >= 0 && x <= plotW) dots.push({ arts: [a], x })
      }
      dots.sort((a, b) => a.x - b.x)
      for (let i = 1; i < dots.length; i++) if (dots[i].x - dots[i - 1].x < 16) dots[i].x = dots[i - 1].x + 16
      const selX = selEvent ? timeX(ts, model.times, isoToMs(selEvent.date) / 1000) : null
      const plotH = (boxRef.current?.querySelector('.st-tc-canvas')?.clientHeight || 0) - 26
      setOverlay({ pins, dots, plotW, plotH, selX })
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw) }
    const ts = chart.timeScale()
    ts.subscribeVisibleLogicalRangeChange(schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(boxRef.current)
    schedule()
    const t = setTimeout(schedule, 150)
    return () => { ts.unsubscribeVisibleLogicalRangeChange(schedule); ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(t) }
  }, [ready, model, events, news, style, selEvent])

  function openPin(g) {
    if (g.items.length === 1) { onSelect?.({ kind: 'event', event: g.items[0].e }); return }
    if (g.items.every((p) => p.e.date === g.items[0].e.date)) { onSelect?.({ kind: 'events', events: g.items.map((p) => p.e) }); return }
    const ts = chartRef.current.timeScale()
    const ls = g.items.map((p) => toLogical(model.times, p.e.t))
    const lo = Math.min(...ls), hi = Math.max(...ls), span = Math.max((hi - lo) * 5, 8)
    ts.setVisibleLogicalRange({ from: (lo + hi) / 2 - span / 2, to: (lo + hi) / 2 + span / 2 })
  }

  const L = legend || (model && { time: model.lastT, ...model.rows[model.rows.length - 1] })
  const firstC = model?.first.c
  const isSel = (items) => {
    const evs = selected?.kind === 'event' ? [selected.event] : selected?.kind === 'events' ? selected.events : []
    return items.some((p) => evs.some((x) => x && x.date === p.e.date && x.label === p.e.label))
  }

  return (
    <div className="st-tc" ref={boxRef} style={{ height }}>
      <div className="st-tc-top">
        {L && (
          <div className="st-tc-legend">
            <span className="st-muted">{ds.kind === 'intraday' ? `${dateShort(L.time * 1000)} ${timeHM(L.time * 1000)}` : dateLong(L.time * 1000)}</span>
            {style === 'candles' && L.o != null && <><span>O <b>{price(L.o, cur)}</b></span><span>H <b>{price(L.h, cur)}</b></span><span>L <b>{price(L.l, cur)}</b></span></>}
            <span>C <b>{price(L.c, cur)}</b></span>
            {firstC && <span className={L.c >= firstC ? 'st-up' : 'st-down'}>{pct((L.c / firstC - 1) * 100)}</span>}
          </div>
        )}
        <div className="st-tc-type" role="group" aria-label="Chart type">
          <button aria-pressed={style === 'line'} onClick={() => setStyle('line')} aria-label="Line chart" title="Line"><LineIcon /></button>
          <button aria-pressed={style === 'candles'} onClick={() => setStyle('candles')} aria-label="Candlestick chart" title="Candles"><CandleIcon /></button>
        </div>
      </div>
      <div className="st-tc-canvas" />
      <div className="st-tc-overlay" style={{ width: overlay.plotW || 0 }}>
        {overlay.selX != null && <i className="st-tc-line" style={{ left: overlay.selX, borderColor: evColor(selEvent, colors) }} />}
        {overlay.dots.map((d, i) => (
          <button key={`n${i}`} className="st-tc-dot" style={{ left: d.x, top: (overlay.plotH || 0) - 36 }}
            onClick={() => onSelect?.({ kind: 'news', articles: d.arts.slice().sort((a, b) => b.ts - a.ts) })}
            aria-label={`News: ${d.arts[0].title}`} />
        ))}
        {overlay.pins.map((g, gi) => {
          const e = g.items[0].e
          const many = g.items.length > 1
          return (
            <button key={`p${gi}`} className={`st-tc-pin ${many ? 'many' : ''} ${isSel(g.items) ? 'sel' : ''} ${e.future ? 'future' : 'past'}`}
              style={{ left: g.x, top: (overlay.plotH || 0) - 13, background: many ? colors.text : evColor(e, colors), color: colors.surface }}
              onClick={() => openPin(g)} aria-label={many ? `${g.items.length} events, zoom in` : `${e.label} ${dateLong(e.date)}`}>
              {many ? g.items.length : ''}
            </button>
          )
        })}
      </div>
      {!ready && <div className="st-tc-loading">Loading chart…</div>}
    </div>
  )
}

export function evColor(e, colors) {
  if (!e) return colors.muted
  return e.type === 'earnings' ? colors.accent : e.type === 'dividend' ? colors.div : colors.macro
}

// Pixel x for any timestamp, interpolated between neighbouring bars
// (logicalToCoordinate returns 0 for fractional indices in v5.2; timeToCoordinate is exact).
function timeX(ts, times, t) {
  const L = toLogical(times, t)
  const i = Math.max(0, Math.min(times.length - 2, Math.floor(L)))
  const x0 = ts.timeToCoordinate(times[i]), x1 = ts.timeToCoordinate(times[i + 1])
  if (x0 == null || x1 == null) return null
  return x0 + (L - i) * (x1 - x0)
}

function toLogical(times, t) {
  const n = times.length
  if (n < 2) return 0
  if (t <= times[0]) return (t - times[0]) / (times[1] - times[0])
  if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / (times[n - 1] - times[n - 2])
  let lo = 0, hi = n - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m }
  return lo + (t - times[lo]) / (times[hi] - times[lo])
}

function hexA(color, a) {
  const c = color.trim()
  if (/^#([0-9a-f]{6})$/i.test(c)) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
  if (c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `,${a})`)
  return c
}
