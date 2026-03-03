import { useState } from 'react'
import { usePortfolio } from '../lib/usePortfolio'
import { RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`

export default function ComparePage() {
  const { userCalc, cramerCalc, loadingPortfolio, loadingPrices, refreshPrices, prices } = usePortfolio()

  const [sortField, setSortField] = useState('cramerValue')
  const [sortDir, setSortDir] = useState('desc')
  const [needsSortField, setNeedsSortField] = useState('dollarShortfall')
  const [needsSortDir, setNeedsSortDir] = useState('desc')

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleNeedsSort = (field) => {
    if (needsSortField === field) {
      setNeedsSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setNeedsSortField(field)
      setNeedsSortDir('desc')
    }
  }

  const SortIcon = ({ field, activeField, activeDir }) => {
    if (activeField !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
    return activeDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--gold)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--gold)' }} />
  }

  const SortTh = ({ field, label, onSort, activeField, activeDir, style }) => (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label} <SortIcon field={field} activeField={activeField} activeDir={activeDir} />
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
  })

  // Sort full comparison table
  const sortedSymbolMap = [...symbolMap].sort((a, b) => {
    let aVal, bVal
    switch (sortField) {
      case 'symbol':
        return sortDir === 'asc'
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol)
      case 'price': aVal = a.currentPrice; bVal = b.currentPrice; break
      case 'userShares': aVal = a.userShares; bVal = b.userShares; break
      case 'userValue': aVal = a.userValue; bVal = b.userValue; break
      case 'userAlloc': aVal = a.userAllocationPct; bVal = b.userAllocationPct; break
      case 'cramerShares': aVal = a.cramerShares; bVal = b.cramerShares; break
      case 'cramerValue': aVal = a.cramerValue; bVal = b.cramerValue; break
      case 'cramerAlloc': aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct; break
      case 'change': aVal = a.changePercent; bVal = b.changePercent; break
      default: aVal = a.cramerValue; bVal = b.cramerValue
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Sort "shares needed" table
  const needToBuy = symbolMap.filter(s => !s.onlyUser && s.sharesShortfall > 0.001)
  const sortedNeedToBuy = [...needToBuy].sort((a, b) => {
    let aVal, bVal
    switch (needsSortField) {
      case 'symbol':
        return needsSortDir === 'asc'
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol)
      case 'userShares': aVal = a.userShares; bVal = b.userShares; break
      case 'cramerShares': aVal = a.cramerShares; bVal = b.cramerShares; break
      case 'cramerAlloc': aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct; break
      case 'sharesNeeded': aVal = a.sharesNeededToMatch; bVal = b.sharesNeededToMatch; break
      case 'sharesShortfall': aVal = a.sharesShortfall; bVal = b.sharesShortfall; break
      case 'dollarShortfall': aVal = a.dollarShortfall; bVal = b.dollarShortfall; break
      default: aVal = a.dollarShortfall; bVal = b.dollarShortfall
    }
    return needsSortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

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

      {/* HEADLINE STATS */}
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
            {cramerTotal > 0 ? `${userVsCramerPct.toFixed(1)}%` : '—'}
          </div>
          <div className="stat-sub">of his total portfolio value</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shared Holdings</div>
          <div className="stat-value">{symbolMap.filter(s => !s.onlyUser && !s.onlyCramer).length}</div>
          <div className="stat-sub">
            {missingFromUser.length} only Cramer's • {symbolMap.filter(s => s.onlyUser).length} only yours
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

      {/* SHARES NEEDED TABLE */}
      {sortedNeedToBuy.length > 0 && (
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">📊 Shares Needed to Match Cramer's Allocation</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                Click headers to sort
              </span>
              <span className="badge badge-gold">{sortedNeedToBuy.length} adjustments</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Based on matching Cramer's percentage allocation per stock, scaled to your portfolio size.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh field="symbol" label="Symbol" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="userShares" label="Your Shares" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="cramerShares" label="Cramer Shares" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="cramerAlloc" label="Cramer %" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="sharesNeeded" label="Target Shares" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="sharesShortfall" label="Need to Buy" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="dollarShortfall" label="$ to Buy" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
              </tr>
            </thead>
            <tbody>
              {sortedNeedToBuy.map(s => (
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
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
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

      {/* FULL COMPARISON TABLE */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">Full Portfolio Comparison</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              Click headers to sort
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>■ You ({fmt(userTotal)})</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)' }}>■ Cramer ({fmt(cramerTotal)})</span>
          </div>
        </div>

        {sortedSymbolMap.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Nothing to compare yet</div>
            <div className="empty-desc">Add holdings to your portfolio and ensure Cramer's is configured</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh field="symbol" label="Symbol" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="price" label="Price" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="userShares" label="Your Shares" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--blue)' }} />
                <SortTh field="userValue" label="Your Value" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--blue)' }} />
                <SortTh field="userAlloc" label="Your %" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--blue)' }} />
                <SortTh field="cramerShares" label="Cramer Shares" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--gold)' }} />
                <SortTh field="cramerValue" label="Cramer Value" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--gold)' }} />
                <SortTh field="cramerAlloc" label="Cramer %" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--gold)' }} />
                <SortTh field="change" label="Day Chg" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
              </tr>
            </thead>
            <tbody>
              {sortedSymbolMap.map(s => (
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
                    {s.userAllocationPct > 0
                      ? <AllocationBar pct={s.userAllocationPct} color="var(--blue)" />
                      : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: s.onlyUser ? 'var(--text-muted)' : 'var(--gold)' }}>
                    {s.cramerShares > 0 ? s.cramerShares.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                    {s.cramerValue > 0 ? fmt(s.cramerValue) : '—'}
                  </td>
                  <td>
                    {s.cramerAllocationPct > 0
                      ? <AllocationBar pct={s.cramerAllocationPct} color="var(--gold)" />
                      : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
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
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {fmt(s.cramerValue)} ({s.cramerAllocationPct.toFixed(1)}%)
                </div>
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
