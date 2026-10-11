import React, { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot,
  ReferenceArea, Brush, CartesianGrid,
} from 'recharts'
import { DAY, isoToMs, dateShort, dateLong, timeHM, price, pct, eventShort, monthYear } from '../format.js'

export const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'Max']
const SPAN = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '5Y': 1826 }
const PAD = { '1D': 0, '1W': 21, '1M': 45, '3M': 75, '6M': 100, '1Y': 130, '5Y': 240, Max: 300 }

const closeOnly = (rows) => rows.map((b) => [b[0], b[b.length - 1]])

function series(d, range) {
  const r = seriesRaw(d, range)
  return { ...r, pts: closeOnly(r.pts) }
}

function seriesRaw(d, range) {
  if (range === '1D') {
    if (d.intraday?.length > 10) return { pts: d.intraday, step: 0, intraday: true }
    return { pts: (d.daily || []).slice(-5), step: DAY, intraday: false }
  }
  const weekly = range === '5Y' || range === 'Max'
  const src = weekly ? d.weekly || [] : d.daily || []
  if (!src.length) return { pts: [], step: DAY }
  const last = src[src.length - 1][0]
  const pts = range === 'Max' ? src : src.filter(([t]) => t >= last - SPAN[range] * DAY)
  // make sure the live close is the final point on weekly ranges
  const lastDaily = d.daily?.[d.daily.length - 1]
  if (weekly && lastDaily && lastDaily[0] > last) pts.push(lastDaily)
  return { pts, step: weekly ? 7 * DAY : DAY }
}

function EventLabel({ viewBox, value, fill, row }) {
  if (!viewBox) return null
  const x = viewBox.x
  const y = viewBox.y + 2 + row * 17
  const w = Math.max(16, value.length * 6.4 + 8)
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={y} width={w} height={15} rx={4} fill={fill} />
      <text x={x} y={y + 11} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{value}</text>
    </g>
  )
}

function NewsDot({ cx, cy: cy0, n, stack, colors }) {
  if (cx == null || cy0 == null) return null
  const cy = cy0 - stack * 20
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={9} fill={colors.text} stroke={colors.surface} strokeWidth={2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill={colors.surface}>{n}</text>
    </g>
  )
}

