import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ArrowRotateCw } from '@openai/apps-sdk-ui/components/Icon'
import { CSS } from './theme.js'
import { ago, price, pct, tone } from './format.js'
import Dashboard, { KINDS, PERIODS } from './ui/Dashboard.jsx'
import Detail from './ui/Detail.jsx'
import Portfolio, { t212Id, samplePortfolio } from './ui/Portfolio.jsx'

const FALLBACK = { accent: '#3b82f6', muted: '#8a8f98', border: '#e3e5e8', text: '#111', surface: '#fff', up: '#1f9d5c', down: '#e0464b', div: '#14b8a6', macro: '#d98a0b' }

function useColors(ref) {
  const [c, setC] = useState(FALLBACK)
  useEffect(() => {
    const read = () => {
      if (!ref.current) return
      const s = getComputedStyle(ref.current)
      const g = (n, f) => s.getPropertyValue(n).trim() || f
      setC({
        accent: g('--accent', FALLBACK.accent), muted: g('--muted', FALLBACK.muted), border: g('--border', FALLBACK.border),
        text: g('--text', FALLBACK.text), surface: g('--surface', FALLBACK.surface), up: g('--st-up', FALLBACK.up),
        down: g('--st-down', FALLBACK.down), div: g('--st-div', FALLBACK.div), macro: g('--st-macro', FALLBACK.macro),
      })
    }
    read()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', read)
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    return () => { mq.removeEventListener?.('change', read); obs.disconnect() }
  }, [ref])
  return c
}

