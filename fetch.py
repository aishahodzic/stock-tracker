#!/usr/bin/env python3
"""Daily market data refresh for Stock Tracker.

Sources (free JSON/RSS APIs, no keys):
  CNBC chart + quote services  -> prices (1D intraday, 3Y daily, 10Y weekly), stats
  Nasdaq analyst/company API   -> next earnings date, EPS est vs actual, forecasts,
                                  financials, ratios, dividends, price targets,
                                  macro calendar
  SEC EDGAR (data.sec.gov)     -> past earnings release dates (8-K item 2.02) and
                                  long quarterly revenue / net income / EPS history
  Google News RSS              -> articles from credible outlets only
  Trading 212 public API       -> owner's positions (only if a key is saved)

Usage:
  fetch.py <app_id>                 write to the app's storage (scheduled job)
  fetch.py --out DIR [SYM ...]      write JSON files locally (development)
"""
import base64, concurrent.futures as cf, datetime as dt, email.utils, html, json, os, re
import sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
# SEC EDGAR asks automated clients to identify themselves; installers may set a contact.
SEC_UA = os.environ.get('STOCK_TRACKER_SEC_CONTACT') or 'Mobius Stock Tracker app'
API = os.environ.get('API_BASE_URL', 'http://localhost:8000')
T212_FILE = '/data/.stock-tracker/t212.json'

# kind, id, display name, cnbc symbol, extra
INSTRUMENTS = [
    ('index', 'SPX', 'S&P 500', '.SPX', {'region': 'US', 'alias': ['S&P', 'Wall Street', 'stocks']}),
    ('index', 'NDX', 'Nasdaq 100', '.NDX', {'region': 'US', 'alias': ['Nasdaq', 'tech stocks']}),
    ('index', 'DJI', 'Dow Jones', '.DJI', {'region': 'US', 'alias': ['Dow', 'Wall Street']}),
    ('index', 'FTSE', 'FTSE 100', '.FTSE', {'region': 'UK', 'alias': ['FTSE', 'London stocks', 'UK stocks']}),
    ('index', 'DAX', 'DAX 40', '.GDAXI', {'region': 'DE', 'nq': 'DAX', 'alias': ['DAX', 'German stocks', 'European stocks', 'European shares']}),
    ('stock', 'AAPL', 'Apple', 'AAPL', {}),
    ('stock', 'MSFT', 'Microsoft', 'MSFT', {}),
    ('stock', 'NVDA', 'Nvidia', 'NVDA', {}),
    ('stock', 'AMZN', 'Amazon', 'AMZN', {}),
    ('stock', 'GOOGL', 'Alphabet', 'GOOGL', {'alias': ['Google']}),
    ('stock', 'META', 'Meta', 'META', {}),
    ('stock', 'TSLA', 'Tesla', 'TSLA', {}),
    ('stock', 'AVGO', 'Broadcom', 'AVGO', {}),
    ('stock', 'BRK.B', 'Berkshire Hathaway', 'BRK.B', {'sec': 'BRK-B', 'alias': ['Buffett']}),
    ('stock', 'JPM', 'JPMorgan Chase', 'JPM', {'alias': ['JPMorgan', 'Dimon']}),
    ('stock', 'V', 'Visa', 'V', {}),
    ('stock', 'MA', 'Mastercard', 'MA', {}),
    ('stock', 'LLY', 'Eli Lilly', 'LLY', {'alias': ['Lilly']}),
    ('stock', 'UNH', 'UnitedHealth', 'UNH', {}),
    ('stock', 'XOM', 'Exxon Mobil', 'XOM', {'alias': ['Exxon'], 'old_ciks': [34088]}),
    ('stock', 'WMT', 'Walmart', 'WMT', {}),
    ('stock', 'COST', 'Costco', 'COST', {}),
    ('stock', 'NFLX', 'Netflix', 'NFLX', {}),
    ('stock', 'AMD', 'AMD', 'AMD', {}),
    ('stock', 'PLTR', 'Palantir', 'PLTR', {}),
    ('commodity', 'GOLD', 'Gold', '@GC.1', {'q': 'gold price'}),
    ('commodity', 'SILVER', 'Silver', '@SI.1', {'q': 'silver price'}),
    ('commodity', 'WTI', 'WTI Crude', '@CL.1', {'q': 'oil prices', 'must': ['oil', 'crude', 'WTI']}),
    ('commodity', 'BRENT', 'Brent Crude', '@LCO.1', {'q': 'Brent crude', 'must': ['Brent', 'oil', 'crude']}),
    ('commodity', 'NATGAS', 'Natural Gas', '@NG.1', {'q': 'natural gas prices', 'must': ['gas', 'LNG']}),
    ('commodity', 'COPPER', 'Copper', '@HG.1', {'q': 'copper price'}),
]
# Index -> constituents (from our list) whose earnings move it most
INDEX_MEMBERS = {
    'SPX': ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META'],
    'NDX': ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO'],
    'DJI': ['AAPL', 'MSFT', 'NVDA', 'JPM', 'V', 'UNH', 'WMT'],
}
# Macro events: (country, exact/prefix name test, short label, impacted ids)
US_ASSETS = ['SPX', 'NDX', 'DJI', 'GOLD', 'SILVER']
MACRO_RULES = [
    ('United States', lambda n: n == 'Fed Interest Rate Decision', 'FOMC rate decision', US_ASSETS + ['WTI', 'COPPER']),
    ('United States', lambda n: n == 'CPI', 'US CPI', US_ASSETS),
    ('United States', lambda n: n == 'Nonfarm Payrolls', 'US payrolls', US_ASSETS),
    ('United States', lambda n: n.startswith('GDP') and 'Now' not in n and 'Price' not in n, 'US GDP', ['SPX', 'NDX', 'DJI']),
    ('United States', lambda n: n.startswith('Core PCE Price Index'), 'US core PCE', US_ASSETS),
    ('United States', lambda n: 'OPEC' in n, 'OPEC', ['WTI', 'BRENT']),
    ('United States', lambda n: n == 'Crude Oil Inventories', 'EIA crude stocks', ['WTI', 'BRENT']),
    ('United States', lambda n: n == 'Natural Gas Storage', 'EIA gas storage', ['NATGAS']),
    ('United Kingdom', lambda n: n == 'BoE Interest Rate Decision', 'BoE rate decision', ['FTSE']),
    ('United Kingdom', lambda n: n.startswith('CPI') and 'Core' not in n, 'UK CPI', ['FTSE']),
    ('United Kingdom', lambda n: n.startswith('GDP'), 'UK GDP', ['FTSE']),
    ('Euro Zone', lambda n: n in ('ECB Interest Rate Decision', 'Deposit Facility Rate'), 'ECB rate decision', ['DAX']),
    ('Germany', lambda n: n == 'German CPI', 'German CPI', ['DAX']),
    ('China', lambda n: n.startswith('GDP'), 'China GDP', ['COPPER']),
]
SOURCES = ['ft.com', 'reuters.com', 'bloomberg.com', 'wsj.com', 'cnbc.com', 'businessinsider.com',
           'marketwatch.com', 'barrons.com']

NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date()


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def get(url, headers=None, timeout=25, raw=False, tries=3):
    h = {'User-Agent': UA, 'Accept': 'application/json, text/plain, */*'}
    h.update(headers or {})
    err = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                body = r.read()
            return body if raw else json.loads(body)
        except Exception as e:  # noqa: BLE001 - every source is best-effort
            err = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f'{url[:90]}: {err}')


def nasdaq(path):
    return get('https://api.nasdaq.com/api/' + path,
               {'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/'})


def num(s):
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s = str(s).replace('$', '').replace(',', '').replace('%', '').strip()
    neg = s.startswith('(') and s.endswith(')')
    s = s.strip('()')
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return None


def mdy(s):
    try:
        return dt.datetime.strptime(s.strip(), '%m/%d/%Y').date().isoformat()
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- prices

def cnbc_bars(sym, rng):
    d = get(f'https://ts-api.cnbc.com/harmony/app/charts/{rng}.json?symbol={urllib.parse.quote(sym)}')
    bars = (d.get('barData') or {}).get('priceBars') or []
    out = []
    for b in bars:
        c = num(b.get('close'))
        if c is not None:
            o, h, l = (num(b.get(k)) for k in ('open', 'high', 'low'))
            o = c if o is None else o
            # bars are [time, open, high, low, close]
            out.append([int(b['tradeTimeinMills']), round(o, 4), round(max(h or c, o, c), 4),
                        round(min(l or c, o, c), 4), round(c, 4)])
    return out


def cnbc_quotes(syms):
    url = ('https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols='
           + urllib.parse.quote('|'.join(syms)) + '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json')
    d = get(url)
    q = d['FormattedQuoteResult']['FormattedQuote']
    return {x['symbol']: x for x in q}


