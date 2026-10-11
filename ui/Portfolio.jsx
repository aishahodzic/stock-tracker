import React from 'react'
import { price, num, tone, ago, pct } from '../format.js'

export function t212Id(ticker) {
  // "AAPL_US_EQ" -> "AAPL", "BRK_B_US_EQ" -> "BRK.B"
  const base = String(ticker || '').replace(/_US_EQ$|_EQ$/, '')
  return base.replace(/_/g, '.')
}

function positionFields(p) {
  const ticker = p.ticker || p.instrument?.ticker
  const qty = p.quantity
  const avg = p.averagePrice ?? p.averagePricePaid
  const cur = p.currentPrice
  const pl = p.ppl ?? p.walletImpact?.unrealizedProfitLoss
  const value = p.walletImpact?.currentValue ?? (qty != null && cur != null ? qty * cur : null)
  return { ticker, id: t212Id(ticker), name: p.instrument?.name, qty, avg, cur, pl, value }
}

function summaryFields(s) {
  if (!s) return []
  const flat = {}
  const walk = (o, prefix) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (v && typeof v === 'object') walk(v, k)
      else if (typeof v === 'number') flat[prefix ? `${prefix} ${k}` : k] = v
    }
  }
  walk(s, '')
  const pick = [
    ['Total', ['total', 'totalValue']], ['Invested', ['invested', 'investments currentValue']],
    ['P/L', ['ppl', 'investments unrealizedProfitLoss']], ['Cash', ['free', 'cash availableToTrade']],
    ['Realised', ['result', 'investments realizedProfitLoss']],
  ]
  return pick.map(([label, keys]) => [label, keys.map((k) => flat[k]).find((v) => v != null)]).filter(([, v]) => v != null)
}

// Made-up holdings shown until a real Trading 212 account is connected; valued at live prices.
const SAMPLE = [['AAPL', 12, 245], ['MSFT', 6, 410], ['NVDA', 40, 135], ['GOOGL', 10, 190], ['AMZN', 8, 205], ['JPM', 5, 250], ['LLY', 2, 760]]

export function samplePortfolio(index) {
  const px = Object.fromEntries((index?.items || []).map((i) => [i.id, i.last]))
  const positions = SAMPLE.filter(([id]) => px[id]).map(([id, quantity, averagePrice]) => ({
    sample: true, ticker: `${id}_US_EQ`, quantity, averagePrice, currentPrice: px[id], ppl: (px[id] - averagePrice) * quantity,
  }))
  const value = positions.reduce((a, p) => a + p.currentPrice * p.quantity, 0)
  const invested = positions.reduce((a, p) => a + p.averagePrice * p.quantity, 0)
  const cash = 1000
  return { sample: true, updated: index?.updated, positions,
    summary: { total: value + cash, invested, ppl: value - invested, free: cash } }
}

export default function Portfolio({ portfolio, known, onOpen, onConnect }) {
  if (!portfolio) {
    return (
      <div className="st-wrap">
        <div className="st-empty">
          <b>Trading 212 not connected</b>
          Positions · P/L · cash
          <div><button className="st-btn" onClick={onConnect}>Connect</button></div>
        </div>
      </div>
    )
  }
  const positions = (portfolio.positions || []).map(positionFields).sort((a, b) => (b.value || 0) - (a.value || 0))
  const sums = summaryFields(portfolio.summary)
  return (
    <div className="st-wrap">
      <div className="st-section-h">
        <span>{portfolio.sample ? <span className="st-sample">Sample</span> : portfolio.env === 'demo' ? 'Demo account' : 'Account'}</span>
        <span>{portfolio.updated ? ago(Date.parse(portfolio.updated)) + ' ago' : ''}</span>
      </div>
      {portfolio.error && <div className="st-card st-err">{portfolio.error}</div>}
      {portfolio.sample && (
        <div className="st-card st-sample-note">
          <span>Made-up positions at live prices</span>
          <button className="st-btn ghost" onClick={onConnect}>Connect Trading 212</button>
        </div>
      )}
      {sums.length > 0 && (
        <div className="st-grid">
          {sums.map(([k, v]) => <div key={k}><span>{k}</span><b className={k.includes('P/L') || k === 'Realised' ? tone(v) : ''}>{num(v)}</b></div>)}
        </div>
      )}
      <div className="st-section-h"><span>{positions.length} positions</span></div>
      <div className="st-table-wrap">
        <table className="st-table">
          <thead><tr><th>Ticker</th><th>Qty</th><th>Avg</th><th>Price</th><th>Value</th><th>P/L</th><th>%</th></tr></thead>
          <tbody>
            {positions.map((p) => {
              const ret = p.avg && p.cur ? (p.cur / p.avg - 1) * 100 : null
              const tracked = known.has(p.id)
              return (
                <tr key={p.ticker} onClick={tracked ? () => onOpen(p.id) : undefined} style={{ cursor: tracked ? 'pointer' : 'default' }}>
                  <td>{tracked ? <a href="#" onClick={(e) => { e.preventDefault(); onOpen(p.id) }}>{p.id}</a> : p.id}</td>
                  <td>{num(p.qty, p.qty % 1 ? 3 : 0)}</td><td>{price(p.avg)}</td><td>{price(p.cur)}</td>
                  <td>{num(p.value)}</td><td className={tone(p.pl)}>{num(p.pl)}</td><td className={tone(ret)}>{pct(ret, 1)}</td>
                </tr>
              )
            })}
            {!positions.length && <tr><td colSpan={7} className="st-muted">—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
