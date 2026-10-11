import React, { useState } from 'react'
import { price, pct, num, tone, dateShort, countdown } from '../format.js'

export const KINDS = [['index', 'Indices'], ['stock', 'Stocks'], ['commodity', 'Commodities'], ['portfolio', 'Trading 212']]
export const PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y']
const SORTS = [['default', 'Default'], ['up', 'Gainers'], ['down', 'Losers']]

// Price path for the selected period, with a dashed baseline at the period's starting price.
function Spark({ values, colors, change, delay = 0 }) {
  if (!values || values.length < 2) return <span />
  const min = Math.min(...values), max = Math.max(...values)
  const w = 80, h = 32
  const y = (v) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${y(v)}`).join(' ')
  const color = change == null ? colors.muted : change >= 0 ? colors.up : colors.down
  return (
    <svg className="st-spark" style={{ animationDelay: `${delay}ms` }} width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={w} y1={y(values[0])} y2={y(values[0])} stroke={colors.muted} strokeOpacity="0.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function NextEvent({ e }) {
  if (!e) return null
  const what = e.type === 'earnings' ? (e.ref ? `${e.ref} earnings` : e.label?.includes('est.') ? 'Earnings (est.)' : 'Earnings') : e.type === 'dividend' ? 'Ex-dividend' : e.label
  return (
    <span className={`st-next ${e.type}`}>
      <span className={`st-dot ${e.type}`} />{what} {dateShort(e.date)} · {countdown(e.date, true)}
    </span>
  )
}

export default function Dashboard({ index, kind, period, colors, onOpen, held, heldLabel = 'T212' }) {
  const [sort, setSort] = useState('default')
  const change = (it) => (period === '1D' ? it.changePct : it.perf?.[period])
  let items = (index.items || []).filter((i) => i.kind === kind)
  if (sort !== 'default') items = items.slice().sort((a, b) => (sort === 'up' ? 1 : -1) * ((change(b) ?? -1e9) - (change(a) ?? -1e9)))
  return (
    <div className="st-wrap">
      <div className="st-section-h">
        <span>{kind === 'index' ? 'Indices' : kind === 'stock' ? 'Stocks' : 'Commodities'} · {period}</span>
        <span className="st-sort" role="group" aria-label="Sort">
          {SORTS.map(([k, l]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
        </span>
      </div>
      <div className="st-list">
        {items.map((it, i) => {
          const v = change(it)
          const spark = it.sparks?.[period] || it.spark
          const cur = it.kind === 'index' ? null : it.currency
          return (
            <button key={it.id} className="st-row" onClick={() => onOpen(it.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="st-row-name">{it.name}{held?.has(it.id) && <span className="st-held">{heldLabel}</span>}</div>
                <div className="st-row-meta"><span className="st-tick">{it.id}</span><NextEvent e={it.next} /></div>
              </div>
              {/* keyed by tab + period so the draw-in replays whenever either changes */}
              <Spark key={`${kind}-${period}-${sort}`} values={spark} colors={colors} change={v} delay={Math.min(i, 12) * 35} />
              <div className="st-row-right">
                <div className="st-row-price">{price(it.last, cur)}</div>
                <span className={`st-pill ${tone(v)}`}>{pct(v)}</span>
                {period === '1D' && it.change != null && <div className={`st-row-abs ${tone(it.change)}`}>{it.change > 0 ? '+' : ''}{num(it.change)}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
