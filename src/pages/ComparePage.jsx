import { useState } from 'react'
import { usePortfolio } from '../lib/usePortfolio'
import { RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`

export default function ComparePage() {
  const { userCalc, cramerCalc, loadingPortfolio, loadingPrices, refreshPrices, prices } = usePortfolio()

  const [sortField, setSortField] = useState('cramerAlloc')
  const [sortDir, setSortDir] = useState('desc')
  const [needsSortField, setNeedsSortField] = useState('dollarShortfall')
  const [needsSortDir, setNeedsSortDir] = useState('desc')

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleNeedsSort = (field) => {
    if (needsSortField === field) setNeedsSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setNeedsSortField(field); setNeedsSortDir('desc') }
  }

  const SortIcon = ({ field, activeField, activeDir }) => {
    if (activeField !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
    return activeDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--gold)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--gold)' }} />
  }

  const SortTh = ({ field, label, onSort, activeField, activeDir, style }) => (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
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
    const cramerAllocationPct = cramerTotal > 0 ? (cramerValue / cramerTotal) * 100 : 0
    const userAllocationPct = userTotal > 0 ? (userValue / userTotal) * 100 : 0
    const targetValueForUser = (cramerAllocationPct / 100) * userTotal
    const sharesNeededToMatch = currentPrice > 0 ? targetValueForUser / currentPrice : 0
    const sharesShortfall = Math.max(0, sharesNeededToMatch - userShares)
    const dollarShortfall = sharesShortfall * currentPrice
    const allocDiff = userAllocationPct - cramerAllocationPct

    return {
      symbol: sym,
      companyName: priceInfo?.company_name || userHolding?.companyName || cramerHolding?.companyName || sym,
      currentPrice,
      userShares, cramerShares, userValue, cramerValue,
      cramerAllocationPct, userAllocationPct, allocDiff,
      sharesNeededToMatch, sharesShortfall, dollarShortfall,
      changePercent: priceInfo?.change_percent || 0,
      onlyUser: !cramerHolding,
      onlyCramer: !userHolding
    }
  })

  const sortRows = (rows, field, dir) => [...rows].sort((a, b) => {
    let aVal, bVal
    switch (field) {
      case 'symbol':
        return dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      case 'price': aVal = a.currentPrice; bVal = b.currentPrice; break
      case 'userShares': aVal = a.userShares; bVal = b.userShares; break
      case 'userValue': aVal = a.userValue; bVal = b.userValue; break
      case 'userAlloc': aVal = a.userAllocationPct; bVal = b.userAllocationPct; break
      case 'cramerShares': aVal = a.cramerShares; bVal = b.cramerShares; break
      case 'cramerValue': aVal = a.cramerValue; bVal = b.cramerValue; break
      case 'cramerAlloc': aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct; break
      case 'allocDiff': aVal = a.allocDiff; bVal = b.allocDiff; break
      case 'change': aVal = a.changePercent; bVal = b.changePercent; break
      case 'dollarShortfall': aVal = a.dollarShortfall; bVal = b.dollarShortfall; break
      case 'sharesShortfall': aVal = a.sharesShortfall; bVal = b.sharesShortfall; break
      case 'sharesNeeded': aVal = a.sharesNeededToMatch; bVal = b.sharesNeededToMatch; break
      case 'cramerAllocNeeds': aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct; break
      default: aVal = a.cramerAllocationPct; bVal = b.cramerAllocationPct
    }
    return dir === 'asc' ? aVal - bVal : bVal - aVal
  })

  const sortedSymbolMap = sortRows(symbolMap, sortField, sortDir)
  const needToBuy = symbolMap.filter(s => !s.onlyUser && s.sharesShortfall > 0.001)
  const sortedNeedToBuy = sortRows(needToBuy, needsSortField, needsSortDir)
  const missingFromUser = symbolMap.filter(s => s.onlyCramer)

  // Max allocation for visual scaling
  const maxAlloc = Math.max(
    ...symbolMap.map(s => Math.max(s.userAllocationPct, s.cramerAllocationPct)),
    1
  )

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

      {/* ALLOCATION COMPARISON - THE MAIN VIEW */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">📊 Portfolio Allocation Comparison</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Click headers to sort</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--blue)', borderRadius: 2 }} /> You
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--gold)', borderRadius: 2 }} /> Cramer
            </span>
          </div>
        </div>

        {sortedSymbolMap.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Nothing to compare yet</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh field="symbol" label="Symbol" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="price" label="Price" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="userAlloc" label="Your %" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--blue)' }} />
                <th style={{ color: 'var(--blue)', minWidth: 120 }}>Your Allocation</th>
                <SortTh field="cramerAlloc" label="Cramer %" onSort={handleSort} activeField={sortField} activeDir={sortDir} style={{ color: 'var(--gold)' }} />
                <th style={{ color: 'var(--gold)', minWidth: 120 }}>Cramer Allocation</th>
                <SortTh field="allocDiff" label="Difference" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="userValue" label="Your Value" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
                <SortTh field="cramerValue" label="Cramer Value" onSort={handleSort} activeField={sortField} activeDir={sortDir} />
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

                  {/* YOUR % */}
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: s.onlyCramer ? 'var(--text-muted)' : 'var(--blue)' }}>
                    {s.userAllocationPct > 0 ? `${s.userAllocationPct.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <AllocBar pct={s.userAllocationPct} maxPct={maxAlloc} color="var(--blue)" />
                  </td>

                  {/* CRAMER % */}
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: s.onlyUser ? 'var(--text-muted)' : 'var(--gold)' }}>
                    {s.cramerAllocationPct > 0 ? `${s.cramerAllocationPct.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <AllocBar pct={s.cramerAllocationPct} maxPct={maxAlloc} color="var(--gold)" />
                  </td>

                  {/* DIFFERENCE */}
                  <td>
                    {s.userAllocationPct > 0 && s.cramerAllocationPct > 0 ? (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                        color: s.allocDiff >= 0 ? 'var(--green)' : 'var(--red)'
                      }}>
                        {s.allocDiff >= 0 ? '+' : ''}{s.allocDiff.toFixed(2)}%
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </td>

                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--blue)' }}>
                    {s.userValue > 0 ? fmt(s.userValue) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                    {s.cramerValue > 0 ? fmt(s.cramerValue) : '—'}
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

      {/* SHARES NEEDED TABLE */}
      {sortedNeedToBuy.length > 0 && (
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">🛒 Shares Needed to Match Cramer's Allocation</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Click headers to sort</span>
              <span className="badge badge-gold">{sortedNeedToBuy.length} adjustments</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Shares needed to match Cramer's percentage allocation, scaled to your portfolio size.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh field="symbol" label="Symbol" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="userShares" label="Your Shares" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} />
                <SortTh field="userAlloc" label="Your %" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} style={{ color: 'var(--blue)' }} />
                <SortTh field="cramerAllocNeeds" label="Cramer %" onSort={handleNeedsSort} activeField={needsSortField} activeDir={needsSortDir} style={{ color: 'var(--gold)' }} />
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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--blue)', width: 44 }}>
                        {s.userAllocationPct.toFixed(2)}%
                      </span>
                      <AllocBar pct={s.userAllocationPct} maxPct={maxAlloc} color="var(--blue)" width={60} />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold)', width: 44 }}>
                        {s.cramerAllocationPct.toFixed(2)}%
                      </span>
                      <AllocBar pct={s.cramerAllocationPct} maxPct={maxAlloc} color="var(--gold)" width={60} />
                    </div>
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
                  {fmt(s.cramerValue)} ({s.cramerAllocationPct.toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AllocBar({ pct, maxPct, color, width = 80 }) {
  const fillPct = maxPct > 0 ? (pct / maxPct) * 100 : 0
  return (
    <div style={{ width, height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{
        width: `${Math.min(fillPct, 100)}%`,
        height: '100%',
        background: color,
        borderRadius: 4,
        transition: 'width 0.4s ease'
      }} />
    </div>
  )
}
