import React, { useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, BarChart, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'
import PriceChart from './PriceChart.jsx'
import TradeChart, { RANGES } from './TradeChart.jsx'
import {
  price, pct, big, num, tone, dateShort, dateLong, countdown, ago, fiscalLabel, isoToMs,
} from '../format.js'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortPeriod = (p) => (p || '').replace(/^(\w{3})\w* (\d{2})(\d{2})$/, '$1 $3')
const selKey = (s) => !s ? '' : s.kind === 'event' ? `e:${s.event.date}:${s.event.label}`
  : s.kind === 'events' ? `es:${s.events.map((e) => e.date + e.label).join('|')}`
  : `n:${(s.articles || [s.article]).map((a) => a.url).sort().join('|')}`
const sameSel = (a, b) => !!a && !!b && selKey(a) === selKey(b)
const PERF_KEYS = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y']

export default function Detail({ data, colors, position, onOpen, chartStyle, setChartStyle }) {
  const [range, setRange] = useState('1Y')
  const [tab, setTab] = useState('overview')
  const [sel, setSel] = useState(null)
  const [fallback, setFallback] = useState(false)
  const panelRef = useRef(null)
  function select(s) {
    if (sameSel(sel, s)) { setSel(null); return }   // tapping the selected dot again clears it
    setSel(s)
    requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }))
  }
  const q = { ...(data.quote || {}) }
  if (data.kind === 'index') q.currency = null
  const isStock = data.kind === 'stock'
  const tabs = isStock
    ? [['overview', 'Overview'], ['earnings', 'Earnings'], ['financials', 'Financials'], ['news', 'News']]
    : [['overview', 'Overview'], ['news', 'News']]
  const rangeChg = useMemo(() => rangeChange(data, range), [data, range])

  return (
    <div className="st-wrap">
      <div className="st-hero">
        <div className="st-hero-price">{price(q.last, q.currency)}</div>
        <div className={`st-hero-chg ${tone(range === '1D' ? q.changePct : rangeChg)}`}>
          {range === '1D'
            ? `${q.change > 0 ? '+' : ''}${num(q.change)} (${pct(q.changePct)})`
            : pct(rangeChg)}
          <span className="st-muted" style={{ fontWeight: 500 }}> · {range}</span>
          {q.asOf && <span className="st-muted" style={{ fontWeight: 500 }}> · {q.asOf}</span>}
        </div>
      </div>

      <div className="st-chips st-ranges" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r} className="st-chip" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>
      {fallback
        ? <PriceChart data={data} range={range} colors={colors} news={data.news} />
        : <TradeChart data={data} range={range} style={chartStyle} setStyle={setChartStyle} colors={colors} onSelect={select} selected={sel} onFail={() => setFallback(true)} />}
      <div className="st-legend">
        {isStock && <span><span className="st-pin-k" style={{ background: colors.accent }} />Earnings</span>}
        {isStock && <span><span className="st-pin-k" style={{ background: colors.div }} />Ex-dividend</span>}
        {data.kind === 'index' && <span><span className="st-pin-k" style={{ background: colors.accent }} />Member earnings</span>}
        {!isStock && <span><span className="st-pin-k" style={{ background: colors.macro }} />Macro · Fed, CPI, GDP{data.kind === 'commodity' ? ', OPEC, EIA' : ''}</span>}
        <span><span className="st-news-k" />Top news</span>
        <span><span className="st-nm multi">3</span>Several · tap to zoom</span>
      </div>
      <div ref={panelRef}>
        {sel && <SelectionPanel sel={sel} data={data} onClose={() => setSel(null)} onOpen={onOpen} goTab={(t) => { setTab(t); setSel(null) }} />}
      </div>

      <div className="st-seg" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} position={position} />}
      {tab === 'earnings' && <Earnings data={data} colors={colors} />}
      {tab === 'financials' && <Financials data={data} colors={colors} />}
      {tab === 'news' && <News items={data.news} />}
    </div>
  )
}

function rangeChange(d, range) {
  const src = range === '5Y' || range === 'Max' ? d.weekly : d.daily
  if (!src?.length) return null
  if (range === 'Max') return (d.quote?.last / src[0][src[0].length - 1] - 1) * 100
  return d.perf?.[range] ?? null
}

/* ---------------------------------------------------------------- selection */