export default function App({ appId, token }) {
  const rootRef = useRef(null)
  const colors = useColors(rootRef)
  const store = window.mobius?.storage
  const [index, setIndex] = useState(undefined)
  const [portfolio, setPortfolio] = useState(null)
  const [kind, setKind] = useState('stock')
  const [period, setPeriod] = useState('1D')
  const [chartStyle, setChartStyle] = useState('line')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [refreshing, setRefreshing] = useState(null)
  const [error, setError] = useState(null)
  const navRef = useRef(null)
  const ready = useRef(false)

  useEffect(() => {
    if (!store) { setIndex(null); return }
    const u1 = store.subscribe('index.json', (v) => {
      setIndex(v || null)
      if (!ready.current) { ready.current = true; window.mobius.signal?.('app_ready', { item_count: v?.items?.length || 0 }) }
    })
    const u2 = store.subscribe('portfolio.json', (v) => setPortfolio(v || null))
    store.get('prefs.json').then((p) => { if (p?.kind) setKind(p.kind); if (p?.period) setPeriod(p.period); if (p?.chartStyle) setChartStyle(p.chartStyle) }).catch(() => {})
    return () => { u1?.(); u2?.() }
  }, [])

  useEffect(() => {
    if (refreshing && index?.updated && index.updated !== refreshing.from) setRefreshing(null)
  }, [index, refreshing])

  useEffect(() => {
    if (!selected || !store) { setDetail(null); return }
    setDetail(undefined)
    return store.subscribe(`sym/${selected}.json`, (v) => setDetail(v || null))
  }, [selected])

  function savePrefs(next) {
    store?.set('prefs.json', { kind, period, chartStyle, ...next }).catch(() => {})
  }

  async function open(id) {
    navRef.current?.close()
    let handle = null
    handle = window.mobius?.nav?.open?.('st-detail', {
      onBack: () => { navRef.current = null; setSelected(null) },
      onForward: () => { navRef.current = handle; setSelected(id) },
    })
    navRef.current = handle
    setSelected(id)
    rootRef.current?.scrollIntoView?.({ block: 'start' })
    if (handle) {
      const { status } = await handle.outcome
      if (status !== 'owned' && navRef.current === handle) navRef.current = null
    }
  }

  function close() {
    navRef.current?.close()
    navRef.current = null
    setSelected(null)
  }

  async function refresh() {
    setError(null)
    try {
      const r = await fetch(`/api/apps/${appId}/run-job`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(`Refresh failed (${r.status})`)
      setRefreshing({ from: index?.updated, at: Date.now() })
      setTimeout(() => setRefreshing(null), 12 * 60000)
    } catch (e) {
      setError(e.message)
      window.mobius.signal?.('error', { message: e.message, source: 'refresh' })
    }
  }

  function connect() {
    window.parent.postMessage({ type: 'moebius:new-chat', draft: 'Connect my Trading 212 account to Stock Tracker. Use a sealed secure-input card (fields: key, secret) whose consumer is `python3 /data/apps/stock-tracker/store_t212.py live` (or `demo` for a Practice key), then run the Stock Tracker job and check the Trading 212 tab.' }, '*')
  }

  // a real connected account always wins; otherwise show the labelled sample
  const pf = useMemo(() => portfolio || (index?.items?.length ? samplePortfolio(index) : null), [portfolio, index])
  const held = useMemo(() => new Set((pf?.positions || []).map((p) => t212Id(p.ticker || p.instrument?.ticker))), [pf])
  const known = useMemo(() => new Set((index?.items || []).map((i) => i.id)), [index])
  const position = selected && pf?.positions?.find((p) => t212Id(p.ticker || p.instrument?.ticker) === selected)
  const item = selected && index?.items?.find((i) => i.id === selected)

  return (
    <div className="st-root" ref={rootRef}>
      <style>{CSS}</style>
      <header className="st-top">
        <div className="st-brandbar">
          <div className="st-wrap st-brandrow">
            <div className="st-brand">
              <img className="st-mark" src={`/app-assets/by-id/${appId}/brand/icon.png`} alt="" />
              <div className="st-brand-text">
                <h1>Stock Tracker</h1>
                <span>{refreshing ? 'Updating…' : index?.updated ? `Updated ${ago(Date.parse(index.updated))} ago · refreshes daily` : 'Refreshes daily'}</span>
              </div>
            </div>
            <button className="st-icon-btn" onClick={refresh} disabled={!!refreshing} aria-label="Refresh data">
              <ArrowRotateCw className={refreshing ? 'st-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="st-wrap">
          {selected ? (
            <div className="st-top-row">
              <button className="st-icon-btn" onClick={close} aria-label="Back"><ChevronLeft /></button>
              <div className="st-title">
                {item?.name || selected}
                <div className="st-sub">
                  {selected}{detail?.quote?.exchange ? ` · ${detail.quote.exchange}` : ''}
                  {item ? <> · <span className={tone(item.changePct)}>{pct(item.changePct)}</span></> : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="st-rail" role="tablist">
                {KINDS.map(([k, l]) => (
                  <button key={k} className="st-stage" role="tab" aria-pressed={kind === k} aria-selected={kind === k}
                    onClick={() => { setKind(k); savePrefs({ kind: k }) }}><i />{l}</button>
                ))}
              </div>
              {kind !== 'portfolio' && (
                <div className="st-chips" role="group" aria-label="Performance period" style={{ marginBottom: 12 }}>
                  {PERIODS.map((p) => (
                    <button key={p} className="st-chip" aria-pressed={period === p} onClick={() => { setPeriod(p); savePrefs({ period: p }) }}>{p}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </header>
      {error && <div className="st-wrap st-err">{error}</div>}

      {selected ? (
        detail === undefined ? <div className="st-empty">Loading…</div>
          : detail === null ? <div className="st-empty"><b>No data yet</b></div>
          : <Detail key={selected} data={detail} colors={colors} position={position} onOpen={open}
              chartStyle={chartStyle} setChartStyle={(v) => { setChartStyle(v); savePrefs({ chartStyle: v }) }} />
      ) : index === undefined ? (
        <div className="st-empty">Loading…</div>
      ) : !index?.items?.length ? (
        <div className="st-empty">
          <b>No market data yet</b>
          First refresh takes a few minutes
          <div><button className="st-btn" onClick={refresh} disabled={!!refreshing}>{refreshing ? 'Updating…' : 'Fetch now'}</button></div>
        </div>
      ) : kind === 'portfolio' ? (
        <Portfolio portfolio={pf} known={known} onOpen={open} onConnect={connect} />
      ) : (
        <Dashboard index={index} kind={kind} period={period} colors={colors} onOpen={open} held={pf?.sample ? null : held} />
      )}
    </div>
  )
}