export default function PriceChart({ data, range, colors, news, height = 270 }) {
  const model = useMemo(() => {
    const { pts, step, intraday } = series(data, range)
    if (!pts.length) return null
    const first = pts[0][1]
    const lastT = pts[pts.length - 1][0]
    const rows = pts.map(([t, p]) => ({ t, p }))
    const allEvents = data.events || []
    const todayIso = new Date().toISOString().slice(0, 10)
    const future = allEvents.filter((e) => e.date >= todayIso)
    let padDays = PAD[range]
    if (range !== '1D' && future.length) {
      const until = (isoToMs(future[0].date) - Date.now()) / DAY
      padDays = Math.max(padDays, Math.min(until + 6, 140))
    }
    const end = lastT + padDays * DAY
    if (step) for (let t = lastT + step; t <= end; t += step) rows.push({ t, p: null })
    const start = rows[0].t
    const showDiv = !['5Y', 'Max'].includes(range)
    const visible = allEvents.filter((e) => {
      const t = isoToMs(e.date)
      if (t < start || t > end) return false
      if (e.type === 'dividend' && !showDiv) return false
      if (e.type === 'macro' && e.date < todayIso && range !== '1M' && range !== '1W') return false
      return true
    })
    // label future events without overlap: same-day events share one label, up to 3 rows
    const futureVis = visible.filter((e) => e.date >= todayIso)
    const byDate = new Map()
    futureVis.forEach((e) => { if (!byDate.has(e.date)) byDate.set(e.date, []); byDate.get(e.date).push(e) })
    const labelRow = new Map()
    const rowsUsed = [[], [], []]
    const msPerPx = (end - start) / 320
    for (const [date, evs] of byDate) {
      const text = eventShort(evs[0]) + (evs.length > 1 ? ` +${evs.length - 1}` : '')
      const t = isoToMs(date)
      const half = ((text.length * 6.4 + 12) / 2) * msPerPx
      const r = rowsUsed.findIndex((row) => row.every(([a, b]) => t + half < a || t - half > b))
      if (r >= 0) {
        rowsUsed[r].push([t - half, t + half])
        labelRow.set(evs[0], { row: r, text })
      }
    }
    // news markers: up to 3 articles inside the price window
    const markers = []
    ;(news || []).forEach((a, idx) => {
      if (markers.length >= 3 || a.t < start || a.t > lastT + DAY) return
      let best = null
      for (const r of rows) {
        if (r.p == null) break
        if (r.t <= a.t + (intraday ? 0 : DAY / 2)) best = r
      }
      if (best) markers.push({ row: best, article: a, n: idx + 1, stack: markers.filter((m) => m.row === best).length })
    })
    const lastP = pts[pts.length - 1][1]
    return { markerIds: new Set(markers.map((m) => m.n)), rows, first, lastT, end, start, visible, labelRow, markers, intraday, step, chg: (lastP / first - 1) * 100 }
  }, [data, range, news])

  if (!model) return <div className="st-empty" style={{ height }}>No price data</div>
  const up = model.chg >= 0
  const line = up ? colors.up : colors.down
  const evColor = (e) => (e.type === 'earnings' ? colors.accent : e.type === 'dividend' ? colors.div : colors.macro)
  const todayIso = new Date().toISOString().slice(0, 10)
  const gradId = `st-g-${up ? 'u' : 'd'}`
  const fmtX = (t) => (model.intraday ? timeHM(t) : range === '5Y' || range === 'Max' ? monthYear(t) : dateShort(t))
  const yFmt = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : v.toFixed(v < 10 ? 2 : 0))

  function Tip({ active, payload }) {
    if (!active || !payload?.length) return null
    const r = payload[0].payload
    const tol = model.step >= 7 * DAY ? 3.5 * DAY : DAY / 2
    const evs = model.visible.filter((e) => Math.abs(isoToMs(e.date) - r.t) <= tol + DAY / 2)
    const mk = model.markers.filter((m) => m.row === r)
    return (
      <div className="st-tip">
        <div className="st-muted">{model.intraday ? `${dateShort(r.t)} ${timeHM(r.t)}` : dateLong(r.t)}</div>
        {r.p != null && (
          <div>
            <b>{price(r.p, data.kind === 'index' ? null : data.quote?.currency)}</b>{' '}
            <span className={r.p >= model.first ? 'st-up' : 'st-down'}>{pct((r.p / model.first - 1) * 100)}</span>
          </div>
        )}
        {evs.map((e, i) => (
          <div className="st-tip-ev" key={i}>
            <span className={`st-dot ${e.type}`} />
            <b style={{ fontSize: 12 }}>{e.label}</b>
            {e.consensus != null && <div className="st-muted">Est {e.type === 'earnings' ? '$' + e.consensus : e.consensus}</div>}
            {e.actual && <div className="st-muted">Act {e.actual}</div>}
          </div>
        ))}
        {mk.map((m) => (
          <div className="st-tip-ev" key={m.n}>
            <b style={{ fontSize: 12 }}>{m.n}. {m.article.source}</b>
            <div>{m.article.title}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="st-chart-box" role="img" aria-label={`${data.name} price chart, ${range}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={model.rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line} stopOpacity={0.22} />
              <stop offset="100%" stopColor={line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.border} strokeOpacity={0.6} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={fmtX}
            tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis orientation="right" domain={['auto', 'auto']} tickFormatter={yFmt} width={44}
            tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
          {model.end > model.lastT && (
            <ReferenceArea x1={model.lastT} x2={model.end} fill={colors.muted} fillOpacity={0.06} ifOverflow="hidden" />
          )}
          <ReferenceLine y={model.first} stroke={colors.muted} strokeOpacity={0.4} strokeDasharray="2 4" />
          {model.visible.map((e, i) => {
            const fut = e.date >= todayIso
            return (
              <ReferenceLine key={i} x={isoToMs(e.date)} stroke={evColor(e)} strokeOpacity={fut ? 0.95 : 0.35}
                strokeWidth={fut ? 1.5 : 1} strokeDasharray={fut ? '5 4' : '1 3'} ifOverflow="hidden"
                label={fut && model.labelRow.has(e) ? <EventLabel value={model.labelRow.get(e).text} fill={evColor(e)} row={model.labelRow.get(e).row} /> : undefined} />
            )
          })}
          <Area type="monotone" dataKey="p" stroke={line} strokeWidth={2} fill={`url(#${gradId})`}
            isAnimationActive={false} connectNulls={false} dot={false} activeDot={{ r: 4, fill: line, stroke: colors.surface }} />
          {model.markers.map((m) => (
            <ReferenceDot key={m.n} x={m.row.t} y={m.row.p} ifOverflow="extendDomain"
              shape={(p) => <NewsDot {...p} n={m.n} stack={m.stack} colors={colors} />} />
          ))}
          <Tooltip content={<Tip />} cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }} isAnimationActive={false} />
          {range !== '1D' && (
            <Brush key={range} dataKey="t" height={26} stroke={colors.border} fill={colors.surface}
              travellerWidth={12} tickFormatter={fmtX} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