def perf(daily, weekly, last):
    def back(series, days):
        if not series:
            return None
        cut = series[-1][0] - days * 86400000
        prev = None
        for bar in series:
            t, c = bar[0], bar[-1]
            if t <= cut:
                prev = c
            else:
                break
        return prev

    res = {}
    for key, days, src in [('1W', 7, daily), ('1M', 30, daily), ('3M', 91, daily), ('6M', 182, daily),
                           ('1Y', 365, daily), ('3Y', 1095, weekly), ('5Y', 1826, weekly), ('10Y', 3650, weekly)]:
        p = back(src, days)
        res[key] = round((last / p - 1) * 100, 2) if p and last else None
    ys = [b[-1] for b in daily if dt.datetime.fromtimestamp(b[0] / 1000, dt.timezone.utc).year < TODAY.year]
    res['YTD'] = round((last / ys[-1] - 1) * 100, 2) if ys and last else None
    return res


# ---------------------------------------------------------------- news

CREDIBLE = {'Financial Times', 'Reuters', 'Bloomberg', 'Bloomberg.com', 'The Wall Street Journal', 'WSJ', 'CNBC',
            'Business Insider', 'MarketWatch', "Barron's", 'The Economist', 'AP News', 'Associated Press',
            'The Motley Fool', 'Fortune', 'Axios', 'BBC', 'The Guardian', 'Forbes', 'Morningstar'}


def news(query, n=12, days=30, must=None, topic=None):
    """Recent articles from credible outlets. `must`: headline must contain one of these words."""
    sites = ' OR '.join('site:' + s for s in SOURCES)
    url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode(
        {'q': f'{query} {sites} when:{days}d', 'hl': 'en-GB', 'gl': 'GB', 'ceid': 'GB:en'})
    try:
        root = ET.fromstring(get(url, {'Accept': 'application/rss+xml'}, raw=True))
    except Exception as e:  # noqa: BLE001
        log('news fail', query, e)
        return []
    items = []
    for it in root.iter('item'):
        title = html.unescape(it.findtext('title') or '')
        src = it.find('source')
        source = (src.text if src is not None else '') or ''
        if source and title.endswith(' - ' + source):
            title = title[: -len(source) - 3]
        if source not in CREDIBLE or re.search(r'stock price|stock quote|\| quote|advanced charts|index overview|^[A-Z.\-]{1,8} \|', title, re.I):
            continue
        if topic and not re.search(topic, title, re.I):
            continue
        if must and not any(re.search(r'\b' + re.escape(m) + r'\b', title, re.I) for m in must):
            continue
        try:
            ts = email.utils.parsedate_to_datetime(it.findtext('pubDate')).timestamp()
        except Exception:  # noqa: BLE001
            continue
        items.append({'title': title.strip(), 'source': source, 'url': it.findtext('link'), 't': int(ts * 1000)})
    # Google returns results in relevance order: keep it (importance), cap each day at 2
    # so one busy day can't fill the list, then show the picks newest-first.
    per_day, picked = {}, []
    for it in diverse(items, n * 3):
        day = time.strftime('%Y-%m-%d', time.gmtime(it['t'] / 1000))
        if per_day.get(day, 0) >= 2:
            continue
        per_day[day] = per_day.get(day, 0) + 1
        picked.append(it)
        if len(picked) >= n:
            break
    # importance: Google relevance rank + top-tier outlet + market-moving topic; top 3 are "key"
    for rank, it in enumerate(picked):
        it['score'] = round((len(picked) - rank) + TIER.get(it['source'], 0) + (4 if MOVERS.search(it['title']) else 0), 1)
    for it in sorted(picked, key=lambda x: -x['score'])[:3]:
        it['key'] = True
    return sorted(picked, key=lambda x: -x['t'])


TIER = {'Financial Times': 4, 'Reuters': 4, 'Bloomberg': 4, 'Bloomberg.com': 4, 'The Wall Street Journal': 4, 'WSJ': 4,
        "Barron's": 2, 'CNBC': 2, 'MarketWatch': 1, 'Business Insider': 1}
MOVERS = re.compile(r'earnings|results|quarter|guidance|forecast|outlook|revenue|profit|downgrad|upgrad|price target|'
                    r'acqui|merger|deal|buyback|dividend|ceo|lawsuit|probe|antitrust|regulat|tariff|record|plunge|surge|'
                    r'soar|slump|tumble|rate (cut|hike)|fed |inflation|opec|sanction', re.I)
