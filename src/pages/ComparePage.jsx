import { useState } from 'react'
import { usePortfolio } from '../lib/usePortfolio'
import { RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`
const fmtShares = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function ComparePage() {
  const { userCalc, cramerCalc, loadingPortfolio, loadingPrices, refreshPrices, prices } = usePortfolio()

  const [sortField, setSortField] = useState('cramerAlloc')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--gold)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--gold)' }} />
  }

  const SortTh = ({ field, label, style }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label} <SortIcon field={field} />
      </span>
    </th>
  )

  if (loadingPortfolio) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  )

  const userTotal = userCalc.totalValue
  const cramerTotal = cramerCalc.totalValue
  const diffDollars = userTotal - cramerTotal
  const diffPercent = cramerTotal > 0 ? ((userTotal - cramerTotal) / cramerTotal) * 100 : 0
  const userVsCramerPct = cramerTotal > 0 ? (userTotal / cramerTotal) * 100 : 0

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
    const cramerAllocationPct = cramerTotal > 0 ? (cramerValue / cramerTotal) * 100 : 0
    const userAllocationPct = userTotal > 0 ? (userValue / userTotal) * 100 : 0
    const effectiveUserTotal = userTotal > 0 ? userTotal : cramerTotal
    const targetValue = (cramerAllocationPct / 100) * effectiveUserTotal
    const targetShares = currentPrice > 0 ? targetValue / currentPrice : 0
    const sharesDiff = targetShares - userShares
    const dollarDiff = sharesDiff * currentPrice
    const allocDiff = userAllocationPct - cramerAllocationPct

    return {
      symbol: sym,
      companyName: priceInfo?.company_name || userHolding?.companyName || cramerHolding?.companyName || sym,
      currentPrice, userShares, cramerShares, userValue, cramerValue,
      cramerAllocationPct, userAllocationPct, allocDiff,
      targetShares, sharesDiff, dollarDiff,
      changePercent: priceInfo?.change_percent || 0,
      onlyUser: !cramerHolding,
      onlyCramer: !userHolding
    }
  })

  const sortedSymbolMap = [...symbolMap].sort((a, b) => {
    let aVal, bVal
    switch (sortField) {
      case 'symbol':
        return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      case 'price': aVal = a.currentPrice; bVal = b.currentPrice; break
      case 'userShares': aVal = a.userShares; bVal = b.userShares; break
      case 'userValue': aVal = a.userValue; bVal = b.userValue; break
      case 'userAlloc': aVal = a.userAllocationPct; bVal = b.userAllocationPct; break
      case 'cramerShares': aVal = a.cramerShares; bVal = b.cramerShares; break
      case 'cramerValue': aVal = a.cramerValue; bVal = b.cramerValue; break
      case 'cramerAlloc': aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct; break
      case 'allocDiff': aVal = a.allocDiff; bVal = b.allocDiff; break
      case 'sharesDiff': aVal = Math.abs(a.sharesDiff); bVal = Math.abs(b.sharesDiff); break
      case 'dollarDiff': aVal = Math.abs(a.dollarDiff); bVal = Math.abs(b.dollarDiff); break
      case 'change': aVal = a.changePercent; bVal = b.changePercent; break
      default: aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  const missingFromUser = symbolMap.filter(s => s.onlyCramer)

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">VS CRAMER</div>
          <div className="page-subtitle">Detailed comparison against Jim Cramer</div>
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

      {/* HEADLINE STATS */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className={`stat-card ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Performance vs Cramer</div>
          <div className={`stat-value ${diffDollars >= 0 ? 'positive' : 'negative'}`}>{fmtPct(diffPercent)}</div>
          <div className="stat-sub">{fmt(Math.abs(diffDollars))} {diffDollars >= 0 ? 'ahead' : 'behind'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Size vs Cramer's</div>
          <div className="stat-value gold">{cramerTotal > 0 ? `${userVsCramerPct.toFixed(1)}%` : '—'}</div>
          <div className="stat-sub">of his total portfolio value</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shared Holdings</div>
          <div className="stat-value">{symbolMap.filter(s => !s.onlyUser && !s.onlyCramer).length}</div>
          <div className="stat-sub">{missingFromUser.length} only Cramer's • {symbolMap.filter(s => s.onlyUser).length} only yours</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">$ To Match Cramer</div>
          <div className="stat-value">
            {cramerTotal > 0 && cramerTotal > userTotal ? fmt(cramerTotal - userTotal) : '—'}
          </div>
          <div className="stat-sub">total portfolio value gap</div>
        </div>
      </div>

      {/* MAIN ALLOCATION TABLE */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">📊 Portfolio Allocation Comparison</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Click headers to sort</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>■ You</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>■ Cramer</span>
          </div>
        </div>

        {sortedSymbolMap.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Nothing to compare yet</div>
            <div className="empty-desc">Add holdings to your portfolio and ensure Cramer's is configured</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh field="symbol" label="Symbol" />
                  <SortTh field="price" label="Price" />
                  <SortTh field="userShares" label="Your Shares" />
                  <SortTh field="userAlloc" label="Your Allocation" style={{ color: 'var(--blue)' }} />
                  <SortTh field="cramerShares" label="Cramer Shares" />
                  <SortTh field="cramerAlloc" label="Cramer Allocation" style={{ color: 'var(--gold)' }} />
                  <SortTh field="allocDiff" label="Alloc Diff" />
                  <SortTh field="sharesDiff" label="Shares to Buy/Sell" />
                  <SortTh field="dollarDiff" label="$ to Buy/Sell" />
                  <SortTh field="change" label="Day Chg" />
                </tr>
              </thead>
              <tbody>
                {sortedSymbolMap.map(s => {
                  const needsBuy = s.sharesDiff > 0.005
                  const needsSell = s.sharesDiff < -0.005
                  const isMatched = !needsBuy && !needsSell && !s.onlyCramer && !s.onlyUser

                  return (
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
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {s.userShares > 0 ? fmtShares(s.userShares) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {s.userAllocationPct > 0
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{s.userAllocationPct.toFixed(2)}%</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                        {s.cramerShares > 0 ? fmtShares(s.cramerShares) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {s.cramerAllocationPct > 0
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{s.cramerAllocationPct.toFixed(2)}%</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {s.userAllocationPct > 0 && s.cramerAllocationPct > 0
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: s.allocDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {s.allocDiff >= 0 ? '+' : ''}{s.allocDiff.toFixed(2)}%
                            </span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {s.onlyUser ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        ) : isMatched ? (
                          <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>✓ Matched</span>
                        ) : (
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: needsBuy ? 'var(--green)' : 'var(--red)' }}>
                              {needsBuy ? '+' : ''}{fmtShares(s.sharesDiff)} shares
                            </span>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                              {needsBuy ? 'BUY' : 'SELL'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {s.onlyUser ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        ) : isMatched ? (
                          <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>✓</span>
                        ) : (
                          <span className={`badge ${needsBuy ? 'badge-green' : 'badge-red'}`}>
                            {needsBuy ? '+' : '-'}{fmt(Math.abs(s.dollarDiff))}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`change-badge ${s.changePercent > 0 ? 'up' : s.changePercent < 0 ? 'down' : 'flat'}`}>
                          {s.changePercent >= 0 ? '▲' : '▼'}{Math.abs(s.changePercent).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
                borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12
              }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.symbol}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {fmt(s.cramerValue)} ({s.cramerAllocationPct.toFixed(2)}% of his portfolio)
                </div>
                <div style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2 }}>
                  Buy +{fmtShares(s.sharesDiff)} shares ({fmt(s.dollarDiff)})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
