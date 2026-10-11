// Pure formatting helpers — no React, no I/O.

export const DAY = 86400000

export function price(v, cur) {
  if (v == null || isNaN(v)) return '—'
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 3
  const s = v.toLocaleString('en-GB', { minimumFractionDigits: digits === 3 ? 2 : digits, maximumFractionDigits: digits })
  const sym = { USD: '$', GBP: '£', EUR: '€', GBX: 'p' }[cur] || ''
  return cur === 'GBX' ? s + 'p' : sym + s
}

export function pct(v, digits = 2) {
  if (v == null || isNaN(v)) return '—'
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits) + '%'
}

export function big(v) {
  if (v == null || isNaN(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e12) return sign + (a / 1e12).toFixed(2) + 'T'
  if (a >= 1e9) return sign + (a / 1e9).toFixed(1) + 'B'
  if (a >= 1e6) return sign + (a / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return sign + (a / 1e3).toFixed(1) + 'K'
  return sign + a.toFixed(2)
}

export function num(v, d = 2) {
  if (v == null || isNaN(v)) return '—'
  return Number(v).toFixed(d)
}

export function tone(v) {
  return v == null ? '' : v > 0 ? 'st-up' : v < 0 ? 'st-down' : ''
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function isoToMs(iso) {
  return Date.parse(iso + 'T12:00:00Z')
}

export function dateShort(t) {
  const d = new Date(typeof t === 'string' ? isoToMs(t) : t)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export function dateLong(t) {
  const d = new Date(typeof t === 'string' ? isoToMs(t) : t)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function monthYear(t) {
  const d = new Date(typeof t === 'string' ? isoToMs(t) : t)
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
}

export function timeHM(t) {
  return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function daysUntil(iso) {
  const today = new Date()
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((isoToMs(iso) - DAY / 2 - t0) / DAY)
}

export function countdown(iso, long = false) {
  const d = daysUntil(iso)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d < 0) return long ? `${-d} days ago` : `${-d}d ago`
  return long ? `in ${d} days` : `in ${d}d`
}

export function ago(t) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 60) return `${Math.max(1, m)}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

export function fiscalLabel(endIso) {
  // "2026-06-27" -> "Jun 26"
  return monthYear(endIso)
}

export const EVENT_COLORS = { earnings: 'accent', dividend: 'div', macro: 'macro' }

export function eventShort(e) {
  if (e.type === 'earnings') return e.ref ? e.ref : 'E'
  if (e.type === 'dividend') return 'D'
  return e.label.replace(' rate decision', '').replace('EIA ', '')
}