STOP = set('the a an of to in on for and or with as at by is are be its it from after over new says will has have stock stocks shares share market'.split())


def words(t):
    return {w for w in re.findall(r'[a-z0-9]+', t.lower()) if w not in STOP and len(w) > 2}


def diverse(items, n):
    """Keep newest items whose headline topics don't overlap previous picks."""
    out = []
    for it in items:
        w = words(it['title'])
        if not w:
            continue
        if all(len(w & words(o['title'])) / max(1, len(w | words(o['title']))) < 0.25 for o in out):
            out.append(it)
        if len(out) >= n:
            break
    return out


# ---------------------------------------------------------------- SEC

_sec_tickers = None


def sec_cik(ticker):
    global _sec_tickers
    if _sec_tickers is None:
        d = get('https://www.sec.gov/files/company_tickers.json', {'User-Agent': SEC_UA})
        _sec_tickers = {v['ticker'].upper(): int(v['cik_str']) for v in d.values()}
    return _sec_tickers.get(ticker.upper())


REV_CONCEPTS = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet',
                'RevenuesNetOfInterestExpense', 'RevenueFromContractWithCustomerIncludingAssessedTax']


def sec_quarters(facts, concepts, unit):
    """Quarterly (3-month) values keyed by period end; Q4 derived from FY - Q1..Q3."""
    q, fy = {}, {}
    for c in concepts:
        node = facts.get(c)
        if not node:
            continue
        for e in node['units'].get(unit, []):
            if 'start' not in e:
                continue
            s, en = dt.date.fromisoformat(e['start']), dt.date.fromisoformat(e['end'])
            span = (en - s).days
            tgt = q if 80 <= span <= 100 else fy if 350 <= span <= 380 else None
            if tgt is None:
                continue
            prev = tgt.get(e['end'])
            if prev is None or e['filed'] > prev[2] or (c == concepts[0] and prev[3] != c and e['filed'] >= prev[2]):
                tgt[e['end']] = (e['start'], e['val'], e['filed'], c)
    for end, (start, val, filed, c) in fy.items():
        if end in q:
            continue
        inside = [v[1] for k, v in q.items() if start < k < end and k > start]
        if len(inside) == 3:
            q[end] = (None, val - sum(inside), filed, c)
    return {k: v[1] for k, v in q.items()}