function SelectionPanel({ sel, data, onClose, onOpen, goTab }) {
  if (sel.kind === 'news') {
    const arts = sel.articles || [sel.article]
    return (
      <div className="st-card st-sel">
        <div className="st-sel-head"><b>News</b><span className="st-muted">{dateLong(arts[0].t)}</span>
          <button className="st-sel-x" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto' }}>×</button></div>
        {arts.map((a) => (
          <a key={a.n} className="st-news" href={a.url} target="_blank" rel="noreferrer" style={{ marginTop: 6 }}>
            <span className="st-nm">{a.n}</span>
            <span><div className="st-news-t">{a.title}</div><div className="st-news-s">{a.source} · {ago(a.t)}</div></span>
          </a>
        ))}
      </div>
    )
  }
  if (sel.kind === 'events') {
    return (
      <div className="st-card st-sel">
        <div className="st-sel-head"><b>{sel.events.length} events</b><span className="st-muted">{dateLong(sel.events[0].date)}</span>
          <button className="st-sel-x" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto' }}>×</button></div>
        {sel.events.map((e, i) => <EventRow key={i} e={e} />)}
      </div>
    )
  }
  const e = sel.event
  const q = (data.sec?.quarters || []).find((x) => x.reported === e.date)
  const div = e.type === 'dividend' && (data.dividends?.history || []).find((x) => x.ex === e.date)
  const isNextEarnings = e.type === 'earnings' && !e.ref && e.future
  return (
    <div className="st-card st-sel">
      <div className="st-sel-head">
        <span className={`st-dot ${e.type}`} /><b>{e.label}</b><span className="st-muted">{dateLong(e.date)}</span>
        <span className="st-countdown">{countdown(e.date)}</span>
        <button className="st-sel-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="st-event-kv" style={{ fontSize: 13 }}>
        {e.time && <span>{e.time === 'before market open' ? 'Pre-market' : e.time === 'after market close' ? 'After close' : e.time + ' ET'}</span>}
        {e.consensus != null && <span>Est <b>{e.type === 'earnings' ? '$' + e.consensus : e.consensus}</b></span>}
        {e.previous && <span>Prev <b>{e.previous}</b></span>}
        {e.actual && <span>Act <b>{e.actual}</b></span>}
        {isNextEarnings && data.nextEarnings?.yearAgo != null && <span>Year ago <b>${data.nextEarnings.yearAgo}</b></span>}
        {q && <><span>Revenue <b>{big(q.revenue)}</b></span><span>Net inc <b>{big(q.netIncome)}</b></span>{q.eps != null && <span>EPS <b>{num(q.eps)}</b></span>}</>}
        {div && <><span>Amount <b>${div.amount}</b></span>{div.pay && <span>Paid <b>{dateShort(div.pay)}</b></span>}</>}
      </div>
      {isNextEarnings && data.eventNews?.length > 0 && (
        <div className="st-links">
          {data.eventNews.slice(0, 3).map((a, i) => (
            <a key={i} className="st-link" href={a.url} target="_blank" rel="noreferrer"><span className="st-src">{a.source.replace('.com', '')}</span><span>{a.title}</span></a>
          ))}
        </div>
      )}
      <div className="st-sel-actions">
        {e.ref && onOpen && <button className="st-btn ghost" onClick={() => onOpen(e.ref)}>Open {e.ref}</button>}
        {e.type === 'earnings' && !e.ref && data.kind === 'stock' && <button className="st-btn ghost" onClick={() => goTab('earnings')}>Earnings</button>}
        {(e.url || q?.filing) && <a className="st-btn ghost" href={e.url || q.filing} target="_blank" rel="noreferrer">SEC filing</a>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- overview */

function Overview({ data, position }) {
  const q = data.quote || {}
  const todayIso = new Date().toISOString().slice(0, 10)
  const upcoming = (data.events || []).filter((e) => e.date >= todayIso).slice(0, 6)
  // One column of full-width rows; each row lays its items out side by side (wrapping on phones).
  return (
    <div>
      <div className="st-perf">
        {PERF_KEYS.map((k) => (
          <div key={k}><span>{k}</span><b className={tone(data.perf?.[k])}>{pct(data.perf?.[k], 1)}</b></div>
        ))}
      </div>

      {position && <PositionCard p={position} cur={q.currency} />}

      <div className="st-section-h"><span>Key stats</span></div>
      <Stats data={data} />

      <div className="st-section-h"><span>Upcoming</span></div>
      {upcoming.length === 0 ? <div className="st-card st-muted">—</div> : (
        <div className="st-evrow">
          {upcoming.map((e, i) => <EventTile key={i} e={e} />)}
        </div>
      )}

      <div className="st-section-h"><span>News</span></div>
      <div className="st-newsrow">
        {topNews(data.news).map((a, i) => (
          <a key={i} className="st-newstile" href={a.url} target="_blank" rel="noreferrer">
            <span className="st-news-s">{a.source.replace('.com', '')} · {dateShort(a.t)}</span>
            <span className="st-news-t">{a.title}</span>
          </a>
        ))}
      </div>

      {data.target && <Analysts t={data.target} last={q.last} cur={q.currency} />}
    </div>
  )
}

// the 3 key (most important) articles, newest first; older data without scores falls back to newest 3
function topNews(list) {
  const all = list || []
  const key = all.filter((a) => a.key)
  return (key.length ? key : all).slice(0, 3)
}

function EventTile({ e }) {
  return (
    <div className={`st-evtile ${e.type}`}>
      <div className="st-evtile-top"><span className={`st-dot ${e.type}`} /><b>{dateShort(e.date)}</b><span className="st-countdown">{countdown(e.date)}</span></div>
      <div className="st-evtile-name">{e.label}</div>
      <div className="st-event-kv">
        {e.consensus != null && <span>Est <b>{e.type === 'earnings' ? '$' + e.consensus : e.consensus}</b></span>}
        {e.previous && <span>Prev <b>{e.previous}</b></span>}
        {e.time && <span>{e.time === 'before market open' ? 'Pre-market' : e.time === 'after market close' ? 'After close' : e.time + ' ET'}</span>}
      </div>
    </div>
  )
}

function PositionCard({ p, cur }) {
  const pl = p.ppl ?? p.walletImpact?.unrealizedProfitLoss
  const qty = p.quantity
  const avg = p.averagePrice ?? p.averagePricePaid
  return (
    <>
      <div className="st-section-h"><span>Trading 212{p.sample ? ' · Sample' : ''}</span></div>
      <div className="st-grid st-hgrid">
        <div><span>Shares</span><b>{num(qty, qty % 1 ? 4 : 0)}</b></div>
        <div><span>Avg price</span><b>{price(avg, cur)}</b></div>
        <div><span>P/L</span><b className={tone(pl)}>{pl == null ? '—' : num(pl)}</b></div>
      </div>
    </>
  )
}

export function EventRow({ e, links }) {
  const d = new Date(isoToMs(e.date))
  const mon = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  return (
    <div className="st-event">
      <div className="st-event-date"><b>{d.getUTCDate()}</b><span>{mon}</span></div>
      <div style={{ minWidth: 0 }}>
        <div className="st-event-name"><span className={`st-dot ${e.type}`} />{e.label}</div>
        <div className="st-event-kv">
          {e.time && <span>{e.time === 'before market open' ? 'Pre-market' : e.time === 'after market close' ? 'After close' : e.time + ' ET'}</span>}
          {e.consensus != null && <span>Est <b>{e.type === 'earnings' ? '$' + e.consensus : e.consensus}</b></span>}
          {e.previous && <span>Prev <b>{e.previous}</b></span>}
          {e.actual && <span>Act <b>{e.actual}</b></span>}
          {e.type === 'earnings' && e.confirmed === false && <span>Unconfirmed</span>}
        </div>
        {links?.length > 0 && (
          <div className="st-links">
            {links.slice(0, 3).map((a, i) => (
              <a key={i} className="st-link" href={a.url} target="_blank" rel="noreferrer">
                <span className="st-src">{a.source.replace('.com', '')}</span><span>{a.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="st-countdown">{countdown(e.date)}</div>
    </div>
  )
}

function Stats({ data }) {
  const q = { ...(data.quote || {}), ...(data.kind === 'index' ? { currency: null } : {}) }
  const latestRatio = (k) => data.quarterly?.[k]?.[0]
  const items = [
    ['Open', price(q.open, q.currency)],
    ['Day range', q.low != null ? `${num(q.low)} – ${num(q.high)}` : '—'],
    ['52w range', q.yrLow != null ? `${num(q.yrLow)} – ${num(q.yrHigh)}` : '—'],
    ['Prev close', price(q.prevClose, q.currency)],
  ]
  if (data.kind === 'stock') {
    items.push(
      ['Market cap', q.mktCap || '—'], ['P/E', num(q.pe)], ['EPS (TTM)', num(q.eps)], ['Beta', num(q.beta)],
      ['Div yield', q.divYield || '—'], ['Volume', q.volume || '—'],
      ['Net margin', latestRatio('profitMargin') != null ? num(latestRatio('profitMargin'), 1) + '%' : '—'],
      ['Debt / equity', num(latestRatio('debtToEquity'))],
    )
  } else if (q.volume && q.volume !== '0') items.push(['Volume', q.volume])
  return (
    <div className="st-grid st-hgrid">
      {items.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
    </div>
  )
}

function Analysts({ t, last, cur }) {
  if (!t.mean) return null
  const lo = Math.min(t.low, last), hi = Math.max(t.high, last)
  const at = (v) => `${((v - lo) / (hi - lo || 1)) * 100}%`
  const total = (t.buy || 0) + (t.hold || 0) + (t.sell || 0)
  const upside = (t.mean / last - 1) * 100
  return (
    <>
      <div className="st-section-h"><span>Analyst ratings · {total}</span><span className={tone(upside)}>{pct(upside, 1)} to target</span></div>
      <div className="st-card">
        <div className="st-grid" style={{ border: 0 }}>
          <div><span>Target</span><b>{price(t.mean, cur)}</b></div>
          <div><span>Low</span><b>{price(t.low, cur)}</b></div>
          <div><span>High</span><b>{price(t.high, cur)}</b></div>
        </div>
        <div className="st-range" aria-hidden="true">
          <em style={{ left: at(t.mean) }} />
          <i style={{ left: at(last) }} />
        </div>
        <div className="st-range-l"><span>{price(lo, cur)}</span><span>Now · <b style={{ color: 'var(--accent)' }}>Target</b></span><span>{price(hi, cur)}</span></div>
        {total > 0 && (
          <>
            <div className="st-ratings" aria-hidden="true">
              <i style={{ width: `${(t.buy / total) * 100}%` }} />
              <i style={{ width: `${(t.hold / total) * 100}%` }} />
              <i style={{ width: `${(t.sell / total) * 100}%` }} />
            </div>
            <div className="st-range-l">
              <span className="st-up">Buy {t.buy}</span><span>Hold {t.hold}</span><span className="st-down">Sell {t.sell}</span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- earnings */

function Earnings({ data, colors }) {
  const [more, setMore] = useState(false)
  const ne = data.nextEarnings || {}
  const fq = data.forecast?.quarterly?.[0]
  const epsRows = (data.eps || []).map((r) => ({
    period: shortPeriod(r.period), consensus: r.consensus, actual: r.upcoming ? null : r.actual,
  }))
  const consensusByPeriod = Object.fromEntries((data.eps || []).map((r) => [r.period, r]))
  const quarters = (data.sec?.quarters || []).slice().reverse()
  const byEnd = Object.fromEntries((data.sec?.quarters || []).map((x) => [x.end, x]))
  const yoy = (x, k) => {
    const prior = (data.sec?.quarters || []).find((y) => Math.abs(isoToMs(y.end) - (isoToMs(x.end) - 364 * 86400000)) < 20 * 86400000)
    return prior?.[k] && x[k] ? (x[k] / prior[k] - 1) * 100 : null
  }
  const periodLong = (end) => { const [y, m] = end.split('-'); return `${MON[+m - 1]} ${y}` }

  return (
    <div>
      <div className="st-section-h"><span>Next report</span>{ne.date && <span className="st-countdown">{countdown(ne.date)}</span>}</div>
      <div className="st-card">
        <div className="st-grid" style={{ border: 0 }}>
          <div><span>Date</span><b>{ne.date ? dateLong(ne.date) : '—'}</b></div>
          <div><span>Quarter</span><b>{ne.period || '—'}</b></div>
          <div><span>EPS est</span><b>{ne.consensus != null ? '$' + ne.consensus : '—'}</b></div>
          <div><span>Year ago</span><b>{ne.yearAgo != null ? '$' + ne.yearAgo : '—'}</b></div>
          <div><span>Est range</span><b>{fq ? `$${fq.low} – $${fq.high}` : '—'}</b></div>
          <div><span>Analysts</span><b>{fq?.n ?? '—'}</b></div>
          <div><span>Revisions 4w</span><b><span className="st-up">↑{fq?.up ?? 0}</span> <span className="st-down">↓{fq?.down ?? 0}</span></b></div>
          <div><span>Implied growth</span><b className={tone(ne.consensus - ne.yearAgo)}>{ne.yearAgo ? pct((ne.consensus / ne.yearAgo - 1) * 100, 1) : '—'}</b></div>
        </div>
        {data.eventNews?.length > 0 && (
          <div className="st-links" style={{ marginTop: 12 }}>
            {data.eventNews.slice(0, 3).map((a, i) => (
              <a key={i} className="st-link" href={a.url} target="_blank" rel="noreferrer">
                <span className="st-src">{a.source.replace('.com', '')}</span><span>{a.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {epsRows.length > 0 && (
        <>
          <div className="st-section-h"><span>EPS · estimate vs actual</span></div>
          <div className="st-card st-bars">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={epsRows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={colors.border} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: colors.border, opacity: 0.3 }} contentStyle={tipStyle(colors)}
                  formatter={(v, n) => [v == null ? '—' : '$' + num(v), n === 'consensus' ? 'Estimate' : 'Actual']} />
                <Bar dataKey="consensus" fill={colors.muted} fillOpacity={0.45} radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
                  {epsRows.map((r, i) => <Cell key={i} fill={r.actual >= r.consensus ? colors.up : colors.down} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="st-legend">
            <span><span className="st-sw" style={{ background: colors.muted, opacity: 0.45 }} />Estimate</span>
            <span><span className="st-sw" style={{ background: colors.up }} />Beat</span>
            <span><span className="st-sw" style={{ background: colors.down }} />Miss</span>
          </div>
        </>
      )}

      <div className="st-section-h"><span>History</span><span>SEC filings</span></div>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead><tr>
            <th>Quarter</th><th>Reported</th><th>Revenue</th><th>YoY</th><th>Net inc</th><th>EPS</th><th>Est</th><th>Surprise</th><th>8-K</th>
          </tr></thead>
          <tbody>
            {ne.date && (
              <tr className="st-nextrow">
                <td>{ne.period || 'Next'}</td><td>{dateShort(ne.date)}</td><td>—</td><td>—</td><td>—</td><td>—</td>
                <td>{ne.consensus != null ? num(ne.consensus) : '—'}</td><td>—</td><td>—</td>
              </tr>
            )}
            {quarters.slice(0, more ? 40 : 4).map((x) => {
              const c = consensusByPeriod[periodLong(x.end)]
              const actual = c?.actual ?? x.eps
              const surprise = c?.consensus && c?.actual != null ? (c.actual / c.consensus - 1) * 100 : null
              return (
                <tr key={x.end}>
                  <td>{fiscalLabel(x.end)}</td>
                  <td>{x.reported ? dateShort(x.reported) + ' ' + x.reported.slice(2, 4) : '—'}</td>
                  <td>{big(x.revenue)}</td>
                  <td className={tone(yoy(x, 'revenue'))}>{pct(yoy(x, 'revenue'), 1)}</td>
                  <td>{big(x.netIncome)}</td>
                  <td>{actual != null ? num(actual) : '—'}</td>
                  <td>{c?.consensus != null ? num(c.consensus) : '—'}</td>
                  <td className={tone(surprise)}>{pct(surprise, 1)}</td>
                  <td>{x.filing ? <a href={x.filing} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
                </tr>
              )
            })}
            {!quarters.length && <tr><td colSpan={9} className="st-muted">—</td></tr>}
          </tbody>
        </table>
      </div>
      {quarters.length > 4 && (
        <button className="st-more" onClick={() => setMore(!more)}>{more ? 'Show less' : `See more · ${quarters.length} quarters`}</button>
      )}

      {data.forecast && (
        <>
          <div className="st-section-h"><span>EPS · actual vs analyst forecasts</span></div>
          <ForecastChart data={data} colors={colors} />
          <ForecastTable title="Quarter" rows={data.forecast.quarterly} />
          <div style={{ height: 10 }} />
          <ForecastTable title="Fiscal year" rows={data.forecast.yearly} />
        </>
      )}
    </div>
  )
}

// Past quarters: reported EPS vs the estimate. Future quarters: consensus with the analysts' low–high range.
function ForecastChart({ data, colors }) {
  const past = (data.eps || []).filter((r) => !r.upcoming).map((r) => ({
    p: shortPeriod(r.period), actual: r.actual, est: r.consensus,
  }))
  const fut = (data.forecast?.quarterly || []).map((r) => ({
    p: shortPeriod(r.period), est: r.eps, range: r.low != null && r.high != null ? [r.low, r.high] : null, n: r.n,
  }))
  const rows = past.concat(fut.filter((f) => !past.some((x) => x.p === f.p)))
  if (rows.length < 2) return null
  return (
    <>
      <div className="st-card st-bars" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.border} />
            <XAxis dataKey="p" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip cursor={{ fill: colors.border, opacity: 0.25 }} contentStyle={tipStyle(colors)}
              formatter={(v, n) => [Array.isArray(v) ? `$${num(v[0])} – $${num(v[1])}` : v == null ? '—' : '$' + num(v),
                n === 'range' ? 'Analyst range' : n === 'est' ? 'Consensus' : 'Reported']} />
            <Bar dataKey="range" fill={colors.accent} fillOpacity={0.22} radius={4} barSize={18} />
            <Line dataKey="est" stroke={colors.accent} strokeDasharray="4 3" strokeWidth={1.5} dot={{ r: 4, fill: colors.accent, stroke: colors.surface }} isAnimationActive={false} />
            <Line dataKey="actual" stroke={colors.text} strokeWidth={2} dot={{ r: 4, fill: colors.text, stroke: colors.surface }} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="st-legend" style={{ marginBottom: 10 }}>
        <span><span className="st-sw" style={{ background: colors.text }} />Reported</span>
        <span><span className="st-sw" style={{ background: colors.accent }} />Consensus</span>
        <span><span className="st-sw" style={{ background: colors.accent, opacity: 0.3 }} />Analyst low–high</span>
      </div>
    </>
  )
}

function ForecastTable({ title, rows }) {
  if (!rows?.length) return null
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead><tr><th>{title}</th><th>EPS est</th><th>Low</th><th>High</th><th>Analysts</th><th>Raised 4w</th><th>Cut 4w</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period}>
              <td>{r.period}</td><td><b>{num(r.eps)}</b></td><td>{num(r.low)}</td><td>{num(r.high)}</td>
              <td>{r.n}</td><td className="st-up">{r.up}</td><td className="st-down">{r.down}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- financials */

function Financials({ data, colors }) {
  const [freq, setFreq] = useState('quarterly')
  const [moreQ, setMoreQ] = useState(false)
  const allQ = data.sec?.quarters || []
  const secQ = allQ.slice(moreQ ? -20 : -4).map((x) => ({
    p: fiscalLabel(x.end), revenue: x.revenue, netIncome: x.netIncome,
    margin: x.revenue && x.netIncome != null ? (x.netIncome / x.revenue) * 100 : null,
  }))
  const t = data[freq] || {}
  const r0 = (k) => t[k]?.[0]
  const fcf = (i) => (t.opCashFlow?.[i] != null && t.capex?.[i] != null ? t.opCashFlow[i] + t.capex[i] : null)
  const rows = [
    ['Revenue', 'revenue', big], ['Gross profit', 'grossProfit', big], ['Operating income', 'operatingIncome', big],
    ['Net income', 'netIncome', big], ['Gross margin', 'grossMargin', (v) => (v == null ? '—' : num(v, 1) + '%')],
    ['Operating margin', 'operatingMargin', (v) => (v == null ? '—' : num(v, 1) + '%')],
    ['Net margin', 'profitMargin', (v) => (v == null ? '—' : num(v, 1) + '%')],
    ['ROE', 'roe', (v) => (v == null ? '—' : num(v, 1) + '%')],
    ['Total assets', 'assets', big], ['Total liabilities', 'liabilities', big], ['Equity', 'equity', big],
    ['Cash', 'cash', big], ['Long-term debt', 'ltDebt', big],
    ['Debt / equity', 'debtToEquity', (v) => num(v)], ['Assets / equity', 'leverage', (v) => num(v)],
    ['Current ratio', 'currentRatio', (v) => num(v)], ['Quick ratio', 'quickRatio', (v) => num(v)],
    ['Operating cash flow', 'opCashFlow', big],
  ]
  return (
    <div>
      <div className="st-section-h"><span>Latest quarter</span><span>{data.quarterly?.periods?.[0] ? dateShort(data.quarterly.periods[0]) + ' ' + data.quarterly.periods[0].slice(2, 4) : ''}</span></div>
      <div className="st-grid">
        {[['Revenue', big(data.quarterly?.revenue?.[0])], ['Net income', big(data.quarterly?.netIncome?.[0])],
          ['Net margin', data.quarterly?.profitMargin?.[0] != null ? num(data.quarterly.profitMargin[0], 1) + '%' : '—'],
          ['Gross margin', data.quarterly?.grossMargin?.[0] != null ? num(data.quarterly.grossMargin[0], 1) + '%' : '—'],
          ['Debt / equity', num(data.quarterly?.debtToEquity?.[0])], ['Leverage (A/E)', num(data.quarterly?.leverage?.[0])],
          ['Current ratio', num(data.quarterly?.currentRatio?.[0])], ['ROE', data.quarterly?.roe?.[0] != null ? num(data.quarterly.roe[0], 1) + '%' : '—'],
        ].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
      </div>

      {secQ.length > 0 && (
        <>
          <div className="st-section-h"><span>Revenue · net income</span><span>{moreQ ? '5Y' : '1Y'}</span></div>
          <div className="st-card st-bars" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={secQ} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={1}>
                <CartesianGrid vertical={false} stroke={colors.border} />
                <XAxis dataKey="p" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tickFormatter={(v) => big(v).replace(".0", "")} tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: colors.border, opacity: 0.3 }} contentStyle={tipStyle(colors)}
                  formatter={(v, n) => [big(v), n === 'revenue' ? 'Revenue' : 'Net income']} />
                <Bar dataKey="revenue" fill={colors.accent} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                <Bar dataKey="netIncome" radius={[2, 2, 0, 0]}>
                  {secQ.map((r, i) => <Cell key={i} fill={r.netIncome >= 0 ? colors.up : colors.down} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="st-legend">
            <span><span className="st-sw" style={{ background: colors.accent }} />Revenue</span>
            <span><span className="st-sw" style={{ background: colors.up }} />Net income</span>
          </div>
          {allQ.length > 4 && <button className="st-more" onClick={() => setMoreQ(!moreQ)}>{moreQ ? 'Show less' : 'See more · 5 years'}</button>}
        </>
      )}

      <div className="st-section-h">
        <span>Statements</span>
        <div className="st-chips" style={{ width: 190 }}>
          <button className="st-chip" aria-pressed={freq === 'quarterly'} onClick={() => setFreq('quarterly')}>Quarterly</button>
          <button className="st-chip" aria-pressed={freq === 'annual'} onClick={() => setFreq('annual')}>Annual</button>
        </div>
      </div>
      {t.periods ? (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>{freq === 'annual' ? 'Year' : 'Quarter'}</th>{t.periods.map((p) => <th key={p}>{/^\d{4}-/.test(p) ? fiscalLabel(p) : p}</th>)}</tr></thead>
            <tbody>
              {rows.filter(([, k]) => t[k]).map(([label, k, f]) => (
                <tr key={k}><td>{label}</td>{t[k].map((v, i) => <td key={i}>{f(v)}</td>)}</tr>
              ))}
              {t.opCashFlow && t.capex && (
                <tr><td>Free cash flow</td>{t.periods.map((_, i) => <td key={i} className={tone(fcf(i))}>{big(fcf(i))}</td>)}</tr>
              )}
            </tbody>
          </table>
        </div>
      ) : <div className="st-card st-muted">—</div>}
      {r0('revenue') == null && null}
    </div>
  )
}

export function tipStyle(colors) {
  return { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 12, color: colors.text }
}

/* ---------------------------------------------------------------- news */

function News({ items, bare }) {
  const list = items || []
  const body = list.length === 0
    ? <div className="st-muted">—</div>
    : list.map((a, i) => (
      <a key={i} className="st-news" href={a.url} target="_blank" rel="noreferrer">
        <span className={`st-nm ${i >= 3 ? 'off' : ''}`}>{i + 1}</span>
        <span>
          <div className="st-news-t">{a.title}</div>
          <div className="st-news-s">{a.source} · {dateShort(a.t)} · {ago(a.t)}</div>
        </span>
      </a>
    ))
  return bare ? body : <div className="st-card" style={{ marginTop: 14 }}>{body}</div>
}
