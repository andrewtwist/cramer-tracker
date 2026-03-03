import { usePortfolio } from '../lib/usePortfolio'
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`

export default function ComparePage() {
  const { userCalc, cramerCalc, loadingPortfolio, loadingPrices, refreshPrices, prices } = usePortfolio()

  if (loadingPortfolio) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  )

  const userTotal = userCalc.totalValue
  const cramerTotal = cramerCalc.totalValue
  const diffDollars = userTotal - cramerTotal
  const diffPercent = cramerTotal > 0 ? ((userTotal - cramerTotal) / cramerTotal) * 100 : 0

  // Build merged symbol comparison
  const allSymbols = new Set([
    ...userCalc.holdings.map(h => h.symbol),
    ...cramerCalc.holdings.map(h => h.symbol)
  ])

  const symbolMap = [...allSymbols].map(sym => {
    const userHolding = userCalc.holdings.find(h => h.symbol === sym)
    const cramerHolding = cramerCalc.holdings.find(h => h.symbol === sym)
    const priceInfo = prices[sym]
    const currentPrice = priceInfo?.price || 0

    const userShares = userHolding ? parseFloat(userHolding.shares) : 0
    const cramerShares = cramerHolding ? parseFloat(cramerHolding.shares) : 0
    const userValue = userShares * currentPrice
    const cramerValue = cramerShares * currentPrice

    // How many shares needed to match Cramer's % allocation?
    // Cramer's % of his portfolio = cramerValue / cramerTotal
    // What user needs = that % * userTotal / currentPrice
    const cramerAllocationPct = cramerTotal > 0 ? cramerValue / cramerTotal : 0
    const targetValueForUser = cramerAllocationPct * userTotal
    const sharesNeededToMatch = currentPrice > 0 ? targetValueForUser / currentPrice : 0
    const sharesShortfall = Math.max(0, sharesNeededToMatch - userShares)
    const dollarShortfall = sharesShortfall * currentPrice

    return {
      symbol: sym,
      companyName: priceInfo?.company_name || userHolding?.companyName || cramerHolding?.companyName || sym,
      currentPrice,
      userShares,
      cramerShares,
      userValue,
      cramerValue,
      cramerAllocationPct: cramerAllocationPct * 100,
      userAllocationPct: userTotal > 0 ? (userValue / userTotal) * 100 : 0,
      sharesNeededToMatch,
      sharesShortfall,
      dollarShortfall,
      changePercent: priceInfo?.change_percent || 0,
      onlyUser: !cramerHolding,
      onlyCramer: !userHolding
    }
  }).sort((a, b) => b.cramerValue - a.cramerValue)

  // Stocks where user needs to buy more to match Cramer's allocation
  const needToBuy = symbolMap
    .filter(s => !s.onlyUser && s.sharesShortfall > 0.001)
    .sort((a, b) => b.dollarShortfall - a.dollarShortfall)

  // Stocks Cramer has but user doesn't
  const missingFromUser = symbolMap.filter(s => s.onlyCramer)

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">VS CRAMER</div>
          <div className="page-subtitle">Detailed comparison against Jim Cramer's Mad Money portfolio</div>
        </div>
        <button className="btn btn-secondary" onClick={refreshPrices} disabled={loadingPrices}>
          <RefreshCw size={13} /> {loadingPrices ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {cramerTotal === 0 && (
        <div className="alert alert-info">
          <strong>No Cramer portfolio data yet.</strong> Your admin needs to configure Jim Cramer's holdings in the Admin panel.
        </div>
      )}

      {/* HEADLINE COMPARISON */}
      <div className="stat-grid mb-24">
        <div className={`stat-card ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Performance vs Cramer</div>
          <div className={`stat-value ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
            {fmtPct(diffPercent)}
          </div>
          <div className="stat-sub">{fmt(Math.abs(diffDollars))} {diffDollars >= 0 ? 'ahead' : 'behind'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Size vs Cramer's</div>
          <div className="stat-value gold">
            {cramerTotal > 0 ? `${((userTotal / cramerTotal) * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="stat-sub">of his total portfolio value</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shared Holdings</div>
          <div className="stat-value">{symbolMap.filter(s => !s.onlyUser && !s.onlyCramer).length}</div>
          <div className="stat-sub">
            {missingFromUser.length} only in Cramer's • {symbolMap.filter(s => s.onlyUser).length} only yours
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">$ To Match Cramer</div>
          <div className="stat-value">
            {cramerTotal > 0 && cramerTotal > userTotal ? fmt(cramerTotal - userTotal) : '—'}
          </div>
          <div className="stat-sub">total portfolio value gap</div>
        </div>
      </div>

      {/* SHARES NEEDED TO MATCH TABLE */}
      {needToBuy.length > 0 && (
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">📊 Shares Needed to Match Cramer's Allocation</div>
            <span className="badge badge-gold">{needToBuy.length} adjustments</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Based on matching Cramer's <em>percentage allocation</em> per stock, scaled to your portfolio size.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Your Shares</th>
                <th>Cramer's Shares</th>
                <th>Cramer Alloc %</th>
                <th>Target Shares (for you)</th>
                <th>Need to Buy</th>
                <th>$ to Buy</th>
              </tr>
            </thead>
            <tbody>
              {needToBuy.map(s => (
                <tr key={s.symbol}>
                  <td>
                    <div className="symbol">{s.symbol}</div>
                    <div className="company-name">{s.companyName}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {s.userShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                    {s.cramerShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {s.cramerAllocationPct.toFixed(2)}%
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--blue)' }}>
                    {s.sharesNeededToMatch.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>
                    +{s.sharesShortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className="badge badge-red">{fmt(s.dollarShortfall)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FULL SIDE BY SIDE */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">Full Portfolio Comparison</div>
          <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--blue)' }}>■ You ({fmt(userTotal)})</span>
            <span style={{ color: 'var(--gold)' }}>■ Cramer ({fmt(cramerTotal)})</span>
          </div>
        </div>

        {symbolMap.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Nothing to compare yet</div>
            <div className="empty-desc">Add holdings to your portfolio and ensure Cramer's is configured</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th style={{ color: 'var(--blue)' }}>Your Shares</th>
                <th style={{ color: 'var(--blue)' }}>Your Value</th>
                <th style={{ color: 'var(--blue)' }}>Your %</th>
                <th style={{ color: 'var(--gold)' }}>Cramer Shares</th>
                <th style={{ color: 'var(--gold)' }}>Cramer Value</th>
                <th style={{ color: 'var(--gold)' }}>Cramer %</th>
                <th>Day Chg</th>
              </tr>
            </thead>
            <tbody>
              {symbolMap.map(s => (
                <tr key={s.symbol} style={{ opacity: s.currentPrice === 0 ? 0.5 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="symbol">{s.symbol}</div>
                      {s.onlyCramer && <span className="badge badge-gold" style={{ fontSize: 8 }}>CRAMER</span>}
                      {s.onlyUser && <span className="badge badge-blue" style={{ fontSize: 8 }}>YOURS</span>}
                    </div>
                    <div className="company-name">{s.companyName}</div>
                  </td>
                  <td className="price">{s.currentPrice > 0 ? fmt(s.currentPrice) : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: s.onlyCramer ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {s.userShares > 0 ? s.userShares.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--blue)' }}>
                    {s.userValue > 0 ? fmt(s.userValue) : '—'}
                  </td>
                  <td>
                    {s.userAllocationPct > 0 ? (
                      <AllocationBar pct={s.userAllocationPct} color="var(--blue)" />
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: s.onlyUser ? 'var(--text-muted)' : 'var(--gold)' }}>
                    {s.cramerShares > 0 ? s.cramerShares.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                    {s.cramerValue > 0 ? fmt(s.cramerValue) : '—'}
                  </td>
                  <td>
                    {s.cramerAllocationPct > 0 ? (
                      <AllocationBar pct={s.cramerAllocationPct} color="var(--gold)" />
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td>
                    <span className={`change-badge ${s.changePercent > 0 ? 'up' : s.changePercent < 0 ? 'down' : 'flat'}`}>
                      {s.changePercent >= 0 ? '▲' : '▼'}{Math.abs(s.changePercent).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MISSING FROM USER */}
      {missingFromUser.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <AlertCircle size={13} style={{ marginRight: 6 }} />
              Cramer Holdings You Don't Have
            </div>
            <span className="badge badge-gold">{missingFromUser.length}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {missingFromUser.map(s => (
              <div key={s.symbol} style={{
                padding: '8px 14px',
                background: 'rgba(240,192,64,0.05)',
                border: '1px solid rgba(240,192,64,0.2)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 12
              }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.symbol}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{fmt(s.cramerValue)} ({s.cramerAllocationPct.toFixed(1)}%)</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AllocationBar({ pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}