def sec_data(ticker, extra_ciks=()):
    cik = sec_cik(ticker)
    if not cik:
        return None
    rev, ni, eps, releases = {}, {}, {}, []
    for c in list(extra_ciks) + [cik]:   # older registrations first; the current one wins
        facts = get(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{c:010d}.json', {'User-Agent': SEC_UA}, timeout=60)
        g = facts['facts'].get('us-gaap', {})
        rev.update(sec_quarters(g, REV_CONCEPTS, 'USD'))
        ni.update(sec_quarters(g, ['NetIncomeLoss', 'ProfitLoss'], 'USD'))
        eps.update(sec_quarters(g, ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares'))
        r = get(f'https://data.sec.gov/submissions/CIK{c:010d}.json', {'User-Agent': SEC_UA})['filings']['recent']
        for i, form in enumerate(r['form']):
            if form == '8-K' and '2.02' in (r['items'][i] or ''):
                acc = r['accessionNumber'][i]
                releases.append({
                    'date': r['filingDate'][i],
                    'url': f"https://www.sec.gov/Archives/edgar/data/{c}/{acc.replace('-', '')}/{r['primaryDocument'][i]}",
                })
    releases.sort(key=lambda x: x['date'])
    ends = sorted(set(rev) | set(ni) | set(eps))
    quarters = []
    for end in ends:
        e = dt.date.fromisoformat(end)
        if e.year < TODAY.year - 10:
            continue
        rel = next((x for x in releases if 5 <= (dt.date.fromisoformat(x['date']) - e).days <= 75), None)
        quarters.append({'end': end, 'revenue': rev.get(end), 'netIncome': ni.get(end),
                         'eps': round(eps[end], 3) if end in eps else None,
                         'reported': rel['date'] if rel else None, 'filing': rel['url'] if rel else None})
    return {'cik': cik, 'quarters': quarters}


# ---------------------------------------------------------------- Nasdaq fundamentals

def table(tbl, wanted):
    if not tbl:
        return None
    heads = tbl['headers']
    cols = [k for k in heads if k != 'value1']
    periods = [mdy(heads[k]) or heads[k] for k in cols]
    rows = {r['value1']: r for r in tbl['rows']}
    out = {'periods': periods}
    for label, key in wanted.items():
        r = rows.get(label)
        out[key] = [num(r.get(k)) if r else None for k in cols]
    return out


def fundamentals(sym):
    res = {}

    def safe(name, fn):
        try:
            res[name] = fn()
        except Exception as e:  # noqa: BLE001
            log('  nasdaq', sym, name, e)

    def next_earnings():
        d = nasdaq(f'analyst/{sym}/earnings-date')['data']
        text = d.get('reportText') or ''
        m = re.search(r'on\s+(\d\d/\d\d/\d{4})', text)
        when = re.search(r'(before market open|after market close)', text)
        period = re.search(r'Quarter ending (\w+ \d{4})', text)
        cons = re.search(r'consensus EPS forecast for the quarter is \$(-?\d+(?:\.\d+)?)', text)
        last = re.search(r'reported EPS for the same quarter last year was \$(-?\d+(?:\.\d+)?)', text)
        return {'date': mdy(m.group(1)) if m else None, 'time': when.group(1) if when else None,
                'period': period.group(1) if period else None,
                'consensus': float(cons.group(1)) if cons else None,
                'yearAgo': float(last.group(1)) if last else None,
                'confirmed': 'expected*' not in text}

    def eps():
        rows = nasdaq(f'quote/{sym}/eps?assetclass=stocks')['data'].get('earningsPerShare') or []
        return [{'period': r['period'], 'consensus': r.get('consensus'),
                 'actual': r.get('earnings') if r['type'] == 'PreviousQuarter' else None,
                 'upcoming': r['type'] != 'PreviousQuarter'} for r in rows]

    def forecast():
        d = nasdaq(f'analyst/{sym}/earnings-forecast')['data']
        pick = lambda rows: [{'period': r['fiscalEnd'], 'eps': r['consensusEPSForecast'], 'high': r['highEPSForecast'],
                              'low': r['lowEPSForecast'], 'n': r['noOfEstimates'], 'up': r['up'], 'down': r['down']}
                             for r in (rows or [])]
        return {'quarterly': pick(d['quarterlyForecast']['rows']), 'yearly': pick(d['yearlyForecast']['rows'])}

    def fin(freq):
        d = nasdaq(f'company/{sym}/financials?frequency={freq}')['data']
        inc = table(d.get('incomeStatementTable'), {'Total Revenue': 'revenue', 'Gross Profit': 'grossProfit',
                                                     'Operating Income': 'operatingIncome', 'Net Income': 'netIncome'})
        bal = table(d.get('balanceSheetTable'), {'Total Assets': 'assets', 'Total Liabilities': 'liabilities',
                                                  'Total Equity': 'equity', 'Long-Term Debt': 'ltDebt',
                                                  'Short-Term Debt / Current Portion of Long-Term Debt': 'stDebt',
                                                  'Cash and Cash Equivalents': 'cash'})
        cfs = table(d.get('cashFlowTable'), {'Net Cash Flow-Operating': 'opCashFlow', 'Capital Expenditures': 'capex'})
        rat = table(d.get('financialRatiosTable'), {'Current Ratio': 'currentRatio', 'Quick Ratio': 'quickRatio',
                                                     'Gross Margin': 'grossMargin', 'Operating Margin': 'operatingMargin',
                                                     'Profit Margin': 'profitMargin', 'After Tax ROE': 'roe'})
        out = {'periods': (inc or bal or {}).get('periods', [])}
        for t in (inc, bal, cfs, rat):
            if t:
                out.update({k: v for k, v in t.items() if k != 'periods'})
        # Nasdaq statements are in thousands
        for k in ('revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'assets', 'liabilities', 'equity',
                  'ltDebt', 'stDebt', 'cash', 'opCashFlow', 'capex'):
            if k in out:
                out[k] = [v * 1000 if v is not None else None for v in out[k]]
        if 'equity' in out:
            out['debtToEquity'] = [round(((a or 0) + (b or 0)) / e, 3) if e else None
                                   for a, b, e in zip(out.get('ltDebt', []), out.get('stDebt', []), out['equity'])]
            out['leverage'] = [round(a / e, 3) if a and e else None for a, e in zip(out.get('assets', []), out['equity'])]
        return out

    def dividends():
        d = nasdaq(f'quote/{sym}/dividends?assetclass=stocks')['data']
        rows = ((d.get('dividends') or {}).get('rows')) or []
        return {'yield': d.get('yield'), 'annual': num(d.get('annualizedDividend')),
                'history': [{'ex': mdy(r['exOrEffDate']), 'pay': mdy(r['paymentDate']), 'amount': num(r['amount'])}
                            for r in rows[:24] if mdy(r['exOrEffDate'])]}

    def target():
        d = nasdaq(f'analyst/{sym}/targetprice')['data']
        o = d.get('consensusOverview') or {}
        hist = [{'t': int(h['x']) * 1000, 'target': h['y'], 'buy': h['z']['buy'], 'hold': h['z']['hold'],
                 'sell': h['z']['sell']} for h in (d.get('historicalConsensus') or [])]
        return {'low': o.get('lowPriceTarget'), 'high': o.get('highPriceTarget'), 'mean': o.get('priceTarget'),
                'buy': o.get('buy'), 'hold': o.get('hold'), 'sell': o.get('sell'), 'history': hist}

    safe('nextEarnings', next_earnings)
    safe('eps', eps)
    safe('forecast', forecast)
    safe('quarterly', lambda: fin(2))
    safe('annual', lambda: fin(1))
    safe('dividends', dividends)
    safe('target', target)
    return res


# ---------------------------------------------------------------- macro

def macro_calendar():
    events = []
    for off in range(-21, 75):
        day = TODAY + dt.timedelta(days=off)
        if day.weekday() >= 5:
            continue
        try:
            rows = (nasdaq(f'calendar/economicevents?date={day.isoformat()}')['data'] or {}).get('rows') or []
        except Exception as e:  # noqa: BLE001
            log('macro', day, e)
            continue
        seen = set()
        for r in rows:
            name, country = r.get('eventName', ''), r.get('country', '')
            for c, test, label, ids in MACRO_RULES:
                if country == c and test(name) and label not in seen:
                    seen.add(label)
                    clean = lambda v: None if not v or v.strip() in ('&nbsp;', '') else html.unescape(v).strip()
                    events.append({'date': day.isoformat(), 'time': r.get('gmt'), 'label': label, 'ids': ids,
                                   'actual': clean(r.get('actual')), 'consensus': clean(r.get('consensus')),
                                   'previous': clean(r.get('previous'))})
        time.sleep(0.15)
    return events


# ---------------------------------------------------------------- Trading 212

def t212():
    try:
        with open(T212_FILE) as f:
            cred = json.load(f)
    except FileNotFoundError:
        return None
    base = 'https://demo.trading212.com' if cred.get('env') == 'demo' else 'https://live.trading212.com'
    auth = 'Basic ' + base64.b64encode(f"{cred['key']}:{cred.get('secret', '')}".encode()).decode() \
        if cred.get('secret') else cred['key']
    h = {'Authorization': auth}
    out = {'updated': NOW.isoformat(), 'env': cred.get('env', 'live')}
    try:
        out['positions'] = get(base + '/api/v0/equity/positions', h, tries=1)
        time.sleep(1.2)
        try:
            out['summary'] = get(base + '/api/v0/equity/account/summary', h, tries=1)
        except Exception:  # noqa: BLE001 - older accounts expose /account/cash instead
            out['summary'] = get(base + '/api/v0/equity/account/cash', h, tries=1)
    except Exception as e:  # noqa: BLE001
        out['error'] = str(e)[:200]
    return out


# ---------------------------------------------------------------- assemble

def build(inst, quote, macro):
    kind, sid, name, csym, extra = inst
    log('build', sid)
    d = {'id': sid, 'name': name, 'kind': kind, 'symbol': csym, 'updated': NOW.isoformat()}
    d['intraday'] = []
    for attempt in range(3):
        try:
            d['intraday'] = cnbc_bars(csym, '1D')
        except Exception as e:  # noqa: BLE001
            log('  1D', sid, e)
        if d['intraday']:
            break
        time.sleep(3)
    d['daily'] = cnbc_bars(csym, '6M')       # CNBC returns ~3 years of daily bars
    d['weekly'] = cnbc_bars(csym, '5Y')      # ~10 years of weekly bars
    q = quote or {}
    last = num(q.get('last')) or (d['daily'][-1][-1] if d['daily'] else None)
    d['quote'] = {'last': last, 'change': num(q.get('change')), 'changePct': num(q.get('change_pct')),
                  'prevClose': num(q.get('previous_day_closing')), 'open': num(q.get('open')),
                  'high': num(q.get('high')), 'low': num(q.get('low')), 'volume': q.get('volume_alt'),
                  'currency': q.get('currencyCode'), 'pe': num(q.get('pe')), 'eps': num(q.get('eps')),
                  'mktCap': q.get('mktcapView'), 'beta': num(q.get('beta')), 'divYield': q.get('dividendyield'),
                  'yrHigh': num(q.get('yrhiprice')), 'yrLow': num(q.get('yrloprice')),
                  'asOf': q.get('last_timedate'), 'exchange': q.get('exchange')}
    lt = q.get('last_time')
    if last and lt and d['daily']:
        try:
            t = int(dt.datetime.fromisoformat(lt[:10]).replace(tzinfo=dt.timezone.utc).timestamp() * 1000)
            if t > d['daily'][-1][0] + 43200000:
                o = num(q.get('open')) or last
                d['daily'].append([t, o, max(num(q.get('high')) or last, o, last), min(num(q.get('low')) or last, o, last), last])
        except ValueError:
            pass
    d['perf'] = perf(d['daily'], d['weekly'], last)
    d['perf']['1D'] = d['quote']['changePct']

    events = []
    if kind == 'stock':
        d.update(fundamentals(sid))
        try:
            d['sec'] = sec_data(extra.get('sec', sid), extra.get('old_ciks', ()))
        except Exception as e:  # noqa: BLE001
            log('  sec', sid, e)
        ne = d.get('nextEarnings') or {}
        past_rel = [x['reported'] for x in (d.get('sec') or {}).get('quarters', []) if x.get('reported')]
        if not ne.get('date') and past_rel:
            guess = dt.date.fromisoformat(past_rel[-1]) + dt.timedelta(days=91)
            while guess.weekday() >= 5:
                guess += dt.timedelta(days=1)
            if guess >= TODAY:
                fq = ((d.get('forecast') or {}).get('quarterly') or [{}])[0]
                ne = d['nextEarnings'] = {'date': guess.isoformat(), 'estimated': True, 'confirmed': False,
                                          'period': fq.get('period'), 'consensus': fq.get('eps')}
        if ne.get('date'):
            events.append({'date': ne['date'], 'type': 'earnings',
                           'label': ('Earnings (est. date)' if ne.get('estimated') else (f"Earnings · {ne['period'][:3]} qtr" if ne.get('period') else 'Earnings')),
                           'consensus': ne.get('consensus'), 'time': ne.get('time'), 'confirmed': ne.get('confirmed')})
        for x in (d.get('sec') or {}).get('quarters', []):
            if x.get('reported'):
                events.append({'date': x['reported'], 'type': 'earnings', 'label': 'Earnings', 'url': x['filing'],
                               'past': True})
        for dv in (d.get('dividends') or {}).get('history', []):
            events.append({'date': dv['ex'], 'type': 'dividend', 'label': f"Ex-div {dv['amount']}",
                           'past': dv['ex'] < TODAY.isoformat()})
        must = [name.split()[0], sid.split('.')[0]] + extra.get('alias', [])
        d['news'] = news(f'"{name}"', days=30, must=must)
        d['eventNews'] = news(f'"{name}" earnings', n=4, days=60, must=must,
                              topic=r'earning|results|quarter|guidance|revenue|outlook|forecast|profit|sales|preview|expect')
    else:
        for m in macro:
            if sid in m['ids']:
                events.append({'date': m['date'], 'type': 'macro', 'label': m['label'], 'time': m['time'],
                               'consensus': m['consensus'], 'actual': m['actual'], 'previous': m['previous'],
                               'past': m['date'] < TODAY.isoformat()})
        if kind == 'commodity':
            d['news'] = news(extra['q'], days=30, must=extra.get('must') or [name.split()[0]])
        else:
            d['news'] = news(f'"{extra.get("nq", name)}"', days=30, must=[name.split()[0]] + extra.get('alias', []))
    d['events'] = sorted(events, key=lambda e: e['date'])
    return d


def thin(points, n=48):
    if len(points) <= n:
        return points
    step = (len(points) - 1) / (n - 1)
    return [points[round(i * step)] for i in range(n)]


def period_sparks(d):
    """Closing prices for each dashboard period, starting at the period's reference price."""
    daily, weekly = d['daily'], d['weekly']
    out = {}
    if d.get('intraday'):
        base = d['quote'].get('prevClose')
        pts = [b[-1] for b in d['intraday']]
        last = d['quote'].get('last')
        out['1D'] = ([base] if base else []) + thin(pts, 60) + ([last] if last else [])  # end on the official close
    elif len(daily) >= 2:
        out['1D'] = [daily[-2][-1], daily[-1][-1]]
    for key, days, src in [('1W', 7, daily), ('1M', 30, daily), ('3M', 91, daily), ('1Y', 365, daily), ('5Y', 1826, weekly)]:
        if not src:
            continue
        cut = src[-1][0] - days * 86400000
        start = max([i for i, b in enumerate(src) if b[0] <= cut] or [0])
        seg = [b[-1] for b in src[start:]]
        last = d['quote'].get('last')
        if last and seg and abs(seg[-1] - last) > 1e-9 and key != '5Y':
            seg.append(last)
        out[key] = [seg[0]] + thin(seg[1:], 47) if len(seg) > 1 else seg
    return out


def summary(d):
    fut = [e for e in d['events'] if e['date'] >= TODAY.isoformat()]
    return {'id': d['id'], 'name': d['name'], 'kind': d['kind'], 'last': d['quote']['last'],
            'change': d['quote']['change'], 'changePct': d['quote']['changePct'], 'currency': d['quote']['currency'],
            'perf': d['perf'], 'sparks': period_sparks(d), 'next': fut[0] if fut else None,
            'mktCap': d['quote'].get('mktCap'), 'yrHigh': d['quote'].get('yrHigh'), 'yrLow': d['quote'].get('yrLow')}


class Sink:
    def __init__(self, app_id=None, out=None):
        self.app_id, self.out = app_id, out
        if out:
            os.makedirs(os.path.join(out, 'sym'), exist_ok=True)

    def put(self, path, value):
        body = json.dumps(value, separators=(',', ':')).encode()
        if self.out:
            with open(os.path.join(self.out, path), 'wb') as f:
                f.write(body)
            return
        req = urllib.request.Request(f'{API}/api/storage/apps/{self.app_id}/{path}', data=body, method='PUT',
                                     headers={'Authorization': 'Bearer ' + os.environ['APP_TOKEN'],
                                              'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=60).read()


def main():
    args = sys.argv[1:]
    if args and args[0] == '--out':
        sink, only = Sink(out=args[1]), set(args[2:])
    else:
        sink, only = Sink(app_id=args[0]), set()
    insts = [i for i in INSTRUMENTS if not only or i[1] in only]
    started = time.time()
    macro = macro_calendar()
    log('macro events', len(macro))
    quotes = {}
    syms = [i[3] for i in insts]
    for k in range(0, len(syms), 10):
        try:
            quotes.update(cnbc_quotes(syms[k:k + 10]))
        except Exception as e:  # noqa: BLE001
            log('quotes', e)
    built, errors = {}, []
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(build, i, quotes.get(i[3]), macro): i for i in insts}
        for f in cf.as_completed(futs):
            i = futs[f]
            try:
                built[i[1]] = f.result()
            except Exception as e:  # noqa: BLE001
                errors.append(f'{i[1]}: {e}')
                log('FAIL', i[1], e)
    # CNBC's minute-bar service intermittently 503s under parallel load: retry the gaps slowly
    for sid, d in built.items():
        if not d['intraday']:
            for attempt in range(3):
                time.sleep(4)
                try:
                    d['intraday'] = cnbc_bars(d['symbol'], '1D')
                except Exception as e:  # noqa: BLE001
                    log('  1D retry', sid, e)
                if d['intraday']:
                    break
    # Index events also include the biggest member earnings
    for idx, members in INDEX_MEMBERS.items():
        if idx in built:
            for m in members:
                ne = (built.get(m) or {}).get('nextEarnings') or {}
                if ne.get('date'):
                    built[idx]['events'].append({'date': ne['date'], 'type': 'earnings', 'label': f'{m} earnings',
                                                 'ref': m})
            built[idx]['events'].sort(key=lambda e: e['date'])
    for sid, d in built.items():
        sink.put(f'sym/{sid}.json', d)
    order = [i[1] for i in insts if i[1] in built]
    sink.put('index.json', {'updated': NOW.isoformat(), 'items': [summary(built[s]) for s in order],
                            'macro': [m for m in macro if m['date'] >= (TODAY - dt.timedelta(days=7)).isoformat()],
                            'errors': errors, 'seconds': round(time.time() - started)})
    port = t212()
    if port is not None:
        sink.put('portfolio.json', port)
    log(f'done {len(built)}/{len(insts)} in {time.time() - started:.0f}s; errors={len(errors)}')
    return 0 if built else 1


if __name__ == '__main__':
    sys.exit(main())
